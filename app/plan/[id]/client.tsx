'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle, Circle, ChevronRight, ChevronLeft, Loader2, PlayCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import mermaid from 'mermaid'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { generateImage } from '../../actions/image'
import { generateLearningPlan, generatePlanContent } from '../../actions/generate'

// Initialize Mermaid
mermaid.initialize({
    startOnLoad: true,
    theme: 'neutral',
    securityLevel: 'loose',
})

const MermaidDiagram = ({ chart }: { chart: string }) => {
    const [svg, setSvg] = useState('')

    useEffect(() => {
        const render = async () => {
            try {
                const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, chart);
                setSvg(svg)
            } catch (e) {
                console.error('Mermaid render error', e)
                setSvg('<div class="text-red-500 text-sm">Failed to render diagram</div>')
            }
        }
        render()
    }, [chart])

    return <div className="my-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
}

const SimpleTable = ({ dataStr }: { dataStr: string }) => {
    try {
        let cleanStr = typeof dataStr === 'string' ? dataStr.trim() : JSON.stringify(dataStr)
        // Remove markdown code blocks if present
        if (cleanStr.startsWith('```')) {
            cleanStr = cleanStr.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '')
        }

        const data = JSON.parse(cleanStr)
        if (!Array.isArray(data) || data.length === 0) {
            // Fallback: If it's just a string description, show it as text
            if (typeof dataStr === 'string' && dataStr.length > 0 && !dataStr.trim().startsWith('{') && !dataStr.trim().startsWith('[')) {
                return (
                    <div className="my-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-gray-600 italic text-center">
                        {dataStr}
                    </div>
                )
            }
            return null
        }

        const headers = Object.keys(data[0])

        return (
            <div className="my-6 overflow-hidden rounded-xl border border-gray-200 shadow-sm font-sans">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs tracking-wider">
                            <tr>
                                {headers.map((h) => (
                                    <th key={h} className="px-6 py-3 border-b border-gray-200 whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {data.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                    {headers.map((h) => (
                                        <td key={h} className="px-6 py-4 text-gray-600 font-medium whitespace-nowrap">
                                            {row[h]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    } catch (e) {
        // Fallback for parsing errors: Show the text if it looks like a description
        if (typeof dataStr === 'string' && !dataStr.trim().startsWith('{') && !dataStr.trim().startsWith('[')) {
            return (
                <div className="my-6 p-4 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">ℹ️</div>
                    <p className="text-sm font-medium">{dataStr}</p>
                </div>
            )
        }

        return (
            <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                Could not render table data.
            </div>
        )
    }
}

const AIImage = ({ prompt }: { prompt: string }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [touched, setTouched] = useState(false)

    const load = async () => {
        if (loading || imageUrl) return
        setLoading(true)
        setTouched(true)

        try {
            const res = await generateImage(prompt)
            if (res && res.success && res.url) {
                setImageUrl(res.url)
            } else {
                console.error("Client Image Load Error:", res?.error)
                alert(`Image Generation Failed: ${res?.error || "Unknown error"}`)
                // You could also set an error state here to show in UI
            }
        } catch (e) {
            console.error("Client Image Call Failed", e)
        }

        setLoading(false)
    }

    return (
        <div className="my-6">
            {!touched ? (
                <button
                    onClick={load}
                    className="w-full h-64 bg-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors border-2 border-dashed border-gray-300 gap-2"
                >
                    <PlayCircle className="w-8 h-8 opacity-50" />
                    <span className="font-medium text-sm">Generate AI Illustration</span>
                </button>
            ) : loading ? (
                <div className="w-full h-64 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Generating visuals...
                </div>
            ) : imageUrl ? (
                <img src={imageUrl} alt="AI illustration" className="rounded-xl w-full h-auto shadow-sm border border-gray-100" />
            ) : (
                <div className="w-full h-16 bg-red-50 text-red-500 text-sm rounded-lg flex items-center justify-center">
                    Failed to load image.
                </div>
            )}
        </div>
    )
}

export default function PlanClient({ plan, chapters }: { plan: any, chapters: any[] }) {
    const router = useRouter()
    const [currentIndex, setCurrentIndex] = useState(0)
    const [completed, setCompleted] = useState<Set<string>>(new Set())
    const [generatingNext, setGeneratingNext] = useState<string | null>(null)
    const [initializing, setInitializing] = useState(chapters.length === 0)

    // Trigger content generation if plan is new
    useEffect(() => {
        if (chapters.length === 0 && plan.status === 'generating') {
            const init = async () => {
                try {
                    console.log("Initializing plan content...")
                    const res = await generatePlanContent(plan.id)
                    if (res.success) {
                        setInitializing(false)
                        router.refresh()
                    }
                } catch (e) {
                    console.error("Initialization Failed", e)
                    alert("Failed to generate content. Please try again.")
                }
            }
            init()
        } else if (chapters.length > 0) {
            setInitializing(false)
        }
    }, [chapters.length, plan.status, plan.id, router])

    // Update URL hash for sharing/bookmarking
    useEffect(() => {
        if (!initializing && chapters.length > 0) {
            window.history.replaceState(null, '', `#chapter-${indexToId(currentIndex)}`)
        }
    }, [currentIndex, initializing, chapters])

    const indexToId = (i: number) => chapters[i]?.id

    const handleNextStep = async (topic: string) => {
        setGeneratingNext(topic)
        try {
            const formData = new FormData()
            formData.append('topic', topic)
            formData.append('urgency', plan.urgency)
            formData.append('level', plan.level)
            formData.append('language', plan.language)

            const res = await generateLearningPlan(formData)
            if (res && res.planId) {
                router.push(`/plan/${res.planId}`)
            } else {
                throw new Error("Failed to get plan ID")
            }
        } catch (e: any) {
            console.error(e)
            setGeneratingNext(null)
            alert(`Failed to create next course: ${e.message || "Unknown error"}`)
        }
    }

    const handleNext = () => {
        if (currentIndex < chapters.length - 1) {
            setCurrentIndex(prev => prev + 1)
        }
    }

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1)
        }
    }

    const markAsDone = () => {
        const chapterId = chapters[currentIndex].id
        setCompleted(prev => new Set(prev).add(chapterId))

        // Auto advance after short delay
        if (currentIndex < chapters.length - 1) {
            setTimeout(() => handleNext(), 500)
        }
    }

    // Determine completion progress
    const progress = ((currentIndex) / (chapters.length)) * 100
    const isFinished = completed.has(chapters[chapters.length - 1]?.id)

    const currentChapter = chapters[currentIndex]

    if (initializing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Designing your custom curriculum...</h2>
                <p className="text-gray-500 max-w-md">
                    Crafting {plan.level} level explanations, analogies, and quizzes for "{plan.topic}".
                </p>
                <p className="text-xs text-gray-400 mt-8">This takes about 30 seconds.</p>
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto px-4 pb-20">
            {/* Progress Bar */}
            <div className="fixed top-[73px] left-0 right-0 h-1 bg-gray-100 z-40">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-amber-500"
                />
            </div>

            {/* Navigation Header */}
            <div className="flex justify-between items-center mb-8 text-sm text-gray-500">
                <span>Chapter {currentIndex + 1} of {chapters.length}</span>
                <span className="font-medium text-gray-900">{Math.round(progress)}% Complete</span>
            </div>

            <AnimatePresence mode='wait'>
                <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 md:p-10 min-h-[60vh] flex flex-col justify-between"
                >
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-6">
                            {currentChapter.title}
                        </h2>

                        <div className="space-y-6">
                            {/* Mental Model - The "Anchor" */}
                            {currentChapter.mental_model && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 shadow-sm">
                                    <span className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">
                                        <span className="text-lg">💡</span> Mental Model
                                    </span>
                                    <p className="text-indigo-950 font-medium text-lg">
                                        {currentChapter.mental_model}
                                    </p>
                                </div>
                            )}

                            {/* Visual Content */}
                            {currentChapter.visual_type === 'mermaid' && (
                                <MermaidDiagram chart={currentChapter.visual_content} />
                            )}

                            {currentChapter.visual_type === 'react' && (
                                <SimpleTable dataStr={currentChapter.visual_content} />
                            )}

                            {currentChapter.visual_type === 'image' && (
                                <AIImage prompt={currentChapter.visual_content} />
                            )}

                            <p className="text-xl text-gray-700 leading-relaxed font-serif">
                                {currentChapter.explanation}
                            </p>

                            {/* Common Misconception - The "Correction" */}
                            {currentChapter.common_misconception && (
                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-5">
                                    <span className="flex items-center gap-2 text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">
                                        <span className="text-lg">⚠️</span> Common Myth
                                    </span>
                                    <p className="text-rose-950 font-medium text-base">
                                        {currentChapter.common_misconception}
                                    </p>
                                </div>
                            )}

                            {/* Real World Example */}
                            {currentChapter.real_world_example && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                                    <span className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Real World Example</span>
                                    <p className="text-blue-900 font-medium text-lg italic">
                                        "{currentChapter.real_world_example}"
                                    </p>
                                </div>
                            )}

                            {/* Quiz / Active Recall */}
                            {currentChapter.quiz_question && (
                                <div className="bg-teal-50 border border-teal-100 rounded-xl p-6 mt-6">
                                    <span className="block text-xs font-bold text-teal-700 uppercase tracking-wider mb-2">Active Recall</span>
                                    <p className="text-teal-900 font-medium text-lg mb-4">
                                        {currentChapter.quiz_question}
                                    </p>

                                    <details className="group">
                                        <summary className="cursor-pointer text-teal-600 font-medium text-sm hover:text-teal-800 transition-colors list-none flex items-center gap-2">
                                            <span className="bg-teal-100 px-2 py-1 rounded">Reveal Answer</span>
                                        </summary>
                                        <div className="mt-3 text-teal-800 leading-relaxed pl-1">
                                            {currentChapter.quiz_answer}
                                        </div>
                                    </details>
                                </div>
                            )}

                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 mt-8">
                                <span className="block text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Key Takeaway</span>
                                <p className="text-amber-900 font-medium text-lg">
                                    {currentChapter.key_takeaway}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex items-center justify-between pt-8 border-t border-gray-100">
                        <button
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            className="text-gray-400 hover:text-gray-900 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors flex items-center gap-2"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            Previous
                        </button>

                        {!completed.has(currentChapter.id) ? (
                            <button
                                onClick={markAsDone}
                                className="bg-gray-900 text-white px-8 py-4 rounded-xl font-medium hover:bg-gray-800 transition-all flex items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1"
                            >
                                <Circle className="w-5 h-5" />
                                Mark as Understood
                            </button>
                        ) : (
                            <button
                                onClick={handleNext}
                                disabled={currentIndex === chapters.length - 1}
                                className="bg-green-600 text-white px-8 py-4 rounded-xl font-medium hover:bg-green-700 transition-all flex items-center gap-3 shadow-lg"
                            >
                                <CheckCircle className="w-5 h-5" />
                                {currentIndex === chapters.length - 1 ? 'Finish' : 'Next Chapter'}
                            </button>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Completion State */}
            {isFinished && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-0 left-0 right-0 p-8 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col items-center z-50"
                >
                    <div className="text-center w-full max-w-2xl">
                        <h3 className="text-xl font-bold text-green-600 mb-2">🎉 Course Completed!</h3>
                        <p className="text-gray-600 mb-6">You've mastered the basics. Here are some recommended next steps:</p>

                        {plan.next_steps && plan.next_steps.length > 0 ? (
                            <div className="flex flex-wrap justify-center gap-3 mb-6">
                                {plan.next_steps.map((step: string, i: number) => (
                                    <button
                                        key={i}
                                        onClick={() => handleNextStep(step)}
                                        disabled={generatingNext !== null}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {generatingNext === step ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Building...
                                            </>
                                        ) : (
                                            <>
                                                Learn {step} &rarr;
                                            </>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <Link href="/" className="inline-block bg-gray-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors">
                                Start a new topic
                            </Link>
                        )}

                        {plan.next_steps && plan.next_steps.length > 0 && !generatingNext && (
                            <Link href="/" className="text-gray-400 text-xs hover:text-gray-600 underline">
                                Return to home
                            </Link>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Global Loader Overlay */}
            {generatingNext && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900">Designing your {generatingNext} course...</h2>
                    <p className="text-gray-500 mt-2">Using your previous preferences ({plan.level}, {plan.urgency})</p>
                </div>
            )}
        </div>
    )
}
