import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_RULES, getEffectiveTier } from '@/lib/subscription'
import { buildDietaryContextLine } from '@/lib/dietaryContext'
import { SLOT_LABELS, type MealSlotKey } from '@/store/useAppStore'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)


function buildWeekDatesFromTomorrow(): string[] {
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
    const out: string[] = []
    const start = new Date()
    start.setDate(start.getDate() + 1)
    for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        const label = `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
        out.push(label)
    }
    return out
}

function fillUndefinedMeals(text: string): string {
    const replacements = [
        'Bouillie de mil + oeuf dur + papaye',
        'Riz complet + haricots rouges + poisson grillé',
        'Banane + arachides nature',
        'Patate douce + légumes-feuilles + poulet braisé',
        'Igname bouillie + sauce tomate-oignon + œufs',
        'Akassa + sauce gombo + poisson',
        'Avoine + yaourt nature + fruits',
    ]
    let i = 0
    return text.replace(/a definir/gi, () => {
        const val = replacements[i % replacements.length]
        i += 1
        return val
    })
}

/**
 * Fallback en cas de surcharge Anthropic : compose un menu simple à partir de la BD
 */
function buildEmergencyLocalMenu(foods: any[], userMsg: string): string {
    const normalized = userMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    let slot: MealSlotKey = 'dejeuner'
    if (normalized.includes('petit')) slot = 'petit_dejeuner'
    if (normalized.includes('collation') || normalized.includes('grignoter')) slot = 'collation'
    if (normalized.includes('diner') || normalized.includes('soir')) slot = 'diner'
    
    const selected: any[] = []
    if (foods && foods.length > 0) {
        const shuffled = [...foods].sort(() => 0.5 - Math.random())
        selected.push(...shuffled.slice(0, 2))
    }

    const itemsStr = selected.map(f => `- ${f.display_name || f.name_standard} (${f.default_portion_g || 150}g)`).join('\n')
    const dataItems = selected.map(f => ({ name: f.name_standard, volume_ml: f.default_portion_g || 150 }))

    return `menu creneau ${slot}:
[Mode de Secours 🛡️] Mes serveurs sont un peu occupés, mais voici une suggestion équilibrée pour ton **${SLOT_LABELS[slot]}** basée sur notre base de données :

${itemsStr}

Bon appétit et merci de ta patience ! 💪

---DATA---
{"type":"suggestion","items":${JSON.stringify(dataItems)}}`
}

/**
 * Détecte si l'utilisateur précise des ingrédients disponibles.
 * Ex: "j'ai seulement du riz, des tomates et du poisson"
 * Retourne un tableau de noms normalisés, ou null si aucune contrainte.
 */
function detectIngredientConstraint(msg: string): string[] | null {
    const normalized = msg.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const patterns = [
        /j[\s']ai\s+(?:seulement|que|uniquement)?\s*(?:du\s+|de\s+la\s+|de\s+l[\s']|des\s+)?([^.?!\n]+?)(?:\s+(?:disponible|a disposition|chez moi|seulement))?[.?!]?$/i,
        /avec\s+(?:seulement|que|uniquement)?\s*(?:du\s+|de\s+la\s+|des\s+)?([^.?!\n]+?)(?:\s+(?:disponible|a disposition))?[.?!]?$/i,
        /(?:ingredients?|aliments?)\s*(?:disponibles?|que j[\s']ai)?\s*[:]\s*([^.?!\n]+)/i,
        /(?:en utilisant|utilise|prepare|compose)\s+(?:seulement|uniquement)?\s*(?:du\s+|de\s+la\s+|des\s+)?([^.?!\n]+)/i,
        /(?:il me reste|j[\s']ai seulement|j[\s']ai juste)\s+([^.?!\n]+)/i,
    ]
    for (const pattern of patterns) {
        const match = normalized.match(pattern)
        if (match) {
            const items = match[1]
                .split(/,|\bet\b|\bou\b|\bplus\b/i)
                .map((s: string) => s.replace(/^(du|de la|de l|des|un|une|le|la|les)\s+/i, '').trim())
                .filter((s: string) => s.length > 2 && !/^(menu|pour|mon|ma|mes|ce|cette|le|la|les)$/.test(s))
            if (items.length > 0) return items
        }
    }
    return null
}

/**
 * Filtre les aliments de la BD dont le nom correspond aux ingrédients détectés.
 * Utilise une correspondance partielle bidirectionnelle pour la robustesse.
 */
function matchFoodsToIngredients(allFoods: any[], ingredients: string[]): any[] {
    return allFoods.filter((f: any) => {
        const nameStd = (f.name_standard || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const nameDisp = (f.display_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return ingredients.some((ing: string) => {
            const ingClean = ing.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
            return (
                nameStd.includes(ingClean) ||
                nameDisp.includes(ingClean) ||
                ingClean.includes(nameStd.split(' ')[0]) ||
                (nameDisp && ingClean.includes(nameDisp.split(' ')[0]))
            )
        })
    })
}

function buildLocalWeekMenuFallback(): string {
    const weekDates = buildWeekDatesFromTomorrow()
    const dayTemplates = [
        {
            pd: 'Petit-déj (500 kcal): Bouillie de mil + 2 oeufs + banane',
            dj: 'Déjeuner (700 kcal): Riz + poisson grillé + légumes-feuilles',
            co: 'Collation (250 kcal): Orange + arachides',
            di: 'Dîner (650 kcal): Patate douce + haricots rouges + salade tomate-oignon',
        },
        {
            pd: 'Petit-déj (500 kcal): Pâte maïs + lait + oeuf dur',
            dj: 'Déjeuner (700 kcal): Riz complet + poulet + carottes sautées',
            co: 'Collation (250 kcal): Yaourt nature + amandes',
            di: 'Dîner (650 kcal): Igname + lentilles + légumes verts',
        },
        {
            pd: 'Petit-déj (500 kcal): Oeufs brouillés + pain complet + avocat',
            dj: 'Déjeuner (700 kcal): Riz + boeuf maigre + brocoli',
            co: 'Collation (250 kcal): Pomme + cacahuètes',
            di: 'Dîner (650 kcal): Manioc + pois chiches + salade concombre',
        },
    ]

    const lines = weekDates.map((d, idx) => {
        const t = dayTemplates[idx % dayTemplates.length]
        return `${idx + 1}. ${d}:\n${t.pd}\n${t.dj}\n${t.co}\n${t.di}`
    })
    return `menu semaine:\n${lines.join('\n')}`
}

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization')
        if (!authHeader) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)
        if (!user || authError) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

        // 1. Récupérer le profil et les données d'utilisation actuelles
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single()

        if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

        let tier = profile.subscription_tier || 'free'
        const expiresAt = profile?.subscription_expires_at ? new Date(profile.subscription_expires_at) : null
        if (expiresAt && expiresAt < new Date()) {
            tier = 'free'
            if (profile.subscription_tier !== 'free') {
                await supabase
                    .from('user_profiles')
                    .update({ subscription_tier: 'free' })
                    .eq('user_id', user.id)
            }
        }

        // 2. Gestion des quotas
        const effectiveTier = getEffectiveTier(profile)
        const rules = SUBSCRIPTION_RULES[effectiveTier] || SUBSCRIPTION_RULES.free
        const maxMessages = Number(rules.maxChatMessagesPerDay)
        const today = new Date().toISOString().split('T')[0]

        let messagesUsedToday = profile.chat_messages_today || 0
        let resetUpdates: any = {}
        if (profile.last_usage_reset_date !== today) {
            if (effectiveTier !== 'free') {
                messagesUsedToday = 0
                resetUpdates = { scan_feedbacks_today: 0 } // Reset other daily counters too
            }
        }

        // 3. Traiter la requête de l'utilisateur
        const { messages, userContext, currentSuggestions } = await req.json()
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: 'Messages invalides' }, { status: 400 })
        }
        const messageContent = String(messages[messages.length - 1]?.content || '')
        const normalizedUserMessage = messageContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

        // --- VÉRIFICATION DES LIMITES (MESSAGES ET SUGGESTIONS) ---
        const scanFeedbacksToday = profile.scan_feedbacks_today || 0
        // --- VÉRIFICATION DES LIMITES (MESSAGES) ---
        let isUsingPaidMessages = false
        const paidChatMessages = profile.paid_chat_messages_remaining || 0

        if (messagesUsedToday >= maxMessages) {
            if (paidChatMessages > 0) {
                isUsingPaidMessages = true
            } else {
                return NextResponse.json({
                    success: false,
                    error: 'Limite de messages atteinte (10/jour). Achète un pack (100 FCFA) pour continuer !',
                    code: 'LIMIT_REACHED'
                }, { status: 200 })
            }
        }

        const isRequestingMenu = normalizedUserMessage.includes('menu') || normalizedUserMessage.includes('composer') || normalizedUserMessage.includes('manger quoi') || normalizedUserMessage.includes('collation') || normalizedUserMessage.includes('grignoter') || normalizedUserMessage.includes('petit dejeuner') || normalizedUserMessage.includes('dejeuner') || normalizedUserMessage.includes('diner')
        
        // --- BLOCAGE SUGGESTIONS SI QUOTA 4 ATTEINT ---
        const maxScansAllowed = SUBSCRIPTION_RULES[effectiveTier].maxScansPerDay
        if (isRequestingMenu && scanFeedbacksToday >= maxScansAllowed && paidChatMessages <= 0) {
            return NextResponse.json({
                success: false,
                error: 'Ta limite quotidienne de 4 repas est atteinte. Reviens demain ou utilise un pack !',
                code: 'LIMIT_REACHED'
            }, { status: 200 })
        }
        const wantsMenuAny = isRequestingMenu || normalizedUserMessage.includes('ingredient') || normalizedUserMessage.includes('j\'ai')
        
        const wantsTomorrow = /\bdemain\b/.test(normalizedUserMessage) && /\bmenu\b/.test(normalizedUserMessage)
        const wantsWeek = (/\bsemaine\b/.test(normalizedUserMessage) || /\b7 jours\b/.test(normalizedUserMessage)) && /\bmenu\b/.test(normalizedUserMessage)
        const isFreeLimited = (wantsTomorrow || wantsWeek) && effectiveTier === 'free'

        // Contexte des suggestions actuelles pour la mémoire longue
        let suggestionsContext = "Aucune suggestion de menu n'est active pour le moment."
        if (currentSuggestions?.week) {
            suggestionsContext = `Un menu SEMAINE est déjà actif :\n${currentSuggestions.week.substring(0, 500)}...`
        } else if (currentSuggestions?.tomorrow) {
            suggestionsContext = `Un menu pour DEMAIN est déjà actif : ${currentSuggestions.tomorrow.substring(0, 100)}...`
        }

        let foodsContext = ""
        let hasIngredientConstraint = false
        let allFoodsDB: any[] = [] 

        // 🔍 Coach Yao interroge TOUJOURS la BD pour avoir le contexte (Filtre Sécurité)
        const { data: allFoods, error: foodsError } = await supabase
            .from('food_items')
            .select('*, verified, user_id')
            .or(`verified.eq.true,user_id.eq.${user.id}`)

        if (foodsError) console.error("❌ Erreur Supabase food_items:", foodsError)
        if (allFoods) allFoodsDB = allFoods 
        console.log(`✅ ${allFoods?.length || 0} aliments sécurisés trouvés dans la BD.`)

        if (allFoods && allFoods.length > 0) {
            // ── Détection d'ingrédients précisés par l'utilisateur ──────────
            const detectedIngredients = detectIngredientConstraint(messageContent)
            const matchedFoods = detectedIngredients ? matchFoodsToIngredients(allFoods, detectedIngredients) : []
            hasIngredientConstraint = matchedFoods.length > 0

            if (hasIngredientConstraint) {
                const matchedList = matchedFoods.map((f: any) =>
                    `- ${f.display_name || f.name_standard} [ID_BD: ${f.name_standard}] : ${f.calories_per_100g}kcal/100g`
                ).join('\n')
                foodsContext = `\n\n[INGRÉDIENTS DISPONIBLES - LISTE EXCLUSIVE]\nL'utilisateur a UNIQUEMENT ces ${matchedFoods.length} aliment(s). Propose un menu avec SEULEMENT ceux-là :\n${matchedList}`
            } else {
                const foodsList = allFoods.map((f: any) =>
                    `- ${f.display_name || f.name_standard} [ID_BD: ${f.name_standard}]`
                ).join('\n')
                foodsContext = `\n\n[BASE DE DONNÉES : ${allFoods.length} ALIMENTS DISPONIBLES]\nUtilise ces aliments pour tes suggestions. Si l'utilisateur n'a pas encore ajouté ses propres aliments, encourage-le à utiliser le bouton SCANNER (icône bleue au centre) pour enregistrer ses vrais repas et "alimenter" ton savoir de coach :\n${foodsList}`
            }
        }


        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        // Abidjan est à l'heure UTC+0. On utilise getUTC pour être robuste quel que soit le serveur.
        const hh = String(now.getUTCHours()).padStart(2, '0')
        const mm = String(now.getUTCMinutes()).padStart(2, '0')
        const currentTime = `${hh}:${mm}`
        const tomDate = new Date()
        tomDate.setDate(now.getDate() + 1)
        const tomorrowStr = tomDate.toISOString().split('T')[0]
        
        // --- CALCUL CONSOMMATION RÉELLE AUJOURD'HUI ---
        const { data: todayMealsDB } = await supabase
            .from('meals')
            .select('calories, protein_g, carbs_g, fat_g, logged_at')
            .eq('user_id', user.id)
            .gte('logged_at', `${todayStr}T00:00:00.000Z`)
            .lte('logged_at', `${todayStr}T23:59:59.999Z`)

        const dailyConsumed = (todayMealsDB || []).reduce((acc, m) => acc + (Number(m.calories) || 0), 0)
        let dailyProt = 0, dailyCarbs = 0, dailyFat = 0
        const slotTotals: Record<string, number> = { petit_dejeuner: 0, dejeuner: 0, collation: 0, diner: 0 }
        
        ;(todayMealsDB || []).forEach(m => {
            const hour = new Date(m.logged_at).getUTCHours()
            const s = (hour < 12) ? 'petit_dejeuner' : (hour < 16) ? 'dejeuner' : (hour < 19) ? 'collation' : 'diner'
            slotTotals[s] += (Number(m.calories) || 0)
            dailyProt += (Number(m.protein_g) || 0)
            dailyCarbs += (Number(m.carbs_g) || 0)
            dailyFat += (Number(m.fat_g) || 0)
        })

        const dailyRemaining = Math.max(0, profile.calorie_target - dailyConsumed)
        const budgetPercentRemaining = Math.round((dailyRemaining / profile.calorie_target) * 100)

        // --- CALCUL OBJECTIF CRÉNEAU ACTUEL (Redistribution dynamique) ---
        const SLOT_ORDER = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
        const DEFAULT_DIST: Record<string, number> = { petit_dejeuner: 0.25, dejeuner: 0.35, collation: 0.10, diner: 0.30 }
        
        const currentHour = now.getUTCHours()
        const currentSlot = (currentHour < 12) ? 'petit_dejeuner' : (currentHour < 16) ? 'dejeuner' : (currentHour < 19) ? 'collation' : 'diner'
        const currentIdx = SLOT_ORDER.indexOf(currentSlot)
        
        let pastCons = 0
        for(let i=0; i<currentIdx; i++) pastCons += slotTotals[SLOT_ORDER[i]]
        
        const remainingSlots = SLOT_ORDER.slice(currentIdx)
        const totalPctRem = remainingSlots.reduce((sum, s) => sum + DEFAULT_DIST[s], 0)
        const shareOfCurrent = DEFAULT_DIST[currentSlot] / (totalPctRem || 1)
        const currentSlotTarget = Math.round(Math.max(0, profile.calorie_target - pastCons) * shareOfCurrent)
        const currentSlotConsumed = slotTotals[currentSlot]
        const currentSlotRemaining = Math.max(0, currentSlotTarget - currentSlotConsumed)

        // --- DÉTECTION ALERTES ---
        let smartAlert = ""
        const protTarget = profile.protein_target_g || 100
        const carbsTarget = profile.carbs_target_g || 250
        const fatTarget = profile.fat_target_g || 65
        if (dailyConsumed > profile.calorie_target) smartAlert = "[ALERTE] Budget calories DÉPASSÉ pour aujourd'hui."
        else if (dailyCarbs > carbsTarget * 0.9) smartAlert = "[ALERTE] Quota GLUCIDES presque atteint."
        else if (dailyFat > fatTarget * 0.9) smartAlert = "[ALERTE] Quota LIPIDES presque atteint."

        console.log(`📊 [CHAT DEBUG] Slot: ${currentSlot} | SlotTarget: ${currentSlotTarget} | DailyRem: ${dailyRemaining}`)

        // --- DATES DE PLANIFICATION (Séquence exacte pour le Coach) ---
        const next7Days = buildWeekDatesFromTomorrow()
        const planningSequence = next7Days.map((d, i) => `Jour ${i + 1} : ${d}`).join('\n')

        const { data: userPlans } = await supabase
            .from('user_plans')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', todayStr)

        let plannerContext = "L'utilisateur n'a PAS de repas planifiés."
        if (userPlans && userPlans.length > 0) {
            plannerContext = "L'utilisateur A DÉJÀ ces repas confirmés dans son planning :\n"
            const grouped: Record<string, string[]> = {}
            for (const p of userPlans) {
                if (!grouped[p.date]) grouped[p.date] = []
                grouped[p.date].push(`- ${p.slot} : ${p.recipe_name}`)
            }
            for (const [d, meals] of Object.entries(grouped)) {
                plannerContext += `Date: ${d} (Aujourd'hui=${todayStr}, Demain=${tomorrowStr})\n${meals.join('\n')}\n`
            }
        }

        const systemPrompt = `Tu es Coach Yao, coach nutrition africain expert (humain). Ne mentionne JAMAIS que tu es une intelligence artificielle ou une IA.
        
=== DONNÉES TEMPORELLES & BUDGET (EXTRÊMEMENT IMPORTANT) ===
- HEURE RÉELLE (STRICTE) : ${currentTime}
- CONSOMMATION RÉELLE AUJOURD'HUI : ${Math.round(dailyConsumed)} kcal
- BUDGET RESTANT AUJOURD'HUI : ${Math.round(dailyRemaining)} kcal
- OBJECTIF DU CRÉNEAU ACTUEL (${currentSlot}) : ${currentSlotTarget} kcal
- DÉJÀ MANGÉ DANS CE CRÉNEAU : ${currentSlotConsumed} kcal
- RESTE À MANGER DANS CE CRÉNEAU : ${currentSlotRemaining} kcal (AFFICHE CE CHIFFRE EN PREMIER)
- Objectif Journalier Global : ${profile.calorie_target} kcal
${smartAlert ? `\n${smartAlert}\n` : ''}

RÈGLE D'OR : N'utilise JAMAIS d'étoiles (****) pour masquer les chiffres. FIE-TOI UNIQUEMENT à l'heure réelle (${currentTime}) et au "RESTE À MANGER" (${currentSlotRemaining}) pour tes conseils. Ne l'invente pas. INTERDICTION de citer ta stratégie de 35% si le budget restant est faible ; Yao, montre que tu es synchro avec le journal !

=== CADRE D'INTERACTION STRICT ===
- TON RÔLE : Tu es UNIQUEMENT un coach en nutrition et bien-être.
- HORS-SUJET : Si l'utilisateur pose une question qui n'a AUCUN rapport avec la nutrition, la santé, le sport ou les traditions culinaires (ex: politique, mécanique, informatique, potins, etc.), refuse POLIMENT d'y répondre. Dis-lui que ton expertise se limite à l'assiette et à la forme physique pour l'aider à atteindre ses objectifs sur Cal-Afrik.
- SANTÉ GLOBALE : Redirige toujours la conversation vers des conseils alimentaires ou d'hygiène de vie sains.

${foodsContext || "[ALERTE : Base de données vide. Demande à l'utilisateur d'utiliser le bouton SCANNER (au centre) pour enregistrer son premier repas. Explique que tout commence par une photo de son assiette pour que tu puisses apprendre ses habitudes.]"}

- RÉCAPITULATIF PAR CRÉNEAU (Vu sur le Dashboard) :
${SLOT_ORDER.map(s => {
    const t = Math.round(profile.calorie_target * DEFAULT_DIST[s]);
    const c = slotTotals[s];
    return `  * ${s.replace('_', ' ').toUpperCase()} : Objectif initial ${t} kcal | Consommé ${c} kcal`;
}).join('\n')}

=== STRATÉGIE & ALERTES (OMNISCIENCE) ===
- Si le contexte contient [ALERTE COACH], tu DOIS en tenir compte IMMEDIATEMENT dans ta prochaine suggestion (ex: proposer un repas pauvre en Glucides si l'alerte concerne les glucides).
- PRIORITÉ BUDGET : Oublie les pourcentages de [STRATÉGIE NUTRITIONNELLE] (ex: 35% pour le déjeuner) si le "RESTE À MANGER DANS CE CRÉNEAU" est différent. Priorise TOUJOURS le budget dynamique restant pour ce repas spécifique.

=== SÉQUENCE DE PLANIFICATION (7 JOURS À VENIR) ===
Tu DOIS commencer tout menu de la SEMAINE par le "Jour 1" listé ci-dessous :
${planningSequence}

=== TRANCHES HORAIRES DU STORE (getMealSlot) ===
- Petit-déjeuner (petit_dejeuner) : 00:00 - 12:00
- Déjeuner (dejeuner) : 12:00 - 16:00
- Collation (collation) : 16:00 - 19:00
- Dîner (diner) : 19:00 - 23:59

RÈGLES DE CONSCIENCE TEMPORELLE :
- Il est actuellement ${currentTime}.
- Cite TOUJOURS le "RESTE À MANGER DANS CE CRÉNEAU" dans ton introduction pour montrer que tu es synchronisé avec le journal de l'utilisateur.
- Propose le repas correspondant au créneau actuel (${currentSlot}).
- Après minuit, bascule sur le petit-déjeuner du lendemain.

RÈGLES STRICTES (OBLIGATOIRES) :
1) BUDGET CALORIQUE DYNAMIQUE (CRITIQUE) : Si tu composes un menu pour AUJOURD'HUI (menu creneau), tu DOIS calculer : [Cible] - [Déjà consommé]. Le total calorique du repas proposé DOIT impérativement tenir dans ce budget. 
2) PAS DE CALCUL DU REPAS : Ne calcule JAMAIS le TOTAL du repas que tu proposes (Calories/Macros) dans ton texte. Le système l'ajoutera automatiquement à la fin. Cependant, tu PEUX (et dois) mentionner ton budget restant et ta consommation du jour fournis ci-dessous en utilisant l'unité kcal.
3) PRÉFIXES TECHNIQUES (OBLIGATOIRES) : 
   - "menu creneau [nom]:" -> UNIQUEMENT pour un repas à consommer AUJOURD'HUI. INTERDICTION de proposer plus d'un repas à la fois pour aujourd'hui.
   - "menu demain:" -> Pour un menu complet de DEMAIN (ou un repas spécifique demain).
   - "menu semaine:" -> Pour le planning complet des 7 jours.

4) RÈGLES DE SUGGESTION (AUJOURD'HUI) :
   - Pour aujourd'hui, ne suggère JAMAIS un menu complet de la journée. 
   - Par défaut, propose UNIQUEMENT le repas du créneau actuel (${currentSlot}).
   - Si l'utilisateur précise un créneau (ex: "un dîner"), propose celui-là spécifiquement sans tenir compte de l'heure actuelle.
   - Toujours un seul repas à la fois pour aujourd'hui.
   - Dès qu'un utilisateur valide une suggestion pour aujourd'hui via "Envoyer au planning", elle s'ajoute à son journal.

5) FORMAT MENU : Très détaillé pour aujourd'hui, liste complète pour demain/semaine.
5) DISCIPLINE DE LA BASE DE DONNÉES : Utilise uniquement les [ID_BD:...] fournis.

RÈGLE DE SORTIE ABSOLUE (CRITIQUE) :
Toute suggestion de repas POUR AUJOURD'HUI (menu creneau) DOIT IMPÉRATIVEMENT se terminer par le bloc technique "---DATA---" suivi du JSON des aliments. Si tu proposes un repas mais que tu oublies ce bloc, l'utilisateur ne pourra pas l'ajouter à son journal et ton travail sera inutile. Propose uniquement des aliments présents dans la liste [ID_BD:...] ci-dessus.

EXEMPLE RÉPONSE CORRECTE :
menu creneau diner:
[Ton texte de coach ici...]

---DATA---
{"type":"suggestion","items":[{"name":"riz_blanc_vapeur","volume_ml":200},{"name":"poisson_braise","volume_ml":150}]}

Contexte utilisateur :
- OBJECTIF CALORIQUE : ${profile.calorie_target} kcal / jour (NE PAS DÉPASSER)
- Cibles Macros : P:${profile.protein_target_g || 100}g | G:${profile.carbs_target_g || 250}g | L:${profile.fat_target_g || 65}g
- Objectif forme : ${profile.goal || 'rester en forme'}
- Sexe : ${profile.gender === 'femme' ? 'Femme' : 'Homme'}
- Poids : ${profile.weight_kg || '?'} kg
- Restrictions : ${buildDietaryContextLine(profile.dietary_restrictions) || 'Aucune'}
- Autres infos : ${userContext || 'Aucune.'}

=== PLANNING ACTUALISÉ ===
${plannerContext}

=== STRATÉGIE NUTRITIONNELLE (RESPECTER STRICTEMENT) ===
- Pour un menu de DEMAIN ou SEMAINE, la somme des calories des 4 repas d'une journée DOIT être égale à environ ${profile.calorie_target} kcal (+/- 5%). Ne propose pas de journées à 3000 kcal si la cible est à ${profile.calorie_target}.
- Répartition conseillée : Petit-déj (25%), Déjeuner (35%), Collation (10%), Dîner (30%).

=== BALISE STRUCTURELLE OBLIGATOIRE (menu creneau uniquement) ===
Chaque fois que tu génères un menu pour un CRÉNEAU UNIQUE (préfixe "menu creneau XXX:"), tu DOIS ajouter à la toute fin de ton message la balise ---DATA--- avec le JSON des items.
- Ne mets RIEN après cette balise.
- Ne calcule RIEN manuellement dans le texte.`

        // ─── MODE SIMULATION ──────────────────────────────────────────
        const MOCK_MODE = false

        let aiMessage = ""

        if (MOCK_MODE) {
            await new Promise(r => setTimeout(r, 800)) // Simule un délai réaliste
            aiMessage = `[Mode TEST 🔧] Salut ${profile.name || 'ami'} ! Super question. Rappelle-toi : l'équilibre c'est la clé ! Mange des légumes africains variés, bois 2L d'eau et écoute ton corps. Tu es sur la bonne voie ! 🌿`
        } else {
            const wantsMenu = /\bmenu\b/.test(normalizedUserMessage)
            const wantsTomorrow = /\bdemain\b/.test(normalizedUserMessage)
            const wantsWeek = /\bsemaine\b/.test(normalizedUserMessage)
            const wantsSlotPetitDej = /\bpetit[\s-]?dej(?:euner)?\b/.test(normalizedUserMessage)
            const wantsSlotDejeuner = /\bdejeuner\b/.test(normalizedUserMessage)
            const wantsSlotCollation = /\bcollation\b/.test(normalizedUserMessage)
            const wantsSlotDiner = /\bdiner\b/.test(normalizedUserMessage)

            // Formatage des messages pour Anthropic (Claude exige de commencer par 'user' et d'alterner les rôles)
            let formattedMessages: any[] = messages
                .map((m: any) => ({
                    role: (m.role === 'coach' ? 'assistant' : 'user') as 'assistant' | 'user',
                    content: String(m.content || '').replace(/\*\*\*\*/g, '??') // On remplace les anciennes étoiles par des points d'interrogation pour briser le pattern
                }))
            
            // On commence impérativement par un message 'user'
            const firstUserIdx = formattedMessages.findIndex(m => m.role === 'user')
            if (firstUserIdx !== -1) {
                formattedMessages = formattedMessages.slice(firstUserIdx)
            } else {
                // Si aucun message user (impossible normalement), on vide pour éviter le crash
                formattedMessages = []
            }

            // On filtre pour éviter les doublons de rôle consécutifs (Claude râle sinon)
            formattedMessages = formattedMessages.filter((m, i, arr) => i === 0 || m.role !== arr[i-1].role)

            try {
                // Si l'utilisateur est gratuit et demande un menu restreint, on ajoute une consigne à l'IA
                const tierInstruction = isFreeLimited
                    ? "\n\n[ALERTE PLAN]: L'utilisateur est en version GRATUITE. Il demande un menu (semaine ou demain) réservé aux membres PRO et PREMIUM. NE GÉNÈRE PAS le menu demandé. Explique-lui chaleureusement que c'est une fonctionnalité PRO/PREMIUM et invite-le à s'abonner, mais propose-lui obligatoirement un menu pour AUJOURD'HUI à la place pour l'aider immédiatement."
                    : ""

            // --- RETRY LOGIC (Backoff pour erreurs 529) ---
            let attempts = 0
            const maxAttempts = 3
            let lastErr: any = null

            while (attempts < maxAttempts) {
                try {
                    const response = await anthropic.messages.create({
                        model: 'claude-haiku-4-5-20251001',
                        max_tokens: wantsWeek ? 4500 : 1500, // Augmenté pour éviter les textes et JSON tronqués
                        system: systemPrompt + (wantsWeek ? "\n\n[CONSIGNE SEMAINE]: Détaille chaque jour avec ses 4 créneaux. Ne sois pas trop concis." : "") + (isFreeLimited ? "\n[PLAN GRATUIT]: Refuse poliment le menu demain/semaine et invite à s'abonner." : ""),
                        messages: formattedMessages as any
                    })

                    const rawText = response.content[0].type === 'text' ? response.content[0].text : 'Je suis là pour t\'aider ! 💪'
                    aiMessage = rawText.trim()
                    lastErr = null
                    break // Succès !
                } catch (err: any) {
                    lastErr = err
                    if (err?.status === 529 || err?.status === 429) {
                        attempts++
                        console.warn(`⚠️ Anthropic Overloaded (Attempt ${attempts}/${maxAttempts})...`)
                        await new Promise(r => setTimeout(r, 1000 * attempts)) // Attente progressive
                    } else {
                        throw err // Autre erreur : on stop
                    }
                }
            }

            if (lastErr) {
                console.error('❌ Anthropic failed after retries:', lastErr)
                // --- FALLBACK INTELLIGENT (Sans IA) ---
                if (wantsMenuAny) {
                    aiMessage = buildEmergencyLocalMenu(allFoodsDB, messageContent)
                } else {
                    aiMessage = "Désolé, mes systèmes sont un peu fatigués en ce moment. Peux-tu réessayer dans quelques secondes ? 💪"
                }
            }
            
            // Nettoyage sécurité : Si l'IA pose une question mais a mis un préfixe technique de CRÉNEAU UNIQUE, on nettoie pour l'affichage suggestion.
            if (aiMessage.toLowerCase().includes('menu creneau')) {
                // ... reste du nettoyage existant ...
            }
            } catch (anthropicErr) {
                console.error('⚠️ Anthropic primary error:', anthropicErr)
                if (wantsWeek) {
                    aiMessage = buildLocalWeekMenuFallback()
                } else {
                    throw anthropicErr
                }
            }

            // Garde-fou: si l'utilisateur demande un menu mais que le modèle n'a pas mis
            // le préfixe attendu, on le rajoute automatiquement. Mais si le modèle a mis le préfixe
            // alors que c'est manifestement une question ou une phrase conversationnelle courte, on l'enlève.
            const prefixRegex = /^menu\s+(creneau\s+(petit_dejeuner|dejeuner|collation|diner)|demain|semaine)\s*:\s*/i
            const hasMenuPrefix = prefixRegex.test(aiMessage)
            const hasExplicitTarget = wantsWeek || wantsTomorrow || wantsSlotPetitDej || wantsSlotDejeuner || wantsSlotCollation || wantsSlotDiner
            const isConfirmationPrompt = aiMessage.includes('?') && aiMessage.length < 250
            const lacksMealFormat = !/(Petit-d[ée]j|D[ée]jeuner|Collation|D[îi]ner)\b/i.test(aiMessage) && !wantsWeek

            if (hasMenuPrefix && (isConfirmationPrompt || lacksMealFormat)) {
                // L'IA a mis le préfixe à tort sur une phrase conversationnelle
                aiMessage = aiMessage.replace(prefixRegex, '')
            } else if (wantsMenu && hasExplicitTarget && !hasMenuPrefix && !isConfirmationPrompt && !lacksMealFormat) {
                // L'IA a oublié le préfixe pour un vrai menu
                let prefix = 'menu demain:'
                if (wantsWeek) prefix = 'menu semaine:'
                else if (wantsTomorrow) prefix = 'menu demain:'
                else if (wantsSlotPetitDej) prefix = 'menu creneau petit_dejeuner:'
                else if (wantsSlotDejeuner) prefix = 'menu creneau dejeuner:'
                else if (wantsSlotCollation) prefix = 'menu creneau collation:'
                else if (wantsSlotDiner) prefix = 'menu creneau diner:'
                aiMessage = `${prefix} ${aiMessage}`.trim()
            }

            // On s'assure que le menu semaine est bien détecté et formaté par Yao directement
            if (wantsWeek && !/^menu\s+semaine\s*:/i.test(aiMessage) && aiMessage.length > 300) {
                aiMessage = `menu semaine:\n${aiMessage}`.trim()
            }
        }

        // ─── VALIDATION SERVEUR DU BLOC ---DATA--- ──────────────────────────────
        // L'IA peut inventer des name_standard. On corrige ici avant d'envoyer au frontend.
        if (aiMessage.includes('---DATA---') && allFoodsDB.length > 0) {
            try {
                // On récupère le texte pur sans aucune balise DATA générée par l'IA
                // pour reconstruire proprement la signature et le JSON final.
                const segments = aiMessage.split('---DATA---')
                const baseText = segments[0].trim()
                const jsonStr = segments[segments.length - 1].trim()
                const parsed = JSON.parse(jsonStr)

                if (parsed.items && Array.isArray(parsed.items)) {
                    let changed = false
                    parsed.items = parsed.items.map((item: any) => {
                        const inputName = (item.name || '').toLowerCase().replace(/_/g, ' ')

                        // 1. Correspondance exacte name_standard
                        let match = allFoodsDB.find((f: any) => f.name_standard === item.name)

                        // 2. Correspondance exacte display_name
                        if (!match) {
                            match = allFoodsDB.find((f: any) =>
                                (f.display_name || '').toLowerCase() === inputName
                            )
                        }

                        // 3. Correspondance partielle (mots significatifs > 2 chars)
                        if (!match) {
                            const words = inputName.split(/[\s_]+/).filter((w: string) => w.length > 2)
                            let bestScore = 0
                            for (const f of allFoodsDB) {
                                const nameStd = (f.name_standard || '').toLowerCase().replace(/_/g, ' ')
                                const dispName = (f.display_name || '').toLowerCase()
                                const score = words.filter((w: string) =>
                                    nameStd.includes(w) || dispName.includes(w)
                                ).length
                                if (score > bestScore) {
                                    bestScore = score
                                    match = f
                                }
                            }
                            if (bestScore === 0) match = undefined
                        }

                        if (match && match.name_standard !== item.name) {
                            console.log(`🔧 DATA auto-fix: "${item.name}" → "${match.name_standard}"`)
                            changed = true
                            return { ...item, name: match.name_standard }
                        }
                        if (!match) {
                            console.warn(`⚠️ DATA: aliment introuvable en BD: "${item.name}" — item supprimé du bloc`)
                            changed = true
                            return null
                        }
                        return item
                    }).filter(Boolean)

                    if (changed || parsed.items.length > 0) {
                        // --- NETTOYAGE SÉCURITÉ ---
                        // On ne nettoie plus agressivement car le coach peut mentionner le budget restant
                        aiMessage = baseText

                        // --- CALCUL DU TOTAL CERTIFIÉ (Injecté en signature) ---
                        let trueCals = 0, trueP = 0, trueG = 0, trueL = 0
                        parsed.items.forEach((it: any) => {
                            const f = allFoodsDB.find(db => db.name_standard === it.name)
                            if (f) {
                                const q = it.volume_ml || f.default_portion_g || 150
                                trueCals += (f.calories_per_100g * q) / 100
                                trueP += ((f.proteins_100g || 0) * q) / 100
                                trueG += ((f.carbs_100g || 0) * q) / 100
                                trueL += ((f.lipids_100g || 0) * q) / 100
                            }
                        })

                        if (trueCals > 0) {
                            // On enrichit chaque item avec ses valeurs nutritionnelles calculées
                            parsed.items = parsed.items.map((it: any) => {
                                const f = allFoodsDB.find(db => db.name_standard === it.name)
                                if (f) {
                                    const q = it.volume_ml || f.default_portion_g || 150
                                    return {
                                        ...it,
                                        display_name: f.display_name || f.name_standard.replace(/_/g, ' '),
                                        calories: Math.round((f.calories_per_100g * q) / 100),
                                        protein_g: Math.round(((f.proteins_100g || 0) * q) / 100 * 10) / 10,
                                        carbs_g: Math.round(((f.carbs_100g || 0) * q) / 100 * 10) / 10,
                                        fat_g: Math.round(((f.lipids_100g || 0) * q) / 100 * 10) / 10
                                    }
                                }
                                return it
                            })

                             // --- NETTOYAGE DES DOUBLONS ---
                             // On s'assure qu'il n'y a pas déjà une signature ou un bloc DATA (cas de retry ou hallucination)
                             aiMessage = aiMessage.split('───')[0].split('---DATA---')[0].trim()

                             const signature = `\n\n────────────────\n📊 **TOTAL CERTIFIÉ** (Base Cal-Afrik) :\n🔥 **${Math.round(trueCals)} kcal** | 🥩 P: ${Math.round(trueP)}g | 🥖 G: ${Math.round(trueG)}g | 🥑 L: ${Math.round(trueL)}g`
                             aiMessage = aiMessage + signature + '\n\n---DATA---\n' + JSON.stringify(parsed)
                        } else {
                            aiMessage = aiMessage + '\n\n---DATA---\n' + JSON.stringify(parsed)
                        }
                    }
                }
            } catch (fixErr) {
                console.warn('⚠️ DATA block auto-fix failed:', fixErr)
            }
        }

        // 4. Mettre à jour l'utilisation dans la base de données
        const isSuggestion = aiMessage.includes('---DATA---')
        const updatePayload: any = { updated_at: new Date().toISOString() }

        if (isUsingPaidMessages) {
            updatePayload.paid_chat_messages_remaining = Math.max(0, paidChatMessages - 1)
        } else {
            updatePayload.chat_messages_today = messagesUsedToday + 1
            updatePayload.last_usage_reset_date = todayStr
            if (resetUpdates) Object.assign(updatePayload, resetUpdates)
            
        }


        await supabase
            .from('user_profiles')
            .update(updatePayload)
            .eq('user_id', user.id)

        // 5. Retourner la réponse
        return NextResponse.json({
            success: true,
            message: aiMessage,
            usageRemaining: maxMessages - (messagesUsedToday + 1)
        })

    } catch (err: any) {
        console.error('❌ Chat API error:', err)
        return NextResponse.json({ 
            success: false, 
            error: err.message || 'Erreur interne inconnue',
            details: err.stack
        }, { status: 500 })
    }
}
