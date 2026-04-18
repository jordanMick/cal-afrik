import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

// Verify route for client-side synchronous verification
export async function POST(req: Request) {
    try {
        const { transactionId } = await req.json();
        
        if (!transactionId) {
            return NextResponse.json({ success: false, error: 'No transaction ID' }, { status: 400 });
        }

        // Authentifier le user appelant (sécurité supplémentaire)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ success: false, error: 'Auth missing' }, { status: 401 });
        }
        
        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
             return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        // Vérification directe auprès de FedaPay
        const FEDAPAY_KEY = process.env.FEDAPAY_SECRET_KEY;
        const verifyRes = await fetch(`https://api.fedapay.com/v1/transactions/${transactionId}`, {
            headers: {
                Authorization: `Bearer ${FEDAPAY_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!verifyRes.ok) {
            console.error(`[FedaPay Verify] Échec (Status: ${verifyRes.status})`);
            return NextResponse.json({ success: false, error: 'FedaPay verification failed' });
        }

        const verifyData = await verifyRes.json();
        const transaction = verifyData?.["v1/transaction"] || verifyData?.transaction || verifyData;

        if (transaction.status === 'approved') {
            const metadata = typeof transaction.metadata === 'string' 
                ? JSON.parse(transaction.metadata) 
                : (transaction.metadata || transaction.custom_metadata || {});

            // Sécurité : s'assurer que c'est le propre abonnement du user
            const userId = metadata.user_id || metadata.userId || transaction.external_id;
            const tier = (metadata.tier || 'premium').toLowerCase();

            if (userId !== user.id) {
                 return NextResponse.json({ success: false, error: 'Transaction belongs to another user' }, { status: 403 });
            }

            // Calcul de l'expiration (+30 jours cumulés)
            const { data: profile } = await supabaseAdmin
                .from('user_profiles')
                .select('subscription_expires_at, subscription_tier')
                .eq('user_id', userId)
                .single();

            // S'il est DÉJÀ mis à jour par le Webhook, on arrête
            if (profile?.subscription_tier === tier) {
                 return NextResponse.json({ success: true, already_updated: true });
            }

            let baseDate = new Date();
            if (profile?.subscription_expires_at) {
                const currentExp = new Date(profile.subscription_expires_at);
                if (currentExp > baseDate) baseDate = currentExp;
            }
            baseDate.setDate(baseDate.getDate() + 30);

            // Mise à jour via Admin
            const { error: updateError } = await supabaseAdmin
                .from('user_profiles')
                .update({ 
                    subscription_tier: tier,
                    subscription_expires_at: baseDate.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

            if (updateError) {
                console.error('[FedaPay Verify] Erreur DB:', updateError.message);
                return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
            }

            console.log(`[FedaPay Verify] ✅ Abonnement ${tier} activé côté client pour ${userId}`);
            return NextResponse.json({ success: true, updated: true });
        } else {
            return NextResponse.json({ success: false, error: `Transaction status is ${transaction.status}` });
        }

    } catch (error: any) {
        console.error('[FedaPay Verify] Erreur:', error.message);
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
    }
}
