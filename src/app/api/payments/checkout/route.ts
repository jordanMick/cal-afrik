import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const PRODUCT_IDS: Record<string, string | undefined> = {
    pro: process.env.MAKETOU_PRODUCT_ID_PRO,
    premium: process.env.MAKETOU_PRODUCT_ID_PREMIUM,
    scan: process.env.MAKETOU_PRODUCT_ID_SCAN,
    suggestion: process.env.MAKETOU_PRODUCT_ID_SUGGESTION
};

// Prix attendus par tier (en FCFA) — validation côté serveur
const EXPECTED_AMOUNTS: Record<string, number> = {
    pro: 1500,
    premium: 2500,
    scan: 100,
    suggestion: 100
};

export async function POST(req: Request) {
    const tag = '[Maketou Checkout]';
    try {
        const { tier } = await req.json();
        const apiKey = process.env.MAKETOU_API_KEY;

        if (!apiKey) {
            console.error(`${tag} MAKETOU_API_KEY manquante`);
            return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 500 });
        }

        // 1. Authentification
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Auth header manquant' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Session invalide' }, { status: 401 });
        }

        // 2. Validation stricte du produit
        const tierKey = (tier || '').toLowerCase();
        const productDocumentId = PRODUCT_IDS[tierKey];
        const expectedAmount = EXPECTED_AMOUNTS[tierKey];

        if (!productDocumentId || !expectedAmount) {
            console.error(`${tag} Tier invalide: '${tierKey}'`);
            return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
        }

        console.log(`${tag} Création panier — user=${user.email}, tier=${tierKey}, montant=${expectedAmount} FCFA`);

        // 3. Appel API Maketou
        const fullName = user.user_metadata?.full_name || 'Utilisateur CalAfrik';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || 'Utilisateur';
        const lastName = nameParts.slice(1).join(' ') || 'CalAfrik';

        const response = await fetch('https://api.maketou.net/api/v1/stores/cart/checkout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productDocumentId,
                email: user.email,
                firstName,
                lastName,
                // ✅ Le webhook est la source de vérité — la redirection est secondaire
                redirectURL: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/success`,
                meta: {
                    user_id: user.id,
                    tier: tierKey,
                    expected_amount: expectedAmount
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`${tag} Erreur API Maketou:`, data);
            return NextResponse.json({ error: data.message || 'Erreur Maketou' }, { status: response.status });
        }

        const cartId: string = data.cart?.id || data.cartId || '';
        console.log(`${tag} ✅ Panier créé: cartId=${cartId}, tier=${tierKey}`);

        return NextResponse.json({
            success: true,
            url: data.redirectUrl,
            cartId
        });

    } catch (error: any) {
        console.error(`${tag} ❌ Erreur:`, error.message);
        return NextResponse.json({ error: 'Erreur de communication avec le service de paiement' }, { status: 500 });
    }
}
