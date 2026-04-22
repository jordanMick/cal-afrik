import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        
        // 1. Extraire l'ID de transaction
        const transactionId = payload.data?.entity?.id || payload.entity?.id || payload.id;
        
        if (!transactionId) {
            console.error('[FedaPay Webhook] Transaction ID manquant');
            return NextResponse.json({ error: 'No transaction ID' }, { status: 400 });
        }

        // 🛡️ SÉCURITÉ : Vérification directe auprès de FedaPay pour éviter les faux payloads
        const FEDAPAY_KEY = process.env.FEDAPAY_SECRET_KEY;
        const verifyRes = await fetch(`https://api.fedapay.com/v1/transactions/${transactionId}`, {
            headers: {
                Authorization: `Bearer ${FEDAPAY_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!verifyRes.ok) {
            console.error(`[FedaPay Webhook] Échec vérification FedaPay (Status: ${verifyRes.status})`);
            return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
        }

        const verifyData = await verifyRes.json();
        const transaction = verifyData?.["v1/transaction"] || verifyData?.transaction || verifyData;

        if (transaction.status === 'approved') {
            let metadata = transaction.custom_metadata || transaction.metadata || {};
            if (typeof metadata === 'string') {
                try { metadata = JSON.parse(metadata); } catch(e) {}
            }

            const userId = metadata.user_id || metadata.userId || transaction.external_id;
            const tier = (metadata.tier || 'premium').toLowerCase();

            if (!userId) {
                console.error('[FedaPay Webhook] Impossible d\'identifier l\'utilisateur');
                return NextResponse.json({ error: 'User not identified' }, { status: 400 });
            }

            if (tier === 'scan') {
                // Pour un scan à l'unité (100 FCFA), on incrémente le pack (1 Scan + 1 Avis Coach)
                const { error: updateError } = await supabaseAdmin.rpc('increment_paid_scan_pack', { user_id_input: userId });

                if (updateError) {
                    console.warn('[FedaPay Webhook] RPC increment_paid_scan_pack failed, using fallback', updateError.message);
                    const { data: p } = await supabaseAdmin.from('user_profiles').select('paid_scans_remaining, paid_coach_feedbacks_remaining').eq('user_id', userId).single();
                    await supabaseAdmin.from('user_profiles').update({ 
                        paid_scans_remaining: (p?.paid_scans_remaining || 0) + 1,
                        paid_coach_feedbacks_remaining: (p?.paid_coach_feedbacks_remaining || 0) + 1,
                        updated_at: new Date().toISOString()
                    }).eq('user_id', userId);
                }
                console.log(`[FedaPay Webhook] ✅ Pack Scan+Avis ajouté pour ${userId}`);
            } else if (tier === 'suggestion') {
                // Pour une suggestion à l'unité (100 FCFA), on donne 10 messages de discussion
                const { error: updateError } = await supabaseAdmin.rpc('increment_paid_suggestion_messages', { user_id_input: userId });
                if (updateError) {
                    const { data: p } = await supabaseAdmin.from('user_profiles').select('paid_chat_messages_remaining').eq('user_id', userId).single();
                    await supabaseAdmin.from('user_profiles').update({ 
                        paid_chat_messages_remaining: (p?.paid_chat_messages_remaining || 0) + 10,
                        updated_at: new Date().toISOString()
                    }).eq('user_id', userId);
                }
                console.log(`[FedaPay Webhook] ✅ 10 Messages de suggestion ajoutés pour ${userId}`);
            } else {
                // Calcul de l'expiration (+30 jours cumulés)
                const { data: profile } = await supabaseAdmin
                    .from('user_profiles')
                    .select('subscription_expires_at')
                    .eq('user_id', userId)
                    .single();

                let baseDate = new Date();
                if (profile?.subscription_expires_at) {
                    const currentExp = new Date(profile.subscription_expires_at);
                    if (currentExp > baseDate) baseDate = currentExp;
                }
                baseDate.setDate(baseDate.getDate() + 30);

                // Mise à jour via Admin (contourne RLS)
                const { error: updateError } = await supabaseAdmin
                    .from('user_profiles')
                    .update({ 
                        subscription_tier: tier,
                        subscription_expires_at: baseDate.toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('user_id', userId);

                if (updateError) {
                    console.error('[FedaPay Webhook] Erreur mise à jour profil:', updateError.message);
                    return NextResponse.json({ error: 'Database error' }, { status: 500 });
                }
                console.log(`[FedaPay Webhook] ✅ Abonnement ${tier} activé pour ${userId}`);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[FedaPay Webhook] Erreur:', error.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
