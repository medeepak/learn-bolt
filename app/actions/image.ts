'use server'

import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function generateImage(prompt: string) {
    if (!prompt) return null

    try {
        const response = await openai.images.generate({
            model: "gpt-image-1.5",
            prompt: `A clear, educational diagram or illustration explaining: ${prompt}. Simple, modern flat style, white background, high quality.`,
            n: 1,
            size: "1024x1024",
            quality: "medium",
        });

        // @ts-ignore
        const data = response.data?.[0]
        const tempUrl = data?.url

        if (!tempUrl) {
            return { success: false, error: "No URL in response", debug: response }
        }

        // Server-side fetch and convert to Base64 to avoid client-side loading issues
        try {
            const imageRes = await fetch(tempUrl)
            if (!imageRes.ok) throw new Error("Failed to fetch image from OpenAI URL")

            const arrayBuffer = await imageRes.arrayBuffer()
            const base64 = Buffer.from(arrayBuffer).toString('base64')
            const dataUri = `data:image/png;base64,${base64}`

            return { success: true, url: dataUri }
        } catch (fetchError) {
            console.error("Failed to convert image to base64:", fetchError)
            return { success: true, url: tempUrl } // Fallback to raw URL
        }

    } catch (error: any) {
        console.error("Image generation failed:", error)
        return { success: false, error: error.message || "Unknown error" }
    }
}
