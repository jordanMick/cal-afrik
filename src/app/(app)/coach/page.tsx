'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { getEffectiveTier, SUBSCRIPTION_RULES } from '@/lib/subscription'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'

type Role = 'user' | 'coach'

interface Message {
    id: string;
    role: Role;
    content: string;
    timestamp: Date;
}

interface PersistedMessage {
    id: string;
    role: Role;
    content: string;
    timestamp: string;
}

interface ChatThread {
    date: string; // YYYY-MM-DD
    messages: PersistedMessage[];
    messagesUsed: number;
    maxMessages: number;
    updatedAt: string;
}

// Supprimé : localStorage migré vers Supabase pour sync cross-device

function toLocalDateKey(d = new Date()): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function getWelcomeMessage(name?: string | null): PersistedMessage {
    return {
        id: 'welcome',
        role: 'coach',
        content: `Bonjour ${name || 'mon ami'} ! Je suis ton coach Yao 🤖. Nutritionniste et expert en plats africains. Que puis-je faire pour t'aider à atteindre ton objectif aujourd'hui ?`,
        timestamp: new Date().toISOString(),
    }
}

function sanitizeThreads(threads: ChatThread[]): ChatThread[] {
    const valid = (threads || [])
        .filter(t => !!t?.date && Array.isArray(t?.messages))
        .map(t => ({
            date: t.date,
            messages: t.messages,
            messagesUsed: Number(t.messagesUsed || 0),
            maxMessages: Number(t.maxMessages || 0),
            updatedAt: t.updatedAt || t.date,
        }))
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    return valid.slice(-3)
}

function detectMenuKind(message: string): { kind: 'today' | 'tomorrow' | 'week', slot?: string } | null {
    const normalized = message
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()

    const hasMealContent = /(petit[- ]?dej|dejeuner|collation|diner)/.test(normalized)
    if (normalized.includes('menu semaine:') && hasMealContent) return { kind: 'week' }
    if (normalized.includes('menu demain:') && hasMealContent) return { kind: 'tomorrow' }
    
    const slotMatch = normalized.match(/menu creneau (petit_dejeuner|dejeuner|collation|diner):/i)
    if (slotMatch && hasMealContent) return { kind: 'today', slot: slotMatch[1] }
    
    return null
}

/**
 * Extrait le bloc ---DATA--- du message de l'IA.
 * Retourne { displayText, dataItems, slot } ou null si absent.
 */
function parseDataBlock(rawMessage: string): {
    displayText: string
    dataItems: Array<{ name: string; volume_ml: number }>
    slot: string
} | null {
    const sep = '---DATA---'
    const idx = rawMessage.indexOf(sep)
    if (idx === -1) return null

    const displayText = rawMessage.substring(0, idx).trim()
    const jsonPart = rawMessage.substring(idx + sep.length).trim()

    // Détection du slot depuis le prefix technique
    const slotMatch = rawMessage.match(/menu creneau (petit_dejeuner|dejeuner|collation|diner):/i)
    const slot = slotMatch ? slotMatch[1] : 'dejeuner'

    try {
        const parsed = JSON.parse(jsonPart)
        if (parsed?.type === 'suggestion' && Array.isArray(parsed.items)) {
            return { displayText, dataItems: parsed.items, slot }
        }
    } catch {
        // JSON malformé : on affiche juste le texte sans le bouton
    }
    return null
}
/**
 * Détecte si un message est un menu "demain" ou "semaine".
 * Retourne { kind, cleanText } ou null.
 */
function parseMenuKind(text: string): { kind: 'tomorrow' | 'week'; cleanText: string } | null {
    const tomorrowMatch = /^menu\s+demain\s*:\s*/i.exec(text)
    if (tomorrowMatch) {
        return { kind: 'tomorrow', cleanText: text.substring(tomorrowMatch[0].length).trim() }
    }
    const weekMatch = /^menu\s+semaine\s*:\s*/i.exec(text)
    if (weekMatch) {
        return { kind: 'week', cleanText: text.substring(weekMatch[0].length).trim() }
    }
    return null
}


export default function CoachChatPage() {
    const router = useRouter()
    const { profile, slots, setLastCoachMessage, setChatSuggestedMenu, chatSuggestedMenus } = useAppStore()
    const effectiveTier = getEffectiveTier(profile)

    const maxMessages = Number(SUBSCRIPTION_RULES[effectiveTier].maxChatMessagesPerDay || 2)

    const todayDate = toLocalDateKey()
    const isToday = profile?.last_usage_reset_date === todayDate
    const initialMessagesUsed = isToday ? (profile?.chat_messages_today || 0) : 0

    const [threads, setThreads] = useState<ChatThread[]>([])
    const [activeThreadDate, setActiveThreadDate] = useState<string>(todayDate)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const [messagesUsedToday, setMessagesUsedToday] = useState(initialMessagesUsed)
    const [isLoadingThreads, setIsLoadingThreads] = useState(false)

    // ── Sauvegarde asynchrone d'un thread vers Supabase ──────────────
    const saveThreadToSupabase = async (thread: ChatThread, userId: string) => {
        try {
            await supabase
                .from('coach_chat_threads')
                .upsert({
                    user_id: userId,
                    date: thread.date,
                    messages: thread.messages,
                    messages_used: thread.messagesUsed,
                    max_messages: thread.maxMessages,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id,date' })
        } catch (err) {
            console.error('⚠️ saveThreadToSupabase error:', err)
        }
    }

    // Synchroniser si le profil change en arrière-plan
    useEffect(() => {
        setMessagesUsedToday(profile?.last_usage_reset_date === todayDate ? (profile?.chat_messages_today || 0) : 0)
    }, [profile, todayDate])

    // Historique persistant : chargé depuis Supabase (sync cross-device)
    useEffect(() => {
        if (!profile) return
        const uid = profile.user_id || profile.id
        if (!uid) return

        const loadFromSupabase = async () => {
            setIsLoadingThreads(true)
            try {
                const threeDaysAgo = new Date()
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
                const sinceDate = threeDaysAgo.toISOString().split('T')[0]

                const { data, error } = await supabase
                    .from('coach_chat_threads')
                    .select('*')
                    .eq('user_id', uid)
                    .gte('date', sinceDate)
                    .order('date', { ascending: true })

                let stored: ChatThread[] = []
                if (!error && data) {
                    stored = sanitizeThreads(data.map((t: any) => ({
                        date: t.date,
                        messages: t.messages || [],
                        messagesUsed: t.messages_used || 0,
                        maxMessages: t.max_messages || maxMessages,
                        updatedAt: t.updated_at || t.date,
                    })))
                }

                const todayThread = stored.find(t => t.date === todayDate)
                if (!todayThread) {
                    const newThread: ChatThread = {
                        date: todayDate,
                        messages: [getWelcomeMessage(profile?.name)],
                        messagesUsed: 0,
                        maxMessages,
                        updatedAt: new Date().toISOString(),
                    }
                    stored.push(newThread)
                    await saveThreadToSupabase(newThread, uid)
                } else {
                    if (todayThread.messages.length === 0) {
                        todayThread.messages = [getWelcomeMessage(profile?.name)]
                        todayThread.updatedAt = new Date().toISOString()
                    }
                    // Toujours synchroniser le max avec le plan actuel
                    todayThread.maxMessages = maxMessages
                }

                const trimmed = sanitizeThreads(stored)
                setThreads(trimmed)
                setActiveThreadDate(todayDate)
            } catch (err) {
                console.error('❌ loadFromSupabase chat error:', err)
            } finally {
                setIsLoadingThreads(false)
            }
        }

        loadFromSupabase()
    }, [todayDate, profile?.user_id, profile?.id, profile?.name, maxMessages])

    useEffect(() => {
        const thread = threads.find(t => t.date === activeThreadDate)
        if (!thread) {
            setMessages([])
            return
        }
        setMessages(
            thread.messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.timestamp),
            }))
        )
    }, [threads, activeThreadDate])

    const endOfMessagesRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isTyping])

    const persistMessagesForThread = (threadDate: string, nextMessages: Message[], incrementUsage: boolean = false) => {
        const persisted: PersistedMessage[] = nextMessages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp.toISOString(),
        }))

        setThreads(prev => {
            const existing = prev.find(t => t.date === threadDate)
            const updated = existing
                ? prev.map(t => (t.date === threadDate ? {
                    ...t,
                    messages: persisted,
                    messagesUsed: incrementUsage ? Math.min(t.maxMessages, (t.messagesUsed || 0) + 1) : t.messagesUsed,
                    updatedAt: new Date().toISOString(),
                } : t))
                : [...prev, {
                    date: threadDate,
                    messages: persisted,
                    messagesUsed: incrementUsage ? 1 : 0,
                    maxMessages,
                    updatedAt: new Date().toISOString(),
                }]
            const trimmed = sanitizeThreads(updated)

            // Sauvegarde asynchrone vers Supabase (fire-and-forget)
            const uid = profile?.user_id || profile?.id
            const threadToSave = trimmed.find(t => t.date === threadDate)
            if (uid && threadToSave) saveThreadToSupabase(threadToSave, uid)

            return trimmed
        })
    }

    const handleSendMessage = async () => {
        const activeThread = threads.find(t => t.date === activeThreadDate)
        if (!input.trim()) return
        if (!activeThread) return
        if ((activeThread.messagesUsed || 0) >= (activeThread.maxMessages || maxMessages)) {
            alert("Limite de messages atteinte pour cette discussion.")
            return
        }

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() }
        const newMessagesContext = [...messages, userMsg]
        setMessages(newMessagesContext)
        persistMessagesForThread(activeThreadDate, newMessagesContext)
        setInput('')
        setIsTyping(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const dailyConsumed = Object.values(slots).reduce((acc, s) => acc + s.consumed, 0)
            const contextStr = `Cible: ${profile?.calorie_target || 2000} kcal. Déjà consommé aujourd'hui: ${Math.round(dailyConsumed)} kcal.`

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ 
                    messages: newMessagesContext, 
                    userContext: contextStr,
                    currentSuggestions: chatSuggestedMenus
                })
            })

            const data = await res.json()

            if (data.code === 'LIMIT_REACHED') {
                setMessagesUsedToday(maxMessages)
                setIsTyping(false)
                return
            }
            if (data.code === 'MENU_TIER_REQUIRED') {
                setMessages(prev => {
                    const next = [...prev, {
                        id: `menu-tier-${Date.now()}`,
                        role: 'coach' as const,
                        content: data.message || 'Passez au plan pro et premium pour avoir le menu du lendemain et de la semaine',
                        timestamp: new Date()
                    }]
                    persistMessagesForThread(activeThreadDate, next)
                    return next
                })
                setIsTyping(false)
                return
            }

            if (data.success) {
                console.log('📨 Réponse brute Yao:', data.message)
                setMessagesUsedToday(maxMessages - data.usageRemaining)
                setLastCoachMessage(data.message)
                // Le stockage dans les suggestions se fait UNIQUEMENT via le bouton
                // (plus d'auto-stockage — l'utilisateur valide manuellement)
                const coachReply: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'coach',
                    content: data.message,
                    timestamp: new Date()
                }
                setMessages(prev => {
                    const next = [...prev, coachReply]
                    persistMessagesForThread(activeThreadDate, next, true)
                    return next
                })
            } else {
                setMessages(prev => {
                    const next = [...prev, { id: `err-${Date.now()}`, role: 'coach' as const, content: 'Désolé, une erreur technique est survenue.', timestamp: new Date() }]
                    persistMessagesForThread(activeThreadDate, next)
                    return next
                })
            }
        } catch (err) {
            console.error(err)
            setMessages(prev => {
                const next = [...prev, { id: `err2-${Date.now()}`, role: 'coach' as const, content: 'Impossible de joindre le serveur.', timestamp: new Date() }]
                persistMessagesForThread(activeThreadDate, next)
                return next
            })
        } finally {
            setIsTyping(false)
        }
    }

    const limitReached = messagesUsedToday >= maxMessages
    const activeThread = threads.find(t => t.date === activeThreadDate)
    const activeThreadLimitReached = !!activeThread && (activeThread.messagesUsed >= activeThread.maxMessages)

    /**
     * Ajoute le menu suggéré dans le bloc Scanner "Aujourd'hui" (slot concerné)
     * puis navigue vers le Scanner. L'utilisateur pourra ensuite cliquer
     * "Ajouter au journal" depuis les suggestions du Scanner.
     */
    const handleAddToScanner = (
        dataItems: Array<{ name: string; volume_ml: number }>,
        slot: string,
        fullMessage: string
    ) => {
        // Stocker dans chatSuggestedMenus[today][slot] — le Scanner lira ça
        setChatSuggestedMenu('today', fullMessage, slot)

        // Persistance cross-device
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            const updatedMenus = {
                ...chatSuggestedMenus,
                today: {
                    ...(chatSuggestedMenus.today || {}),
                    [slot]: fullMessage,
                },
                date: todayDate,
            }
            supabase
                .from('user_profiles')
                .update({ suggested_menus_json: updatedMenus })
                .eq('user_id', session.user.id)
                .then(({ error }) => { if (error) console.error('⚠️ suggested_menus save error:', error) })
        })

        router.push('/scanner')
    }

    /** Ajoute un menu demain/semaine dans les suggestions du Scanner (validation manuelle) */
    const handleAddMenuToScanner = (kind: 'tomorrow' | 'week', cleanText: string) => {
        setChatSuggestedMenu(kind, cleanText)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            const updatedMenus = {
                ...chatSuggestedMenus,
                [kind]: cleanText,
                date: todayDate,
            }
            supabase
                .from('user_profiles')
                .update({ suggested_menus_json: updatedMenus })
                .eq('user_id', session.user.id)
                .then(({ error }) => { if (error) console.error('⚠️ suggested_menus save error:', error) })
        })
        router.push('/scanner')
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto', position: 'relative' }}>

            {/* Halos d'ambiance */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '150px', left: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* HEADER */}
            <div style={{ padding: '24px 20px', background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(15px)', borderBottom: '0.5px solid #222', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ position: 'relative' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '18px', background: 'linear-gradient(135deg, #f59e0b, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 8px 20px rgba(245,158,11,0.25)' }}>
                        🤖
                    </div>
                    {/* Status dot */}
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: '14px', height: '14px', background: '#10b981', border: '3px solid #0a0a0a', borderRadius: '50%' }} />
                </div>
                <div>
                    <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '800', letterSpacing: '-0.3px' }}>Coach Yao</h1>
                    <p style={{ color: '#10b981', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>En ligne</p>
                </div>
            </div>

            {/* Historique 3 discussions max */}
            <div style={{ display: 'flex', gap: '8px', padding: '10px 20px 0', overflowX: 'auto' }}>
                {[...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(thread => {
                    const active = thread.date === activeThreadDate
                    const label = thread.date === todayDate ? "Aujourd'hui" : thread.date
                    return (
                        <button
                            key={thread.date}
                            onClick={() => setActiveThreadDate(thread.date)}
                            style={{
                                border: active ? '0.5px solid #6366f1' : '0.5px solid #222',
                                background: active ? 'rgba(99,102,241,0.14)' : '#141414',
                                color: active ? '#c7d2fe' : '#777',
                                borderRadius: '10px',
                                padding: '7px 10px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
            {activeThread && (
                <div style={{ padding: '8px 20px 0' }}>
                    <p style={{ color: '#666', fontSize: '11px', fontWeight: '600' }}>
                        Messages discussion: {activeThread.messagesUsed} / {activeThread.maxMessages}
                    </p>
                </div>
            )}

            {/* MESSAGES AREA */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '30px' }}>
                {messages.map((msg) => {
                    const isCoach = msg.role === 'coach'
                    const parsed = isCoach ? parseDataBlock(msg.content) : null
                    const menuKind = isCoach && !parsed ? parseMenuKind(msg.content) : null
                    const displayContent = parsed
                        ? parsed.displayText
                        : menuKind
                            ? menuKind.cleanText
                            : msg.content
                    return (
                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isCoach ? 'flex-start' : 'flex-end', width: '100%' }}>
                            <div style={{
                                maxWidth: '85%',
                                padding: '16px 20px',
                                borderRadius: isCoach ? '6px 24px 24px 24px' : '24px 24px 6px 24px',
                                background: isCoach ? '#141414' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                                color: '#fff',
                                fontSize: '15px',
                                lineHeight: '1.6',
                                boxShadow: isCoach ? 'none' : '0 10px 20px rgba(99,102,241,0.2)',
                                border: isCoach ? '0.5px solid #222' : 'none'
                            }}>
                                {isCoach ? (
                                    <ReactMarkdown
                                        components={{
                                            p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
                                            strong: ({ children }) => <strong style={{ color: '#f59e0b', fontWeight: 700 }}>{children}</strong>,
                                            em: ({ children }) => <em style={{ color: '#a78bfa' }}>{children}</em>,
                                            hr: () => <hr style={{ border: 'none', borderTop: '0.5px solid #333', margin: '10px 0' }} />,
                                            ul: ({ children }) => <ul style={{ paddingLeft: '18px', margin: '4px 0' }}>{children}</ul>,
                                            ol: ({ children }) => <ol style={{ paddingLeft: '18px', margin: '4px 0' }}>{children}</ol>,
                                            li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                                            h1: ({ children }) => <h1 style={{ fontSize: '17px', fontWeight: 800, margin: '8px 0 4px', color: '#f59e0b' }}>{children}</h1>,
                                            h2: ({ children }) => <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '8px 0 4px', color: '#f59e0b' }}>{children}</h2>,
                                            h3: ({ children }) => <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '6px 0 2px', color: '#a78bfa' }}>{children}</h3>,
                                        }}
                                    >
                                        {displayContent}
                                    </ReactMarkdown>
                                ) : (
                                    displayContent
                                )}
                            </div>
                            {/* Bouton "Ajouter au Scanner" — menu créneau (DATA block) */}
                            {parsed && (
                                <button
                                    onClick={() => handleAddToScanner(parsed.dataItems, parsed.slot, msg.content)}
                                    style={{
                                        marginTop: '10px',
                                        padding: '10px 18px',
                                        borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        color: '#fff',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        boxShadow: '0 6px 16px rgba(16,185,129,0.3)',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    📲 Ajouter au Scanner
                                </button>
                            )}
                            {/* Bouton "Ajouter au Scanner" — menu demain ou semaine */}
                            {menuKind && (
                                <button
                                    onClick={() => handleAddMenuToScanner(menuKind.kind, menuKind.cleanText)}
                                    style={{
                                        marginTop: '10px',
                                        padding: '10px 18px',
                                        borderRadius: '14px',
                                        background: menuKind.kind === 'tomorrow'
                                            ? 'linear-gradient(135deg, #6366f1, #818cf8)'
                                            : 'linear-gradient(135deg, #f59e0b, #d97706)',
                                        color: '#fff',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        boxShadow: menuKind.kind === 'tomorrow'
                                            ? '0 6px 16px rgba(99,102,241,0.3)'
                                            : '0 6px 16px rgba(245,158,11,0.3)',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    {menuKind.kind === 'tomorrow' ? '📅 Ajouter au Scanner (Demain)' : '📆 Ajouter au Scanner (Semaine)'}
                                </button>
                            )}
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

                {/* SUGGESTIONS DE QUESTIONS (Principalement Menu) */}
                {!activeThreadLimitReached && (
                    <div className="hide-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }}>
                        {[
                            "Fais-moi un menu pour demain",
                            "Génère un menu pour la semaine",
                            "Que manger au dîner ce soir ?",
                            "Idée de petit-déjeuner africain ?"
                        ].map((suggestion, idx) => (
                            <button
                                key={idx}
                                onClick={() => setInput(suggestion)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '16px',
                                    background: '#1a1a1a',
                                    border: '0.5px solid #333',
                                    color: '#ccc',
                                    fontSize: '12px',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#2a2a2a'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#1a1a1a'}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}

                {/* JAUGE DE QUOTA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ padding: '2px 8px', background: effectiveTier === 'free' ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)', color: effectiveTier === 'free' ? '#aaa' : '#818cf8', borderRadius: '10px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>
                            Plan {effectiveTier}
                        </span>
                    </div>
                </div>

                {activeThreadLimitReached ? (
                    effectiveTier === 'premium' ? (
                        <div
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '0.5px solid #2a2a2a',
                                textAlign: 'center'
                            }}
                        >
                            <p style={{ color: '#aaa', fontSize: '13px', fontWeight: '600' }}>
                                Limite atteinte, reviens demain.
                            </p>
                        </div>
                    ) : (
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
                    )
                ) : (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Pose ta question à Yao..."
                            style={{
                                flex: 1, padding: '18px 24px', borderRadius: '24px',
                                background: '#141414', border: '0.5px solid #333',
                                color: '#fff', fontSize: '15px', outline: 'none',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                            }}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!input.trim()}
                            style={{
                                width: '58px', height: '58px', borderRadius: '24px',
                                background: input.trim() ? 'linear-gradient(135deg, #6366f1, #818cf8)' : '#1a1a1a',
                                color: input.trim() ? '#fff' : '#444', border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default',
                                transition: 'all 0.3s ease',
                                boxShadow: input.trim() ? '0 10px 20px rgba(99,102,241,0.3)' : 'none'
                            }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
