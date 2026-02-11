'use server'

import { createClient } from '@/lib/supabase/server'
import { generateAICompletion, getAIProvider, type AIMessage } from '@/lib/ai-client'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// Allow up to 5 minutes for generation (if platform permits, otherwise cap at 60s for Hobby)
// Note: maxDuration cannot be exported here in "use server" files. It must be in the Page/Route.


export async function generateLearningPlan(formData: FormData) {
    console.log('[Server] generateLearningPlan called')
    console.log('[Server] FormData keys:', Array.from(formData.keys()))

    const topic = formData.get('topic') as string
    const urgency = formData.get('urgency') as string
    const level = formData.get('level') as string
    const language = formData.get('language') as string
    const mode = (formData.get('mode') as string) || 'standard'
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
    console.log("Step 1: Creating initial plan for:", topic, `Mode: ${mode}`, pdfBase64 ? `(with PDF, ${pdfBase64.length} chars base64)` : '')
    const { data: plan, error: planError } = await supabase
        .from('learning_plans')
        .insert({
            user_id: user?.id || null,
            topic,
            urgency,
            level,
            language,
            mode,
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

    const { topic, urgency, level, language, document_context, mode } = plan
    const pdfBase64 = document_context as string | null

    // IDEMPOTENCY CHECK: If chapters already exist, don't re-generate.
    // This handles race conditions where the client might trigger this multiple times,
    // or if the plan was generated but status update failed.
    const { count: existingChapterCount } = await supabase
        .from('chapters')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', planId)

    if (existingChapterCount && existingChapterCount > 0) {
        console.log(`[Server] Plan ${planId} already has ${existingChapterCount} chapters. Skipping generation.`);
        // Ensure status is correct just in case
        if (plan.status !== 'structure_ready' && plan.status !== 'generated') {
            await supabase.from('learning_plans').update({ status: 'structure_ready' }).eq('id', planId)
        }
        return { success: true, message: 'Plan already generated' }
    }

    console.log("Step 2: Generating CURRICULUM STRUCTURE for Plan ID:", planId, `Mode: ${mode}`, pdfBase64 ? `(with PDF, ${pdfBase64.length} chars base64)` : '(no document)')

    // Build prompt based on whether document is provided
    let systemPrompt = "You are a curriculum architect. Output valid JSON."
    let userPrompt: string

    if (mode === 'story') {
        systemPrompt = "You are a master storyteller. Output valid JSON."
        userPrompt = `
    Create a captivating visual story outline about: "${topic}"
    
    Target Audience: ${level} level
    Language: ${language}
    
    Requirements:
    1. Create a continuous narrative split into 10-12 mini-chapters (scenes).
    2. Define the ARC of the story.
    3. DO NOT write the full story text yet. Just the titles and setting.
    
    Output JSON format:
    {
      "intent": "story",
      "curriculum_strategy": "Briefly describe the narrative arc.",
      "chapters": [
        {
          "title": "Scene 1 Title",
          "mental_model": "Scene Setting (Time/Place)", 
          "key_takeaway": "Plot Point / Core Concept to be covered"
        }
      ],
      "next_steps": ["Related stories", "Advanced topics"]
    }
         `
    } else if (pdfBase64) {
        // DOCUMENT-BASED: The PDF is the PRIMARY source
        userPrompt = `
    Analyze the attached PDF document to create a Learning Path Outline.
    
    The user entered: "${topic}"
    
    INTENT DETECTION (choose EXACTLY ONE):
    - LEARNING: User wants to understand concepts (default)
    - SOLVING: User wants a problem solved/assignment done
    - PREPARING: User wants quick revision
    
    CRITICAL: Generate a sequence of 10-12 mini-chapters.
    - DO NOT generate the full content. Just the structure.
    - Each chapter must have a clear "title" and "mental_model" (concept/approach).
    
    Output JSON (valid JSON only):
    {
    "intent": "learning" | "solving" | "preparing",
    "curriculum_strategy": "2-sentence approach explanation",
    "chapters": [{ "title": "...", "mental_model": "...", "key_takeaway": "Brief objective of this chapter" }],
    "next_steps": ["..."]
    }
  `
    } else {
        // TOPIC-BASED: No document, generate from topic alone
        userPrompt = `
    You are an expert curriculum designer.
    
    The user entered: "${topic}"
    
    Create a 10-12 step Learning Path Outline.
    
    INTENT DETECTION (choose EXACTLY ONE):
    - LEARNING: User wants to understand concepts
    - SOLVING: User wants a problem solved / how-to guide
    - PREPARING: User wants quick revision
    
    CRITICAL: Generate ONLY the structure.
    - "title": Specific chapter title.
    - "mental_model": The analogy, approach, or setting for this chapter.
    - "key_takeaway": The one key thing the user will learn/achieve in this chapter.
    
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

    let content: string;
    try {
        console.time('[Performance] Step 1 (Structure Generation) AI Latency');
        content = await generateAICompletion({
            messages: messages as AIMessage[],
            jsonMode: true,
        });
        console.timeEnd('[Performance] Step 1 (Structure Generation) AI Latency');
    } catch (e: any) {
        console.timeEnd('[Performance] Step 1 (Structure Generation) AI Latency');
        console.error("AI API Error:", e.message);
        throw new Error(`AI API Error: ${e.message || 'Unknown'}`);
    }
    console.log(`${await getAIProvider()} Response received for:`, topic)

    if (!content) throw new Error("Failed to generate content");

    let parsedData;
    try {
        parsedData = JSON.parse(content);
    } catch (e) {
        console.error("JSON Parse Error", e);
        throw new Error("AI generated invalid JSON");
    }

    // No translation needed - content is generated directly in target language

    if (!parsedData.chapters || !Array.isArray(parsedData.chapters)) {
        console.error("Invalid Structure", parsedData)
        throw new Error("AI generated invalid JSON structure: missing chapters")
    }

    // Normalize chapter fields
    const normalizeChapter = (ch: any) => {
        const title = ch.title || ch.chapter_title || ch.name || ch.heading || (typeof ch === 'string' ? ch : 'Untitled Chapter')
        const mental_model = ch.mental_model || ch.approach || ch.method || ch.strategy || ch.analogy || ''
        const key_takeaway = ch.key_takeaway || ch.takeaway || ch.summary || ch.result || ch.conclusion || ch.objective || ''

        return {
            title: typeof title === 'string' ? title : JSON.stringify(title),
            mental_model: typeof mental_model === 'string' ? mental_model : JSON.stringify(mental_model),
            key_takeaway: typeof key_takeaway === 'string' ? key_takeaway : JSON.stringify(key_takeaway)
        }
    }

    // 3. Save Chapters (Outline Only)
    // NOTE: explanation and visual_content are deliberately empty/placeholder to trigger client-side lazy loading
    const chaptersToInsert = parsedData.chapters.map((ch: any, index: number) => {
        const normalized = normalizeChapter(ch)
        return {
            plan_id: plan.id,
            title: normalized.title,
            mental_model: normalized.mental_model,
            explanation: "", // EMPTY to trigger lazy loading
            common_misconception: "",
            real_world_example: "",
            quiz_question: "",
            quiz_answer: "",
            visual_type: "text",
            visual_content: "",
            key_takeaway: normalized.key_takeaway,
            order: index + 1,
            is_completed: false
        }
    })

    const { error: chapterError } = await supabase
        .from('chapters')
        .insert(chaptersToInsert)

    if (chapterError) {
        console.error("DB Chapter Error", chapterError)
        throw new Error("Failed to save chapters")
    }

    // 4. Update Plan Status
    // Use 'structure_ready' to signal client that structure exists but content might be loading
    await supabase.from('learning_plans').update({
        status: 'structure_ready',
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
    const { topic, level, language, document_context } = plan
    const pdfBase64 = document_context as string | null

    // Fetch ALL chapters for this plan to get context from previous ones
    const { data: allChapters } = await supabase
        .from('chapters')
        .select('id, title, key_takeaway, explanation, order_index')
        .eq('plan_id', plan.id)
        .order('order_index', { ascending: true })

    // Build context from PREVIOUS chapters (those with lower order_index that have content)
    const previousChapters = (allChapters || [])
        .filter(c => c.order_index < chapter.order_index && c.explanation)
        .map(c => ({
            title: c.title,
            key_takeaway: c.key_takeaway,
            summary: c.explanation?.substring(0, 500) // First 500 chars of explanation
        }))

    const previousContext = previousChapters.length > 0
        ? `\n\n    PREVIOUS SECTIONS COMPLETED (build upon this work):\n${previousChapters.map((c, i) =>
            `    ${i + 1}. "${c.title}"\n       Key Result: ${c.key_takeaway}\n       Summary: ${c.summary}...`
        ).join('\n')}\n`
        : ''

    console.log(`[Server] Generating content for chapter ID: ${chapterId} in ${language || 'english'} (with ${previousChapters.length} previous chapters)`)

    const prompt = `
    Generate detailed content for this mini-chapter of a "${topic}" course.

    Chapter Title: "${chapter.title}"
    Mental Model: "${chapter.mental_model}"
    ${previousContext}
    FIRST, determine the user's INTENT from the topic:
    - LEARNING: User wants to understand concepts → Explain the mechanism (how and why it works)
    - SOLVING: User wants a problem solved → Perform the work and produce the result
    - PREPARING: User is revising for a test/interview → Focus on recall, patterns, and mistakes

    Context:
    - Level: ${level}
    - Language: ${(language || 'english').charAt(0).toUpperCase() + (language || 'english').slice(1)} (generate ALL content directly in this language)
    ${previousChapters.length > 0 ? '- THIS IS A CONTINUATION. Reference and build upon the previous sections shown above.' : ''}

    GENERATE CONTENT BASED ON INTENT (STRICTLY FOLLOW ONLY THE MATCHING SECTION):

    IF LEARNING:
    - explanation: Explain HOW the concept works internally (5–8 concise lines, no fluff)
    - common_misconception: What beginners typically misunderstand or confuse
    - real_world_example: A concrete, relatable example using numbers, objects, or situations
    - quiz_question / quiz_answer: Test conceptual understanding (not memorization)

    IF SOLVING OR WRITING AN ASSIGNMENT:
    ⚠️ YOU ARE DOING THE WORK, NOT EXPLAINING HOW TO DO IT.
    ⚠️ THIS IS SECTION ${chapter.order_index + 1} OF THE SOLUTION. Continue from where the previous section left off.
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

    // Build messages - include PDF if available
    const messages: AIMessage[] = [
        { role: "system", content: "You are an expert tutor. Output valid JSON." }
    ]

    if (pdfBase64) {
        // Include PDF for context
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
                    text: prompt
                }
            ]
        })
    } else {
        messages.push({ role: "user", content: prompt })
    }

    console.time(`[Performance] Step 2 (Content Generation) AI Latency for ${chapterId}`);
    const content = await generateAICompletion({
        messages,
        jsonMode: true,
    });
    console.timeEnd(`[Performance] Step 2 (Content Generation) AI Latency for ${chapterId}`);

    if (!content) throw new Error("Empty content from AI");

    let parsedData;
    try {
        // Clean content - sometimes weak models wrap JSON in markdown blocks
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
        }

        parsedData = JSON.parse(cleanContent);

        // Normalize explanation if it's an array (Gemini often does this)
        if (Array.isArray(parsedData.explanation)) {
            parsedData.explanation = parsedData.explanation.join('\n\n');
        }
        if (Array.isArray(parsedData.common_misconception)) {
            parsedData.common_misconception = parsedData.common_misconception.join('\n\n');
        }
        if (Array.isArray(parsedData.real_world_example)) {
            parsedData.real_world_example = parsedData.real_world_example.join('\n\n');
        }

        // Validation - ensure explanation exists and has reasonable length
        // Note: Non-latin scripts (Chinese/Japanese/etc) might be shorter, but 50 chars is still very low.
        // We'll keep 20 as a safe lower bound for "meaningful content".
        if (!parsedData.explanation || parsedData.explanation.length < 20) {
            console.error("Content too short:", parsedData.explanation)
            throw new Error("AI returned explanation too short")
        }
    } catch (e: any) {
        console.error("JSON Parse Error. Raw content:", content)
        console.error("Error details:", e.message)
        // Check if it's the specific "too short" error we threw above
        if (e.message === "AI returned explanation too short") {
            throw e
        }
        // Try to recover partial JSON if possible using regex
        // Or just fail gracefully with a clearer message
        throw new Error(`Invalid JSON from AI: ${e.message}`)
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

    const translated = await generateAICompletion({
        messages: [
            { role: "system", content: "You are a professional translator. You preserve English technical terms." },
            { role: "user", content: prompt }
        ],
        jsonMode: true,
    });

    const parsed = JSON.parse(translated || "{}");

    // Normalize potential arrays from Gemini
    if (Array.isArray(parsed.explanation)) parsed.explanation = parsed.explanation.join('\n\n');
    if (Array.isArray(parsed.common_misconception)) parsed.common_misconception = parsed.common_misconception.join('\n\n');
    if (Array.isArray(parsed.real_world_example)) parsed.real_world_example = parsed.real_world_example.join('\n\n');

    return parsed;
}
