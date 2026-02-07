'use server'

import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Environment flag: 'openai' or 'gemini'
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai'

// Initialize clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

export type AIMessage = {
    role: 'system' | 'user' | 'assistant'
    content: string | AIContentPart[]
}

export type AIContentPart =
    | { type: 'text'; text: string }
    | { type: 'file'; file: { filename: string; file_data: string } }

export type AICompletionOptions = {
    messages: AIMessage[]
    jsonMode?: boolean
}

/**
 * Unified AI completion function that works with both OpenAI and Gemini
 */
export async function generateAICompletion(options: AICompletionOptions): Promise<string> {
    const { messages, jsonMode = true } = options

    if (AI_PROVIDER === 'gemini') {
        return generateGeminiCompletion(messages, jsonMode)
    } else {
        return generateOpenAICompletion(messages, jsonMode)
    }
}

async function generateOpenAICompletion(messages: AIMessage[], jsonMode: boolean): Promise<string> {
    const openaiMessages = messages.map(msg => {
        if (typeof msg.content === 'string') {
            return { role: msg.role, content: msg.content }
        }
        // Handle multimodal content (PDF/images)
        return { role: msg.role, content: msg.content }
    })

    const completion = await openai.chat.completions.create({
        messages: openaiMessages as any,
        model: "gpt-4o",
        response_format: jsonMode ? { type: "json_object" } : undefined,
    })

    return completion.choices[0].message.content || ''
}

async function generateGeminiCompletion(messages: AIMessage[], jsonMode: boolean): Promise<string> {
    const model = gemini.getGenerativeModel({
        model: "gemini-2.5-flash-preview-05-20",
        generationConfig: jsonMode ? { responseMimeType: "application/json" } : undefined,
    })

    // Extract system instruction and user messages
    let systemInstruction = ''
    const parts: any[] = []

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemInstruction = typeof msg.content === 'string' ? msg.content : ''
            continue
        }

        if (typeof msg.content === 'string') {
            parts.push({ text: msg.content })
        } else {
            // Handle multimodal content
            for (const part of msg.content) {
                if (part.type === 'text') {
                    parts.push({ text: part.text })
                } else if (part.type === 'file') {
                    // Convert file to inline data for Gemini
                    const base64Data = part.file.file_data.split(',')[1] || part.file.file_data
                    parts.push({
                        inlineData: {
                            mimeType: 'application/pdf',
                            data: base64Data
                        }
                    })
                }
            }
        }
    }

    const result = await model.generateContent({
        systemInstruction,
        contents: [{ role: 'user', parts }],
    })

    return result.response.text()
}

/**
 * Get the current AI provider name for logging
 */
export function getAIProvider(): string {
    return AI_PROVIDER
}
