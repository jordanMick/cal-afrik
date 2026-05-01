import { NextResponse } from 'next/server'
import dns from 'dns'
import { promisify } from 'util'
import { createClient } from '@supabase/supabase-js'

const resolveMx = promisify(dns.resolveMx)

// Client admin pour vérifier les logs d'IP
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
    try {
        const { email, logSignup } = await req.json()

        // 1. Récupérer l'IP de manière fiable (protection contre le spoofing)
        // Sur Vercel, x-real-ip est injecté par le proxy et n'est pas falsifiable par le client.
        const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'

        // 2. Si on demande juste d'enregistrer l'inscription réussie
        if (logSignup) {
            // SÉCURITÉ : On vérifie si l'utilisateur existe réellement et s'il est récent (dernières 5 min)
            const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers()
            const newUser = users?.users.find(u => u.email === email)
            
            const isRecent = newUser && (Date.now() - new Date(newUser.created_at).getTime() < 300000)

            if (!isRecent) {
                console.warn(`[Verify] Tentative de log d'inscription invalide pour ${email}`)
                return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
            }

            await supabaseAdmin.from('signup_logs').insert({ ip_address: ip })
            return NextResponse.json({ success: true })
        }

        // 3. Vérifier la limite d'IP (Max 2 par 24h)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { count, error: countErr } = await supabaseAdmin
            .from('signup_logs')
            .select('*', { count: 'exact', head: true })
            .eq('ip_address', ip)
            .gte('created_at', twentyFourHoursAgo)

        if (countErr) console.error('Erreur check IP logs:', countErr)

        if (count !== null && count >= 2) {
            return NextResponse.json({
                success: false,
                error: "Trop de comptes créés depuis cette connexion. Réessaie demain."
            }, { status: 429 })
        }

        const domain = email?.split('@')[1]
        if (!domain) {
            return NextResponse.json({ success: false, error: 'Domaine invalide' }, { status: 400 })
        }

        // 4. Vérification des enregistrements MX
        try {
            const addresses = await resolveMx(domain)
            if (addresses && addresses.length > 0) {
                return NextResponse.json({ success: true })
            }
        } catch (dnsErr) {
            console.error('DNS MX lookup failed:', dnsErr)
        }

        return NextResponse.json({
            success: false,
            error: "Cet e-mail ne semble pas pouvoir recevoir de messages. Vérifie l'orthographe."
        }, { status: 400 })

    } catch (err) {
        console.error('API Verify Error:', err)
        return NextResponse.json({ success: false, error: 'Erreur de vérification' }, { status: 500 })
    }
}
