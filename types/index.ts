export type Chapter = {
    title: string
    explanation: string
    real_world_example: string
    visual_type: 'mermaid' | 'react' | 'image'
    visual_content: string
    key_takeaway: string
    order: number
}

export type LearningPlan = {
    topic: string
    urgency: string
    level: string
    language: string
    chapters: Chapter[]
    next_steps: string[]
}
