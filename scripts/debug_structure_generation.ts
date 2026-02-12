
import { createClient } from '@supabase/supabase-js'

// Mock Env
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini'
// Needs proper keys. Hardcoding for debug script or assuming process.env is set if using `tsx` with .env support
// I'll assume I need to pass them or hardcode them from .env.local view earlier

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://twxvnptdktjrgyhibetd.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3eHZucHRka3Rqcmd5aGliZXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTQ0NDcsImV4cCI6MjA4NTkzMDQ0N30.6OAH1UmnbCPhDvhkDBTkXzGEGdE-2Er_dYlSv8lm9uA'
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || 'AIzaSyAeIKgnu-6vBxKQ-Kklb19Jy4AAmgGuJZ8'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function debugStructureGeneration(planId: string) {
    console.log(`Debug Structure Generation for Plan: ${planId}`)

    const { data: plan, error } = await supabase.from('learning_plans').select('*').eq('id', planId).single()
    if (!plan) { console.error("Plan not found"); return }

    const { topic, mode, level, language, document_context } = plan
    console.log(`Plan Context: Topic="${topic}", Mode="${mode}", PDF=${document_context ? 'Yes' : 'No'} (${document_context?.length} bytes)`)

    if (!document_context) {
        console.error("No PDF context found! Aborting.")
        return
    }

    // Call Gemini directly
    try {
        console.log("Importing GoogleGenerativeAI...")
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY)
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } })

        const userPrompt = `
        Analyze the attached PDF document to create a Learning Path Outline.
        The user entered: "${topic}"
        INTENT DETECTION: LEARNING | SOLVING | PREPARING
        CRITICAL: Generate a sequence of 10-12 mini-chapters.
        Output JSON: { "intent": "learning", "curriculum_strategy": "...", "chapters": [{ "title": "...", "mental_model": "...", "key_takeaway": "..." }], "next_steps": ["..."] }
        `

        console.time("Gemini Generation")
        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: document_context
                        }
                    },
                    { text: userPrompt }
                ]
            }]
        })
        console.timeEnd("Gemini Generation")

        const text = result.response.text()
        console.log("Response Length:", text.length)
        console.log("Response Preview:", text.substring(0, 200))

        JSON.parse(text)
        console.log("JSON Valid")

    } catch (e: any) {
        console.error("Gemini Failure:", e)
        if (e.response) console.error("Response:", await e.response.text())
    }
}

// Plan ID from the failed test
debugStructureGeneration('3166b731-b8e6-43fc-9cec-20661bb0f536')
