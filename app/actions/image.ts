'use server'

import { gemini } from '@/lib/ai-client'

export async function generateImage(prompt: string) {
    if (!prompt) return null

    try {
        console.log("Generating image with Gemini (gemini-2.5-flash) for:", prompt.substring(0, 50))

        // Use gemini-2.5-flash as requested. 
        // Note: Use 'gemini-2.5-flash-image' if 'gemini-2.5-flash' fails to generate images.
        const model = gemini.getGenerativeModel({
            model: "gemini-2.5-flash",
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
            return { success: true, url: `data:${mimeType};base64,${dataData}` }
        }

        // If no image, check if there's a file URI (sometimes used for larger images)
        // or just return failure
        console.warn("Gemini returned no inline image data. Response candidates:", JSON.stringify(response.candidates, null, 2))

        return { success: false, error: "Model returned text instead of image. Verify model supports image generation." }

    } catch (error: any) {
        console.error("Gemini Image Generation failed:", error)

        // If 404, suggest using a different model
        if (error.message?.includes('404') || error.message?.includes('not found')) {
            return { success: false, error: "Model 'gemini-2.5-flash' not found. Try 'gemini-2.0-flash-exp' or 'imagen-3.0-generate-001'." }
        }

        return { success: false, error: error.message || "Unknown error" }
    }
}
