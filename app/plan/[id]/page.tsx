import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

import PlanClient from './client'

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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

    return <PlanClient plan={plan} chapters={chapters} />
}
