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
        
        // FedaPay utilise 'name' ou 'event' pour le type d'événement
        const eventName = payload.name || payload.event || payload.event_type;
        const transaction = payload.data?.entity || payload.entity || {};
        
        // 🛡️ Métadonnées
        const rawMeta = transaction.metadata || transaction.custom_metadata || payload.metadata || payload.data?.metadata || {};
        let metadata: any = {};
        if (typeof rawMeta === 'string') {
            try { metadata = JSON.parse(rawMeta); } catch (e) {}
        } else { metadata = rawMeta; }

        const userId = metadata.user_id || metadata.userId;
        const tier = metadata.tier || metadata.plan || "premium";
        const customerEmail = transaction.customer?.email || payload.data?.customer?.email;
        const description = transaction.description || "";

        console.log(`[FedaPay Webhook] Logic:`, { eventName, transaction_id: transaction.id, userId, description, customerEmail });

        if (eventName === 'transaction.approved' || transaction.status === 'approved' || eventName === 'transaction.paid') {
            
            let targetUserId = userId;

            // 🔍 FALLBACK 1: Chercher dans la description (Format: "Abonnement - ID: user_id")
            if (!targetUserId && description.includes('ID:')) {
                const parts = description.split('ID:');
                if (parts.length > 1) targetUserId = parts[1].trim();
            }

            // 🔍 FALLBACK 2: Chercher par email (si présent dans user_profiles)
            if (!targetUserId && customerEmail) {
                const { data: userByEmail } = await supabaseAdmin
                    .from('user_profiles')
                    .select('user_id')
                    .eq('email', customerEmail)
                    .single();
                if (userByEmail) targetUserId = userByEmail.user_id;
            }

            if (!targetUserId) {
                console.error('[FedaPay Webhook] User ID non identifié');
                return NextResponse.json({ error: 'User identification failed' }, { status: 400 });
            }

            // Cumul et mise à jour
            const { data: profile } = await supabaseAdmin
                .from('user_profiles')
                .select('subscription_expires_at')
                .eq('user_id', targetUserId)
                .single();

            let baseDate = new Date();
            if (profile?.subscription_expires_at) {
                const currentExp = new Date(profile.subscription_expires_at);
                if (currentExp > baseDate) baseDate = currentExp;
            }
            baseDate.setDate(baseDate.getDate() + 30);

            const { error: updateError } = await supabaseAdmin
                .from('user_profiles')
                .update({ 
                    subscription_tier: tier.toLowerCase(),
                    subscription_expires_at: baseDate.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', targetUserId);

            if (updateError) throw updateError;
            console.log(`[FedaPay Webhook] SUCCESS pour ${targetUserId}`);
        }
        
        return NextResponse.json({ received: true });

    } catch (error: any) {
        console.error('[FedaPay Webhook] Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}