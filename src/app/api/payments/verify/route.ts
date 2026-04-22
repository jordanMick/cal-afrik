import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    try {
        const { transactionId } = await req.json(); // Ici transactionId = cartId de Maketou
        const apiKey = process.env.MAKETOU_API_KEY;
        
        if (!transactionId) {
            return NextResponse.json({ success: false, error: 'No transaction ID' }, { status: 400 });
        }

        // 1. Authentifier le user
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

        // 2. Vérification auprès de Maketou
        console.log(`[Maketou Verify] Vérification du panier: ${transactionId}`);
        const response = await fetch(`https://api.maketou.net/api/v1/stores/cart/${transactionId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!response.ok) {
            const errData = await response.json();
            console.error('[Maketou Verify] Erreur API:', errData);
            return NextResponse.json({ success: false, error: 'Erreur de vérification Maketou' });
        }

        const cart = await response.json();

        // 3. Si le paiement est réussi
        // On accepte 'completed' OU la présence d'un 'paymentId' (qui prouve que l'argent est arrivé chez Maketou)
        if (cart.status === 'completed' || cart.paymentId) {
            const metadata = cart.meta || {};
            const userId = metadata.user_id || metadata.userId;
            const tier = (metadata.tier || 'premium').toLowerCase();

            // Sécurité : s'assurer que c'est le bon utilisateur
            if (userId !== user.id) {
                 return NextResponse.json({ success: false, error: 'Transaction belongs to another user' }, { status: 403 });
            }

            // --- LOGIQUE DE MISE À JOUR DB (Copie de la logique existante) ---
            
            if (tier === 'scan') {
                await supabaseAdmin.rpc('increment_paid_scan_pack', { user_id_input: userId });
                console.log(`[Maketou Verify] ✅ Pack Scan ajouté pour ${userId}`);
            } else if (tier === 'suggestion') {
                await supabaseAdmin.rpc('increment_paid_suggestion_messages', { user_id_input: userId });
                console.log(`[Maketou Verify] ✅ 10 Messages ajoutés pour ${userId}`);
            } else {
                // Abonnement
                const { data: profile } = await supabaseAdmin.from('user_profiles').select('subscription_expires_at, subscription_tier').eq('user_id', userId).single();
                
                if (profile?.subscription_tier === tier) {
                    return NextResponse.json({ success: true, already_updated: true });
                }

                let baseDate = new Date();
                if (profile?.subscription_expires_at) {
                    const currentExp = new Date(profile.subscription_expires_at);
                    if (currentExp > baseDate) baseDate = currentExp;
                }
                baseDate.setDate(baseDate.getDate() + 30);

                await supabaseAdmin.from('user_profiles').update({ 
                    subscription_tier: tier,
                    subscription_expires_at: baseDate.toISOString(),
                    updated_at: new Date().toISOString(),
                }).eq('user_id', userId);

                console.log(`[Maketou Verify] ✅ Abonnement ${tier} activé pour ${userId}`);
            }

            return NextResponse.json({ success: true, updated: true });
        } else {
            return NextResponse.json({ success: false, status: cart.status, message: 'Paiement non complété' });
        }

    } catch (error: any) {
        console.error('[Maketou Verify] Erreur:', error.message);
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
    }
}
