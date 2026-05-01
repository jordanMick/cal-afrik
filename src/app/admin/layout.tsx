'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ShieldAlert } from 'lucide-react'

const ADMIN_EMAILS = ['jomickeal11@gmail.com']

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [authorized, setAuthorized] = useState<boolean | null>(null)
    const router = useRouter()

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                router.push('/login')
                return
            }

            const email = session.user.email?.toLowerCase()
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('is_admin')
                .eq('user_id', session.user.id)
                .single()

            if ((email && ADMIN_EMAILS.includes(email)) || profile?.is_admin) {
                setAuthorized(true)
            } else {
                setAuthorized(false)
            }
        }

        checkAdmin()
    }, [router])

    if (authorized === null) {
        return (
            <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: '32px', height: '32px' }} />
            </div>
        )
    }

    if (authorized === false) {
        return (
            <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                <ShieldAlert size={64} color="#ef4444" style={{ marginBottom: '24px' }} />
                <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#fff', marginBottom: '8px' }}>Acces restreint</h1>
                <p style={{ color: 'rgba(255,255,255,0.4)', maxWidth: '400px', lineHeight: '1.6' }}>
                    Desole, vous n'avez pas les permissions necessaires pour acceder a l'interface d'administration.
                </p>
                <button
                    onClick={() => router.push('/dashboard')}
                    style={{ marginTop: '32px', padding: '16px 32px', background: '#fff', color: '#000', borderRadius: '16px', fontWeight: '800', border: 'none', cursor: 'pointer' }}
                >
                    Retour au dashboard
                </button>
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#050505',
            color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <header style={{
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(20px)',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                height: '80px',
                display: 'flex',
                alignItems: 'center'
            }}>
                <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                        <div style={{ width: '42px', height: '42px', background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#000', fontSize: '20px' }}>
                            A
                        </div>
                        <div>
                            <h1 style={{ fontSize: '18px', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>Cal-Afrik Admin</h1>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '2px' }}>Console de controle</p>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push('/dashboard')}
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 18px', borderRadius: '12px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        Quitter
                    </button>
                </div>
            </header>

            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
                {children}
            </main>
        </div>
    )
}
