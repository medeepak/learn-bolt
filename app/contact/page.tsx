import Link from 'next/link'
import { ChevronLeft, Mail, MapPin } from 'lucide-react'

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Home
                </Link>

                <h1 className="text-3xl font-bold text-gray-900 mb-8">Contact Us</h1>

                <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
                    <p className="text-lg text-gray-600 mb-8">
                        Have questions, feedback, or need support? We'd love to hear from you.
                    </p>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                <Mail className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Email Us</h3>
                                <p className="text-gray-600">support@tinylessons.com</p>
                                <p className="text-sm text-gray-400 mt-1">We typically reply within 24 hours.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                <MapPin className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Location</h3>
                                <p className="text-gray-600">San Francisco, CA</p>
                                <p className="text-sm text-gray-400 mt-1">Remote-first team.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
