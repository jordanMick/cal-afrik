import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

/**
 * ─── ARCHITECTURE MAKETOU (sans webhook) ────────────────────────────────────
 *
 * Maketou ne pousse PAS de webhook → c'est à nous de poll l'API.
 *
 * Flow :
 *   Frontend (every 5s) → POST /api/payments/verify
 *     → 1. Auth user
 *     → 2. payment_logs déjà traité ? → retourne success (idempotence)
 *     → 3. Interroge Maketou GET /cart/{cartId}
 *     → 4. cart.status === 'completed' ?
 *            → active crédits
 *            → écrit payment_logs
 *            → retourne success
 *          sinon → retourne { status: 'waiting' } → frontend re-poll
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Helper activation crédits (partagé avec webhook si activé un jour) ──────
async function activateCredits(userId: string, tier: string, cartId: string) {
    const tag = `[Verify][${cartId}]`;

    if (tier === 'scan') {
        const { error } = await supabaseAdmin.rpc('increment_paid_scan_pack', { user_id_input: userId });
        if (error) {
            const { data: p } = await supabaseAdmin
                .from('user_profiles')
                .select('paid_scans_remaining, paid_coach_feedbacks_remaining')
                .eq('user_id', userId).single();
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
                .eq('user_id', userId).single();
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
            .eq('user_id', userId).single();

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

// ─── POST /api/payments/verify ────────────────────────────────────────────────
export async function POST(req: Request) {
    const tag = '[Maketou Verify]';
    try {
        const body = await req.json();
        // Support des deux clés pour compatibilité (cartId ou transactionId)
        const cartId: string = body.cartId || body.transactionId || '';

        if (!cartId) {
            return NextResponse.json({ success: false, error: 'cartId manquant' }, { status: 400 });
        }

        const cartTag = `${tag}[${cartId}]`;

        // 1. Authentifier l'utilisateur
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ success: false, error: 'Auth manquant' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
        }

        // 2. 🛡️ IDEMPOTENCE : ce cartId a déjà été activé ?
        const { data: existing } = await supabaseAdmin
            .from('payment_logs')
            .select('id, user_id, tier, status')
            .eq('cart_id', cartId)
            .maybeSingle();

        if (existing) {
            // Sécurité : le log doit appartenir à cet user
            if (existing.user_id !== user.id) {
                console.warn(`${cartTag} user_id mismatch — log=${existing.user_id} vs session=${user.id}`);
                return NextResponse.json({ success: false, error: 'Transaction non autorisée' }, { status: 403 });
            }
            if (existing.status === 'processed') {
                console.log(`${cartTag} Déjà traité (idempotence) — retour succès direct`);
                return NextResponse.json({ success: true, tier: existing.tier, already_processed: true });
            }
        }

        // 3. 📡 Poll Maketou API directement (pas de webhook disponible)
        const apiKey = process.env.MAKETOU_API_KEY;
        const maketouRes = await fetch(`https://api.maketou.net/api/v1/stores/cart/${cartId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!maketouRes.ok) {
            console.error(`${cartTag} Erreur API Maketou (${maketouRes.status})`);
            return NextResponse.json({ success: false, status: 'api_error', message: 'Erreur de communication avec Maketou' });
        }

        const cart = await maketouRes.json();
        const cartStatus: string = cart?.status || '';

        console.log(`${cartTag} Statut Maketou: '${cartStatus}'`);

        // 4. Statuts non finaux → on retourne "waiting" pour que le frontend re-poll
        if (cartStatus !== 'completed') {
            const knownFailed = ['payment_failed', 'failed', 'abandoned', 'cancelled'];
            if (knownFailed.includes(cartStatus)) {
                return NextResponse.json({
                    success: false,
                    status: cartStatus,
                    message: 'Le paiement a échoué ou a été annulé.'
                });
            }
            // 'waiting_payment', 'pending', ou tout autre statut intermédiaire
            return NextResponse.json({
                success: false,
                status: 'waiting',
                message: 'Paiement en cours de traitement…'
            });
        }

        // 5. ✅ completed — extraire et valider les métadonnées
        const metadata = cart?.meta || {};
        const cartUserId: string = metadata?.user_id || metadata?.userId || '';
        const tier: string = (metadata?.tier || 'premium').toLowerCase();

        if (!cartUserId) {
            console.error(`${cartTag} user_id introuvable dans cart.meta`);
            return NextResponse.json({ success: false, error: 'Métadonnées du panier invalides' }, { status: 400 });
        }

        // 🛡️ Sécurité : le panier doit appartenir à l'utilisateur authentifié
        if (cartUserId !== user.id) {
            console.warn(`${cartTag} Tentative d'accès à un panier étranger — cartUser=${cartUserId} vs session=${user.id}`);
            return NextResponse.json({ success: false, error: 'Transaction non autorisée' }, { status: 403 });
        }

        // 6. Activer les crédits
        await activateCredits(user.id, tier, cartId);

        // 7. Enregistrer dans payment_logs (idempotence future + audit)
        await supabaseAdmin.from('payment_logs').upsert({
            cart_id: cartId,
            user_id: user.id,
            tier,
            status: 'processed',
            processed_at: new Date().toISOString(),
        }, { onConflict: 'cart_id' });

        console.log(`${cartTag} ✅ Paiement activé — user=${user.id}, tier=${tier}`);
        return NextResponse.json({ success: true, tier });

    } catch (error: any) {
        console.error(`${tag} ❌ Erreur:`, error.message);
        return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
    }
}
