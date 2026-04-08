import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getEffectiveTier } from "@/lib/subscription"

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
    
    // Si Free, on ne donne pas accès au planning
    if (tier === 'free') {
        return NextResponse.json({ 
            success: false, 
            error: "Upgrade required", 
            code: "PREMIUM_ONLY" 
        }, { status: 403 })
    }

    // 2. Récupérer les repas déjà pris aujourd'hui
    const today = new Date().toISOString().split('T')[0]
    const { data: todayMeals } = await supabase
        .from('meals')
        .select('logged_at')
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

    // 3. Déterminer le prochain créneau prioritaire
    const slotsOrder = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
    const slotTimes: Record<string, number> = {
        'petit_dejeuner': 0,
        'dejeuner': 12,
        'collation': 16,
        'diner': 19
    }

    let nextSlot = slotsOrder.find(s => !recordedSlots.includes(s))

    // Si tout est fini pour aujourd'hui
    if (!nextSlot) {
        return NextResponse.json({
            success: true,
            completed: true,
            message: "Bravo ! Ta journée est bien remplie. On se retrouve demain pour un nouveau menu."
        })
    }

    // Vérifier si le slot est "ouvert" (pas trop tôt)
    const currentHour = new Date().getHours()
    const canLogNow = currentHour >= slotTimes[nextSlot]

    // 4. Propositions simulées
    const mockProposals: Record<string, any> = {
        'petit_dejeuner': { name: 'Bouillie de mil & une mangue', kcal: 320, protein: 6, carbs: 65, fat: 4 },
        'dejeuner': { name: 'Riz gras au poisson braisé', kcal: 650, protein: 35, carbs: 80, fat: 18 },
        'diner': { name: 'Attiéké thon & crudités', kcal: 480, protein: 28, carbs: 60, fat: 12 },
        'collation': { name: 'Poignée d\'arachides grillées', kcal: 180, protein: 8, carbs: 6, fat: 14 }
    }

    const proposal = mockProposals[nextSlot as keyof typeof mockProposals]

    return NextResponse.json({
        success: true,
        completed: false,
        tier,
        next_meal: proposal,
        slot: nextSlot as 'petit_dejeuner' | 'dejeuner' | 'collation' | 'diner',
        can_log_now: canLogNow,
        start_hour: slotTimes[nextSlot],
        can_see_tomorrow: tier === 'pro' || tier === 'premium',
        can_see_week: tier === 'premium'
    })
}
