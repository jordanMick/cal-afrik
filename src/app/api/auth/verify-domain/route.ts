import { NextResponse } from 'next/server'
import dns from 'dns'
import { promisify } from 'util'

const resolveMx = promisify(dns.resolveMx)

export async function POST(req: Request) {
    try {
        const { email } = await req.json()
        const domain = email.split('@')[1]

        if (!domain) {
            return NextResponse.json({ success: false, error: 'Domaine invalide' }, { status: 400 })
        }

        // Vérification des enregistrements MX
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
        return NextResponse.json({ success: false, error: 'Erreur de vérification' }, { status: 500 })
    }
}
