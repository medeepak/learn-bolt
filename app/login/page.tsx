import { Zap } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
            <Link href="/" className="flex items-center gap-2 font-semibold text-xl tracking-tight text-gray-900 mb-8">
                <Zap className="w-6 h-6 text-amber-500 fill-amber-500" />
                <span>Express Learning</span>
            </Link>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-md text-center">
                <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
                <p className="text-gray-500 mb-6">Enter your email to access your learning plans.</p>

                <form className="space-y-4">
                    <div>
                        <input
                            type="email"
                            placeholder="name@example.com"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                    </div>
                    <button className="w-full bg-gray-900 text-white font-medium py-3 rounded-xl hover:bg-gray-800 transition-colors">
                        Continue with Email
                    </button>
                </form>

                <div className="mt-8 text-sm text-gray-400">
                    <p>Protected by Supabase Auth.</p>
                    <Link href="/" className="text-gray-900 underline mt-2 inline-block">Back to Home</Link>
                </div>
            </div>
        </div>
    )
}
