'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Shield, Lock, Eye, FileText, Globe } from 'lucide-react'

export default function PrivacyPage() {
    const router = useRouter()

    const sections = [
        {
            title: "Collecte des données",
            icon: <Eye size={20} color="var(--accent-primary)" />,
            content: "Cal Afrik collecte les informations nécessaires à ton suivi nutritionnel : nom, email, âge, poids, taille et tes habitudes alimentaires. Nous stockons également les photos de tes repas pour l'analyse par l'IA de Coach Yao."
        },
        {
            title: "Utilisation des données",
            icon: <Globe size={20} color="var(--success)" />,
            content: "Tes données sont utilisées exclusivement pour calculer tes besoins caloriques, générer tes bilans nutritionnels et améliorer la précision de nos conseils. Nous ne vendons jamais tes données à des tiers."
        },
        {
            title: "Sécurité & Stockage",
            icon: <Lock size={20} color="#f59e0b" />,
            content: "Tes informations sont sécurisées via Supabase et chiffrées lors des transferts. L'accès à tes données personnelles est strictement limité à l'infrastructure technique nécessaire au fonctionnement de l'application."
        },
        {
            title: "Tes Droits",
            icon: <Shield size={20} color="#ef4444" />,
            content: "Tu disposes d'un droit d'accès, de rectification et de suppression de tes données. Tu peux supprimer ton compte et toutes les données associées directement depuis les paramètres de l'application."
        }
    ]

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '60px' }}>
            {/* Header */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="var(--text-primary)" size={24} />
                </button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Confidentialité</h1>
            </div>

            <div style={{ padding: '0 20px' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(6,95,70,0.1), rgba(16,185,129,0.1))', borderRadius: '24px', padding: '24px', marginBottom: '32px', textAlign: 'center', border: '0.5px solid var(--border-color)' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
                        <Shield size={28} color="var(--accent-primary)" />
                    </div>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Ta vie privée est sacrée</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        Chez Cal Afrik, nous croyons que tes données de santé t'appartiennent. Voici comment nous les protégeons.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {sections.map((section, i) => (
                        <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: '20px', padding: '20px', border: '0.5px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {section.icon}
                                </div>
                                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{section.title}</h3>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                {section.content}
                            </p>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '40px', padding: '20px', borderRadius: '20px', background: 'var(--bg-tertiary)', textAlign: 'center' }}>
                    <FileText size={24} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        Dernière mise à jour : 24 Avril 2026<br />
                        Pour toute question : via notre support WhatsApp dans l'application
                    </p>
                </div>
            </div>
        </div>
    )
}
