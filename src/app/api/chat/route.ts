import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

        const tier = profile.subscription_tier || 'free'
        
        // 2. Gestion des quotas
        const limits: Record<string, number> = {
            free: 1,
            pro: 10,
            premium: 30
        }

        const maxMessages = limits[tier] || 1
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
        const userMessage = messages[messages.length - 1].content

        const systemPrompt = `Tu es Coach Yao, un expert en nutrition africaine bienveillant, enthousiaste et très compétent.
L'utilisateur s'appelle ${profile.name || 'mon ami'}. 
Ton rôle est de donner des conseils pratiques sur son alimentation et son hygiène de vie, en utilisant des références aux aliments locaux d'Afrique (maïs, manioc, mil, sorgho, igname, poulet bicyclette, etc.).

Contexte actuel de l'utilisateur :
- Objectif : ${profile.goal || 'rester en forme'}
- Poids : ${profile.weight_kg || '?'} kg
- Infos repas récents / macros : ${userContext || 'Aucune donnée fournie pour aujourd hui.'}

Réponds avec un ton chaleureux, direct et motivant (pas trop long, 3-4 phrases max, comme dans un SMS). Utilise quelques émojis.`

        // ─── MODE SIMULATION ──────────────────────────────────────────
        const MOCK_MODE = true

        let aiMessage = ""
        
        if (MOCK_MODE) {
            await new Promise(r => setTimeout(r, 800)) // Simule un délai réaliste
            aiMessage = `[Mode TEST 🔧] Salut ${profile.name || 'ami'} ! Super question. Rappelle-toi : l'équilibre c'est la clé ! Mange des légumes africains variés, bois 2L d'eau et écoute ton corps. Tu es sur la bonne voie ! 🌿`
        } else {
            // Formatage des messages pour Anthropic
            const formattedMessages = messages.map((m: any) => ({
                role: m.role === 'coach' ? 'assistant' : 'user',
                content: m.content
            }))

            const response = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 300,
                system: systemPrompt,
                messages: formattedMessages
            })
            
            aiMessage = response.content[0].type === 'text' ? response.content[0].text : 'Je suis là pour t\'aider ! 💪'
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
