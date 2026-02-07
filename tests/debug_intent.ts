import { readFileSync } from 'fs';
import OpenAI from 'openai';

// Load API key from .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const apiKeyMatch = envContent.match(/OPENAI_API_KEY=(.+)/);
if (apiKeyMatch) process.env.OPENAI_API_KEY = apiKeyMatch[1].trim();

const openai = new OpenAI()

async function testSolvingIntent() {
    // Load the PDF as base64
    const pdfPath = '/Users/deepak/Downloads/Product Jam – Long-Distance Trips (1).pdf'
    const pdfBuffer = readFileSync(pdfPath)
    const pdfBase64 = pdfBuffer.toString('base64')

    console.log('='.repeat(60))
    console.log('TEST: Solve this assignment')
    console.log('PDF:', pdfPath)
    console.log('PDF Base64 Length:', pdfBase64.length)
    console.log('='.repeat(60))

    const topic = 'Solve this assignment'
    const urgency = 'normal'
    const level = 'intermediate'

    const userPrompt = `
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

    console.log('\n[PROMPT SENT TO AI]')
    console.log('-'.repeat(60))
    console.log(userPrompt.slice(0, 500) + '...')
    console.log('-'.repeat(60))

    // Call OpenAI with PDF
    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: "You are a strict, no-nonsense teacher. Output valid JSON." },
            {
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
            } as any
        ],
        model: "gpt-4o",
        response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    console.log('\n[RAW AI RESPONSE]')
    console.log('='.repeat(60))
    console.log(content)
    console.log('='.repeat(60))

    // Parse and analyze
    const parsed = JSON.parse(content || '{}')

    console.log('\n[ANALYSIS]')
    console.log('-'.repeat(60))
    console.log('Detected Intent:', parsed.intent)
    console.log('Curriculum Strategy:', parsed.curriculum_strategy)
    console.log('\nChapters:')
    parsed.chapters?.forEach((ch: any, i: number) => {
        console.log(`\n  ${i + 1}. ${ch.title}`)
        console.log(`     Mental Model: ${ch.mental_model}`)
        console.log(`     Key Takeaway: ${ch.key_takeaway?.slice(0, 100)}...`)
    })

    // Check if it's actually solving or just explaining
    console.log('\n[QUALITY CHECK]')
    console.log('-'.repeat(60))
    const keyTakeaways = parsed.chapters?.map((ch: any) => ch.key_takeaway).join(' ') || ''
    const instructionalPhrases = [
        'you should', 'you need to', 'analyze the', 'calculate the', 'consider the',
        'this step involves', 'in this step', 'first, you', 'next, you', 'then you'
    ]

    const foundInstructional = instructionalPhrases.filter(phrase =>
        keyTakeaways.toLowerCase().includes(phrase)
    )

    if (foundInstructional.length > 0) {
        console.log('❌ PROBLEM: Found instructional phrases in key_takeaways:')
        foundInstructional.forEach(p => console.log(`   - "${p}"`))
        console.log('\n   This means AI is explaining what to do, not doing it.')
    } else {
        console.log('✅ No obvious instructional phrases found.')
    }
}

testSolvingIntent().catch(console.error)
