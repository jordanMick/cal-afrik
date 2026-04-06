import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { FedaPay } from '@/lib/fedapay';
import { Transaction } from 'fedapay';

const PRICES = {
    pro: 4900,
    premium: 9900
};

export async function POST(req: Request) {
    try {
        const { tier } = await req.json();
        
        // 1. Authentification
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 401 });

        if (!['pro', 'premium'].includes(tier)) {
            return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
        }

        const amount = PRICES[tier as keyof typeof PRICES];

        // 2. Création de la transaction FedaPay
        // Note: On passe l'ID de l'utilisateur et le tier choisi dans les métadonnées
        const transaction = await Transaction.create({
            description: `Abonnement Cal-Afrik ${tier.toUpperCase()}`,
            amount: amount,
            currency: { iso: 'XOF' },
            callback_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/profil?payment=success`,
            customer: {
                firstname: user.user_metadata?.full_name || 'Utilisateur',
                email: user.email,
            },
            custom_metadata: {
                user_id: user.id,
                tier: tier
            }
        });

        // 3. Génération du token de paiement
        const token = await transaction.generateToken();

        return NextResponse.json({ 
            success: true, 
            token: token.token,
            url: token.url 
        });

    } catch (error: any) {
        console.error('Erreur Checkout FedaPay:', error);
        return NextResponse.json({ error: error.message || 'Erreur lors de la création du paiement' }, { status: 500 });
    }
}
