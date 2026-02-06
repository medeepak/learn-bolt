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
            quality: "standard",
            response_format: "b64_json",
        });

        // @ts-ignore
        console.log("Raw Image Response:", JSON.stringify(response, null, 2))

        // @ts-ignore
        const data = response.data?.[0]
        let url = data?.url

        if (!url && data?.b64_json) {
            url = `data:image/png;base64,${data.b64_json}`
        }

        if (!url) {
            return { success: false, error: "No URL or Base64 in response", debug: response }
        }

        return { success: true, url }
    } catch (error: any) {
        console.error("Image generation failed:", error)
        return { success: false, error: error.message || "Unknown error" }
    }
}
