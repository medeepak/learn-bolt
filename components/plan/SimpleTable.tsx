'use client'

import React from 'react'

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

export default SimpleTable
