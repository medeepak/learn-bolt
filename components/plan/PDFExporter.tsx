'use client'

import React, { useRef, useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import MobileChapterCard from './MobileChapterCard'

interface PDFExporterProps {
    plan: any
    chapters: any[]
}

const PDFExporter = ({ plan, chapters }: PDFExporterProps) => {
    const [isGenerating, setIsGenerating] = useState(false)
    const printRef = useRef<HTMLDivElement>(null)

    const handleExport = async () => {
        if (!printRef.current || isGenerating) return

        try {
            setIsGenerating(true)

            // Wait for any images to load/render in the hidden container
            await new Promise(resolve => setTimeout(resolve, 2000))

            const chapterElements = printRef.current.children
            if (chapterElements.length === 0) return

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
            })

            for (let i = 0; i < chapterElements.length; i++) {
                const element = chapterElements[i] as HTMLElement
                // Force white background for the capture
                element.style.backgroundColor = 'white'

                const dataUrl = await toPng(element, {
                    cacheBust: true,
                    backgroundColor: '#ffffff',
                    pixelRatio: 2 // Improve quality
                })

                const imgProps = pdf.getImageProperties(dataUrl)
                // We want to use the image's dimensions for the page to avoid whitespace/scaling issues
                // Convert px to mm (approx 1px = 0.264583 mm)
                const imgWidthMm = imgProps.width * 0.264583
                const imgHeightMm = imgProps.height * 0.264583

                // If first page, set its size. Otherwise add new page with size.
                if (i === 0) {
                    // There isn't a clean way to resize the first page in standard jsPDF without internal hacking or just creating it right.
                    // But we can just set page size for the next pages. 
                    // For the first page, let's try to match it or just accept standard A4 if we can't change it easily on fly.
                    // Actually, we can pass format to addPage.
                    // Let's delete the initial blank page or just reuse it? 
                    // Best approach: create PDF with first image size.
                }

                // Actually, simpler approach:
                // If i > 0, pdf.addPage([imgWidthMm, imgHeightMm])
                // If i == 0, we can try to set the page size of current page.

                if (i > 0) {
                    pdf.addPage([imgWidthMm, imgHeightMm], imgWidthMm > imgHeightMm ? 'l' : 'p')
                    pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidthMm, imgHeightMm)
                } else {
                    // It's tricky to resize the first page cleanly in all jsPDF versions. 
                    // Let's just create the PDF with the first image's size if possible, 
                    // OR just blindly add image.
                    // A trick: create PDF, delete page 1, then add pages? 
                    // Let's try explicit setPage or just addImage and let it clip/fit?
                    // No, we want custom size.

                    // Let's re-initialize one PDF per loop? No, that's multiple files.

                    // Let's try this:
                    // We can just use the internal method to reset page size if needed, but risky.
                    // Safer: standard A4 for all, or scaling. 
                    // BUT User requested "no excess whitespace". Custom size is best.

                    // Re-instantiate PDF with first image dimensions? We can't await inside the constructor args easily.
                    // Ok, let's assume standard width (mobile) maps to A4 width, and we scale height.
                    // If height is very long, we split? No, user wants "one page per chapter".
                    // So we MUST enable long pages.

                    // Workaround: delete first page and add new one with correct size?
                    pdf.deletePage(1)
                    pdf.addPage([imgWidthMm, imgHeightMm], imgWidthMm > imgHeightMm ? 'l' : 'p')
                    pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidthMm, imgHeightMm)
                }
            }

            pdf.save(`${plan.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_plan.pdf`)

        } catch (e) {
            console.error('PDF Generation failed', e)
            alert(`Failed to generate PDF: ${e instanceof Error ? e.message : 'Unknown error'}`)
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <>
            <button
                onClick={handleExport}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
            >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Export PDF
            </button>

            {/* Hidden Print Container */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '375px' }}>
                <div ref={printRef}>
                    {chapterElements(plan, chapters)}
                </div>
            </div>
        </>
    )
}

// Helper to render chapters for print
// We reuse MobileChapterCard but force specific styling for print
const chapterElements = (plan: any, chapters: any[]) => {
    return chapters.map((chapter, i) => (
        <div key={chapter.id} className="relative bg-white w-[375px] min-h-[667px] h-auto overflow-visible flex flex-col border border-gray-100 mb-10">
            {/* 
              We can't just drop MobileChapterCard because it relies on viewport heights (h-[100dvh], h-[45%]).
              For export, we need fixed heights to ensure html2canvas captures it correctly off-screen.
              So we mock the container to be standard mobile size (375x667 - iPhone 8-ish or 390x844).
              Let's use 375x667 as a base "card" size.
            */}
            <MobileChapterCard
                chapter={chapter}
                plan={plan}
                index={i}
                total={chapters.length}
                failed={false}
                retry={() => { }}
                isLast={false}
                isExport={true}
            />
        </div>
    ))
}

export default PDFExporter
