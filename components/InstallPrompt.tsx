'use client'

import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [showPrompt, setShowPrompt] = useState(false)
    const [isIOS, setIsIOS] = useState(false)

    useEffect(() => {
        // Check if running on iOS
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone = (window.navigator as any).standalone;

        if (isIosDevice && !isStandalone) {
            // Optionally show iOS instructions logic here, 
            // but for now we focus on standard PWA install prompt logic (Android/Desktop)
            // or we can show a specific iOS banner.
            setIsIOS(true);
            // Don't show immediately? The user asked "ask to install on loading".
            // On iOS there is no programmatic install, so we trigger a banner.

            // Only show if not already dismissed in session? 
            // For now, show on load.
            if (!sessionStorage.getItem('installPromptDismissed')) {
                setShowPrompt(true);
            }
        }

        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault()
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e)
            // Update UI notify the user they can install the PWA
            if (!sessionStorage.getItem('installPromptDismissed')) {
                setShowPrompt(true)
            }
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        }
    }, [])

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            // Show the install prompt
            deferredPrompt.prompt()
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice
            // We've used the prompt, and can't use it again, throw it away
            setDeferredPrompt(null)
            setShowPrompt(false)
        } else if (isIOS) {
            // For iOS, we can't trigger install, so just dismiss implementation or show instructions
            // For now, just dismiss
            setShowPrompt(false)
            sessionStorage.setItem('installPromptDismissed', 'true')
        }
    }

    const handleDismiss = () => {
        setShowPrompt(false)
        sessionStorage.setItem('installPromptDismissed', 'true')
    }

    if (!showPrompt) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-in slide-in-from-bottom duration-500">
            <div className="bg-gray-900/95 backdrop-blur-sm text-white p-4 rounded-xl shadow-2xl flex items-center justify-between max-w-md mx-auto border border-gray-700">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-500 p-2 rounded-lg">
                        <Download className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Install App</h3>
                        <p className="text-sm text-gray-300">
                            {isIOS ? 'Tap Share and "Add to Home Screen"' : 'Install for a better experience'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isIOS && (
                        <button
                            onClick={handleInstallClick}
                            className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
                        >
                            Install
                        </button>
                    )}
                    <button
                        onClick={handleDismiss}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
            </div>
        </div>
    )
}
