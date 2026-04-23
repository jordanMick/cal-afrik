import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ─── Helper : activation des crédits (source unique de vérité) ───────────────
async function activateCredits(userId: string, tier: string, cartId: string) {
    const tag = `[Maketou Webhook][${cartId}]`;

    if (tier === 'scan') {
        const { error } = await supabaseAdmin.rpc('increment_paid_scan_pack', { user_id_input: userId });
        if (error) {
            console.warn(`${tag} RPC increment_paid_scan_pack failed, fallback manuel`, error.message);
            const { data: p } = await supabaseAdmin
                .from('user_profiles')
                .select('paid_scans_remaining, paid_coach_feedbacks_remaining')
                .eq('user_id', userId)
                .single();
            await supabaseAdmin.from('user_profiles').update({
                paid_scans_remaining: (p?.paid_scans_remaining || 0) + 1,
                paid_coach_feedbacks_remaining: (p?.paid_coach_feedbacks_remaining || 0) + 1,
                updated_at: new Date().toISOString()
            }).eq('user_id', userId);
        }
        console.log(`${tag} ✅ Pack Scan+Avis ajouté pour user=${userId}`);

    } else if (tier === 'suggestion') {
        const { error } = await supabaseAdmin.rpc('increment_paid_suggestion_messages', { user_id_input: userId });
        if (error) {
            const { data: p } = await supabaseAdmin
                .from('user_profiles')
                .select('paid_chat_messages_remaining')
                .eq('user_id', userId)
                .single();
            await supabaseAdmin.from('user_profiles').update({
                paid_chat_messages_remaining: (p?.paid_chat_messages_remaining || 0) + 10,
                updated_at: new Date().toISOString()
            }).eq('user_id', userId);
        }
        console.log(`${tag} ✅ 10 messages Coach ajoutés pour user=${userId}`);

    } else {
        // Abonnement premium/pro : cumul de 30 jours
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

        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({
                subscription_tier: tier,
                subscription_expires_at: baseDate.toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

        if (error) throw new Error(`DB update failed: ${error.message}`);
        console.log(`${tag} ✅ Abonnement '${tier}' activé pour user=${userId} jusqu'au ${baseDate.toISOString()}`);
    }
}

// ─── Webhook POST ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
    const tag = '[Maketou Webhook]';
    let cartId = 'unknown';

    try {
        const payload = await req.json();
        console.log(`${tag} Payload reçu:`, JSON.stringify(payload));

        // 1. Extraire l'ID du panier depuis le payload Maketou
        cartId = payload?.cart?.id || payload?.id || payload?.cartId || 'unknown';
        const cartStatus: string = payload?.cart?.status || payload?.status || '';
        const tag2 = `${tag}[${cartId}]`;

        if (!cartId || cartId === 'unknown') {
            console.error(`${tag2} Cart ID manquant dans le payload`);
            return NextResponse.json({ error: 'No cart ID' }, { status: 400 });
        }

        // 2. ✅ SEULE SOURCE DE VÉRITÉ : vérification directe auprès de Maketou
        const apiKey = process.env.MAKETOU_API_KEY;
        const verifyRes = await fetch(`https://api.maketou.net/api/v1/stores/cart/${cartId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!verifyRes.ok) {
            console.error(`${tag2} Impossible de vérifier le panier chez Maketou (status: ${verifyRes.status})`);
            return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
        }

        const cart = await verifyRes.json();
        const verifiedStatus: string = cart?.status || '';
        const tag3 = `${tag2}[status=${verifiedStatus}]`;

        console.log(`${tag3} Panier vérifié chez Maketou`);

        // 3. 🚨 CRITIQUE : on n'agit QUE sur 'completed'
        if (verifiedStatus !== 'completed') {
            console.log(`${tag3} Statut non finalisé — aucune action effectuée`);
            return NextResponse.json({ received: true, action: 'none', status: verifiedStatus });
        }

        // 4. Extraire userId et tier depuis les métadonnées du panier
        const metadata = cart?.meta || {};
        const userId: string = metadata?.user_id || metadata?.userId || '';
        const tier: string = (metadata?.tier || 'premium').toLowerCase();

        if (!userId) {
            console.error(`${tag3} userId introuvable dans cart.meta`);
            return NextResponse.json({ error: 'User not identified' }, { status: 400 });
        }

        // 5. 🛡️ VERROU D'IDEMPOTENCE (INSERTION AVANT ACTION)
        const { error: lockError } = await supabaseAdmin.from('payment_logs').insert({
            cart_id: cartId,
            user_id: userId,
            tier,
            status: 'processing',
            processed_at: new Date().toISOString(),
        });
        
        if (lockError) {
            if (lockError.code === '23505') {
                console.log(`${tag3} Déjà en cours ou traité (verrou bloqué)`);
                return NextResponse.json({ received: true, action: 'already_processed' });
            }
            throw lockError;
        }

        try {
            // 6. Activer les crédits
            await activateCredits(userId, tier, cartId);

            // 7. Marquer comme terminé
            await supabaseAdmin.from('payment_logs')
                .update({ status: 'processed' })
                .eq('cart_id', cartId);

            console.log(`${tag3} ✅ Webhook traité avec succès pour user=${userId}, tier=${tier}`);
            return NextResponse.json({ received: true, action: 'activated' });

        } catch (error: any) {
            await supabaseAdmin.from('payment_logs')
                .update({ status: 'failed' })
                .eq('cart_id', cartId);
            throw error;
        }

    } catch (error: any) {
        console.error(`${tag}[${cartId}] ❌ Erreur:`, error.message);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
