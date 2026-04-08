import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getEffectiveTier } from "@/lib/subscription"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Variable temporaire pour simuler les refus (en attendant une table DB si nécessaire)
let skippedSlots: Record<string, string[]> = {} 

function getUtcRangeForLocalDay(dateStr: string, tzOffsetMin: number) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) + tzOffsetMin * 60 * 1000
    const endUtcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) + tzOffsetMin * 60 * 1000
    return {
        start: new Date(startUtcMs).toISOString(),
        end: new Date(endUtcMs).toISOString(),
    }
}

function addDaysToDateString(dateStr: string, days: number) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + days)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export async function POST(req: Request) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    try {
        const { action, slot, date, items, target } = await req.json()
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

        // ACTION: UNLOCK (Supprimer menu validé)
        if (action === 'unlock') {
            if (!date) {
                return NextResponse.json({ error: "Missing date" }, { status: 400 })
            }

            if (target === 'tomorrow') {
                const tomorrow = addDaysToDateString(date, 1)
                await supabase
                    .from('user_plans')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('is_locked', true)
                    .eq('date', tomorrow)

                return NextResponse.json({ success: true, unlocked: true })
            }

            // Par défaut (week/all): on supprime les entrées verrouillées de la semaine active
            const weekEnd = addDaysToDateString(date, 6)
            await supabase
                .from('user_plans')
                .delete()
                .eq('user_id', user.id)
                .eq('is_locked', true)
                .gte('date', date)
                .lte('date', weekEnd)

            return NextResponse.json({ success: true, unlocked: true })
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

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single()
    if (profile?.subscription_tier && profile.subscription_tier !== 'free' && profile?.subscription_expires_at) {
        const expiresAt = new Date(profile.subscription_expires_at)
        if (expiresAt < new Date()) {
            await supabase
                .from('user_profiles')
                .update({ subscription_tier: 'free' })
                .eq('user_id', user.id)
            profile.subscription_tier = 'free'
        }
    }
    const tier = getEffectiveTier(profile)
    const viewsToday = profile?.planner_views_today || 0
    const searchParams = new URL(req.url).searchParams
    const view = searchParams.get('view') || 'today'
    const tzOffsetMin = Number(searchParams.get('tz_offset_min') || '0')
    const localDate = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const localHour = Number(searchParams.get('now_hour') || new Date().getHours())
    const todayStr = new Date().toISOString().split('T')[0]
    const tomorrowLocalDate = addDaysToDateString(localDate, 1)

    // 1. Vérifier les plans VERROUILLÉS
    if (view === 'tomorrow' || view === 'week') {
        const queryDate = view === 'tomorrow' ? tomorrowLocalDate : todayStr
            
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
                const grouped = new Map<string, any[]>()
                for (const p of lockedPlans) {
                    if (!grouped.has(p.date)) grouped.set(p.date, [])
                    grouped.get(p.date)!.push({ slot: p.slot, name: p.recipe_name, kcal: 0 })
                }
                const slotsOrder = ['petit_dejeuner', 'dejeuner', 'collation', 'diner'] as const
                const days = Array.from(grouped.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([day, menu]) => ({
                        day,
                        menu: menu.sort((a: any, b: any) => slotsOrder.indexOf(a.slot as any) - slotsOrder.indexOf(b.slot as any)),
                    }))
                return NextResponse.json({ success: true, locked: true, tier, days })
            }
        }
    }

    // Si un planning "semaine" a déjà été généré (même non verrouillé),
    // on réutilise "demain" depuis user_plans pour garder la cohérence.
    if (view === 'tomorrow') {
        const { data: plannedTomorrow } = await supabase
            .from('user_plans')
            .select('slot, recipe_name')
            .eq('user_id', user.id)
            .eq('date', tomorrowLocalDate)

        if (plannedTomorrow && plannedTomorrow.length > 0) {
            const slotsOrder = ['petit_dejeuner', 'dejeuner', 'collation', 'diner'] as const
            const uniqueSlots = new Set((plannedTomorrow as any[]).map((m: any) => m.slot))
            const hasFullDay = slotsOrder.every(s => uniqueSlots.has(s))

            // On ne réutilise le cache que si demain contient bien les 4 repas.
            // Sinon, on laisse la génération "tomorrow" produire un menu complet.
            if (hasFullDay) {
                const ordered = [...plannedTomorrow].sort((a: any, b: any) =>
                    slotsOrder.indexOf(a.slot as any) - slotsOrder.indexOf(b.slot as any)
                )
                return NextResponse.json({
                    success: true,
                    tier,
                    locked: false,
                    menu: ordered.map((m: any) => ({ slot: m.slot, name: m.recipe_name, kcal: 0 })),
                })
            }
        }
    }

    // 2. Sinon, suggestions standard
    const { start: dayStart, end: dayEnd } = getUtcRangeForLocalDay(localDate, tzOffsetMin)
    const { data: todayMeals } = await supabase
        .from('meals')
        .select('logged_at, meal_type, coach_message')
        .eq('user_id', user.id)
        .gte('logged_at', dayStart)
        .lte('logged_at', dayEnd)
    const plannerMeals = (todayMeals || []).filter((m: any) =>
        String(m?.coach_message || '').includes('Repas validé depuis ton planning Coach Yao.')
    )
    const recordedSlots = plannerMeals.map((m: any) => m.meal_type || getMealSlot(new Date(m.logged_at).getHours()))
    const slotsOrder = ['petit_dejeuner', 'dejeuner', 'collation', 'diner'] as const
    const slotTimes: Record<string, number> = { 'petit_dejeuner': 0, 'dejeuner': 12, 'collation': 16, 'diner': 19 }

    const currentSkipped = skippedSlots[`${user.id}_${localDate}`] || []
    const occupiedSlots = [...new Set([...recordedSlots, ...currentSkipped])]
    const nextSlot = slotsOrder.find(s => !occupiedSlots.includes(s))

    if (view === 'today' && tier === 'free' && viewsToday >= 2) {
        return NextResponse.json({ success: false, error: "Limite de 2 suggestions gratuites atteinte.", code: "LIMIT_REACHED" }, { status: 403 })
    }

    if (view === 'today' && !nextSlot) {
        return NextResponse.json({ success: true, completed: true, message: "Bravo ! Journée terminée ✨" })
    }

    // Sécurité de Tier et Règle du Dîner
    if (view === 'tomorrow') {
        if (tier === 'free') {
            return NextResponse.json({ success: false, error: "Le menu de demain est réservé aux membres PRO.", code: "PRO_ONLY" }, { status: 403 })
        }
        
        const hasDiner = recordedSlots.includes('diner')
        if (!hasDiner) {
            return NextResponse.json({ 
                success: false, 
                error: "Menu de demain débloqué après ton dîner du jour ! Enregistre ton dîner pour le voir.", 
                code: "DINNER_REQUIRED" 
            }, { status: 403 })
        }
    }
    
    if (view === 'week') {
        if (tier !== 'premium') {
            return NextResponse.json({ success: false, error: "Le planning hebdomadaire est réservé aux membres Premium.", code: "PREMIUM_ONLY" }, { status: 403 })
        }
    }

    // 3. Mode Hybride avec CLAUDE (Anthropic) - Utilisation de food_items
    try {
        const { data: allFoods } = await supabase.from('food_items').select('*')
        const foodsList = allFoods?.map(f => `${f.name_fr} (cat: ${f.category}, cal: ${f.calories_per_100g}kcal, P: ${f.protein_per_100g}g, G: ${f.carbs_per_100g}g, L: ${f.fat_per_100g}g, portion: ${f.default_portion_g}g)`).join('\n')

        const prompt = `Tu es Coach Yao. Voici ma base de données d'aliments africains certifiés :
        ${foodsList}

        Crée ${view === 'week' ? '7 jours complets (4 repas par jour)' : view === 'tomorrow' ? '4 repas complets' : 'le meilleur prochain repas équilibré'}.
        CONSEIL DE COMPOSITION : Tu PEUX et dois COMBINER plusieurs lignes pour créer un repas équilibré (ex: Riz + Sauce + Viande). 
        Additionne les calories et macros de chaque composant pour le résultat final.
        Les repas doivent être cohérents : petit_dejeuner (léger/sucré/énergétique), dejeuner/diner (complet : Protéine + Accompagnement + Sauce).
        
        Format attendu (JSON uniquement, pas de texte avant/après) :
        ${view === 'week' ? '{"days": [{"day": "Lundi", "menu": [{"slot":"petit_dejeuner","name":"Nom","kcal":0},{"slot":"dejeuner","name":"Nom","kcal":0},{"slot":"collation","name":"Nom","kcal":0},{"slot":"diner","name":"Nom","kcal":0}]}]}' : view === 'tomorrow' ? '{"menu": [{"slot": "petit_dejeuner", "name": "Nom combiné", "kcal": 0}]}' : '{"name": "Nom combiné", "kcal": 0, "protein": 0, "carbs": 0, "fat": 0}'}`

        const MOCK_MODE = true

        if (MOCK_MODE) {
            console.log("🛠️ MOCK MODE: Simulation de Coach Yao (Zéro coût API)")
            if (view === 'tomorrow') {
                return NextResponse.json({ success: true, tier, locked: false, menu: [
                    { slot: "petit_dejeuner", name: "[MOCK] Bouillie et Beignets", kcal: 450 },
                    { slot: "dejeuner", name: "[MOCK] Garba complet", kcal: 850 },
                    { slot: "collation", name: "[MOCK] Fruits tropicaux", kcal: 150 },
                    { slot: "diner", name: "[MOCK] Soupe légère", kcal: 300 }
                ]})
            }
            if (view === 'week') {
                const days = [
                    {
                        day: "Lundi",
                        menu: [
                            { slot: "petit_dejeuner", name: "[MOCK] Bouillie mil", kcal: 350 },
                            { slot: "dejeuner", name: "[MOCK] Riz sauce graine", kcal: 780 },
                            { slot: "collation", name: "[MOCK] Banane + arachides", kcal: 220 },
                            { slot: "diner", name: "[MOCK] Poisson braisé attiéké", kcal: 640 },
                        ],
                    },
                    {
                        day: "Mardi",
                        menu: [
                            { slot: "petit_dejeuner", name: "[MOCK] Pain omelette", kcal: 420 },
                            { slot: "dejeuner", name: "[MOCK] Foutou banane sauce claire", kcal: 760 },
                            { slot: "collation", name: "[MOCK] Ananas frais", kcal: 160 },
                            { slot: "diner", name: "[MOCK] Kedjenou poulet", kcal: 590 },
                        ],
                    },
                    {
                        day: "Mercredi",
                        menu: [
                            { slot: "petit_dejeuner", name: "[MOCK] Bouillie maïs", kcal: 340 },
                            { slot: "dejeuner", name: "[MOCK] Attiéké poisson", kcal: 700 },
                            { slot: "collation", name: "[MOCK] Yaourt nature", kcal: 180 },
                            { slot: "diner", name: "[MOCK] Sauce gombo riz", kcal: 610 },
                        ],
                    },
                    {
                        day: "Jeudi",
                        menu: [
                            { slot: "petit_dejeuner", name: "[MOCK] Beignets haricot", kcal: 390 },
                            { slot: "dejeuner", name: "[MOCK] Mafé boeuf", kcal: 820 },
                            { slot: "collation", name: "[MOCK] Papaye", kcal: 150 },
                            { slot: "diner", name: "[MOCK] Soupe légère igname", kcal: 520 },
                        ],
                    },
                    {
                        day: "Vendredi",
                        menu: [
                            { slot: "petit_dejeuner", name: "[MOCK] Crêpe millet", kcal: 360 },
                            { slot: "dejeuner", name: "[MOCK] Yassa poulet", kcal: 740 },
                            { slot: "collation", name: "[MOCK] Orange + noix", kcal: 210 },
                            { slot: "diner", name: "[MOCK] Haricot rouge plantain", kcal: 600 },
                        ],
                    },
                    {
                        day: "Samedi",
                        menu: [
                            { slot: "petit_dejeuner", name: "[MOCK] Œufs brouillés pain", kcal: 430 },
                            { slot: "dejeuner", name: "[MOCK] Garba complet", kcal: 850 },
                            { slot: "collation", name: "[MOCK] Smoothie mangue", kcal: 200 },
                            { slot: "diner", name: "[MOCK] Tilapia grillé", kcal: 560 },
                        ],
                    },
                    {
                        day: "Dimanche",
                        menu: [
                            { slot: "petit_dejeuner", name: "[MOCK] Bouillie sorgho", kcal: 330 },
                            { slot: "dejeuner", name: "[MOCK] Tiep poisson", kcal: 790 },
                            { slot: "collation", name: "[MOCK] Avocat + citron", kcal: 190 },
                            { slot: "diner", name: "[MOCK] Sauce feuille + igname", kcal: 580 },
                        ],
                    },
                ]

                // Cache semaine en base (draft) pour cohérence avec l'onglet demain.
                const draftItems = days.flatMap((w, i) =>
                    (w.menu || []).map((m: any) => ({
                        user_id: user.id,
                        date: addDaysToDateString(localDate, i),
                        slot: m.slot,
                        recipe_name: m.name,
                        is_locked: false,
                    }))
                )
                await supabase
                    .from('user_plans')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('is_locked', false)
                    .gte('date', localDate)
                    .lte('date', addDaysToDateString(localDate, 6))
                await supabase.from('user_plans').insert(draftItems)

                return NextResponse.json({ success: true, tier, locked: false, days })
            }
            return NextResponse.json({
                success: true, completed: false, locked: false, tier, slot: nextSlot,
                can_log_now: localHour >= slotTimes[nextSlot as string], start_hour: slotTimes[nextSlot as string],
                next_meal: { name: '[MOCK] Repas Équilibré Standard', kcal: 600, protein: 30, carbs: 70, fat: 20, slot: nextSlot }
            })
        }

        const msg = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 1500,
            messages: [{ role: "user", content: prompt }],
        })

        const rawText = (msg.content[0] as any).text
        const jsonMatch = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
        const selected = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)

        if (view === 'tomorrow') return NextResponse.json({ success: true, tier, menu: selected.menu, locked: false })
        if (view === 'week') {
            const slotsOrder = ['petit_dejeuner', 'dejeuner', 'collation', 'diner'] as const
            const days = (selected.days || []).map((d: any) => {
                if (Array.isArray(d?.menu)) return d
                return {
                    day: d?.day || '',
                    menu: slotsOrder.map((slot) => ({
                        slot,
                        name: d?.main_dish || 'Repas équilibré',
                        kcal: 0,
                    })),
                }
            })
            const draftItems = days.flatMap((w: any, i: number) =>
                (w.menu || []).map((m: any) => ({
                    user_id: user.id,
                    date: addDaysToDateString(localDate, i),
                    slot: m.slot,
                    recipe_name: m.name,
                    is_locked: false,
                }))
            )
            await supabase
                .from('user_plans')
                .delete()
                .eq('user_id', user.id)
                .eq('is_locked', false)
                .gte('date', localDate)
                .lte('date', addDaysToDateString(localDate, 6))
            if (draftItems.length > 0) {
                await supabase.from('user_plans').insert(draftItems)
            }
            return NextResponse.json({ success: true, tier, days, locked: false })
        }

        return NextResponse.json({
            success: true,
            completed: false,
            locked: false,
            tier,
            next_meal: { ...selected, slot: nextSlot },
            slot: nextSlot,
            can_log_now: localHour >= slotTimes[nextSlot as string],
            start_hour: slotTimes[nextSlot as string]
        })
    } catch (aiErr) {
        console.error("Chef Yao error:", aiErr)
        
        // Fallbacks pour éviter un écran vide en cas de crash
        if (view === 'week') {
            const days = Array.from({length: 7}).map((_, i) => ({
                day: `Jour ${i+1}`,
                menu: ['petit_dejeuner', 'dejeuner', 'collation', 'diner'].map((slot) => ({
                    slot,
                    name: 'Foutou sauce graine',
                    kcal: 500,
                })),
            }))
            const draftItems = days.flatMap((w, i) =>
                (w.menu || []).map((m: any) => ({
                    user_id: user.id,
                    date: addDaysToDateString(localDate, i),
                    slot: m.slot,
                    recipe_name: m.name,
                    is_locked: false,
                }))
            )
            await supabase
                .from('user_plans')
                .delete()
                .eq('user_id', user.id)
                .eq('is_locked', false)
                .gte('date', localDate)
                .lte('date', addDaysToDateString(localDate, 6))
            await supabase.from('user_plans').insert(draftItems)
            return NextResponse.json({ success: true, tier, days, locked: false })
        }
        if (view === 'tomorrow') {
            return NextResponse.json({ success: true, tier, menu: ['petit_dejeuner', 'dejeuner', 'collation', 'diner'].map(s => ({ slot: s, name: 'Repas de secours', kcal: 500 })), locked: false })
        }
        
        return NextResponse.json({ success: true, next_meal: { name: 'Riz gras au poisson', kcal: 650, protein: 35, carbs: 80, fat: 18, slot: nextSlot }, slot: nextSlot })
    }
}

function getMealSlot(hour: number): string {
    if (hour >= 5 && hour < 11) return 'petit_dejeuner'
    if (hour >= 11 && hour < 15) return 'dejeuner'
    if (hour >= 15 && hour < 18) return 'collation'
    return 'diner'
}
