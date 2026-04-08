import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getEffectiveTier } from "@/lib/subscription"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
})

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

    if (view === 'today' && !nextSlot) {
        return NextResponse.json({ success: true, completed: true, message: "Bravo ! Journée terminée ✨" })
    }

    if (view === 'tomorrow' && tier === 'free') {
        return NextResponse.json({ success: false, error: "Planning réservé aux membres PRO.", code: "PRO_ONLY" }, { status: 403 })
    }
    
    if (view === 'week' && tier !== 'premium') {
        return NextResponse.json({ success: false, error: "Planning hebdomadaire réservé aux membres Premium.", code: "PREMIUM_ONLY" }, { status: 403 })
    }

    // 3. Mode Hybride avec CLAUDE (Anthropic)
    try {
        const { data: allRecipes } = await supabase.from('recipes').select('*')
        const recipesList = allRecipes?.map(r => `${r.name} (${r.kcal}kcal, P:${r.protein}g, G:${r.carbs}g, L:${r.fat}g, slot:${r.slot})`).join('\n')

        const prompt = `Tu es Coach Yao. Voici mon catalogue de plats africains réels :
        ${recipesList}

        Choisis ${view === 'week' ? '7 déjeuners' : view === 'tomorrow' ? '4 repas (1 par slot)' : 'le meilleur prochain repas'} parmi cette liste.
        Respecte scrupuleusement les noms et les macros du catalogue.
        Format attendu (JSON uniquement, pas de texte avant/après) :
        ${view === 'week' ? '{"days": [{"day": "Lundi", "main_dish": "..."}]}' : view === 'tomorrow' ? '{"menu": [{"slot": "petit_dejeuner", "name": "...", "kcal": 0}]}' : '{"name": "...", "kcal": 0, "protein": 0, "carbs": 0, "fat": 0}'}`

        const msg = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
        })

        const rawText = (msg.content[0] as any).text
        const selected = JSON.parse(rawText)

        if (view === 'tomorrow') return NextResponse.json({ success: true, tier, menu: selected.menu, locked: false })
        if (view === 'week') return NextResponse.json({ success: true, tier, days: selected.days, locked: false })

        return NextResponse.json({
            success: true,
            completed: false,
            locked: false,
            tier,
            next_meal: { ...selected, slot: nextSlot },
            slot: nextSlot,
            can_log_now: new Date().getHours() >= slotTimes[nextSlot as string],
            start_hour: slotTimes[nextSlot as string]
        })
    } catch (aiErr) {
        console.error("Chef Yao error:", aiErr)
        return NextResponse.json({ success: true, next_meal: { name: 'Thon & Alloco', kcal: 520, protein: 32, carbs: 45, fat: 18, slot: nextSlot }, slot: nextSlot })
    }
}

function getMealSlot(hour: number): string {
    if (hour >= 5 && hour < 11) return 'petit_dejeuner'
    if (hour >= 11 && hour < 15) return 'dejeuner'
    if (hour >= 15 && hour < 18) return 'collation'
    return 'diner'
}
