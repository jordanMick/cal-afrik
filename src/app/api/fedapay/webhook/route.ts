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
        
        // 1. Extraire l'ID de transaction (indispensable pour la vérification)
        const transactionId = payload.data?.entity?.id || payload.entity?.id || payload.id;
        
        if (!transactionId) {
            console.error('[FedaPay Webhook] Transaction ID manquant dans le payload');
            return NextResponse.json({ error: 'No transaction ID' }, { status: 400 });
        }

        // 🛡️ ÉTAPE DE SÉCURITÉ CRITIQUE : Vérification directe auprès de FedaPay
        // On ne croit pas aveuglément le payload reçu (qui pourrait être falsifié), 
        // on interroge directement l'API officielle de FedaPay.
        const FEDAPAY_KEY = process.env.FEDAPAY_SECRET_KEY;
        const verifyRes = await fetch(`https://api.fedapay.com/v1/transactions/${transactionId}`, {
            headers: {
                Authorization: `Bearer ${FEDAPAY_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!verifyRes.ok) {
            console.error(`[FedaPay Webhook] Échec de la vérification officielle (Status: ${verifyRes.status})`);
            return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
        }

        const verifyData = await verifyRes.json();
        const officialTransaction = verifyData?.["v1/transaction"] || verifyData?.transaction || verifyData;
        
        console.log(`[FedaPay Webhook] Vérification officielle:`, officialTransaction.status);

        // On ne procède QUE si FedaPay confirme le statut 'approved'
        if (officialTransaction.status === 'approved') {
            
            // Extraction des métadonnées (de la transaction officielle pour plus de sécurité)
            const rawMeta = officialTransaction.metadata || officialTransaction.custom_metadata || {};
            let metadata: any = {};
            if (typeof rawMeta === 'string') {
                try { metadata = JSON.parse(rawMeta); } catch (e) {}
            } else { metadata = rawMeta; }

            const userId = metadata.user_id || metadata.userId;
            const tier = metadata.tier || metadata.plan || "premium";
            const customerEmail = officialTransaction.customer?.email;
            const description = officialTransaction.description || "";

            let targetUserId = userId;

            // FALLBACK 1: Chercher dans la description (Format: "... ID: user_id")
            if (!targetUserId && description.includes('ID:')) {
                const parts = description.split('ID:');
                if (parts.length > 1) targetUserId = parts[1].trim();
            }

            // FALLBACK 2: Chercher par email
            if (!targetUserId && customerEmail) {
                const { data: userByEmail } = await supabaseAdmin
                    .from('user_profiles')
                    .select('user_id')
                    .eq('email', customerEmail)
                    .single();
                if (userByEmail) targetUserId = userByEmail.user_id;
            }

            if (!targetUserId) {
                console.error('[FedaPay Webhook] User ID non identifié même après vérification officielle');
                return NextResponse.json({ error: 'User identification failed' }, { status: 400 });
            }

            // Mise à jour de l'abonnement
            const { data: profile } = await supabaseAdmin
                .from('user_profiles')
                .select('subscription_expires_at')
                .eq('user_id', targetUserId)
                .single();

            let baseDate = new Date();
            if (profile?.subscription_expires_at) {
                const currentExp = new Date(profile.subscription_expires_at);
                if (currentExp > baseDate) baseDate = currentExp;
            }
            // Ajouter 30 jours
            baseDate.setDate(baseDate.getDate() + 30);

            const { error: updateError } = await supabaseAdmin
                .from('user_profiles')
                .update({ 
                    subscription_tier: tier.toLowerCase(),
                    subscription_expires_at: baseDate.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', targetUserId);

            if (updateError) throw updateError;
            console.log(`[FedaPay Webhook] ✅ ABONNEMENT ACTIVÉ pour ${targetUserId}`);
        } else {
            console.warn(`[FedaPay Webhook] Transaction non approuvée ignorée (Statut: ${officialTransaction.status})`);
        }
        
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[FedaPay Webhook] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}