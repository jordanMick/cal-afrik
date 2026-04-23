import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

/**
 * ⚠️  /verify ne fait PAS la mise à jour.
 *     Il lit uniquement payment_logs pour savoir si le webhook a déjà traité le paiement.
 *     La source unique de vérité est le webhook Maketou → payment_logs.
 *
 * Flux correct :
 *   Maketou → webhook → payment_logs → verify (lecture) → UI
 */
export async function POST(req: Request) {
    const tag = '[Maketou Verify]';
    try {
        const { cartId } = await req.json();

        if (!cartId) {
            return NextResponse.json({ success: false, error: 'cartId manquant' }, { status: 400 });
        }

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

        // 2. 🔍 Lire uniquement payment_logs — pas d'appel Maketou ici
        const { data: log } = await supabaseAdmin
            .from('payment_logs')
            .select('*')
            .eq('cart_id', cartId)
            .maybeSingle();

        if (!log) {
            // Le webhook n'a pas encore été reçu — paiement en attente ou en cours
            console.log(`${tag} [${cartId}] Pas encore traité par le webhook — waiting`);
            return NextResponse.json({
                success: false,
                status: 'waiting',
                message: 'Paiement en cours de traitement...'
            });
        }

        // 3. 🛡️ Sécurité : le cartId doit appartenir à cet utilisateur
        if (log.user_id !== user.id) {
            console.warn(`${tag} [${cartId}] user_id mismatch: log=${log.user_id} vs session=${user.id}`);
            return NextResponse.json({ success: false, error: 'Transaction non autorisée' }, { status: 403 });
        }

        if (log.status === 'processed') {
            console.log(`${tag} [${cartId}] ✅ Confirmé pour user=${user.id}, tier=${log.tier}`);
            return NextResponse.json({ success: true, tier: log.tier });
        }

        // Statut inconnu (ex: 'failed', 'abandoned')
        return NextResponse.json({
            success: false,
            status: log.status,
            message: 'Paiement non complété.'
        });

    } catch (error: any) {
        console.error('[Maketou Verify] ❌ Erreur:', error.message);
        return NextResponse.json({ success: false, error: 'Erreur interne' }, { status: 500 });
    }
}
