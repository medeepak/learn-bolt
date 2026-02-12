
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://twxvnptdktjrgyhibetd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3eHZucHRka3Rqcmd5aGliZXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTQ0NDcsImV4cCI6MjA4NTkzMDQ0N30.6OAH1UmnbCPhDvhkDBTkXzGEGdE-2Er_dYlSv8lm9uA'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function checkLatestPlan() {
    console.log(`Checking latest plan...`)

    const { data: plans, error } = await supabase
        .from('learning_plans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

    if (error || !plans || plans.length === 0) {
        console.error('Error fetching plan:', error)
        return
    }

    const plan = plans[0]
    console.log('Latest Plan:', plan.id)
    console.log('Topic:', plan.topic)
    console.log('Status:', plan.status)
    console.log('Context Length:', plan.document_context ? plan.document_context.length : 0)

    const { count } = await supabase
        .from('chapters')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', plan.id)

    console.log(`Chapter Count: ${count}`)
}

checkLatestPlan()
