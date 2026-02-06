import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, CheckCircle, Circle, Menu } from 'lucide-react'
import PlanClient from './client'

export const maxDuration = 60;

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    // Fetch Plan
    const { data: plan, error: planError } = await supabase
        .from('learning_plans')
        .select('*')
        .eq('id', id)
        .single()

    if (planError || !plan) {
        redirect('/')
    }

    // Fetch Chapters
    const { data: chapters, error: chapterError } = await supabase
        .from('chapters')
        .select('*')
        .eq('plan_id', id)
        .order('order', { ascending: true })

    if (chapterError) {
        console.error(chapterError)
        return <div>Error loading chapters</div>
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
                        {chapters.map((chapter) => (
                            <a key={chapter.id} href={`#chapter-${chapter.id}`} className="block px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 transition-colors">
                                <div className="flex items-start gap-3">
                                    <span className="flex-shrink-0 mt-0.5">
                                        {chapter.is_completed ? (
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <Circle className="w-4 h-4 text-gray-300" />
                                        )}
                                    </span>
                                    <span className="line-clamp-2">{chapter.title}</span>
                                </div>
                            </a>
                        ))}
                    </nav>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-4xl mx-auto md:px-12 py-8 md:py-12">
                {/* Mobile Header */}
                <div className="md:hidden px-4 mb-8">
                    <Link href="/" className="inline-flex items-center text-sm text-gray-500 mb-4">
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Home
                    </Link>
                    <h1 className="font-bold text-2xl text-gray-900">{plan.topic}</h1>
                </div>

                <PlanClient plan={plan} chapters={chapters} />
            </main>
        </div>
    )
}
