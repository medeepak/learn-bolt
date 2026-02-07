'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Clock, Zap, BookOpen, Search, User, FileUp, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateLearningPlan } from './actions/generate'
import { useEffect } from 'react'

import { Suspense } from 'react'

function HomeContent() {
  const [topic, setTopic] = useState('')
  const [urgency, setUrgency] = useState('2h')
  const [level, setLevel] = useState('beginner')
  const [language, setLanguage] = useState('english')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const topicParam = searchParams.get('topic')
    if (topicParam) {
      setTopic(topicParam)
    }
  }, [searchParams])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('File too large. Max 10MB.')
        return
      }
      if (!selectedFile.type.includes('pdf')) {
        alert('Only PDF files are supported.')
        return
      }
      setFile(selectedFile)
    }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return

    setLoading(true)
    setStatus('Designing your curriculum...')

    try {
      const formData = new FormData()
      formData.append('topic', topic)
      formData.append('urgency', urgency)
      formData.append('level', level)
      formData.append('language', language)
      if (file) {
        console.log(`[Client] Adding file to FormData: ${file.name}, size: ${file.size}, type: ${file.type}`)
        formData.append('document', file)
      } else {
        console.log('[Client] No file selected')
      }

      console.log('[Client] Calling generateLearningPlan...')
      const res = await generateLearningPlan(formData)
      if (res && res.success && res.planId) {
        router.push(`/plan/${res.planId}`)
      } else {
        throw new Error("Failed to get plan ID")
      }
    } catch (err: any) {
      console.error("Generation failed", err)
      alert(`Error: ${err.message || "Something went wrong"}`)
      setLoading(false)
      setStatus('')
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2 font-semibold text-xl tracking-tight text-gray-900">
          <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
          <span>Express Learning</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link href="/library" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Library
          </Link>
          <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Log in
          </Link>
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
            <User className="w-4 h-4" />
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-24 bg-gradient-to-b from-gray-50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl text-center space-y-8"
        >
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900">
              Learn anything, <span className="text-amber-600">fast.</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-lg mx-auto leading-relaxed">
              Just-in-time learning plans for when you don&apos;t have time for a course.
              Visual, concise, and ready in minutes.
            </p>
          </div>

          {/* Input Card */}
          <div className="bg-white p-2 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col md:flex-row gap-2">
            <div className="flex-1 flex items-center px-4 bg-gray-50 rounded-xl">
              <Search className="w-5 h-5 text-gray-400 mr-3" />
              <input
                type="text"
                placeholder="What do you need to learn urgently?"
                className="w-full bg-transparent py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate(e)}
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || loading}
              className="bg-gray-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[160px]"
            >
              {loading ? (
                <span className="animate-pulse">{status || 'Thinking...'}</span>
              ) : (
                <>
                  Start Learning
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Context Selectors */}
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 text-gray-600">
              <Clock className="w-4 h-4 text-gray-400" />
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer appearance-none pr-2 hover:text-gray-900"
              >
                <option value="2h">I have 2 hours</option>
                <option value="today">I have today</option>
                <option value="week">I have this week</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 text-gray-600">
              <BookOpen className="w-4 h-4 text-gray-400" />
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer appearance-none pr-2 hover:text-gray-900"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* File Upload Pill */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 text-gray-600">
              <FileUp className="w-4 h-4 text-gray-400" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm truncate max-w-[150px]">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm hover:text-gray-900"
                >
                  Upload PDF
                </button>
              )}
            </div>
          </div>

          {/* Examples */}
          <div className="pt-8 flex flex-wrap justify-center gap-3">
            <span className="text-gray-400 text-sm py-1">Try:</span>
            {['Restaurant cash flow', 'React useEffect hook', 'Series A funding'].map((ex) => (
              <button
                key={ex}
                onClick={() => setTopic(ex)}
                className="text-sm px-3 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}
