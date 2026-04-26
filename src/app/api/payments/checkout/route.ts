import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Prix attendus par tier (en FCFA) — validation côté serveur
const EXPECTED_AMOUNTS: Record<string, any> = {
    pro: { '1': 1500, '3': 4000, '12': 14000 },
    premium: { '1': 2500, '3': 6500, '12': 22000 },
    scan: 100,
    suggestion: 100
};

export async function POST(req: Request) {
    const tag = '[Maketou Checkout]';
    try {
        const { tier, discount = 0, duration = 1 } = await req.json();
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
        let tierUpper = (tier || '').toUpperCase(); // ex: PRO, PREMIUM
        let envKey = '';

        // Logique standard
        let base = `MAKETOU_PRODUCT_ID_${tierUpper}`;
        
        if (duration === 1) {
            // 1 mois
            if (discount === 0) {
                envKey = base;
            } else {
                // legacy: _REDUIT (10%) ou _REDUIT5 (5%)
                const suffix = discount === 10 ? '_REDUIT' : `_REDUIT${discount}`;
                envKey = `${base}${suffix}`;
            }
        } else {
            // 3 ou 12 mois
            let withDuration = `${base}_${duration}`;
            if (discount === 0) {
                envKey = withDuration;
            } else {
                const discountSuffix = `REDUIT${discount}`;
                // On teste les deux variantes (avec ou sans underscore avant REDUIT)
                if (process.env[`${withDuration}_${discountSuffix}`]) {
                    envKey = `${withDuration}_${discountSuffix}`;
                } else {
                    envKey = `${withDuration}${discountSuffix}`;
                }
            }
        }

        const productDocumentId = process.env[envKey];
        const tierBase = EXPECTED_AMOUNTS[(tier || '').toLowerCase()];
        const baseAmount = typeof tierBase === 'object' ? tierBase[String(duration)] : tierBase;

        console.log(`${tag} — Key tentée: '${envKey}', ID trouvé: '${productDocumentId ? productDocumentId.substring(0, 8) + '...' : 'AUCUN'}'`);

        if (!productDocumentId || !baseAmount) {
            console.error(`${tag} Produit introuvable. Clé tentée: '${envKey}' (tier=${tierUpper}, dur=${duration}, disc=${discount})`);
            return NextResponse.json({ error: 'Plan ou durée invalide' }, { status: 400 });
        }

        // Calcul du montant final avec réduction
        const finalAmount = Math.round(baseAmount * (1 - (discount / 100)));

        console.log(`${tag} Création panier — user=${user.email}, tier=${tierUpper}, base=${baseAmount}, final=${finalAmount} FCFA (Reduction: ${discount}%)`);

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
                // On tente de passer le prix final si Maketou permet l'override
                // Sinon on compte sur le fait qu'on a bien géré l'affichage client
                price: finalAmount, 
                redirectURL: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/success`,
                meta: {
                    user_id: user.id,
                    tier: tierUpper,
                    duration: duration,
                    base_amount: baseAmount,
                    discount_percent: discount,
                    expected_amount: finalAmount
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`${tag} Erreur API Maketou:`, data);
            return NextResponse.json({ error: data.message || 'Erreur Maketou' }, { status: response.status });
        }

        const cartId: string = data.cart?.id || data.cartId || '';
        console.log(`${tag} ✅ Panier créé: cartId=${cartId}, tier=${tierUpper}`);

        return NextResponse.json({
            success: true,
            url: data.redirectUrl,
            cartId
        });

    } catch (error: any) {
        console.error(`${tag} ❌ Erreur critique:`, error.message);
        return NextResponse.json({ 
            error: `Erreur interne: ${error.message}` 
        }, { status: 500 });
    }
}
