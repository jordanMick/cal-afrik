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
        const maxMessages = Number(SUBSCRIPTION_RULES[effectiveTier].maxChatMessagesPerDay || 2)
        const today = new Date().toISOString().split('T')[0]
        
        // Si la dernière réinitialisation n'est pas aujourd'hui, on remet le compteur à 0
        let messagesUsedToday = profile.chat_messages_today || 0
        if (profile.last_usage_reset_date !== today) {
            messagesUsedToday = 0
        }

        // Vérification de la limite
        if (messagesUsedToday >= maxMessages) {
            return NextResponse.json({ 
                success: false, 
                error: 'Limite de messages atteinte', 
                code: 'LIMIT_REACHED' 
            }, { status: 403 })
        }

        // 3. Traiter la requête de l'utilisateur
        const { messages, userContext } = await req.json()
        const userMessage = String(messages?.[messages.length - 1]?.content || '')
        const normalizedUserMessage = userMessage
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
        const wantsTomorrowMenu = /\bmenu\b/.test(normalizedUserMessage) && /\bdemain\b/.test(normalizedUserMessage)
        const wantsWeekMenu = /\bmenu\b/.test(normalizedUserMessage) && /\bsemaine\b/.test(normalizedUserMessage)

        // Menu demain/semaine réservé Pro/Premium
        if ((wantsTomorrowMenu || wantsWeekMenu) && effectiveTier === 'free') {
            return NextResponse.json({
                success: false,
                code: 'MENU_TIER_REQUIRED',
                error: 'Les menus Demain et Semaine sont réservés aux plans Pro et Premium.',
            }, { status: 403 })
        }

        const systemPrompt = `Tu es Coach Yao, coach nutrition africain bienveillant et concret.
L'utilisateur s'appelle ${profile.name || 'mon ami'}.

RÈGLES STRICTES :
1) Utilise d'abord les données de contexte fournies par l'application. Ne demande pas "qu'as-tu mangé ?" si le contexte contient déjà calories/objectifs.
2) Longueur adaptative :
   - Question simple/rapide -> 1 à 2 phrases.
   - Question complexe (plan, stratégie, comparaison, correction) -> 3 à 5 phrases.
   - Ne dépasse jamais 6 phrases.
   - Réponse courte mais complète: pas de phrase coupée, pas de fin abrupte.
3) Français simple, ton chaleureux, sans artefacts (pas de texte tronqué, pas de symbole parasite, pas de "Dis-").
4) Donne au moins 1 recommandation pratique liée à des aliments locaux (ex: haricots, poisson, igname, légumes-feuilles).
5) Si le contexte est insuffisant, pose UNE seule question précise.
6) Si l'utilisateur demande un menu, la réponse DOIT commencer exactement par l'un de ces préfixes (en minuscules) :
   - "menu creneau petit_dejeuner:"
   - "menu creneau dejeuner:"
   - "menu creneau collation:"
   - "menu creneau diner:"
   - "menu demain:"
   - "menu semaine:"
   Ensuite seulement, donne le contenu du menu.
7) Si le préfixe est "menu semaine:", structure obligatoirement le menu sur 7 jours datés, du lendemain (J+1) à J+7, avec des dates explicites (format JJ/MM), dans l'ordre chronologique.
8) Pour "menu semaine:", reste compact pour éviter la troncature: 4 lignes par jour maximum (Petit-déj, Déjeuner, Collation, Dîner), pas de phrase d'introduction ni de conclusion.

Contexte utilisateur :
- Objectif : ${profile.goal || 'rester en forme'}
- Poids : ${profile.weight_kg || '?'} kg
- Contexte nutrition du jour : ${userContext || 'Aucune donnée fournie pour aujourd hui.'}`

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
                const response = await anthropic.messages.create({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: wantsWeek ? 1200 : 450,
                    system: systemPrompt,
                    messages: formattedMessages
                })
                
                const rawText = response.content[0].type === 'text' ? response.content[0].text : 'Je suis là pour t\'aider ! 💪'
                aiMessage = rawText
                    .replace(/Dis-\s*/gi, 'Dis ')
                    .trim()
            } catch (anthropicErr) {
                console.error('⚠️ Anthropic primary error:', anthropicErr)
                if (wantsWeek) {
                    aiMessage = buildLocalWeekMenuFallback()
                } else {
                    throw anthropicErr
                }
            }

            // Garde-fou: si l'utilisateur demande un menu mais que le modèle n'a pas mis
            // le préfixe attendu, on le rajoute automatiquement.
            const hasMenuPrefix = /^menu\s+(creneau\s+(petit_dejeuner|dejeuner|collation|diner)|demain|semaine)\s*:/i.test(aiMessage)
            const hasExplicitTarget = wantsWeek || wantsTomorrow || wantsSlotPetitDej || wantsSlotDejeuner || wantsSlotCollation || wantsSlotDiner

            if (wantsMenu && hasExplicitTarget && !hasMenuPrefix) {
                let prefix = 'menu demain:'
                if (wantsWeek) prefix = 'menu semaine:'
                else if (wantsTomorrow) prefix = 'menu demain:'
                else if (wantsSlotPetitDej) prefix = 'menu creneau petit_dejeuner:'
                else if (wantsSlotDejeuner) prefix = 'menu creneau dejeuner:'
                else if (wantsSlotCollation) prefix = 'menu creneau collation:'
                else if (wantsSlotDiner) prefix = 'menu creneau diner:'
                aiMessage = `${prefix} ${aiMessage}`.trim()
            }

            // Garde-fou menu semaine: imposer une structure propre J+1 -> J+7
            if (wantsWeek && /^menu\s+semaine\s*:/i.test(aiMessage)) {
                const weekDates = buildWeekDatesFromTomorrow()
                const dateLines = weekDates.map((d, i) => `${i + 1}. ${d}`).join('\n')
                const cleanedBase = aiMessage.trim()

                const formattingPrompt = `Tu reçois un menu semaine brut. Réécris-le proprement.

RÈGLES OBLIGATOIRES :
- Commence EXACTEMENT par "menu semaine:".
- Génère 7 sections datées, une par jour, dans cet ordre (J+1 -> J+7) :
${dateLines}
- Pour chaque jour, donne 4 lignes: Petit-déj, Déjeuner, Collation, Dîner (avec kcal approximatives).
- Interdiction d'écrire "À définir", "a definir", "TBD" ou équivalent. Mets toujours un vrai repas concret.
- Ne mets aucun texte hors de ces 7 jours.
- Pas de markdown cassé, pas de liste parasite numérotée en fin.

MENU BRUT :
${cleanedBase}`

                try {
                    const formatted = await anthropic.messages.create({
                        model: 'claude-haiku-4-5-20251001',
                        max_tokens: 1200,
                        messages: [{ role: 'user', content: formattingPrompt }]
                    })
                    const formattedText = formatted.content[0].type === 'text' ? formatted.content[0].text : cleanedBase
                    aiMessage = formattedText.trim()
                    aiMessage = fillUndefinedMeals(aiMessage)
                } catch (formatErr) {
                    console.error('⚠️ Week menu formatting fallback:', formatErr)
                    // Fallback robuste: on conserve la réponse initiale sans planter l'API.
                    aiMessage = fillUndefinedMeals(cleanedBase)
                }

                if (!/^menu\s+semaine\s*:/i.test(aiMessage)) {
                    aiMessage = `menu semaine:\n${aiMessage}`.trim()
                }
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
