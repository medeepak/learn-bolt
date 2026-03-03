/**
 * Seed script: pre-generates full course content for the 6 suggested topics.
 * Run with: npx tsx scripts/seed-suggestions.ts
 *
 * Outputs: public/suggested-topics.json with stable plan IDs.
 */

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const gemini = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)

const SUGGESTED_TOPICS = [
    { title: '🧠 Brain Tricks You', thumbnail: '/thumbnails/brain-tricks.png' },
    { title: '🌌 Weird Universe', thumbnail: '/thumbnails/weird-universe.png' },
    { title: '💰 Money Secrets', thumbnail: '/thumbnails/money-secrets.png' },
    { title: 'The Future of Humans', thumbnail: '/thumbnails/future-humans.png' },
    { title: 'How Games Hack Your Brain', thumbnail: '/thumbnails/games-brain.png' },
    { title: 'Read People Better Like a Book', thumbnail: '/thumbnails/read-people.png' },
]

async function generateAI(prompt: string): Promise<string> {
    const model = gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
    })
    const result = await model.generateContent({
        systemInstruction: 'You are a master storyteller. Output valid JSON.',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    return result.response.text()
}

async function generateAINoJson(systemInstruction: string, prompt: string): Promise<string> {
    const model = gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
    })
    const result = await model.generateContent({
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    return result.response.text()
}

async function generateStructure(topic: string): Promise<any> {
    const prompt = `
Create a captivating visual story outline about: "${topic}"

Target Audience: beginner level
Language: English

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
}`
    const raw = await generateAI(prompt)
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '')
    return JSON.parse(cleaned)
}

async function generateChapterContent(
    topic: string,
    chapterTitle: string,
    mentalModel: string,
    orderIndex: number
): Promise<any> {
    const prompt = `
Generate detailed content for this mini-chapter of a "${topic}" story course.

Chapter Title: "${chapterTitle}"
Mental Model: "${mentalModel}"
Section: ${orderIndex + 1}
Level: beginner
Language: English

This is story mode - make it engaging and narrative-driven.

Structure JSON:
{
   "explanation": "...",
   "common_misconception": "...",
   "real_world_example": "...",
   "quiz_question": "...",
   "quiz_answer": "...",
   "visual_type": "image" | "mermaid" | "react",
   "visual_content": "..."
}`
    const raw = await generateAINoJson('You are an expert tutor and storyteller. Output valid JSON.', prompt)
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed.explanation)) parsed.explanation = parsed.explanation.join('\n\n')
    if (Array.isArray(parsed.common_misconception)) parsed.common_misconception = parsed.common_misconception.join('\n\n')
    if (Array.isArray(parsed.real_world_example)) parsed.real_world_example = parsed.real_world_example.join('\n\n')
    return parsed
}

async function seedTopic(topicInfo: typeof SUGGESTED_TOPICS[0]) {
    const { title, thumbnail } = topicInfo
    console.log(`\n📚 Seeding: "${title}"`)

    // 1. Create plan in DB
    const { data: plan, error: planError } = await supabase
        .from('learning_plans')
        .insert({
            user_id: null,
            topic: title,
            urgency: '2h',
            level: 'beginner',
            language: 'english',
            mode: 'story',
            status: 'generating',
            next_steps: [],
        })
        .select()
        .single()

    if (planError || !plan) {
        console.error(`❌ Failed to create plan for "${title}":`, planError)
        throw new Error(`Failed to create plan: ${planError?.message}`)
    }
    console.log(`  ✅ Plan created: ${plan.id}`)

    // 2. Generate structure
    console.log(`  🤖 Generating structure...`)
    const structure = await generateStructure(title)
    console.log(`  ✅ Structure: ${structure.chapters.length} chapters`)

    // 3. Insert chapters (empty content first)
    const chaptersToInsert = structure.chapters.map((ch: any, index: number) => ({
        plan_id: plan.id,
        title: ch.title || 'Untitled Chapter',
        mental_model: ch.mental_model || '',
        explanation: '',
        common_misconception: '',
        real_world_example: '',
        quiz_question: '',
        quiz_answer: '',
        visual_type: 'text',
        visual_content: '',
        key_takeaway: ch.key_takeaway || '',
        order: index + 1,
        is_completed: false,
    }))

    const { data: insertedChapters, error: chapterError } = await supabase
        .from('chapters')
        .insert(chaptersToInsert)
        .select()

    if (chapterError || !insertedChapters) {
        console.error(`❌ Failed to insert chapters:`, chapterError)
        throw new Error(`Failed to insert chapters: ${chapterError?.message}`)
    }
    console.log(`  ✅ ${insertedChapters.length} chapter stubs inserted`)

    // 4. Generate full content for each chapter (sequential to avoid rate limits)
    for (let i = 0; i < insertedChapters.length; i++) {
        const chapter = insertedChapters[i]
        const originalChapter = structure.chapters[i]
        console.log(`  📖 Chapter ${i + 1}/${insertedChapters.length}: "${chapter.title}"`)

        try {
            const content = await generateChapterContent(title, chapter.title, originalChapter.mental_model || '', i)

            await supabase.from('chapters').update({
                explanation: content.explanation,
                common_misconception: content.common_misconception,
                real_world_example: content.real_world_example,
                quiz_question: content.quiz_question,
                quiz_answer: content.quiz_answer,
                visual_type: content.visual_type || 'text',
                visual_content: typeof content.visual_content === 'string'
                    ? content.visual_content
                    : JSON.stringify(content.visual_content),
            }).eq('id', chapter.id)

            console.log(`    ✅ Content saved (${content.explanation?.length || 0} chars)`)

            // Small delay between chapters to avoid rate limiting
            if (i < insertedChapters.length - 1) {
                await new Promise(r => setTimeout(r, 1500))
            }
        } catch (err: any) {
            console.error(`    ⚠️  Failed chapter ${i + 1}, skipping:`, err.message)
        }
    }

    // 5. Mark plan as complete
    await supabase.from('learning_plans').update({
        status: 'structure_ready',
        next_steps: structure.next_steps || [],
    }).eq('id', plan.id)

    console.log(`  🎉 "${title}" fully seeded! Plan ID: ${plan.id}`)
    return { title, thumbnail, planId: plan.id }
}

async function main() {
    console.log('🚀 Seeding suggested topics...\n')

    const results: Array<{ title: string; thumbnail: string; planId: string }> = []

    for (const topic of SUGGESTED_TOPICS) {
        try {
            const result = await seedTopic(topic)
            results.push(result)
        } catch (err: any) {
            console.error(`❌ Failed to seed "${topic.title}":`, err.message)
            // Continue with other topics
        }
    }

    // Write JSON file
    const outputPath = path.join(process.cwd(), 'public', 'suggested-topics.json')
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
    console.log(`\n✅ Done! Wrote ${results.length} topics to ${outputPath}`)
    console.log('\nGenerated IDs:')
    results.forEach(r => console.log(`  ${r.title}: ${r.planId}`))
}

main().catch(console.error)
