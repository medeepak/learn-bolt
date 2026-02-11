'use client'

import React from 'react'
import { CheckCircle, Circle, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import AIImage from './AIImage'
import MermaidDiagram from './MermaidDiagram'
import SimpleTable from './SimpleTable'

const MobileChapterCard = ({
    chapter,
    plan,
    index,
    total,
    failed,
    retry,
    isLast,
    isExport
}: {
    chapter: any,
    plan: any,
    index: number,
    total: number,
    failed: boolean,
    retry: () => void,
    isLast: boolean,
    isExport?: boolean
}) => {
    const cardContent = (
        <div className={`w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col border border-gray-200 relative ${isExport ? 'h-auto min-h-[600px] shadow-none border-0' : 'h-[85vh]'}`}>

            {/* Image Section - Fixed Height */}
            {/* FIX: Removed overflow-y-auto on image container if present, added relative overflow-hidden */}
            <div className="h-[45%] bg-gray-50 flex-shrink-0 relative border-b border-gray-100 overflow-hidden">
                {(() => {
                    // Helper to parse visual content which might be JSON (prompt + url) or just string (prompt)
                    let prompt = chapter.visual_content
                    let imageUrl = null

                    if (chapter.visual_type === 'image' && chapter.visual_content) {
                        try {
                            if (chapter.visual_content.trim().startsWith('{')) {
                                const parsed = JSON.parse(chapter.visual_content)
                                if (parsed.prompt) prompt = parsed.prompt
                                if (parsed.url) imageUrl = parsed.url
                            }
                        } catch (e) { }
                    }

                    if (chapter.visual_type === 'image') {
                        return (
                            <AIImage
                                prompt={prompt}
                                chapterId={chapter.id}
                                initialUrl={imageUrl}
                                autoGenerate={plan.mode === 'story'}
                                className="w-full h-full"
                                imgClassName="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                            />
                        )
                    } else if (chapter.visual_content) {
                        return (
                            <div className="w-full h-full overflow-auto flex items-center justify-center bg-gray-50/50 p-4">
                                {chapter.visual_type === 'mermaid' ? (
                                    <MermaidDiagram chart={chapter.visual_content} />
                                ) : chapter.visual_type === 'react' ? (
                                    <SimpleTable dataStr={chapter.visual_content} />
                                ) : (
                                    <div className="text-sm text-gray-500 italic text-center p-6">{chapter.visual_content}</div>
                                )}
                            </div>
                        )
                    } else {
                        return (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                                <Circle className="w-12 h-12 opacity-20" />
                            </div>
                        )
                    }
                })()}

                {/* Badge Overlay */}
                <div className="absolute top-4 right-4 z-10 flex gap-2">
                    {plan.mode === 'story' && (
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-100/90 backdrop-blur px-2 py-1 rounded-full shadow-sm border border-amber-200">
                            Story Mode
                        </span>
                    )}
                    <span className="text-[10px] font-bold text-gray-500 bg-white/90 backdrop-blur px-2 py-1 rounded-full shadow-sm border border-gray-100">
                        {index + 1}/{total}
                    </span>
                </div>
            </div>

            {/* Content Section - Scrollable */}
            <div className={`flex-1 p-6 relative bg-white ${isExport ? 'overflow-visible' : 'overflow-y-auto'}`}>
                <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-4 font-serif">
                    {chapter.title}
                </h2>

                {(!chapter.explanation) ? (
                    failed ? (
                        <div className="text-center p-8 text-red-500 bg-red-50 rounded-xl my-4">
                            <p className="mb-2 text-sm font-medium">Failed to load content.</p>
                            <button onClick={retry} className="px-4 py-2 bg-white border border-red-200 rounded-lg text-xs font-bold text-red-600 shadow-sm">Tap to Retry</button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-pulse mt-6">
                            <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-100 rounded w-full"></div>
                            <div className="h-4 bg-gray-100 rounded w-5/6"></div>
                            <div className="h-20 bg-gray-50 rounded-xl w-full mt-4"></div>
                        </div>
                    )
                ) : (
                    <div className="prose prose-sm prose-gray max-w-none text-gray-600 leading-relaxed pb-8">
                        <ReactMarkdown>{chapter.explanation}</ReactMarkdown>
                    </div>
                )}
            </div>

            {/* Footer / Navigation Hint */}
            <div className="p-4 border-t border-gray-50 bg-white flex justify-between items-center text-xs text-gray-400">
                <div className="flex flex-col">
                    {!isExport && <span className="font-medium text-gray-300 uppercase tracking-widest text-[10px]">Swipe for next</span>}
                </div>
                {isLast && (
                    <div className="text-green-600 font-bold flex items-center gap-1 bg-green-50 px-3 py-1 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Done
                    </div>
                )}
            </div>
        </div>
    )

    if (isExport) {
        return cardContent
    }

    return (
        <section
            className="h-[100dvh] w-full snap-start flex flex-col items-center justify-center p-4 bg-gray-100"
            data-index={index}
        >
            {cardContent}
        </section>
    )
}

export default MobileChapterCard
