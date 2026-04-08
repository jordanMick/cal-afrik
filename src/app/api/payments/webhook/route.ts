import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Note: FedaPay envoie des requêtes POST pour les webhooks
export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const event = payload.event;
        const transaction = payload.entity;

        console.log(`[FedaPay Webhook] Événement reçu: ${event}`);

        // On ne traite que les transactions approuvées
        if (event === 'transaction.approved') {
            const userId = transaction.custom_metadata?.user_id;
            const tier = transaction.custom_metadata?.tier;

            if (!userId || !tier) {
                console.error('[FedaPay Webhook] Métadonnées manquantes (user_id ou tier)');
                return NextResponse.json({ error: 'Métadonnées manquantes' }, { status: 400 });
            }

            console.log(`[FedaPay Webhook] Validation paiement pour ${userId} - Plan: ${tier}`);

            // 1. Récupération de l'ancienne date pour faire un CUMUL si nécessaire
            const { data: currentProfile } = await supabase
                .from('user_profiles')
                .select('subscription_expires_at')
                .eq('user_id', userId)
                .single();

            let baseDate = new Date();
            
            if (currentProfile?.subscription_expires_at) {
                const currentExp = new Date(currentProfile.subscription_expires_at);
                // Si l'ancienne expiration est encore dans le futur, on part de là.
                if (currentExp > baseDate) {
                    baseDate = currentExp;
                }
            }

            // Calcul global de l'expiration (+30 jours)
            baseDate.setDate(baseDate.getDate() + 30);

            // Mise à jour de l'abonnement dans Supabase
            const { error: updateError } = await supabase
                .from('user_profiles')
                .update({ 
                    subscription_tier: tier,
                    subscription_expires_at: baseDate.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

            if (updateError) {
                console.error('[FedaPay Webhook] Erreur mise à jour profil:', updateError);
                return NextResponse.json({ error: 'Erreur DB' }, { status: 500 });
            }

            console.log(`[FedaPay Webhook] Profil mis à jour avec succès pour ${userId}`);
        }

        return NextResponse.json({ received: true });

    } catch (error: any) {
        console.error('[FedaPay Webhook] Erreur:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
