'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, PlayCircle } from 'lucide-react'
import { generateImage } from '@/app/actions/image'

const AIImage = ({
    prompt,
    autoGenerate = false,
    className = "",
    imgClassName = "w-full h-full object-cover"
}: {
    prompt: string | null,
    autoGenerate?: boolean,
    className?: string,
    imgClassName?: string
}) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [touched, setTouched] = useState(false)

    // Auto-generate if enabled
    useEffect(() => {
        if (autoGenerate && prompt && !imageUrl && !loading && !touched) {
            load()
        }
    }, [autoGenerate, prompt, imageUrl, loading, touched])

    const load = async () => {
        if (loading || imageUrl || !prompt) return
        setLoading(true)
        setTouched(true)

        try {
            const res = await generateImage(prompt)
            if (res && res.success && res.url) {
                setImageUrl(res.url)
            } else {
                console.error("Client Image Load Error:", res?.error)
                // You could also set an error state here to show in UI
            }
        } catch (e) {
            console.error("Client Image Call Failed", e)
        }

        setLoading(false)
    }

    if (!prompt) return null

    return (
        <div className={`relative ${className}`}>
            {!touched && !imageUrl ? (
                <button
                    onClick={load}
                    className="w-full h-full min-h-[16rem] bg-gray-100 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors gap-2"
                >
                    <PlayCircle className="w-8 h-8 opacity-50" />
                    <span className="font-medium text-sm">Generate Illustration</span>
                </button>
            ) : loading ? (
                <div className="w-full h-full min-h-[16rem] bg-gray-50 flex items-center justify-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Generating...
                </div>
            ) : imageUrl ? (
                <img src={imageUrl} alt="AI illustration" className={imgClassName} crossOrigin="anonymous" />
            ) : (
                <div className="w-full h-full min-h-[16rem] bg-rose-50 text-rose-500 text-sm flex items-center justify-center p-4 text-center">
                    Failed to load image. Only prompts.
                </div>
            )}
        </div>
    )
}

export default AIImage
