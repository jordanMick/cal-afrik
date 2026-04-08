import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getEffectiveTier } from "@/lib/subscription"

// Variable temporaire pour simuler les refus (en attendant une table DB si nécessaire)
let skippedSlots: Record<string, string[]> = {} 

export async function POST(req: Request) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    try {
        const { slot, date } = await req.json()
        const token = authHeader.replace('Bearer ', '')
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
        const { data: { user } } = await supabase.auth.getUser(token)
        
        if (!user) return NextResponse.json({ error: "No user" }, { status: 401 })

        const key = `${user.id}_${date}`
        if (!skippedSlots[key]) skippedSlots[key] = []
        skippedSlots[key].push(slot)

        return NextResponse.json({ success: true, skipped: skippedSlots[key] })
    } catch (err) {
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // 1. Récupérer le profil et le tier
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
    
    const tier = getEffectiveTier(profile)
    
    // 2. Récupérer les repas déjà pris aujourd'hui
    const today = new Date().toISOString().split('T')[0]
    const { data: todayMeals } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00.000Z`)
        .lte('logged_at', `${today}T23:59:59.999Z`)

    // Fonction pour déterminer le slot d'un repas selon l'heure (Sync avec useAppStore)
    const getSlotFromHour = (hour: number) => {
        if (hour >= 0 && hour < 12) return 'petit_dejeuner'
        if (hour >= 12 && hour < 16) return 'dejeuner'
        if (hour >= 16 && hour < 19) return 'collation'
        return 'diner'
    }

    const recordedSlots = (todayMeals || []).map(m => getSlotFromHour(new Date(m.logged_at).getHours()))

    // ─── LOGIQUE DE TIERS ───────────────────────────────────────
    
    // CAS FREE : Limite de 2 actions (Scan + Suggestions)
    if (tier === 'free') {
        const actionsUsed = (profile?.scan_feedbacks_today || 0)
        if (actionsUsed >= 2) {
            return NextResponse.json({ 
                success: false, 
                error: "Limite de 2 actions gratuites atteinte (Scans + Suggestions).",
                code: "LIMIT_REACHED"
            }, { status: 403 })
        }
        // Increment action count if accessing suggestion ? 
        // On pourrait le faire ici, mais attention au refresh de page. 
        // On va le décompter au moment du LOG du repas pour l'instant.
    }

    // CAS PRO & PREMIUM : Demain bloqué si pas de dîner. CAS FREE : Demain bloqué totalement.
    const hasDiner = recordedSlots.includes('diner')
    const view = new URL(req.url).searchParams.get('view') || 'today' // 'today' | 'tomorrow' | 'week'

    if (view === 'tomorrow') {
        if (tier === 'free') {
            return NextResponse.json({ 
                success: false, 
                error: "Le planning de demain est réservé aux membres Pro & Premium.", 
                code: "PRO_ONLY" 
            }, { status: 403 })
        }
        
        if (!hasDiner) {
            return NextResponse.json({ 
                success: false, 
                error: "Menu de demain débloqué après ton dîner du jour !", 
                code: "DINNER_REQUIRED" 
            }, { status: 403 })
        }
    }

    // CAS PRO/FREE : Semaine bloquée (Premium only)
    if (view === 'week' && tier !== 'premium') {
        return NextResponse.json({ 
            success: false, 
            error: "Planning hebdomadaire réservé aux membres Premium.", 
            code: "PREMIUM_WEEKLY_ONLY" 
        }, { status: 403 })
    }

    // 3. Déterminer le prochain créneau prioritaire pour 'today'
    const slotsOrder = ['petit_dejeuner', 'dejeuner', 'collation', 'diner'] as const
    const slotTimes: Record<string, number> = { 'petit_dejeuner': 0, 'dejeuner': 12, 'collation': 16, 'diner': 19 }

    // On retire les slots déjà enregistrés OU refusés
    const todayStr = new Date().toISOString().split('T')[0]
    const currentSkipped = skippedSlots[`${user.id}_${todayStr}`] || []
    const occupiedSlots = [...new Set([...recordedSlots, ...currentSkipped])]
    const nextSlot = slotsOrder.find(s => !occupiedSlots.includes(s))
    
    // Si on regarde demain, on renvoie tout le menu de demain
    if (view === 'tomorrow') {
        return NextResponse.json({
            success: true,
            view: 'tomorrow',
            menu: [
                { slot: 'petit_dejeuner', name: 'Pain complet & œuf poché', kcal: 280 },
                { slot: 'dejeuner', name: 'Yassa au poulet (portion équilibrée)', kcal: 580 },
                { slot: 'collation', name: 'Yaourt nature & amandes', kcal: 150 },
                { slot: 'diner', name: 'Poisson grillé & alloco grillé (peu d\'huile)', kcal: 450 }
            ]
        })
    }

    // Si on regarde la semaine
    if (view === 'week') {
        return NextResponse.json({
            success: true,
            view: 'week',
            days: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(d => ({
                day: d,
                main_dish: "Menu équilibré Coach Yao"
            }))
        })
    }

    // Logique standard 'today'
    if (!nextSlot) {
        return NextResponse.json({ success: true, completed: true, message: "Bravo ! Journée terminée ✨" })
    }

    const currentHour = new Date().getHours()
    const canLogNow = currentHour >= slotTimes[nextSlot as string]

    const mockProposals: Record<string, any> = {
        'petit_dejeuner': { name: 'Bouillie de mil & une mangue', kcal: 320, protein: 6, carbs: 65, fat: 4 },
        'dejeuner': { name: 'Riz gras au poisson braisé', kcal: 650, protein: 35, carbs: 80, fat: 18 },
        'diner': { name: 'Attiéké thon & crudités', kcal: 480, protein: 28, carbs: 60, fat: 12 },
        'collation': { name: 'Poignée d\'arachides grillées', kcal: 180, protein: 8, carbs: 6, fat: 14 }
    }

    return NextResponse.json({
        success: true,
        completed: false,
        tier,
        next_meal: mockProposals[nextSlot],
        slot: nextSlot,
        can_log_now: canLogNow,
        start_hour: slotTimes[nextSlot as string]
    })
}
