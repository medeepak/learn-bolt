'use server'

import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function generateLearningPlan(formData: FormData) {
    console.log('[Server] generateLearningPlan called')
    console.log('[Server] FormData keys:', Array.from(formData.keys()))

    const topic = formData.get('topic') as string
    const urgency = formData.get('urgency') as string
    const level = formData.get('level') as string
    const language = formData.get('language') as string
    const document = formData.get('document')

    console.log('[Server] document from FormData:', document ? `${typeof document}, name: ${(document as any).name}` : 'NULL')

    if (!topic) {
        throw new Error('Topic is required')
    }

    // Store PDF as base64 to send directly to OpenAI (instead of parsing ourselves)
    let pdfBase64 = ''
    if (document && document instanceof File) {
        console.log(`[PDF] Received document: ${document.name}, size: ${document.size} bytes, type: ${document.type}`)
        try {
            const arrayBuffer = await document.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            pdfBase64 = buffer.toString('base64')
            console.log(`[PDF] Converted to base64, length: ${pdfBase64.length}`)
        } catch (e: any) {
            console.error('[PDF] Failed to convert to base64:', e.message)
        }
    } else {
        console.log(`[PDF] No document provided in form data`)
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // NOTE: We now allow guests (user is optional)

    // 1. Create the Plan Structure in DB immediately (Fast)
    console.log("Step 1: Creating initial plan for:", topic, pdfBase64 ? `(with PDF, ${pdfBase64.length} chars base64)` : '')
    const { data: plan, error: planError } = await supabase
        .from('learning_plans')
        .insert({
            user_id: user?.id || null,
            topic,
            urgency,
            level,
            language,
            status: 'generating', // Initial status
            next_steps: [],
            document_context: pdfBase64 || null  // Store PDF as base64 in DB
        })
        .select()
        .single()

    if (planError) {
        console.error("DB Plan Error", planError)
        throw new Error("Failed to init plan")
    }

    return { success: true, planId: plan.id }
}

export async function generatePlanContent(planId: string) {
    const supabase = await createClient()

    // Fetch plan details to get context (including document_context from DB)
    const { data: plan } = await supabase.from('learning_plans').select('*').eq('id', planId).single()
    if (!plan) throw new Error("Plan not found")

    const { topic, urgency, level, language, document_context } = plan
    const pdfBase64 = document_context as string | null

    console.log("Step 2: Generating content for Plan ID:", planId, pdfBase64 ? `(with PDF, ${pdfBase64.length} chars base64)` : '(no document)')

    // Build prompt based on whether document is provided
    let systemPrompt = "You are a strict, no-nonsense teacher. Output valid JSON."
    let userPrompt: string

    if (pdfBase64) {
        // DOCUMENT-BASED: The PDF is the PRIMARY source for the curriculum
        userPrompt = `
    Analyze the attached PDF document and create a learning plan based on its contents.
    
    The user entered: "${topic}"
    IMPORTANT: If the user says something like "explain this PDF", "explain the document", "summarize this", or similar generic phrases,
    they want you to explain THE CONTENTS of the attached PDF - NOT what PDF files are in general.
    Focus entirely on the ACTUAL CONTENT of this specific document.
    
    Your task: Create a structured learning curriculum that teaches the key concepts found IN THIS DOCUMENT.
    The chapters should extract and teach what's actually written in the document, organized in a logical learning sequence.
    DO NOT create chapters about file formats, document types, or generic topics - only teach the specific content from this document.
    
    Context:
    - Urgency: ${urgency}
    - Level: ${level}
    - Language: English
    
    Output a JSON object with:
    1. "curriculum_strategy": 2-sentence explanation of how you structured the learning path from this document's content.
    2. "chapters": 5-7 chapters covering the document's key concepts in a logical learning order.
    3. "next_steps": 3-4 concrete follow-up topics based on what's in the document.
    
    Each chapter MUST have:
    - title: string (Action-oriented, derived from document content)
    - mental_model: string (A strong analogy to explain the concept)
    - key_takeaway: string (One high-value insight from the document)
    
    Structure:
    {
      "curriculum_strategy": "...",
      "chapters": [{ "title": "...", "mental_model": "...", "key_takeaway": "..." }],
      "next_steps": ["..."]
    }
  `
    } else {
        // TOPIC-BASED: No document, generate from topic alone
        userPrompt = `
    You are an expert curriculum designer.
    ref: "Think First" - Before generating, determine the "Critical Path" to understanding this topic.
    
    Create a learning plan for: "${topic}"

    Context:
    - Urgency: ${urgency}
    - Level: ${level}
    - Language: English

    Goal: The user must understand the *Broad Concepts* and the *Specific Mechanics*. 
    
    Output a JSON object with:
    1. "curriculum_strategy": A 2-sentence explanation of why you chose this specific path.
    2. "chapters": A list of 5-7 items.
    3. "next_steps": A list of 3–4 concrete follow-up topics.

    Each chapter MUST have:
    - title: string (Action-oriented)
    - mental_model: string (A strong analogy)
    - key_takeaway: string (One high-value insight)

    Structure:
    {
      "curriculum_strategy": "...",
      "chapters": [{ "title": "...", "mental_model": "...", "key_takeaway": "..." }],
      "next_steps": ["..."]
    }
  `
    }

    // Build messages - include PDF as file if present
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [
        { role: "system", content: systemPrompt }
    ]

    if (pdfBase64) {
        // Send PDF as file attachment to OpenAI
        messages.push({
            role: "user",
            content: [
                {
                    type: "file",
                    file: {
                        filename: "document.pdf",
                        file_data: `data:application/pdf;base64,${pdfBase64}`
                    }
                },
                {
                    type: "text",
                    text: userPrompt
                }
            ]
        })
    } else {
        messages.push({ role: "user", content: userPrompt })
    }

    const completion = await openai.chat.completions.create({
        messages,
        model: "gpt-4o",
        response_format: { type: "json_object" },
    });
    console.log("OpenAI Response received for:", topic)

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("Failed to generate content");

    let parsedData;
    try {
        parsedData = JSON.parse(content);
    } catch (e) {
        console.error("JSON Parse Error", e);
        throw new Error("AI generated invalid JSON");
    }

    // 2. Translation Step (if needed)
    if (language && language.toLowerCase() !== 'english') {
        parsedData = await translateContent(parsedData, language);
    }

    if (!parsedData.chapters || !Array.isArray(parsedData.chapters)) {
        console.error("Invalid Structure", parsedData)
        throw new Error("AI generated invalid JSON structure: missing chapters")
    }

    // 3. Save Chapters (Outline Only)
    const chaptersToInsert = parsedData.chapters.map((ch: any, index: number) => ({
        plan_id: plan.id,
        title: ch.title,
        mental_model: ch.mental_model,
        explanation: "", // To be filled later
        common_misconception: "",
        real_world_example: "",
        quiz_question: "",
        quiz_answer: "",
        visual_type: "text", // Default
        visual_content: "Content loading...",
        key_takeaway: ch.key_takeaway,
        order: index + 1,
        is_completed: false
    }))

    const { error: chapterError } = await supabase
        .from('chapters')
        .insert(chaptersToInsert)

    if (chapterError) {
        console.error("DB Chapter Error", chapterError)
        throw new Error("Failed to save chapters")
    }

    // 4. Update Plan Status
    await supabase.from('learning_plans').update({
        status: 'generated',
        next_steps: parsedData.next_steps || []
    }).eq('id', planId)

    revalidatePath(`/plan/${planId}`, 'page')
    return { success: true }
}

// Step 1: Generate English Content (Logic)
export async function generateEnglishContent(chapterId: string) {
    const supabase = await createClient()

    // Fetch Chapter and Plan context
    const { data: chapter } = await supabase.from('chapters').select('*, learning_plans(*)').eq('id', chapterId).single()
    if (!chapter) throw new Error("Chapter not found")

    const plan = chapter.learning_plans
    const { topic, level } = plan // Note: We IGNORE plan.language here, forcing English

    console.log(`[Server] Step 1: Generating English detail for chapter ID: ${chapterId}`)

    const prompt = `
    Write the detailed content for this chapter of a "${topic}" course.
    
    Chapter Title: "${chapter.title}"
    Mental Model: "${chapter.mental_model}"
    
    Context:
    - Level: ${level}
    - Language: English (STRICTLY ENGLISH)

    Instruction:
    - Be concrete. Use specific examples.
    - Explain the MECHANISM (How it works).
    - Explanation should be 5-8 lines.
    - For visual_type: MUST be one of "image", "mermaid", or "react" (table).
      - Use "image" for concepts that benefit from an illustration.
      - Use "mermaid" for processes, flows, or hierarchies. Provide valid Mermaid diagram code.
      - Use "react" for comparisons or data that fits a table. Provide JSON array.
    - For visual_content: Provide the content matching the visual_type.
      - If "image": a detailed prompt describing the illustration.
      - If "mermaid": valid Mermaid diagram code.
      - If "react": JSON array for table data.

    Structure JSON:
    {
       "explanation": "...",
       "common_misconception": "...",
       "real_world_example": "...",
       "quiz_question": "...",
       "quiz_answer": "...",
       "visual_type": "image" | "mermaid" | "react",
       "visual_content": "..."
    }
    `

    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are an expert tutor. Output valid JSON." },
            { role: "user", content: prompt }
        ],
        model: "gpt-4o",
        response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("Empty content from OpenAI");

    let parsedData;
    try {
        parsedData = JSON.parse(content);
        if (!parsedData.explanation || parsedData.explanation.length < 50) {
            throw new Error("AI returned explanation too short")
        }
    } catch (e) {
        console.error("JSON Parse Error", e)
        throw new Error("Invalid JSON from AI")
    }

    // Save English Content
    const { error } = await supabase.from('chapters').update({
        explanation: parsedData.explanation,
        common_misconception: parsedData.common_misconception,
        real_world_example: parsedData.real_world_example,
        quiz_question: parsedData.quiz_question,
        quiz_answer: parsedData.quiz_answer,
        visual_type: parsedData.visual_type,
        visual_content: typeof parsedData.visual_content === 'string' ? parsedData.visual_content : JSON.stringify(parsedData.visual_content)
    }).eq('id', chapterId)

    if (error) throw new Error("Failed to save English content")

    if (error) throw new Error("Failed to save English content")

    revalidatePath(`/plan/${plan.id}`, 'page')
    return { success: true, data: parsedData }
}

// Step 2: Translate Content (Localization)
export async function translateChapterContent(chapterId: string) {
    const supabase = await createClient()

    const { data: chapter } = await supabase.from('chapters').select('*, learning_plans(*)').eq('id', chapterId).single()
    if (!chapter) throw new Error("Chapter not found")

    const targetLang = chapter.learning_plans.language
    if (!targetLang || targetLang.toLowerCase() === 'english') {
        return { success: true, skipped: true }
    }

    console.log(`[Server] Step 2: Translating chapter ${chapterId} to ${targetLang}`)

    const currentContent = {
        explanation: chapter.explanation,
        common_misconception: chapter.common_misconception,
        real_world_example: chapter.real_world_example,
        quiz_question: chapter.quiz_question,
        quiz_answer: chapter.quiz_answer,
        visual_type: chapter.visual_type,
        visual_content: chapter.visual_content // Usually kept as is, but good to include context
    }

    const translatedData = await translateContent(currentContent, targetLang)

    // Update with Translated Content
    const { error } = await supabase.from('chapters').update({
        explanation: translatedData.explanation,
        common_misconception: translatedData.common_misconception,
        real_world_example: translatedData.real_world_example,
        quiz_question: translatedData.quiz_question,
        quiz_answer: translatedData.quiz_answer,
        // visual_type and visual_content usually don't need translation updates unless text-heavy
    }).eq('id', chapterId)

    if (error) throw new Error("Failed to save translation")

    revalidatePath(`/plan/${chapter.learning_plans.id}`, 'page')
    return { success: true, data: translatedData }
}

// Helper: Translate JSON Content
async function translateContent(data: any, targetLang: string) {
    console.log(`Translating content to ${targetLang}...`);

    const prompt = `
    Translate the values in this JSON object to ${targetLang}.
    
    Rules:
    - **Conversational Tone**: Use natural, spoken ${targetLang}.
    - **Technical Terms**: KEEP IN ENGLISH. Do not translate "Quantum Physics", "API", "Engine", etc.
    - **Precision**: Keep the exact meaning of the English source.
    
    Input JSON:
    ${JSON.stringify(data, null, 2)}
    
    Output ONLY valid JSON.
    `

    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a professional translator. You preserve English technical terms." },
            { role: "user", content: prompt }
        ],
        model: "gpt-4o",
        response_format: { type: "json_object" },
    });

    const translated = completion.choices[0].message.content;
    return JSON.parse(translated || "{}");
}
