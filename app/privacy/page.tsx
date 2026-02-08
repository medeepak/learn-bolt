import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Home
                </Link>

                <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

                <div className="prose prose-gray max-w-none">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <h2>1. Introduction</h2>
                    <p>Welcome to Tiny Lessons ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy.</p>

                    <h2>2. Information We Collect</h2>
                    <p>We collect information that you provide directly to us, such as when you create a generalized learning plan. This may include uploaded documents which are processed transiently for the purpose of generating content.</p>

                    <h2>3. How We Use Your Information</h2>
                    <p>We use the information we collect to operate, maintain, and improve our services, including generating personalized learning plans and course materials.</p>

                    <h2>4. Data Security</h2>
                    <p>We implement appropriate technical and organizational measures to protect the security of your personal information.</p>

                    <h2>5. Contact Us</h2>
                    <p>If you have questions or comments about this policy, you may contact us via our Contact page.</p>
                </div>
            </div>
        </div>
    )
}
