'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock } from 'lucide-react'

export default function SupportPage() {
    const router = useRouter()

    const handleWhatsApp = () => {
        const text = encodeURIComponent("Bonjour, j'ai besoin d'aide avec l'application Cal-Afrik !")
        window.open(`https://wa.me/22891625978?text=${text}`, '_blank')
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'system-ui, sans-serif',
            maxWidth: '480px',
            margin: '0 auto',
            padding: '48px 24px 80px',
        }}>
            {/* Bouton retour */}
            <button
                onClick={() => router.back()}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                    fontSize: '14px', cursor: 'pointer', marginBottom: '32px',
                }}
            >
                <ArrowLeft size={18} /> Retour
            </button>

            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                {/* En-tête */}
                <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '10px' }}>
                    Support & Aide
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', marginBottom: '40px' }}>
                    Contactez-nous pour tout problème ou feedback.<br />
                    Nous sommes disponibles aux horaires suivants :
                </p>

                {/* Horaires */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '20px',
                    padding: '24px',
                    marginBottom: '32px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--warning)' }}>
                        <Clock size={20} />
                        <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>Heures de disponibilité</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Matin</span>
                            <span style={{ fontWeight: '800', fontSize: '15px' }}>08h00 — 12h00</span>
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-color)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Soir</span>
                            <span style={{ fontWeight: '800', fontSize: '15px' }}>19h00 — 00h00</span>
                        </div>
                    </div>
                </div>

                {/* Bouton WhatsApp */}
                <button
                    onClick={handleWhatsApp}
                    style={{
                        width: '100%',
                        padding: '18px',
                        background: '#25D366',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '18px',
                        fontWeight: '800',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(37,211,102,0.25)',
                    }}
                >
                    {/* Logo officiel WhatsApp */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                    </svg>
                    Nous écrire sur WhatsApp
                </button>

                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '20px' }}>
                    Réponse rapide durant nos horaires de disponibilité.
                </p>
            </motion.div>
        </div>
    )
}
