import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const PRODUCT_IDS = {
    pro: process.env.MAKETOU_PRODUCT_ID_PRO,
    premium: process.env.MAKETOU_PRODUCT_ID_PREMIUM,
    scan: process.env.MAKETOU_PRODUCT_ID_SCAN,
    suggestion: process.env.MAKETOU_PRODUCT_ID_SUGGESTION
};

export async function POST(req: Request) {
    try {
        const { tier } = await req.json();
        const apiKey = process.env.MAKETOU_API_KEY;

        if (!apiKey) {
            console.error('[Maketou] MAKETOU_API_KEY manquante');
            return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 500 });
        }

        // 1. Authentification Supabase
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Auth header missing' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Session invalide' }, { status: 401 });
        }

        // 2. Vérification du produit
        const productDocumentId = PRODUCT_IDS[tier as keyof typeof PRODUCT_IDS];
        if (!productDocumentId) {
            return NextResponse.json({ error: 'Plan ou ID de produit invalide' }, { status: 400 });
        }

        console.log(`[Maketou] Création panier pour ${user.email} - Produit: ${tier}`);

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
                productDocumentId: productDocumentId,
                email: user.email,
                firstName: firstName,
                lastName: lastName,
                redirectURL: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/success`,
                meta: {
                    user_id: user.id,
                    tier: tier
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Maketou] Erreur API:', data);
            return NextResponse.json({ error: data.message || 'Erreur Maketou' }, { status: response.status });
        }

        // 4. Retourner l'URL de redirection
        return NextResponse.json({
            success: true,
            url: data.redirectUrl,
            cartId: data.cart?.id
        });

    } catch (error: any) {
        console.error('[Maketou] Erreur Checkout:', error.message);
        return NextResponse.json({ error: 'Erreur de communication avec le service de paiement' }, { status: 500 });
    }
}
