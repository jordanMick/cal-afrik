import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { FedaPay, Transaction } from 'fedapay';

const PRICES = {
    pro: 100,
    premium: 100
};

export async function POST(req: Request) {
    try {
        const { tier } = await req.json();

        // 1. Initialisation SDK
        const secretKey = process.env.FEDAPAY_SECRET_KEY || '';
        FedaPay.setApiKey(secretKey);
        FedaPay.setEnvironment(process.env.FEDAPAY_ENVIRONMENT || 'live');

        console.log('[FedaPay] Diagnostic Clé:', {
            length: secretKey.length,
            prefix: secretKey.substring(0, 8) + '...', // sk_live_...
            env: process.env.FEDAPAY_ENVIRONMENT
        });

        // 2. Authentification Supabase
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('[FedaPay] Header Authorization manquant');
            return NextResponse.json({ error: 'Auth header missing' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error('[FedaPay] Erreur auth Supabase:', authError?.message);
            return NextResponse.json({ error: 'Session invalide ou expirée. Reconnectez-vous.' }, { status: 401 });
        }

        if (!['pro', 'premium'].includes(tier)) {
            return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
        }

        const amount = PRICES[tier as keyof typeof PRICES];

        // 3. Création de la transaction FedaPay
        console.log(`[FedaPay] Création transaction pour ${user.email} - Montant: ${amount}`);

        const transaction = await Transaction.create({
            description: `Abonnement Cal-Afrik ${tier.toUpperCase()} - ID: ${user.id}`,
            amount: amount,
            currency: { iso: 'XOF' },
            callback_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard`,
            customer: {
                firstname: user.user_metadata?.full_name || 'Utilisateur',
                email: user.email,
            },
            custom_metadata: {
                user_id: user.id,
                tier: tier
            }
        });

        // 4. Génération du token
        const tokenData = await transaction.generateToken();

        return NextResponse.json({
            success: true,
            token: tokenData.token,
            url: tokenData.url
        });

    } catch (error: any) {
        console.error('[FedaPay] Erreur Checkout Detail:', {
            message: error.message,
            response: error.response?.data, // Très important pour FedaPay
            status: error.response?.status
        });
        const msg = error.response?.data?.message || error.message || 'Erreur de communication avec FedaPay';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
