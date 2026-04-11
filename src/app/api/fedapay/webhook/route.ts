import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ Client Admin obligatoire pour contourner RLS dans un Webhook
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        
        // FedaPay utilise 'name' ou 'event' pour le type d'événement
        const eventName = payload.name || payload.event || payload.event_type;
        
        // La transaction est dans payload.data.entity ou payload.entity
        const transaction = payload.data?.entity || payload.entity || {};
        
        // 🛡️ LOGIQUE ULTRA-ROBUSTE POUR LES METADONNEES
        const rawMeta = transaction.metadata || transaction.custom_metadata || payload.metadata || payload.data?.metadata || {};
        let metadata: any = {};

        // Si c'est une chaîne JSON, on la décode
        if (typeof rawMeta === 'string') {
            try {
                metadata = JSON.parse(rawMeta);
                console.log('[FedaPay Webhook] Metadata JSON parsée avec succès');
            } catch (e) {
                console.error('[FedaPay Webhook] Échec du parsing JSON des metadata string');
            }
        } else {
            metadata = rawMeta;
        }

        const userId = metadata.user_id || metadata.userId;
        const tier = metadata.tier || metadata.plan || "premium"; // Fallback premium si plan absent

        const customerEmail = transaction.customer?.email || payload.data?.customer?.email;

        console.log(`[FedaPay Webhook] Analyse payload:`, {
            eventName,
            transaction_id: transaction.id,
            status: transaction.status,
            userId,
            tier,
            customerEmail,
            rawMetadataType: typeof rawMeta
        });

        // 1. Gestion du paiement réussi
        if (eventName === 'transaction.approved' || transaction.status === 'approved' || eventName === 'transaction.paid') {
            
            let targetUserId = userId;

            // 🔍 FALLBACK: Si pas de userId dans les métadonnées, on cherche par email
            if (!targetUserId && customerEmail) {
                console.log(`[FedaPay Webhook] UID absent, recherche par email: ${customerEmail}`);
                const { data: userByEmail } = await supabaseAdmin
                    .from('user_profiles')
                    .select('user_id')
                    .eq('email', customerEmail)
                    .single();
                
                if (userByEmail) {
                    targetUserId = userByEmail.user_id;
                    console.log(`[FedaPay Webhook] Utilisateur trouvé par email: ${targetUserId}`);
                }
            }

            if (!targetUserId) {
                console.error('[FedaPay Webhook] ERREUR CRITIQUE: Impossible d\'identifier l\'utilisateur (ni par metadata, ni par email)');
                return NextResponse.json({ error: 'User identification failed' }, { status: 400 });
            }

            console.log(`[FedaPay Webhook] Traitement validation pour ${targetUserId} - Plan: ${tier}`);

            // Récupération de l'ancienne date pour le cumul
            const { data: currentProfile } = await supabaseAdmin
                .from('user_profiles')
                .select('subscription_expires_at')
                .eq('user_id', targetUserId)
                .single();

            let baseDate = new Date();
            if (currentProfile?.subscription_expires_at) {
                const currentExp = new Date(currentProfile.subscription_expires_at);
                if (currentExp > baseDate) baseDate = currentExp;
            }

            // +30 jours
            baseDate.setDate(baseDate.getDate() + 30);

            const { error: updateError } = await supabaseAdmin
                .from('user_profiles')
                .update({ 
                    subscription_tier: tier.toLowerCase(),
                    subscription_expires_at: baseDate.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', targetUserId);

            if (updateError) {
                console.error('[FedaPay Webhook] Erreur UPDATE Supabase:', updateError);
                return NextResponse.json({ error: 'Erreur DB' }, { status: 500 });
            }

            console.log(`[FedaPay Webhook] SUCCESS: Profil mis à jour pour ${userId}`);
        }
        
        // 2. Gestion de l'échec ou expiration
        const failureEvents = ['transaction.canceled', 'transaction.cancelled', 'transaction.expired', 'subscription.expired'];
        if (failureEvents.includes(eventName)) {
            const userId = metadata.user_id;
            if (userId) {
                await supabaseAdmin
                    .from('user_profiles')
                    .update({ subscription_tier: 'free', updated_at: new Date().toISOString() })
                    .eq('user_id', userId);
                console.log(`[FedaPay Webhook] INFO: Abonnement réinitialisé à free pour ${userId}`);
            }
        }

        return NextResponse.json({ received: true, event: eventName });

    } catch (error: any) {
        console.error('[FedaPay Webhook] Erreur fatale:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}