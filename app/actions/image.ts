'use server'

import { gemini } from '@/lib/ai-client'
import { createClient } from '@/lib/supabase/server'

export async function generateImage(prompt: string, chapterId?: string) {
    if (!prompt) return null

    // 1. Check DB cache if chapterId provided
    if (chapterId) {
        const supabase = await createClient()
        const { data } = await supabase
            .from('chapters')
            .select('visual_content')
            .eq('id', chapterId)
            .single()

        if (data?.visual_content) {
            try {
                // Try to parse as JSON to see if we already have a URL
                const parsed = JSON.parse(data.visual_content)
                if (parsed.url && parsed.prompt) {
                    console.log(`[Image] cache hit for chapter ${chapterId}`)
                    return { success: true, url: parsed.url }
                }
            } catch (e) {
                // Not JSON, likely just the plain prompt string. Continue to generate.
            }
        }
    }

    try {
        console.log("Generating image with Gemini (gemini-2.5-flash) for:", prompt.substring(0, 50))

        // Use gemini-2.5-flash-image as the user requested for image generation
        const model = gemini.getGenerativeModel({
            model: "gemini-2.5-flash-image",
        })

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: `Generate a high-quality, educational diagram or illustration for: ${prompt}. Return the image.` }] }]
        })

        const response = result.response;

        // Check for inline image data in the response parts
        const parts = response.candidates?.[0]?.content?.parts || []
        const imagePart = parts.find((p: any) => p.inlineData)

        if (imagePart && imagePart.inlineData) {
            const mimeType = imagePart.inlineData.mimeType || 'image/png'
            const dataData = imagePart.inlineData.data
            const url = `data:${mimeType};base64,${dataData}`

            // 2. Save to DB if chapterId provided
            if (chapterId) {
                const supabase = await createClient()
                // Store as JSON to preserve prompt AND url
                const newContent = JSON.stringify({
                    prompt: prompt, // Keep original prompt
                    url: url
                })

                await supabase
                    .from('chapters')
                    .update({ visual_content: newContent })
                    .eq('id', chapterId)
            }

            return { success: true, url }
        }

        // If no image, check if there's a file URI (sometimes used for larger images)
        // or just return failure
        console.warn("Gemini returned no inline image data. Response candidates:", JSON.stringify(response.candidates, null, 2))

        return { success: false, error: "Model returned text instead of image. Verify model supports image generation." }

    } catch (error: any) {
        console.error("Gemini Image Generation failed:", error)
        return { success: false, error: error.message || "Unknown error" }
    }
}
