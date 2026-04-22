'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { getEffectiveTier, SUBSCRIPTION_RULES } from '@/lib/subscription'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

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
        content: `Bonjour ${name || 'mon ami'} ! Je suis ton coach Yao. Nutritionniste et expert en plats africains. Que puis-je faire pour t'aider à atteindre ton objectif aujourd'hui ?`,
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
    
    // Détection ultra-souple (petit-déjeuner, petit dej, déjeuner, dîner...)
    const slotMatch = normalized.match(/menu creneau (petit[-_ ]?dej(?:euner)?|dej(?:euner)?|collation|din(?:er|in)):/i)
    if (slotMatch && hasMealContent) {
        let raw = slotMatch[1].toLowerCase()
        let slot = 'dejeuner'
        if (raw.includes('petit')) slot = 'petit_dejeuner'
        else if (raw.includes('coll')) slot = 'collation'
        else if (raw.includes('din')) slot = 'diner'
        return { kind: 'today', slot }
    }
    
    return null
}

/**
 * Extrait le bloc ---DATA--- du message de Coach Yao.
 * Retourne { displayText, dataItems, slot } ou null si absent.
 */
function parseDataBlock(rawMessage: string): { 
    displayText: string; 
    dataItems?: Array<{ 
        name: string; 
        volume_ml: number;
        display_name?: string;
        calories?: number;
        protein_g?: number;
        carbs_g?: number;
        fat_g?: number;
        portion_g?: number;
        id?: string;
    }>; 
    slot?: string 
} | null {
    const sep = '---DATA---'
    const idx = rawMessage.indexOf(sep)
    if (idx === -1) return null

    const displayText = rawMessage.substring(0, idx).trim()
    const jsonPart = rawMessage.substring(idx + sep.length).trim()

    // Détection plus souple (petit-déjeuner, petit dej, déjeuner, dîner...)
    const slotMatch = rawMessage.match(/menu creneau (petit[-_ ]?dej(?:euner)?|dej(?:euner)?|collation|din(?:er|in)):/i)
    let slot = undefined
    if (slotMatch) {
        let raw = slotMatch[1].toLowerCase()
        slot = 'dejeuner'
        if (raw.includes('petit')) slot = 'petit_dejeuner'
        else if (raw.includes('coll')) slot = 'collation'
        else if (raw.includes('din')) slot = 'diner'
    }


    try {
        const parsed = JSON.parse(jsonPart)
        const items = Array.isArray(parsed.items) ? parsed.items : []
        const jsonSlot = parsed.slot
        
        if (items.length > 0) {
            return { displayText, dataItems: items, slot: jsonSlot || slot }
        }
    } catch {
        return { displayText }
    }
    return { displayText }
}
/**
 * Détecte si un message est un menu "demain" ou "semaine".
 * Retourne { kind, cleanText } ou null.
 */
function parseMenuKind(text: string): { kind: 'tomorrow' | 'week'; cleanText: string } | null {
    const sep = '---DATA---'
    const idx = text.indexOf(sep)
    const baseText = idx !== -1 ? text.substring(0, idx).trim() : text

    const tomorrowMatch = /^menu\s+demain\s*:\s*/i.exec(baseText)
    if (tomorrowMatch) {
        return { kind: 'tomorrow', cleanText: baseText.substring(tomorrowMatch[0].length).trim() }
    }
    const weekMatch = /^menu\s+semaine\s*:\s*/i.exec(baseText)
    if (weekMatch) {
        return { kind: 'week', cleanText: baseText.substring(weekMatch[0].length).trim() }
    }
    return null
}

const LimitPaywall = ({ onPayUnit, onUpgrade }: { onPayUnit: () => void, onUpgrade: () => void }) => (
    <div style={{ 
        margin: '20px 0', 
        padding: '24px', 
        borderRadius: '24px', 
        background: 'linear-gradient(135deg, rgba(var(--bg-secondary-rgb), 0.9), rgba(var(--bg-tertiary-rgb), 0.9))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(var(--warning-rgb), 0.3)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        textAlign: 'center',
        animation: 'fadeInUp 0.5s ease-out'
    }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>🛑</div>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>Limite de messages atteinte !</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
            Yao a beaucoup travaillé aujourd'hui. <br/> 
            Débloque-le pour finaliser ton menu !
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
                onClick={onPayUnit}
                style={{
                    padding: '14px',
                    borderRadius: '14px',
                    background: 'var(--warning)',
                    color: '#000',
                    border: 'none',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 8px 20px rgba(var(--warning-rgb), 0.3)',
                    transition: 'transform 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                ⚡️ Débloquer 10 messages (100 FCFA)
            </button>
            
            <button 
                onClick={onUpgrade}
                style={{
                    padding: '12px',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-secondary)',
                    border: '0.5px solid var(--border-color)',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer'
                }}
            >
                💎 Passer au Plan Supérieur
            </button>
        </div>
    </div>
)


export default function CoachChatPage() {
    const router = useRouter()
    const { profile, setProfile, slots, setLastCoachMessage, setChatSuggestedMenu, chatSuggestedMenus } = useAppStore()
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
    const [showScrollButton, setShowScrollButton] = useState(false)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [isPaying, setIsPaying] = useState(false)

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

    // Synchroniser si le profil change
    useEffect(() => {
        setMessagesUsedToday(profile?.last_usage_reset_date === todayDate ? (profile?.chat_messages_today || 0) : 0)
    }, [profile, todayDate])

    // 🔥 REALTIME : Écouter les changements du profil en direct (clôture session, paiements, etc.)
    useEffect(() => {
        if (!profile?.user_id && !profile?.id) return
        const uid = profile.user_id || profile.id
        
        const channel = supabase
            .channel('profile_realtime')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'user_profiles', 
                filter: `user_id=eq.${uid}` 
            }, (payload) => {
                console.log('⚡️ Profile Realtime Update:', payload.new)
                setProfile(payload.new as any)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [profile?.user_id, profile?.id, setProfile])

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
        }
    }, [input])

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

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget
        const diff = target.scrollHeight - target.scrollTop - target.clientHeight
        setShowScrollButton(diff > 300)
    }

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
        const paidChatMessages = profile?.paid_chat_messages_remaining || 0
        const isLimitReached = messagesUsedToday >= maxMessages && paidChatMessages <= 0
        
        if (isLimitReached) {
            toast.error("Limite de messages atteinte. Débloquez Yao pour continuer !")
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

            const { macroDistributions, smartAlert, dailyProtein, dailyCarbs, dailyFat } = useAppStore.getState()
            const todayKey = toLocalDateKey()
            const dailyConsumed = Object.values(slots).reduce((acc, s) => acc + s.consumed, 0)
            
            // Calcul des ratios en temps réel (même si l'alerte est supprimée de la UI)
            const calTarget = profile?.calorie_target || 2000
            const protTarget = profile?.protein_target_g || 100
            const carbTarget = profile?.carbs_target_g || 250
            const fatTarget = profile?.fat_target_g || 65

            const calRatio = Math.round((dailyConsumed / calTarget) * 100)
            const protRatio = Math.round((dailyProtein / protTarget) * 100)
            const carbRatio = Math.round((dailyCarbs / carbTarget) * 100)
            const fatRatio = Math.round((dailyFat / fatTarget) * 100)

            let alertInfo = ""
            if (smartAlert && smartAlert.date === todayKey) {
                alertInfo = `\n[ALERTE ACTIVE] : ${smartAlert.message}`
            }

            const stratInfo = `\n[STRATÉGIE PAR REPAS] : 
            Calories: P.Dej:${macroDistributions.calories.petit_dejeuner*100}%, Dej:${macroDistributions.calories.dejeuner*100}%, Col:${macroDistributions.calories.collation*100}%, Din:${macroDistributions.calories.diner*100}%
            (Applique ces % à la cible de ${calTarget}kcal)`

            const statsInfo = `\n[ÉTAT DE CONSOMMATION DU JOUR] : 
            - Calories : ${Math.round(dailyConsumed)} / ${calTarget} kcal (${calRatio}%)
            - Protéines : ${dailyProtein} / ${protTarget} g (${protRatio}%)
            - Glucides : ${dailyCarbs} / ${carbTarget} g (${carbRatio}%)
            - Lipides : ${dailyFat} / ${fatTarget} g (${fatRatio}%)`

            const contextStr = `${statsInfo}${alertInfo}${stratInfo}`

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
                 // On ne rajoute plus de bulle, on laisse la carte s'afficher
                 setMessagesUsedToday(maxMessages)
                 setIsTyping(false)
                 toast.error(data.error || "Limite atteinte")

                 // 🔥 Forcer le rafraîchissement pour que la carte apparaisse
                 const { data: { session } } = await supabase.auth.getSession()
                 if (session) {
                    const { data: p } = await supabase.from('user_profiles').select('*').eq('user_id', session.user.id).single()
                    if (p) setProfile(p)
                 }
                 return
             }
             if (data.code === 'MENU_TIER_REQUIRED') {
                 setIsTyping(false)
                 toast.info("Abonnement requis pour les menus avancés")
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

                // 🔥 Rafraîchir le profil pour synchroniser les crédits payants restants
                const { data: p } = await supabase.from('user_profiles').select('*').eq('user_id', session.user.id).single()
                if (p) setProfile(p)
            } else {
                setMessages(prev => {
                    const next = [...prev, { 
                        id: `err-${Date.now()}`, 
                        role: 'coach' as const, 
                        content: `Erreur serveur : ${data.error || 'Problème de connexion'}`, 
                        timestamp: new Date() 
                    }]
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

    const paidChatMessages = profile?.paid_chat_messages_remaining || 0
    const limitReached = messagesUsedToday >= maxMessages && paidChatMessages <= 0
    const activeThread = threads.find(t => t.date === activeThreadDate)
    
    // La limite est atteinte si : 
    // 1. On est sur le thread d'aujourd'hui ET (quota global atteint ET pas de messages payés)
    // 2. OU si c'est un ancien thread (on ne peut pas réécrire dans le passé par défaut)
    const activeThreadLimitReached = !!activeThread && (
        activeThread.date !== todayDate || 
        (messagesUsedToday >= maxMessages && paidChatMessages <= 0)
    )

    /**
     * Ajoute le menu suggéré dans la vue de planning "Aujourd'hui" (slot concerné)
     * puis navigue vers le Planning (/menus).
     * L'utilisateur pourra ensuite cliquer "Ajouter au journal" depuis là-bas.
     */
    const handleAddToPlanning = (
        dataItems: Array<{ 
            name: string; 
            volume_ml: number;
            display_name?: string;
            calories?: number;
            protein_g?: number;
            carbs_g?: number;
            fat_g?: number;
            portion_g?: number;
            id?: string;
        }>,
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
                .then(async ({ error }) => { 
                    if (error) console.error('⚠️ suggested_menus save error:', error)
                    
                    // 🔥 Clôture de la session payante s'il y a lieu
                    if (profile?.paid_chat_messages_remaining && profile.paid_chat_messages_remaining > 0) {
                        try {
                            await fetch('/api/payments/consume-session', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
                            })
                            // Refresh profile localement pour verrouiller l'UI
                            const { data: p } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
                            if (p) setProfile(p)
                        } catch (err) { console.error('Error consuming session:', err) }
                    }
                })
        })

        router.push('/menus')
    }

    /** Ajoute un menu demain/semaine dans les suggestions du Planning (validation manuelle) */
    const handleAddMenuToPlanning = (kind: 'tomorrow' | 'week', cleanText: string) => {
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
                .then(async ({ error }) => { 
                    if (error) console.error('⚠️ suggested_menus save error:', error)
                    
                    // 🔥 Clôture de la session payante s'il y a lieu
                    if (profile?.paid_chat_messages_remaining && profile.paid_chat_messages_remaining > 0) {
                        try {
                            await fetch('/api/payments/consume-session', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
                            })
                            // Refresh profile localement pour verrouiller l'UI
                            const { data: p } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
                            if (p) setProfile(p)
                        } catch (err) { console.error('Error consuming session:', err) }
                    }
                })
        })
        router.push('/menus')
    }

    const handlePayForSuggestion = async () => {
        setIsPaying(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                toast.error("Veuillez vous reconnecter")
                return
            }

            const res = await fetch('/api/payments/checkout', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ tier: 'suggestion' })
            })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            } else {
                toast.error("Erreur lors de la création du paiement")
            }
        } catch (err) {
            console.error(err)
            toast.error("Erreur de connexion")
        } finally {
            setIsPaying(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto', position: 'relative' }}>

            {/* Halos d'ambiance */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--warning-rgb), 0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '150px', left: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* HEADER */}
            <div style={{ padding: '24px 20px', background: 'rgba(var(--bg-primary-rgb), 0.85)', backdropFilter: 'blur(15px)', borderBottom: '0.5px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ position: 'relative' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '18px', background: 'linear-gradient(135deg, var(--warning), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 8px 20px rgba(var(--warning-rgb), 0.25)' }}>
                        👨🏾‍⚕️
                    </div>
                    {/* Status dot */}
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: '14px', height: '14px', background: 'var(--success)', border: '3px solid var(--bg-primary)', borderRadius: '50%' }} />
                </div>
                <div>
                    <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800', letterSpacing: '-0.3px' }}>Coach Yao</h1>
                    <p style={{ color: 'var(--success)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>En ligne</p>
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
                                border: active ? '0.5px solid var(--accent)' : '0.5px solid var(--border-color)',
                                background: active ? 'rgba(var(--accent-rgb), 0.14)' : 'var(--bg-secondary)',
                                color: active ? 'var(--accent)' : 'var(--text-muted)',
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


            {/* MESSAGES AREA */}
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '30px', position: 'relative' }}
            >
                {/* Scroll to bottom floating arrow */}
                {showScrollButton && (
                    <button
                        onClick={scrollToBottom}
                        style={{
                            position: 'fixed',
                            bottom: '180px', // Plus haut pour éviter la zone de saisie
                            left: '50%',
                            marginLeft: '-20px', // Centrage manuel précis
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#6366f1',
                            border: '2px solid #fff',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 8px 24px rgba(99,102,241,0.5)',
                            zIndex: 1000, // Toujours au-dessus
                            animation: 'fadeInUp 0.3s ease-out'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"/></svg>
                        <style>{`
                            @keyframes fadeInUp {
                                from { opacity: 0; transform: translate(-50%, 10px); }
                                to { opacity: 1; transform: translate(-50%, 0); }
                            }
                        `}</style>
                    </button>
                )}
                {messages.map((msg) => {
                    const isCoach = msg.role === 'coach'
                    const parsed = isCoach ? parseDataBlock(msg.content) : null
                    const menuKind = isCoach ? parseMenuKind(msg.content) : null
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
                                background: isCoach ? 'var(--bg-secondary)' : 'linear-gradient(135deg, var(--accent), #818cf8)',
                                color: isCoach ? 'var(--text-primary)' : '#fff',
                                fontSize: '15px',
                                lineHeight: '1.6',
                                boxShadow: isCoach ? 'none' : '0 10px 20px rgba(var(--accent-rgb), 0.2)',
                                border: isCoach ? '0.5px solid var(--border-color)' : 'none',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {isCoach ? (
                                    <ReactMarkdown
                                        components={{
                                            p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
                                            strong: ({ children }) => <strong style={{ color: 'var(--warning)', fontWeight: 700 }}>{children}</strong>,
                                            em: ({ children }) => <em style={{ color: 'var(--accent)' }}>{children}</em>,
                                            hr: () => <hr style={{ border: 'none', borderTop: '0.5px solid var(--border-color)', margin: '10px 0' }} />,
                                            ul: ({ children }) => <ul style={{ paddingLeft: '18px', margin: '4px 0' }}>{children}</ul>,
                                            ol: ({ children }) => <ol style={{ paddingLeft: '18px', margin: '4px 0' }}>{children}</ol>,
                                            li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                                            h1: ({ children }) => <h1 style={{ fontSize: '17px', fontWeight: 800, margin: '8px 0 4px', color: 'var(--warning)' }}>{children}</h1>,
                                            h2: ({ children }) => <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '8px 0 4px', color: 'var(--warning)' }}>{children}</h2>,
                                            h3: ({ children }) => <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '6px 0 2px', color: 'var(--accent)' }}>{children}</h3>,
                                        }}
                                    >
                                        {displayContent}
                                    </ReactMarkdown>
                                ) : (
                                    displayContent
                                )}
                            </div>
                            {/* Bouton "Ajouter au Scanner" — menu créneau (DATA block) */}
                            {parsed && parsed.dataItems && parsed.slot && (
                                <button
                                    onClick={() => handleAddToPlanning(parsed.dataItems!, parsed.slot!, msg.content)}
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
                                    📲 Envoyer au Planning (Aujourd'hui)
                                </button>
                            )}
                            {/* Bouton "Ajouter au Scanner" — menu demain ou semaine */}
                            {menuKind && (
                                <button
                                    onClick={() => handleAddMenuToPlanning(menuKind.kind, menuKind.cleanText)}
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
                                    {menuKind.kind === 'tomorrow' ? '📅' : '🗓️'} Envoyer au Planning ({menuKind.kind === 'tomorrow' ? 'Demain' : 'Semaine'})
                                </button>
                            )}
                            <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '6px', margin: isCoach ? '0 0 0 4px' : '0 4px 0 0' }}>
                                {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    )
                })}

                {isTyping && (
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ padding: '14px 20px', borderRadius: '4px 20px 20px 20px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', display: 'flex', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }} />
                            <span style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }} />
                            <span style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }} />
                            <style>{"\
                                @keyframes bounce {\
                                    0%, 80%, 100% { transform: scale(0); }\
                                    40% { transform: scale(1); }\
                                }\
                            "}</style>
                        </div>
                    </div>
                )}

                {activeThreadLimitReached && (
                    <LimitPaywall 
                        onPayUnit={handlePayForSuggestion}
                        onUpgrade={() => router.push('/settings/subscription')}
                    />
                )}
                <div ref={endOfMessagesRef} />
            </div>

            {/* INPUT AREA (FIXED BOTTOM) */}
            <div style={{ padding: '16px 20px', background: 'var(--bg-primary)', borderTop: '0.5px solid var(--border-color)', paddingBottom: '100px' }}>

                {/* SUGGESTIONS DE QUESTIONS (Principalement Menu) */}
                {!activeThreadLimitReached && (
                    <div className="hide-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }}>
                        {[
                            "Menu Petit-déj",
                            "Menu Déjeuner",
                            "Menu Collation",
                            "Menu Dîner",
                            "Menu Demain",
                            "Menu Semaine"
                        ].map((suggestion, idx) => (
                            <button
                                key={idx}
                                onClick={() => setInput(suggestion)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '16px',
                                    background: 'var(--bg-secondary)',
                                    border: '0.5px solid var(--border-color)',
                                    color: 'var(--text-secondary)',
                                    fontSize: '12px',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}

                {/* JAUGE DE QUOTA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ padding: '2px 8px', background: effectiveTier === 'free' ? 'rgba(var(--text-muted-rgb), 0.1)' : 'rgba(var(--accent-rgb), 0.15)', color: effectiveTier === 'free' ? 'var(--text-muted)' : 'var(--accent)', borderRadius: '10px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>
                            Plan {effectiveTier}
                        </span>
                    </div>
                </div>

                {activeThreadLimitReached ? (
                    <div
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '16px',
                            background: 'rgba(var(--warning-rgb), 0.05)',
                            border: '0.5px solid rgba(var(--warning-rgb), 0.2)',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontSize: '13px',
                            fontWeight: '600',
                            letterSpacing: '0.5px'
                        }}
                    >
                        🔒 Chat verrouillé • Quota quotidien atteint
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSendMessage()
                                }
                            }}
                            placeholder="Pose ta question à Yao..."
                            rows={1}
                            style={{
                                flex: 1,
                                padding: '16px 24px',
                                borderRadius: '24px',
                                background: 'var(--bg-secondary)',
                                border: '0.5px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                fontSize: '15px',
                                outline: 'none',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                                resize: 'none',
                                overflowY: (textareaRef.current?.scrollHeight || 0) > 120 ? 'auto' : 'hidden',
                                fontFamily: 'inherit',
                                lineHeight: '1.4'
                            }}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!input.trim()}
                            style={{
                                width: '58px', height: '58px', borderRadius: '24px',
                                background: input.trim() ? 'linear-gradient(135deg, var(--accent), #818cf8)' : 'var(--bg-tertiary)',
                                color: input.trim() ? '#fff' : 'var(--text-muted)', border: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default',
                                transition: 'all 0.3s ease',
                                boxShadow: input.trim() ? '0 10px 20px rgba(var(--accent-rgb), 0.3)' : 'none'
                            }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
