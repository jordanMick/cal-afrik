'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Mail, MessageSquare, Phone, Globe, ExternalLink, HelpCircle } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SupportPage() {
    const router = useRouter()

    const faqItems = [
        { q: "Comment sont calculées mes macros ?", a: "Nous utilisons l'équation de Mifflin-St Jeor basée sur votre profil (âge, poids, taille) et votre niveau d'activité." },
        { q: "Comment scanner un plat ?", a: "Utilisez l'icône appareil photo sur le dashboard. Prenez une photo claire du plat de dessus." },
        { q: "Mon abonnement ne s'affiche pas", a: "Si le paiement a été validé mais que votre compte est toujours en 'Free', contactez-nous avec votre reçu." }
    ]

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '40px' }}>
            {/* Header */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="var(--text-primary)" size={24} />
                </button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Aide & Support</h1>
            </div>

            <div style={{ padding: '0 20px' }}>
                {/* Section Contact Rapide */}
                <div style={{ background: 'linear-gradient(135deg, var(--accent), #ec4899)', borderRadius: '24px', padding: '24px', marginBottom: '32px', boxShadow: '0 10px 30px rgba(99,102,241,0.2)' }}>
                    <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>Besoin d'aide ?</h2>
                    <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>Notre équipe est disponible pour vous accompagner dans votre parcours nutritionnel.</p>
                    <button 
                        onClick={() => window.open('mailto:support@cal-afrik.com')}
                        style={{ background: '#fff', color: 'var(--accent)', border: 'none', padding: '12px 20px', borderRadius: '14px', fontSize: '14px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    >
                        <Mail size={18} />
                        Nous contacter
                    </button>
                </div>

                {/* FAQ Rapide */}
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', marginLeft: '4px' }}>Questions fréquentes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                    {faqItems.map((item, i) => (
                        <motion.div 
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}
                        >
                            <p style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px', color: 'var(--text-primary)' }}>{item.q}</p>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{item.a}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Autres Liens */}
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', marginLeft: '4px' }}>Ressources</h3>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', border: '0.5px solid var(--border-color)', overflow: 'hidden' }}>
                    <button style={{ width: '100%', padding: '16px 20px', background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Globe size={18} color="var(--text-secondary)" />
                            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Site web officiel</span>
                        </div>
                        <ExternalLink size={16} color="var(--text-muted)" />
                    </button>
                    <button style={{ width: '100%', padding: '16px 20px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <HelpCircle size={18} color="var(--text-secondary)" />
                            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Guide d'utilisation</span>
                        </div>
                        <ExternalLink size={16} color="var(--text-muted)" />
                    </button>
                </div>

                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '40px' }}>
                    Version 1.2.4 · Cal Afrik Support
                </p>
            </div>
        </div>
    )
}
