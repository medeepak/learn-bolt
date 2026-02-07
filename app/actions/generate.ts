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
        // DOCUMENT-BASED: The PDF is the PRIMARY source
        userPrompt = `
    Analyze the attached PDF document carefully.

    The user entered: "${topic}"

    ═══════════════════════════════════════════════════════════════
    INTENT DETECTION (choose EXACTLY ONE - this determines everything)
    ═══════════════════════════════════════════════════════════════
    
    SOLVING - User wants you to DO THE WORK and produce a deliverable:
    Keywords: "solve", "answer", "calculate", "complete", "write", "do", "finish", "assignment", "homework", "help me with", "work on"
    Examples: "Solve this problem", "Complete this assignment", "Write an essay on...", "Calculate the revenue"
    
    PREPARING - User wants quick revision/summary for test/interview:
    Keywords: "prepare", "revise", "interview", "exam", "test", "review", "remember", "cram", "last minute", "key points"
    Examples: "Prepare for interview", "Revise for exam", "What to remember for test"
    
    LEARNING - User wants to UNDERSTAND concepts (default):
    Keywords: "explain", "teach", "understand", "what is", "how does", "why", "learn about"
    Examples: "Explain machine learning", "Teach me about...", "What is quantum physics"
    
    DECISION RULES:
    1. If the PDF contains problems/questions/assignments → SOLVING
    2. If user says "solve", "answer", "complete", "write", "do this" → SOLVING
    3. If user mentions exam/interview/test/revision → PREPARING
    4. If unsure between SOLVING and LEARNING → choose SOLVING (it's more actionable)
    5. Only choose LEARNING if user explicitly wants to understand/learn concepts
    
    Do NOT mix intents. The detected intent controls ALL subsequent output.

    CRITICAL: Generate mini-chapters tailored to the intent using ONLY information from the PDF.
    - If the PDF does not contain enough information to fully satisfy the request, still produce the best possible chapters from what exists in the PDF, and note missing info in "next_steps".

    IF LEARNING:
    - Each chapter teaches ONE concept from the document
    - Simple language, bite-sized learning
    - Each chapter continues from where the previous left off (logical progression, no jumps)
    - Include visual cues (diagrams, examples)
    - Focus on understanding the "why" and "how"

    IF SOLVING OR WRITING AN ASSIGNMENT:
    ⚠️ CRITICAL: You are NOT making a plan. You ARE writing the actual assignment submission.
    - Each chapter = ONE COMPLETED SECTION of the assignment answer
    - key_takeaway = THE ACTUAL WRITTEN CONTENT that would be submitted (not a description of what to write)
    
    WRONG vs RIGHT examples:
    
    Math/Calculation:
    - WRONG: "Calculate the total cost"
    - RIGHT: "Total cost = $150 + $75 + $25 = $250"
    
    Business/Product:
    - WRONG: "Develop a solution to improve the completion rate"
    - RIGHT: "Solution: Implement 'Long Trip Bonus' - drivers receive 1.5x surge on trips >50 miles, shown upfront before accepting"
    
    Analysis:
    - WRONG: "Analyze the market data and identify trends"
    - RIGHT: "Market analysis: Long-distance trips grew 23% YoY. Key insight: 68% of cancellations occur within 5 mins of request, suggesting driver hesitancy, not rider issues."
    
    Design/Product:
    - WRONG: "Design a feature to address user needs"
    - RIGHT: "Feature: 'Trip Preview' screen showing exact route, estimated earnings, and break stops. Mockup: [description of UI elements]"
    
    Write the actual answer, not what the answer should contain.

    IF PREPARING:
    - Each chapter = One key point to remember
    - Quick, memorable, last-minute revision format
    - Focus on "what to remember" not "how to understand"
    - Include mnemonics, quick facts, common mistakes to avoid
    - Each chapter continues where previous left off (structured coverage, no repetition)

    Context:
    - Urgency: ${urgency}
    - Level: ${level}
    - Language: English (simple terms)

    OUTPUT QUALITY RULES:
    - Keep chapter titles short and specific.
    - Ensure every chapter has a distinct "mental_model" (analogy/approach/memory trick depending on intent).
    - Keep "key_takeaway" to 1–2 sentences max, but dense and specific.
    - "curriculum_strategy" must be exactly 2 sentences, describing how you chose the chapter sequence and how it fits the intent.
    - "next_steps" must be actionable and specific (3–7 items).

    Output JSON (valid JSON only, no extra text):
    {
    "intent": "learning" | "solving" | "preparing",
    "curriculum_strategy": "2-sentence approach explanation",
    "chapters": [{ "title": "...", "mental_model": "...", "key_takeaway": "..." }],
    "next_steps": ["..."]
    }

    Chapter fields based on intent:
    - LEARNING: title=concept, mental_model=analogy, key_takeaway=key insight
    - SOLVING: title=step description, mental_model=approach used, key_takeaway=ACTUAL RESULT
    - PREPARING: title=topic to remember, mental_model=memory trick, key_takeaway=key fact
  `
    } else {
        // TOPIC-BASED: No document, generate from topic alone
        userPrompt = `
    You are an expert at helping people learn, solve problems, and prepare for challenges.

    The user entered: "${topic}"

    ═══════════════════════════════════════════════════════════════
    INTENT DETECTION (choose EXACTLY ONE - this determines everything)
    ═══════════════════════════════════════════════════════════════
    
    SOLVING - User wants you to DO THE WORK:
    Keywords: "solve", "answer", "calculate", "complete", "write", "do", "finish", "build", "create", "fix", "how to"
    Examples: "Solve this", "How to build a website", "Write a function for..."
    
    PREPARING - User wants quick revision for test/interview:
    Keywords: "prepare", "revise", "interview", "exam", "test", "review", "remember", "cram"
    Examples: "Prepare for JavaScript interview", "Revise data structures for exam"
    
    LEARNING - User wants to UNDERSTAND concepts:
    Keywords: "explain", "teach", "understand", "what is", "how does", "why", "learn about"
    Examples: "Explain machine learning", "What is blockchain"
    
    DECISION RULES:
    1. "How to" questions → SOLVING (user wants the actual steps done)
    2. Build/create/write requests → SOLVING
    3. Interview/exam/test mentioned → PREPARING
    4. If unsure between SOLVING and LEARNING → choose SOLVING
    5. Only LEARNING if explicitly asking to understand concepts
    
    Do NOT mix intents. The detected intent controls ALL output.

    Generate mini-chapters tailored to the intent:

    IF LEARNING:
    - Bite-sized chapters that teach ONE concept at a time
    - Chapters must progress logically, each continuing from where the previous left off
    - Use simple language and intuitive visual cues
    - Focus on explaining the “how” and “why” of the concept

    IF SOLVING OR WRITING AN ASSIGNMENT:
    ⚠️ CRITICAL: You are NOT giving instructions. You ARE doing the work.
    - Each chapter = ONE COMPLETED SECTION of the final answer
    - Chapter title = Section heading (e.g., "Introduction", "Analysis", "Result")
    - key_takeaway = THE ACTUAL WRITTEN CONTENT (the text, calculation, or answer)
    - WRONG: "In this step, analyze the data using regression"
    - RIGHT: "The regression analysis shows y = 2.3x + 4.5, with R² = 0.89"
    - WRONG: "Calculate the total cost"
    - RIGHT: "Total cost = $150 + $75 + $25 = $250"
    - Output should be copy-paste ready for submission

    IF PREPARING:
    - Each chapter is a high-signal revision point
    - No deep explanations — only what is essential to remember
    - Use memorable takeaways, mnemonics, formulas, and common mistakes
    - Focus on recall speed and accuracy, not conceptual depth

    NOTE:
    - Ponder deeply about the problem, research well and come with a solid plan

    Context:
    - Urgency: ${urgency}
    - Level: ${level}
    - Language: English (simple, clear terms)
    
    Output JSON:
    {
      "intent": "learning" | "solving" | "preparing",
      "curriculum_strategy": "2-sentence approach",
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
        model: "gpt-5-nano",
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
    Generate detailed content for this mini-chapter of a "${topic}" course.

    Chapter Title: "${chapter.title}"
    Mental Model: "${chapter.mental_model}"

    FIRST, determine the user's INTENT from the topic:
    - LEARNING: User wants to understand concepts → Explain the mechanism (how and why it works)
    - SOLVING: User wants a problem solved → Perform the work and produce the result
    - PREPARING: User is revising for a test/interview → Focus on recall, patterns, and mistakes

    Context:
    - Level: ${level}
    - Language: English (simple, direct, unambiguous terms)

    GENERATE CONTENT BASED ON INTENT (STRICTLY FOLLOW ONLY THE MATCHING SECTION):

    IF LEARNING:
    - explanation: Explain HOW the concept works internally (5–8 concise lines, no fluff)
    - common_misconception: What beginners typically misunderstand or confuse
    - real_world_example: A concrete, relatable example using numbers, objects, or situations
    - quiz_question / quiz_answer: Test conceptual understanding (not memorization)

    IF SOLVING OR WRITING AN ASSIGNMENT:
    ⚠️ YOU ARE DOING THE WORK, NOT EXPLAINING HOW TO DO IT.
    - explanation: THE ACTUAL COMPLETED WORK for this section. Write the final answer as it would be submitted.
      - WRONG: "To solve this, first identify the variables, then apply the formula"
      - RIGHT: "Given x = 5 and y = 3, the result is x + 2y = 5 + 6 = 11"
      - WRONG: "Analyze the market conditions and write your recommendation"  
      - RIGHT: "Based on the Q3 data showing 15% growth, I recommend increasing marketing spend by $50,000"
    - common_misconception: Common mistakes in the final output
    - real_world_example: THE EXACT OUTPUT (number, formula with values, written paragraph)
    - quiz_question / quiz_answer: Verify the result is correct
    - Write as if copying directly into homework. NO theory. NO advice. JUST THE ANSWER.

    IF PREPARING:
    - explanation: High-signal revision points only (formulas, rules, shortcuts, mnemonics). Bullet-style preferred.
    - common_misconception: Common exam/interview traps to avoid
    - real_world_example: A quick sample question and answer in way to present it
    - quiz_question / quiz_answer: Quick recall or elimination-based question

    Visual type (choose ONE):
    - "image": For concepts or final solutions that benefit from visual intuition
    - "mermaid": For processes, flows, decision paths, or hierarchies (valid Mermaid code only)
    - "react": For comparisons or structured data (valid JSON array only)

    The visual must reinforce the detected intent (not distract from it).

    
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
        model: "gpt-5-nano",
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
        model: "gpt-5-nano",
        response_format: { type: "json_object" },
    });

    const translated = completion.choices[0].message.content;
    return JSON.parse(translated || "{}");
}
