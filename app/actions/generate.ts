'use server'

import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { redirect } from 'next/navigation'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function generateLearningPlan(formData: FormData) {
    const topic = formData.get('topic') as string
    const urgency = formData.get('urgency') as string
    const level = formData.get('level') as string
    const language = formData.get('language') as string

    if (!topic) {
        throw new Error('Topic is required')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // NOTE: We now allow guests (user is optional)

    // 1. Create the Plan Structure in DB immediately (Fast)
    console.log("Step 1: Creating initial plan for:", topic)
    const { data: plan, error: planError } = await supabase
        .from('learning_plans')
        .insert({
            user_id: user?.id || null,
            topic,
            urgency,
            level,
            language,
            status: 'generating', // Initial status
            next_steps: []
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

    // Fetch plan details to get context
    const { data: plan } = await supabase.from('learning_plans').select('*').eq('id', planId).single()
    if (!plan) throw new Error("Plan not found")

    const { topic, urgency, level, language } = plan

    console.log("Step 2: Generating content for Plan ID:", planId)

    const prompt = `
    You are an expert curriculum designer.
    ref: "Think First" - Before generating, determine the "Critical Path" to understanding this topic.
    
    Create a learning plan for: "${topic}"

    Context:
    - Urgency: ${urgency}
    - Level: ${level}
    - Language: English (Always generate reasoning in English first)

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

    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a strict, no-nonsense teacher. Output valid JSON." },
            { role: "user", content: prompt }
        ],
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

    return { success: true }
}

export async function generateChapterContent(chapterId: string) {
    const supabase = await createClient()

    // Fetch Chapter and Plan context
    const { data: chapter } = await supabase.from('chapters').select('*, learning_plans(*)').eq('id', chapterId).single()
    if (!chapter) throw new Error("Chapter not found")

    const plan = chapter.learning_plans
    const { topic, level, language } = plan

    console.log("Generating detail for chapter:", chapter.title)

    const prompt = `
    Write the detailed content for this chapter of a "${topic}" course.
    
    Chapter Title: "${chapter.title}"
    Mental Model: "${chapter.mental_model}"
    
    Context:
    - Level: ${level}
    - Language: English (Generate reasoning in English)

    Instruction:
    - Be concrete. Use specific examples.
    - Explain the MECHANISM (How it works).
    - Explanation should be 5-8 lines.

    Structure JSON:
    {
       "explanation": "...",
       "common_misconception": "...",
       "real_world_example": "...",
       "quiz_question": "...",
       "quiz_answer": "...",
       "visual_type": "...",
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
    if (!content) throw new Error("Failed to generate content");

    let parsedData;
    try {
        parsedData = JSON.parse(content);
    } catch (e) { throw new Error("Invalid JSON") }

    // 2. Translate if needed
    if (language && language.toLowerCase() !== 'english') {
        parsedData = await translateContent(parsedData, language);
    }

    // Update Chapter
    const { error } = await supabase.from('chapters').update({
        explanation: parsedData.explanation,
        common_misconception: parsedData.common_misconception,
        real_world_example: parsedData.real_world_example,
        quiz_question: parsedData.quiz_question,
        quiz_answer: parsedData.quiz_answer,
        visual_type: parsedData.visual_type,
        visual_content: typeof parsedData.visual_content === 'string' ? parsedData.visual_content : JSON.stringify(parsedData.visual_content)
    }).eq('id', chapterId)

    if (error) throw new Error("Failed to update chapter")

    return { success: true }
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
