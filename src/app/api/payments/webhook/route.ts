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

            // Mise à jour de l'abonnement dans Supabase
            // Utilisation de la clé service role si possible, sinon on utilise supabase normal
            // Note: En mode serveur, on peut utiliser une instance supabase privilégiée pour les webhooks
            const { error: updateError } = await supabase
                .from('user_profiles')
                .update({ 
                    subscription_tier: tier,
                    // Vous pouvez ajouter un champ 'updated_at' ou 'subscription_expires_at' ici
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
