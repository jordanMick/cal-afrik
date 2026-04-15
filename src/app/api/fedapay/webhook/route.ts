import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ Client Admin obligatoire pour contourner RLS dans un Webhook
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        
        // 1. Extraire l'ID de transaction (indispensable pour la vérification)
        const transactionId = payload.data?.entity?.id || payload.entity?.id || payload.id;
        
        if (!transactionId) {
            console.error('[FedaPay Webhook] Transaction ID manquant dans le payload');
            return NextResponse.json({ error: 'No transaction ID' }, { status: 400 });
        }

        // 🛡️ ÉTAPE DE SÉCURITÉ CRITIQUE : Vérification directe auprès de FedaPay
        // On ne croit pas aveuglément le payload reçu (qui pourrait être falsifié), 
        // on interroge directement l'API officielle de FedaPay.
        const FEDAPAY_KEY = process.env.FEDAPAY_SECRET_KEY;
        const verifyRes = await fetch(`https://api.fedapay.com/v1/transactions/${transactionId}`, {
            headers: {
                Authorization: `Bearer ${FEDAPAY_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!verifyRes.ok) {
            console.error(`[FedaPay Webhook] Échec de la vérification officielle (Status: ${verifyRes.status})`);
            return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
        }

        const verifyData = await verifyRes.json();
        const officialTransaction = verifyData?.["v1/transaction"] || verifyData?.transaction || verifyData;
        
        console.log(`[FedaPay Webhook] Vérification officielle:`, officialTransaction.status);

        // On ne procède QUE si FedaPay confirme le statut 'approved'
        if (officialTransaction.status === 'approved') {
            
            // Extraction des métadonnées (de la transaction officielle pour plus de sécurité)
            // FedaPay peut renvoyer metadata ou custom_metadata, parfois stringifié
            const rawMeta = officialTransaction.metadata || officialTransaction.custom_metadata || {};
            let metadata: any = {};
            
            if (typeof rawMeta === 'string') {
                try { 
                    metadata = JSON.parse(rawMeta); 
                } catch (e) {
                    console.warn('[FedaPay Webhook] Échec du parse JSON des métadonnées:', rawMeta);
                }
            } else { 
                metadata = rawMeta; 
            }

            // On cherche le userId sous toutes ses formes possibles
            let targetUserId = metadata.user_id || metadata.userId || officialTransaction.external_id;
            const tier = (metadata.tier || metadata.plan || "premium").toLowerCase();
            const customerEmail = officialTransaction.customer?.email;
            const description = officialTransaction.description || "";

            console.log(`[FedaPay Webhook] Tentative identification pour:`, { 
                targetUserId, 
                customerEmail, 
                tier,
                hasDescription: !!description 
            });

            // FALLBACK 1 : Extraction depuis la description (ID: <user_id>)
            if (!targetUserId && description && description.includes('ID:')) {
                try {
                    const parts = description.split('ID:');
                    if (parts.length > 1) {
                        targetUserId = parts[1].trim().split(' ')[0].trim();
                        console.log(`[FedaPay Webhook] Identifié via description: ${targetUserId}`);
                    }
                } catch (e) {
                    console.error('[FedaPay Webhook] Erreur extraction description:', e);
                }
            }

            // FALLBACK 2 : Recherche par email (On tente sur user_profiles au cas où la colonne existe, sinon on log)
            if (!targetUserId && customerEmail) {
                console.log(`[FedaPay Webhook] Recherche par email: ${customerEmail}`);
                try {
                    const { data: userByEmail, error: emailErr } = await supabaseAdmin
                        .from('user_profiles')
                        .select('user_id')
                        .ilike('email', customerEmail) // Suppression de eq pour ilike
                        .maybeSingle();
                    
                    if (userByEmail) {
                        targetUserId = userByEmail.user_id;
                        console.log(`[FedaPay Webhook] Identifié via email: ${targetUserId}`);
                    } else if (emailErr) {
                        console.warn('[FedaPay Webhook] Recherche email échouée (la colonne existe peut-être pas):', emailErr.message);
                    }
                } catch (e) {
                    console.error('[FedaPay Webhook] Erreur lors de la recherche par email');
                }
            }

            if (!targetUserId) {
                console.error('[FedaPay Webhook] ❌ ÉCHEC CRITIQUE : UNABLE TO IDENTIFY USER. Metadata:', JSON.stringify(metadata));
                return NextResponse.json({ error: 'User identification failed' }, { status: 400 });
            }

            console.log(`[FedaPay Webhook] 🔄 Début mise à jour pour: ${targetUserId} (Plan: ${tier})`);

            // Récupération de l'expiration actuelle
            const { data: profile, error: fetchError } = await supabaseAdmin
                .from('user_profiles')
                .select('subscription_expires_at')
                .eq('user_id', targetUserId)
                .single();

            if (fetchError) {
                console.error('[FedaPay Webhook] Erreur fetch profil:', fetchError.message);
            }

            let baseDate = new Date();
            if (profile?.subscription_expires_at) {
                const currentExp = new Date(profile.subscription_expires_at);
                if (currentExp > baseDate) {
                    baseDate = currentExp;
                    console.log('[FedaPay Webhook] Prolongation basée sur date future:', baseDate.toISOString());
                }
            }
            
            // Ajouter 30 jours
            baseDate.setDate(baseDate.getDate() + 30);
            const newExpiry = baseDate.toISOString();

            console.log(`[FedaPay Webhook] Nouvelle date prévue: ${newExpiry}`);

            const { error: updateError } = await supabaseAdmin
                .from('user_profiles')
                .update({ 
                    subscription_tier: tier.toLowerCase(),
                    subscription_expires_at: newExpiry
                    // updated_at retiré car possiblement absent de la table
                })
                .eq('user_id', targetUserId);

            if (updateError) {
                console.error('[FedaPay Webhook] ❌ ERREUR SQL UPDATE:', updateError.message);
                throw updateError;
            }
            
            console.log(`[FedaPay Webhook] ✅ UPDATE RÉUSSI EN BASE pour ${targetUserId}`);
        } else {
            console.warn(`[FedaPay Webhook] Transaction ignorée (Status: ${officialTransaction.status})`);
        }
        
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[FedaPay Webhook] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}