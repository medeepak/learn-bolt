'use client'

import React, { useState, useEffect } from 'react'
import mermaid from 'mermaid'

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

                // Robust regex for {}
                cleanChart = cleanChart.replace(/\{([^}]+)\}/g, (match, content) => {
                    // Try to quote content inside braces if not quoted
                    const trimmed = content.trim();
                    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return match;
                    // Check if likely JSON-like object content which might break mermaid if blindly quoted?
                    // But for flowchart nodes {text}, quoting is safer.
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
                };

                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
                const { svg } = await mermaid.render(id, cleanChart);
                setSvg(svg)
            } catch (e) {
                console.error('Mermaid render error', e)
                setError(true)
                setSvg('')
            }
        }
        render()
    }, [chart])

    if (error || !svg) {
        return null;
    }

    return <div className="p-4 bg-white/50 rounded-xl flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
}

export default MermaidDiagram
