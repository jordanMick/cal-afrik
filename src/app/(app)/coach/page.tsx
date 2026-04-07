'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'

type Role = 'user' | 'coach'

interface Message {
    id: string;
    role: Role;
    content: string;
    timestamp: Date;
}

export default function CoachChatPage() {
    const router = useRouter()
    const { profile, slots } = useAppStore()
    const effectiveTier = getEffectiveTier(profile)

    // Limites en fonction du plan
    const limits = {
        free: 1,
        pro: 10,
        premium: 30
    }

    const maxMessages = limits[effectiveTier] || 1

    // Messages mockés pour la démo UI
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'coach', content: `Bonjour ${profile?.name || 'mon ami'} ! Je suis ton coach Yao 🤖. Nutritionniste et expert en plats africains. Que puis-je faire pour t'aider à atteindre ton objectif aujourd'hui ?`, timestamp: new Date() }
    ])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [messagesUsedToday, setMessagesUsedToday] = useState(0) // Mock du quota

    const endOfMessagesRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isTyping])

    const handleSendMessage = () => {
        if (!input.trim()) return
        if (messagesUsedToday >= maxMessages) return

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setMessagesUsedToday(prev => prev + 1)
        setIsTyping(true)

        // Mock IA Response
        setTimeout(() => {
            setIsTyping(false)
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'coach',
                content: "Ceci est une réponse générée par l'IA pour tester l'interface. Plus tard, nous brancherons ici l'API Gemini pour de vraies recommandations !",
                timestamp: new Date()
            }])
        }, 1500)
    }

    const limitReached = messagesUsedToday >= maxMessages

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto', position: 'relative' }}>
            
            {/* HEADER */}
            <div style={{ padding: '20px', background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(10px)', borderBottom: '0.5px solid #222', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ position: 'relative' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '16px', background: 'linear-gradient(135deg, #f59e0b, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}>
                        🤖
                    </div>
                    {/* Status dot */}
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: '12px', height: '12px', background: '#10b981', border: '2px solid #0a0a0a', borderRadius: '50%' }} />
                </div>
                <div>
                    <h1 style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>Coach Yao</h1>
                    <p style={{ color: '#10b981', fontSize: '12px', fontWeight: '500' }}>En ligne</p>
                </div>
            </div>

            {/* MESSAGES AREA */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '30px' }}>
                {messages.map((msg) => {
                    const isCoach = msg.role === 'coach'
                    return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isCoach ? 'flex-start' : 'flex-end', width: '100%' }}>
                            <div style={{
                                maxWidth: '85%',
                                padding: '14px 16px',
                                borderRadius: isCoach ? '4px 20px 20px 20px' : '20px 20px 4px 20px',
                                background: isCoach ? '#141414' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                                color: '#fff',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                                border: isCoach ? '0.5px solid #222' : 'none'
                            }}>
                                {msg.content}
                            </div>
                            <span style={{ color: '#555', fontSize: '10px', marginTop: '6px', margin: isCoach ? '0 0 0 4px' : '0 4px 0 0' }}>
                                {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    )
                })}
                
                {isTyping && (
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ padding: '14px 20px', borderRadius: '4px 20px 20px 20px', background: '#141414', border: '0.5px solid #222', display: 'flex', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', background: '#6366f1', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }} />
                            <span style={{ width: '6px', height: '6px', background: '#6366f1', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }} />
                            <span style={{ width: '6px', height: '6px', background: '#6366f1', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                            <style>{"\
                                @keyframes bounce {\
                                    0%, 80%, 100% { transform: scale(0); }\
                                    40% { transform: scale(1); }\
                                }\
                            "}</style>
                        </div>
                    </div>
                )}
                <div ref={endOfMessagesRef} />
            </div>

            {/* INPUT AREA (FIXED BOTTOM) */}
            <div style={{ padding: '16px 20px', background: '#0a0a0a', borderTop: '0.5px solid #222', paddingBottom: '100px' }}>
                
                {/* JAUGE DE QUOTA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <p style={{ color: '#888', fontSize: '11px', fontWeight: '500' }}>
                        Messages envoyés : <span style={{ color: limitReached ? '#ef4444' : '#fff' }}>{messagesUsedToday}/{maxMessages}</span>
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ padding: '2px 8px', background: effectiveTier === 'free' ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)', color: effectiveTier === 'free' ? '#aaa' : '#818cf8', borderRadius: '10px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>
                            Plan {effectiveTier}
                        </span>
                    </div>
                </div>

                {limitReached ? (
                    <div 
                        onClick={() => router.push('/upgrade')}
                        style={{ 
                            width: '100%', padding: '16px', borderRadius: '16px', 
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(245,158,11,0.1))',
                            border: '1px solid rgba(245,158,11,0.3)',
                            textAlign: 'center', cursor: 'pointer'
                        }}>
                        <p style={{ color: '#fff', fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Limite atteinte 🔒</p>
                        <p style={{ color: '#aaa', fontSize: '12px', marginBottom: '12px' }}>Passez au plan supérieur pour continuer à discuter avec Yao.</p>
                        <button style={{ padding: '8px 20px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                            Voir les plans →
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Pose-moi une question sur ta diète..."
                            style={{ 
                                flex: 1, padding: '16px', borderRadius: '16px', 
                                background: '#141414', border: '0.5px solid #333', 
                                color: '#fff', fontSize: '14px', outline: 'none'
                            }}
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={!input.trim()}
                            style={{ 
                                width: '52px', height: '52px', borderRadius: '16px', 
                                background: input.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : '#222',
                                color: input.trim() ? '#fff' : '#555', border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default',
                                transition: 'all 0.2s'
                            }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
