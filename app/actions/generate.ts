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

    // 1. Generate the Plan Structure using OpenAI
    const prompt = `
    You are an expert curriculum designer and explainer for busy, non-academic learners.
    Your job is to make complex topics feel obvious, intuitive, and memorable.

    Create a learning plan for: "${topic}"

    Context:
    - Urgency: ${urgency} (Prioritize what matters. Skip edge cases.)
    - Level: ${level}
    - Language: ${language} (Explanations in this language. Technical terms in English.)

    Learning philosophy (IMPORTANT):
    - Teach for understanding, not completeness.
    - Use plain language, short sentences, and everyday comparisons.
    - Avoid academic tone, formulas, or textbook definitions.
    - Every chapter should answer: "Why does this matter?" and "How does this work in real life?"

    Output a JSON object with:
    1. "chapters": A list of 6–12 items.
    2. "next_steps": A list of 3–4 concrete follow-up topics.

    Each chapter MUST have:
    - title: string (Clear, friendly, non-academic)
    - mental_model: string (ONE simple sentence that frames the idea before details. Start with "Think of...")
    - explanation: string (Begin with a short prediction like: "Before reading this, guess...". Then explain in 5-10 lines.)
    - common_misconception: string (One brief common misunderstanding/mistake. "Many people think X, but actually Y.")
    - real_world_example: string (Practical example using real entities. Contrast with a confused concept where applicable.)
    - quiz_question: string (A "Teach it back" scenario or quick check. e.g. "How would you explain X to a friend?")
    - quiz_answer: string (The simple, correct answer to the quiz question.)
    - key_takeaway: string (One short sentence)
    - visual_type: "mermaid" | "react" | "image" (Visual must answer ONE clear question.)
    - visual_content: string

    Structure EXACTLY as:
    {
      "chapters": [
        {
          "title": "...",
          "mental_model": "Think of...",
          "explanation": "Before reading this, guess... (rest of explanation)",
          "common_misconception": "...",
          "real_world_example": "...",
          "quiz_question": "...",
          "quiz_answer": "...",
          "key_takeaway": "...",
          "visual_type": "...",
          "visual_content": "..."
        }
      ],
      "next_steps": ["Step 1", "Step 2", "Step 3"]
    }
  `

    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You describe things simply using analogies. You output valid JSON only." },
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
    } catch (e) {
        console.error("JSON Parse Error", e);
        throw new Error("AI generated invalid JSON");
    }

    if (!parsedData.chapters || !Array.isArray(parsedData.chapters)) {
        console.error("Invalid Structure", parsedData)
        throw new Error("AI generated invalid JSON structure: missing chapters")
    }

    // 2. Save to Supabase
    // Create Plan
    const { data: plan, error: planError } = await supabase
        .from('learning_plans')
        .insert({
            user_id: user?.id || null, // Allow null for guests
            topic,
            urgency,
            level,
            language,
            status: 'generated',
            next_steps: parsedData.next_steps || [] // New field
        })
        .select()
        .single()

    if (planError) {
        console.error("DB Plan Error", planError)
        throw new Error("Failed to save plan")
    }

    // Create Chapters
    const chaptersToInsert = parsedData.chapters.map((ch: any, index: number) => ({
        plan_id: plan.id,
        title: ch.title,
        mental_model: ch.mental_model || "",
        explanation: ch.explanation,
        common_misconception: ch.common_misconception || "",
        real_world_example: ch.real_world_example || "",
        quiz_question: ch.quiz_question || "",
        quiz_answer: ch.quiz_answer || "",
        visual_type: ch.visual_type,
        visual_content: typeof ch.visual_content === 'string' ? ch.visual_content : JSON.stringify(ch.visual_content),
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

    // redirect(`/plan/${plan.id}`)
    return { success: true, planId: plan.id }
}
