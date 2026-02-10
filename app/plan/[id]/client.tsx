'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle, Circle, ChevronRight, ChevronLeft, Loader2, PlayCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import mermaid from 'mermaid'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { generateImage } from '../../actions/image'
import { generateLearningPlan, generatePlanContent, generateEnglishContent } from '../../actions/generate'
import ReactMarkdown from 'react-markdown'

// ... existing mermaid init ...

// Fix Mermaid Diagram component to handle empty charts gracefully
// Initialize mermaid with specific settings to avoid default error rendering
if (typeof window !== 'undefined') {
    mermaid.initialize({
        startOnLoad: false,
        suppressErrorRendering: true,
    });
}

const MermaidDiagram = ({ chart }: { chart: string }) => {
    const [svg, setSvg] = useState('')
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!chart || chart === "Content loading...") return;

        const render = async () => {
            try {
                setError(false)
                let cleanChart = chart.trim()

                // Remove markdown code blocks
                if (cleanChart.startsWith('```')) {
                    cleanChart = cleanChart.replace(/^```(mermaid)?\n?/, '').replace(/\n?```$/, '')
                }

                cleanChart = cleanChart.replace(/^["']|["']$/g, '')

                if (!cleanChart.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline)/i)) {
                    cleanChart = `flowchart TD\n${cleanChart}`
                }

                cleanChart = cleanChart.replace(/[\u201C\u201D]/g, '"')
                cleanChart = cleanChart.replace(/[\u2018\u2019]/g, "'")

                // Robust regex for []
                cleanChart = cleanChart.replace(/\[([^\]]+)\]/g, (match, content) => {
                    const trimmed = content.trim();
                    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return match;
                    return `["${trimmed.replace(/"/g, "'")}"]`;
                })

                // Robust regex for {} - Handle partial/broken JSON-like structures better?
                // If it looks like `{"...` without end quote, we can't easily fix.
                // But generally quote content.
                cleanChart = cleanChart.replace(/\{([^}]+)\}/g, (match, content) => {
                    const trimmed = content.trim();
                    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return match;
                    return `{"${trimmed.replace(/"/g, "'")}"}`;
                })

                // Robust regex for ()
                cleanChart = cleanChart.replace(/\(([^)]+)\)/g, (match, content) => {
                    const trimmed = content.trim();
                    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return match;
                    return `("${trimmed.replace(/"/g, "'")}")`;
                })

                // Suppress parse errors explicitly
                mermaid.parseError = (err) => {
                    console.error('Mermaid Parse Error (Suppressed):', err);
                    // Do not render anything to DOM
                };

                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
                const { svg } = await mermaid.render(id, cleanChart);
                setSvg(svg)
            } catch (e) {
                console.error('Mermaid render error', e)
                setError(true)
                setSvg('') // Clear SVG to ensure nothing shows
            }
        }
        render()
    }, [chart])

    if (error || !svg) {
        return null; // Hide completely on error or loading (user preference "at least hide it")
        // Alternatively retain "Loading..." if purely loading, but "error" should hide.
    }

    return <div className="my-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
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
                                    {headers.map((h) => {
                                        const value = row[h]
                                        // Handle nested objects by converting to string
                                        const displayValue = typeof value === 'object' && value !== null
                                            ? JSON.stringify(value)
                                            : String(value ?? '')
                                        return (
                                            <td key={h} className="px-6 py-4 text-gray-600 font-medium whitespace-nowrap">
                                                {displayValue}
                                            </td>
                                        )
                                    })}
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

const AIImage = ({ prompt, autoGenerate = false }: { prompt: string, autoGenerate?: boolean }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [touched, setTouched] = useState(false)

    // Auto-generate if enabled
    useEffect(() => {
        if (autoGenerate && prompt && !imageUrl && !loading && !touched) {
            load()
        }
    }, [autoGenerate, prompt])

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

export default function PlanClient({ plan, chapters: serverChapters }: { plan: any, chapters: any[] }) {
    // Local state for chapters to allow optimistic/direct updates
    const [chapters, setChapters] = useState(serverChapters)

    // Sync with server updates, but DON'T overwrite if local has content
    // Local is always "fresher" since we apply optimistic updates directly
    useEffect(() => {
        setChapters(prev => {
            // If server has more chapters than local, use server as base
            if (serverChapters.length > prev.length) {
                console.log(`[Sync] Server has ${serverChapters.length} chapters, local has ${prev.length}. Using server.`)
                return serverChapters
            }

            // Otherwise, smart merge each chapter
            return prev.map((localChapter, i) => {
                const serverChapter = serverChapters[i]
                if (!serverChapter) return localChapter

                // If local has explanation, ALWAYS keep local
                // This prevents stale server data from overwriting optimistic/translated content
                const localHasExplanation = localChapter.explanation && localChapter.explanation.length > 0

                if (localHasExplanation) {
                    console.log(`[Sync] Keeping local content for ${localChapter.title} (local is fresh)`)
                    return localChapter
                }

                // Only use server if local has no content
                console.log(`[Sync] Using server content for ${localChapter.title} (local has no content)`)
                return serverChapter
            })
        })
    }, [serverChapters])


    const router = useRouter()
    const [currentIndex, setCurrentIndex] = useState(0)
    const [completed, setCompleted] = useState<Set<string>>(new Set())
    const [generatingNext, setGeneratingNext] = useState<string | null>(null)
    const [initializing, setInitializing] = useState(chapters.length === 0)
    const [generatingChapterId, setGeneratingChapterId] = useState<string | null>(null)
    const [failedChapters, setFailedChapters] = useState<Set<string>>(new Set())

    const processedRef = useRef(new Set<string>())

    // Trigger content generation if plan is new
    useEffect(() => {
        if (chapters.length === 0 && plan.status === 'generating') {
            const init = async () => {
                try {
                    setInitializing(true)
                    console.log("Initializing plan outline...")

                    // document_context is now read from DB inside generatePlanContent
                    const res = await generatePlanContent(plan.id)
                    console.log(`[Client] generatePlanContent called for plan ID: ${plan.id}`)
                    if (res.success) {
                        // Don't set initializing to false here. 
                        // Wait for the router.refresh() to bring in the new chapters.
                        router.refresh()
                    }
                } catch (e: any) {
                    console.error("Initialization Failed", e)
                    alert(`Generation Failed: ${e.message || "Unknown error"}`)
                }
            }
            init()
        } else if (chapters.length > 0) {
            setInitializing(false)
        }
    }, [chapters.length, plan.status, plan.id, router])

    // Queue: Process chapters that are just outlines (missing explanation)
    useEffect(() => {
        if (initializing || chapters.length === 0) return

        const processQueue = async () => {
            // 1. Check for Pending Generations (English Step)
            const pendingChapter = chapters.find(c =>
                (!c.explanation || c.explanation === "") &&
                c.id !== generatingChapterId &&
                !failedChapters.has(c.id) &&
                !processedRef.current.has(c.id)
            )

            if (pendingChapter) {
                console.log(`[Client] Processing queue. Found pending: ${pendingChapter.title} (${pendingChapter.id})`)
                // Mark as processed IMMEDIATELY to prevent double-firing
                processedRef.current.add(pendingChapter.id)
                setGeneratingChapterId(pendingChapter.id)

                try {
                    console.log(`[Client] Calling Step 1 (English) for ${pendingChapter.id}...`)
                    const res = await generateEnglishContent(pendingChapter.id)

                    if (res.success && res.data) {
                        console.log(`[Client] Step 1 success!`)
                        console.log(`[Client] res.data:`, JSON.stringify(res.data, null, 2))
                        console.log(`[Client] res.data.explanation exists:`, !!res.data.explanation)
                        console.log(`[Client] res.data.explanation length:`, res.data.explanation?.length)

                        // Direct Update (Optimistic-ish)
                        setChapters(prev => {
                            const updated = prev.map(c =>
                                c.id === pendingChapter.id
                                    ? { ...c, ...res.data } // Merge new content (explanation, etc)
                                    : c
                            )
                            const exp = updated.find(c => c.id === pendingChapter.id)?.explanation
                            console.log(`[Client] Updated chapter explanation:`, typeof exp === 'string' ? exp.substring(0, 50) : typeof exp)
                            return updated
                        })

                        router.refresh() // Background sync

                        // Check if we need translation immediately?
                        // Actually, next render will pick it up in Step 2 block below if needed.
                    } else {
                        throw new Error("API returned failure")
                    }
                } catch (e) {
                    console.error(`[Client] Chapter generation failed for ${pendingChapter.id}`, e)
                    setFailedChapters(prev => new Set(prev).add(pendingChapter.id))
                } finally {
                    setGeneratingChapterId(null)
                }
                return; // One at a time
            }

            // NOTE: Translation step removed - English only for now

        }

        processQueue()
    }, [chapters, initializing, router])

    // Update URL hash for sharing/bookmarking
    useEffect(() => {
        if (!initializing && chapters.length > 0) {
            window.history.replaceState(null, '', `#chapter-${indexToId(currentIndex)}`)
        }
    }, [currentIndex, initializing, chapters])

    const indexToId = (i: number) => chapters[i]?.id

    const retryChapter = (chapterId: string) => {
        setFailedChapters(prev => {
            const next = new Set(prev)
            next.delete(chapterId)
            return next
        })
    }

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
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
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

    if (initializing || !currentChapter) {
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
        <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans text-gray-900">
            {/* Sidebar for Desktop */}
            <aside className="w-full md:w-80 border-r border-gray-100 bg-gray-50/50 flex-shrink-0 h-auto md:h-screen md:sticky md:top-0 overflow-y-auto hidden md:block">
                <div className="p-6">
                    <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back to Home
                    </Link>
                    <h1 className="font-bold text-xl mb-2 text-gray-900 leading-tight">{plan.topic}</h1>
                    <div className="flex gap-2 text-xs text-gray-500 uppercase tracking-wider font-medium">
                        <span>{plan.level}</span>
                        <span>•</span>
                        <span>{plan.urgency}</span>
                    </div>
                </div>

                <div className="px-3 pb-6">
                    <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Chapters</h3>
                    <nav className="space-y-0.5">
                        {chapters.map((chapter: any, index: number) => (
                            <button
                                key={chapter.id}
                                onClick={() => {
                                    setCurrentIndex(index)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                                className={`w-full text-left block px-3 py-2 rounded-lg text-sm transition-colors ${index === currentIndex
                                    ? 'bg-amber-100/50 text-amber-900 font-medium'
                                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="flex-shrink-0 mt-0.5">
                                        {completed.has(chapter.id) ? (
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <Circle className={`w-4 h-4 ${index === currentIndex ? 'text-amber-500' : 'text-gray-300'}`} />
                                        )}
                                    </span>
                                    <span className="line-clamp-2">{chapter.title}</span>
                                </div>
                            </button>
                        ))}
                    </nav>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-4xl mx-auto md:px-12 py-8 md:py-12">
                {/* Mobile Header - Compact for mobile */}
                <div className="md:hidden px-4 mb-8">
                    <Link href="/" className="inline-flex items-center text-sm text-gray-500 mb-4">
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Home
                    </Link>
                    <h1 className="font-bold text-2xl text-gray-900">{plan.topic}</h1>
                    {/* Mobile chapter selector could go here if needed, but horizontal list is simpler for now */}
                </div>

                <div className="max-w-3xl mx-auto px-4 pb-20">
                    {/* Progress Bar */}
                    <div className="fixed top-[0px] md:top-[0px] left-0 right-0 h-1 bg-gray-100 z-50 md:hidden">
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
                                    {(!currentChapter.explanation || currentChapter.explanation === "") ? (
                                        failedChapters.has(currentChapter.id) ? (
                                            <div className="flex flex-col items-center justify-center p-12 text-center text-red-500 space-y-4">
                                                <div className="bg-red-50 p-4 rounded-full">
                                                    <span className="text-2xl">⚠️</span>
                                                </div>
                                                <p className="font-medium">Failed to write this chapter.</p>
                                                <button
                                                    onClick={() => retryChapter(currentChapter.id)}
                                                    className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    Retry Generation
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 space-y-4">
                                                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                                                <p>Writing this chapter...</p>
                                                <p className="text-xs text-gray-400">Step 1: Drafting Concepts (English)...</p>
                                            </div>
                                        )
                                    ) : (
                                        <>
                                            {/* Mental Model - Only show in standard mode */}
                                            {plan.mode !== 'story' && currentChapter.mental_model && (
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
                                                <AIImage
                                                    prompt={currentChapter.visual_content}
                                                    autoGenerate={plan.mode === 'story'}
                                                />
                                            )}

                                            <div className="prose prose-lg prose-gray max-w-none font-serif text-gray-700 leading-relaxed">
                                                <ReactMarkdown>{currentChapter.explanation}</ReactMarkdown>
                                            </div>

                                            {/* Common Misconception - Hide in Story Mode */}
                                            {plan.mode !== 'story' && currentChapter.common_misconception && (
                                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-5">
                                                    <span className="flex items-center gap-2 text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">
                                                        <span className="text-lg">⚠️</span> Common Myth
                                                    </span>
                                                    <p className="text-rose-950 font-medium text-base">
                                                        {currentChapter.common_misconception}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Real World Example - Hide in Story Mode */}
                                            {plan.mode !== 'story' && currentChapter.real_world_example && (
                                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                                                    <span className="block text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Real World Example</span>
                                                    <p className="text-blue-900 font-medium text-lg italic">
                                                        "{currentChapter.real_world_example}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Quiz / Active Recall - Hide in Story Mode */}
                                            {plan.mode !== 'story' && currentChapter.quiz_question && (
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
                                        </>
                                    )}

                                    {/* Key Takeaway - Hide in Story Mode unless we want it as 'Moral' */}
                                    {plan.mode !== 'story' && (
                                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 mt-8">
                                            <span className="block text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Key Takeaway</span>
                                            <p className="text-amber-900 font-medium text-lg">
                                                {currentChapter.key_takeaway}
                                            </p>
                                        </div>
                                    )}
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
                                        {plan.mode === 'story' ? 'Next Scene' : 'Mark as Understood'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleNext}
                                        disabled={currentIndex === chapters.length - 1}
                                        className="bg-green-600 text-white px-8 py-4 rounded-xl font-medium hover:bg-green-700 transition-all flex items-center gap-3 shadow-lg"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        {currentIndex === chapters.length - 1 ? 'Finish Story' : 'Next Chapter'}
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
            </main>
        </div>
    )
}
