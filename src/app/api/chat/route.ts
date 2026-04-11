import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_RULES, getEffectiveTier } from '@/lib/subscription'

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
        const SUBSCRIPTION_RULES: Record<string, any> = {
            free: { maxChatMessagesPerDay: 10 },
            pro: { maxChatMessagesPerDay: 50 },
            premium: { maxChatMessagesPerDay: 100 }
        }
        
        const effectiveTier = getEffectiveTier(profile)
        const rules = SUBSCRIPTION_RULES[effectiveTier] || SUBSCRIPTION_RULES.free
        const maxMessages = Number(rules.maxChatMessagesPerDay)
        const today = new Date().toISOString().split('T')[0]
        
        let messagesUsedToday = profile.chat_messages_today || 0
        if (profile.last_usage_reset_date !== today) {
            messagesUsedToday = 0
        }

        // Vérification de la limite
        if (messagesUsedToday >= maxMessages) {
            return NextResponse.json({ 
                success: false, 
                error: 'Limite journalière atteinte. Reviens demain !', 
                code: 'LIMIT_REACHED' 
            }, { status: 200 })
        }

        // 3. Traiter la requête de l'utilisateur
        const { messages, userContext, currentSuggestions } = await req.json()
        const messageContent = String(messages?.[messages.length - 1]?.content || '')
        const normalizedUserMessage = messageContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        
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

        const messageLower = normalizedUserMessage
        const wantsMenuAny = messageLower.includes('menu') || messageLower.includes('composer') || messageLower.includes('manger quoi') || messageLower.includes('collation') || messageLower.includes('grignoter') || messageLower.includes('petit déjeuner') || messageLower.includes('déjeuner') || messageLower.includes('dîner') || messageLower.includes('ingredient') || messageLower.includes('j\'ai') || messageLower.includes('j\'ai seulement')
        let foodsContext = ""
        let hasIngredientConstraint = false

        if (wantsMenuAny) {
            console.log("🔍 Coach Yao interroge la BD food_items...")
            const { data: allFoods, error: foodsError } = await supabase.from('food_items').select('*')
            if (foodsError) console.error("❌ Erreur Supabase food_items:", foodsError)
            console.log(`✅ ${allFoods?.length || 0} aliments trouvés dans la BD.`)

            if (allFoods && allFoods.length > 0) {
                // ── Détection d'ingrédients précisés par l'utilisateur ──────────
                const detectedIngredients = detectIngredientConstraint(messageContent)
                const matchedFoods = detectedIngredients ? matchFoodsToIngredients(allFoods, detectedIngredients) : []
                hasIngredientConstraint = matchedFoods.length > 0

                console.log(`🧪 Ingrédients détectés : ${detectedIngredients?.join(', ') || 'aucun'}`)
                console.log(`✅ Aliments matchés dans la BD : ${matchedFoods.length}`)

                if (hasIngredientConstraint) {
                    // Mode contraint : injecter UNIQUEMENT les aliments disponibles avec macros/100g
                    const matchedList = matchedFoods.map((f: any) =>
                        `- ${f.display_name || f.name_standard} [ID_BD: ${f.name_standard}] : ${f.calories_per_100g}kcal/100g | P:${f.proteins_100g || 0}g G:${f.carbs_100g || 0}g L:${f.lipids_100g || 0}g`
                    ).join('\n')
                    foodsContext = `\n\n[INGRÉDIENTS DISPONIBLES - LISTE EXCLUSIVE]\nL'utilisateur a UNIQUEMENT ces ${matchedFoods.length} aliment(s) à sa disposition. Tu DOIS composer le menu EN UTILISANT SEULEMENT ces ingrédients :\n${matchedList}\n\nCONSIGNE PORTIONS : Propose des portions précises en grammes pour atteindre l'objectif calorique du créneau (basé sur le profil utilisateur). Calcule et affiche en fin de réponse :\n- Total calories du repas\n- Total Protéines / Glucides / Lipides\nN'invente AUCUN autre ingrédient non listé ci-dessus.\n\n⚠️ RAPPEL ---DATA--- : Dans le champ "name", utilise UNIQUEMENT les valeurs [ID_BD:...] listées ci-dessus. Ex: [ID_BD: riz_blanc_vapeur] → "name":"riz_blanc_vapeur".`
                } else {
                    // Mode standard : toute la BD
                    // On expose EXPLICITEMENT le name_standard pour le bloc ---DATA---
                    const foodsList = allFoods.map((f: any) =>
                        `- ${f.display_name || f.name_standard} [ID_BD: ${f.name_standard}] (cal: ${f.calories_per_100g}kcal, P: ${f.proteins_100g || 0}g, G: ${f.carbs_100g || 0}g, L: ${f.lipids_100g || 0}g)`
                    ).join('\n')
                    foodsContext = `\n\n[BASE DE DONNÉES CERTIFIÉE : ${allFoods.length} ALIMENTS DISPONIBLES]\nTu as INTERDICTION de proposer un aliment qui n'est pas dans cette liste. Pour chaque aliment, tu vois son [ID_BD: xxx] — c'est cet identifiant exact que tu DOIS utiliser dans le champ "name" du bloc ---DATA--- :\n${foodsList}\n\nCONSIGNE : Dans le bloc ---DATA---, "name" = la valeur [ID_BD:...] EXACTE. N'invente aucun nom, n'utilise pas le display_name.`
                }
            }
        }

        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        const currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' })
        const tomDate = new Date()
        tomDate.setDate(now.getDate() + 1)
        const tomorrowStr = tomDate.toISOString().split('T')[0]

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

        const systemPrompt = `Tu es Coach Yao, coach nutrition africain expert.
${foodsContext || "[ALERTE : Base de données indisponible. Demande à l'utilisateur de charger ses aliments.]"}

=== TRANCHES HORAIRES DU STORE (getMealSlot) ===
- Petit-déjeuner (petit_dejeuner) : 00:00 - 12:00
- Déjeuner (dejeuner) : 12:00 - 16:00
- Collation (collation) : 16:00 - 19:00
- Dîner (diner) : 19:00 - 23:59

RÈGLES DE CONSCIENCE TEMPORELLE :
- Il est actuellement ${currentTime} (heure Afrique).
- Propose le repas correspondant à la tranche horaire actuelle.
- Après minuit, bascule sur le petit-déjeuner du lendemain.

RÈGLES STRICTES (OBLIGATOIRES) :
1) PRÉFIXES TECHNIQUES : "menu creneau [nom]:" (aujourd'hui), "menu demain:", "menu semaine:".
2) FORMAT MENU DU JOUR (menu creneau) : Très détaillé ! Utilise les noms EXACTS de la BD, précise les grammes (ex: 150g) et explique les bénéfices.
3) FORMAT PLANIFICATION (demain/semaine) : Sois CONCIS. Donne juste le nom du plat et une portion indicative.
4) NOMS DE LA BASE DE DONNÉES : Utilise les noms EXACTS de la liste ci-dessus.
5) CONFLIT SEMAINE/DEMAIN : Si l'utilisateur demande "le menu de demain" alors qu'il y a déjà un "menu semaine" actif : ne mets pas de préfixe technique, demande confirmation ("Il y a déjà un menu semaine, veux-tu changer demain ?"). Si "oui", envoie "menu demain:".
6) MODE INGRÉDIENTS CONTRAINTS : Si la liste ci-dessus est marquée "[INGRÉDIENTS DISPONIBLES - LISTE EXCLUSIVE]", tu DOIS :
   a) N'utiliser QUE les aliments listés, sans exception.
   b) Calculer les portions en grammes pour atteindre l'objectif calorique du créneau.
   c) Afficher en fin de réponse le récapitulatif nutritionnel calculé :
      → Total : Xcal | Protéines : Xg | Glucides : Xg | Lipides : Xg

EXEMPLE RÉPONSE STANDARD :
menu creneau diner:
Dîner :
- Fufu (Banane plantain & Igname) (250g) : Pour tes glucides complexes et l'énergie durable.
- Poisson braisé (150g) : Excellente source de protéines maigres pour tes muscles.
- Sauce Gombos (100g) : Riche en minéraux essentiels.
Ce combo est parfait pour ta prise de masse ! 💪

EXEMPLE RÉPONSE MODE INGRÉDIENTS CONTRAINTS :
menu creneau diner:
Dîner composé avec tes ingrédients disponibles :
- Riz blanc (200g) : Énergie durable pour la soirée.
- Poisson braisé (150g) : Protéines maigres pour tes muscles.
- Tomate (100g) : Vitamines et fraîcheur.
─────────────────────────────
📊 Total : 503 kcal | P : 37g | G : 59g | L : 8g
Super choix avec ce que tu as ! Continue comme ça 💪

=== PLANNING ACTUEL ===
${plannerContext}

Contexte utilisateur :
- Objectif : ${profile.goal || 'rester en forme'}
- Poids : ${profile.weight_kg || '?'} kg
- Suggestions déjà générées précédemment : ${suggestionsContext}
- Contexte nutrition du jour : ${userContext || 'Aucune donnée fournie pour aujourd hui.'}

=== BALISE STRUCTURELLE OBLIGATOIRE (menu creneau uniquement) ===
Chaque fois que tu génères un menu pour un CRÉNEAU UNIQUE du jour (préfixe "menu creneau XXX:"), tu DOIS ajouter à la toute fin de ton message, sans rien mettre après, cette balise machine :

---DATA---
{"type":"suggestion","items":[{"name":"nom_standard_exact_bd","volume_ml":400}]}

Règles pour la balise :
- "name" = le nom_standard EXACT tel qu'il apparaît dans la base de données (ex: "riz_blanc_vapeur", "poisson_frit").
- "volume_ml" = estimation du volume de la portion en millilitres (le code convertira en grammes via density_g_ml).
- Liste TOUS les composants du repas dans "items" (base + sauce + protéine séparément).
- Pour les menus SEMAINE ou DEMAIN : n'ajoute PAS cette balise (trop d'items).
- Ne mets RIEN après la balise ---DATA---. C'est la dernière chose dans ton message.`

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

            // Formatage des messages pour Anthropic
            const formattedMessages = messages.map((m: any) => ({
                role: m.role === 'coach' ? 'assistant' : 'user',
                content: m.content
            }))

            try {
                // Si l'utilisateur est gratuit et demande un menu restreint, on ajoute une consigne à l'IA
                const tierInstruction = isFreeLimited 
                    ? "\n\n[ALERTE PLAN]: L'utilisateur est en version GRATUITE. Il demande un menu (semaine ou demain) réservé aux membres PRO. NE GÉNÈRE PAS le menu demandé. Explique-lui chaleureusement que c'est une fonctionnalité PRO/PREMIUM et invite-le à s'abonner, mais propose-lui tout de même un menu pour AUJOURD'HUI pour qu'il ne reparte pas les mains vides."
                    : ""

                const response = await anthropic.messages.create({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: wantsWeek ? 4096 : 800,
                    system: systemPrompt + (wantsWeek ? "\n\n[CONSIGNE SEMAINE]: Sois synthétique pour que les 7 jours tiennent dans le message. Va à l'essentiel : Aliments, Portions et un bénéfice court." : "") + tierInstruction,
                    messages: formattedMessages
                })
                
                const rawText = response.content[0].type === 'text' ? response.content[0].text : 'Je suis là pour t\'aider ! 💪'
                aiMessage = rawText
                    .replace(/Dis-\s*/gi, 'Dis ')
                    .trim()

                // Nettoyage sécurité : Si l'IA pose une question mais a mis un préfixe technique de CRÉNEAU UNIQUE, on nettoie pour l'affichage suggestion.
                // On laisse passer "menu demain:" et "menu semaine:" car ils ne vont pas dans le bloc suggestion immédiat.
                if (aiMessage.includes('?') && aiMessage.toLowerCase().includes('menu creneau')) {
                    aiMessage = aiMessage.replace(/menu\s+creneau\s+\w+\s*:\s*/gi, '').trim()
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

        // 4. Mettre à jour l'utilisation dans la base de données
        await supabase
            .from('user_profiles')
            .update({ 
                chat_messages_today: messagesUsedToday + 1,
                last_usage_reset_date: today
            })
            .eq('user_id', user.id)

        // 5. Retourner la réponse
        return NextResponse.json({ 
            success: true, 
            message: aiMessage,
            usageRemaining: maxMessages - (messagesUsedToday + 1)
        })

    } catch (err: any) {
        console.error('❌ Chat API error:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
