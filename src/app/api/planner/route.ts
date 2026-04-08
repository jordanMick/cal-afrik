import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getEffectiveTier } from "@/lib/subscription"

// Variable temporaire pour simuler les refus (en attendant une table DB si nécessaire)
let skippedSlots: Record<string, string[]> = {} 

export async function POST(req: Request) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    try {
        const { action, slot, date, items } = await req.json()
        const token = authHeader.replace('Bearer ', '')
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
        const { data: { user } } = await supabase.auth.getUser(token)
        
        if (!user) return NextResponse.json({ error: "No user" }, { status: 401 })

        // ACTION: LOCK (Valider Demain ou Semaine)
        if (action === 'lock') {
            const inserts = items.map((it: any) => ({
                user_id: user.id,
                date: it.date,
                slot: it.slot,
                recipe_name: it.name,
                is_locked: true
            }))
            await supabase.from('user_plans').insert(inserts)
            return NextResponse.json({ success: true, locked: true })
        }

        // ACTION: SKIP (Refuser)
        const key = `${user.id}_${date}`
        if (!skippedSlots[key]) skippedSlots[key] = []
        skippedSlots[key].push(slot)
        await supabase.rpc('increment_planner_view', { user_id_input: user.id })

        return NextResponse.json({ success: true, skipped: skippedSlots[key] })
    } catch (err) {
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}

export async function GET(req: Request) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: "No user" }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const tier = getEffectiveTier(profile)
    const viewsToday = profile?.planner_views_today || 0
    const view = new URL(req.url).searchParams.get('view') || 'today'
    const todayStr = new Date().toISOString().split('T')[0]

    // 1. Vérifier les plans VERROUILLÉS
    if (view === 'tomorrow' || view === 'week') {
        const queryDate = view === 'tomorrow' 
            ? new Date(Date.now() + 86400000).toISOString().split('T')[0]
            : todayStr
            
        const { data: lockedPlans } = await supabase.from('user_plans')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', todayStr)
            .eq('is_locked', true)

        if (lockedPlans && lockedPlans.length > 0) {
            if (view === 'tomorrow') {
                const tmr = lockedPlans.filter(p => p.date === queryDate)
                if (tmr.length > 0) {
                    return NextResponse.json({ success: true, locked: true, tier, menu: tmr.map(t => ({ slot: t.slot, name: t.recipe_name, kcal: 0 })) })
                }
            }
            if (view === 'week') {
                return NextResponse.json({ success: true, locked: true, tier, days: lockedPlans.map(p => ({ day: p.date, main_dish: p.recipe_name })) })
            }
        }
    }

    // 2. Sinon, suggestions standard
    const { data: todayMeals } = await supabase.from('meals').select('logged_at').eq('user_id', user.id).gte('logged_at', todayStr)
    const recordedSlots = todayMeals?.map(m => getMealSlot(new Date(m.logged_at).getHours())) || []
    const slotsOrder = ['petit_dejeuner', 'dejeuner', 'collation', 'diner'] as const
    const slotTimes: Record<string, number> = { 'petit_dejeuner': 0, 'dejeuner': 12, 'collation': 16, 'diner': 19 }

    const todayStr_ = new Date().toISOString().split('T')[0]
    const currentSkipped = skippedSlots[`${user.id}_${todayStr_}`] || []
    const occupiedSlots = [...new Set([...recordedSlots, ...currentSkipped])]
    const nextSlot = slotsOrder.find(s => !occupiedSlots.includes(s))

    if (view === 'today' && tier === 'free' && viewsToday >= 2) {
        return NextResponse.json({ success: false, error: "Limite de 2 suggestions gratuites atteinte.", code: "LIMIT_REACHED" }, { status: 403 })
    }

    // CAS DEMAIN : Génération groupée par IA
    if (view === 'tomorrow') {
        if (tier === 'free') return NextResponse.json({ success: false, error: "Planning réservé aux membres PRO.", code: "PRO_ONLY" }, { status: 403 })
        try {
            const prompt = `Tu es Coach Yao. Génère un menu complet pour DEMAIN (4 repas : petit_dejeuner, dejeuner, collation, diner).
            Cuisine africaine saine. Format JSON uniquement :
            {"menu": [ {"slot": "petit_dejeuner", "name": "...", "kcal": 0}, ... ]}`

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } })
            })
            const aiData = await res.json()
            const menu = JSON.parse(aiData.candidates[0].content.parts[0].text)
            return NextResponse.json({ success: true, tier, menu: menu.menu, locked: false })
        } catch (e) {
             return NextResponse.json({ success: true, tier, menu: slotsOrder.map(s => ({ slot: s, name: "Plat Coach Yao " + s, kcal: 450 })) })
        }
    }

    // CAS SEMAINE : Génération groupée par IA
    if (view === 'week') {
        if (tier !== 'premium') return NextResponse.json({ success: false, error: "Planning hebdomadaire réservé aux membres Premium.", code: "PREMIUM_ONLY" }, { status: 403 })
        try {
            const prompt = `Tu es Coach Yao. Génère 7 plats principaux (déjeuner) pour la SEMAINE PROCHAINE.
            Cuisine africaine saine. Format JSON uniquement :
            {"days": [ {"day": "Lundi", "main_dish": "..."}, ... ] }`

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } })
            })
            const aiData = await res.json()
            const week = JSON.parse(aiData.candidates[0].content.parts[0].text)
            return NextResponse.json({ success: true, tier, days: week.days, locked: false })
        } catch (e) {
            return NextResponse.json({ success: true, tier, days: Array.from({length:7}, (_,i)=>({day: "Jour "+(i+1), main_dish: "Poisson Braisé"})) })
        }
    }

    if (!nextSlot) return NextResponse.json({ success: true, completed: true, message: "Bravo ! Journée terminée ✨" })

    // 3. Appel à Coach Yao (IA Gemini) pour une suggestion UNIQUE
    try {
        const prompt = `Tu es Coach Yao, l'expert en nutrition africaine de Cal-Afrik. 
        Génère une proposition de repas unique pour le : ${nextSlot.replace('_', ' ')}.
        Le plat doit être typiquement africain ou avec une touche africaine, sain et équilibré.
        Format attendu (JSON uniquement) :
        {
          "name": "Nom du plat court (ex: Garba équilibré)",
          "kcal": calories_approximatives,
          "protein": grammes_proteines,
          "carbs": grammes_glucides,
          "fat": grammes_lipides
        }`

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        })

        const aiData = await res.json()
        const recipe = JSON.parse(aiData.candidates[0].content.parts[0].text)

        return NextResponse.json({
            success: true,
            completed: false,
            locked: false,
            tier,
            next_meal: { ...recipe, slot: nextSlot },
            slot: nextSlot,
            can_log_now: new Date().getHours() >= slotTimes[nextSlot as string],
            start_hour: slotTimes[nextSlot as string]
        })
    } catch (aiErr) {
        console.error("Coach Yao error:", aiErr)
        // Fallback si l'IA sature
        return NextResponse.json({ 
            success: true, 
            next_meal: { name: 'Thon grillé & Alloco sauté', kcal: 520, protein: 32, carbs: 45, fat: 18, slot: nextSlot }, 
            slot: nextSlot 
        })
    }
}

function getMealSlot(hour: number): string {
    if (hour >= 5 && hour < 11) return 'petit_dejeuner'
    if (hour >= 11 && hour < 15) return 'dejeuner'
    if (hour >= 15 && hour < 18) return 'collation'
    return 'diner'
}
