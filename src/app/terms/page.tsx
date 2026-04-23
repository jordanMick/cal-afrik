'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, Scale, CheckCircle, AlertTriangle, CreditCard, Ban } from 'lucide-react'

export default function TermsPage() {
    const router = useRouter()

    const sections = [
        {
            title: "Usage de l'Application",
            icon: <CheckCircle size={20} color="var(--success)" />,
            content: "Cal-Afrik est un outil d'accompagnement nutritionnel. Les conseils de Coach Yao sont générés par IA et ne remplacent en aucun cas l'avis d'un médecin ou d'un nutritionniste certifié."
        },
        {
            title: "Abonnements & Paiements",
            icon: <CreditCard size={20} color="var(--accent-primary)" />,
            content: "Les abonnements Pro et Premium sont facturés via Maketou. Ils sont valables pour la durée choisie (1 mois, 3 mois ou 12 mois) et ne sont pas remboursables après activation des services IA."
        },
        {
            title: "Responsabilité",
            icon: <AlertTriangle size={20} color="#f59e0b" />,
            content: "Cal-Afrik n'est pas responsable des décisions alimentaires prises par l'utilisateur. En cas de pathologie (diabète, hypertension, etc.), consulte impérativement un professionnel de santé avant de modifier ton régime."
        },
        {
            title: "Suspension de compte",
            icon: <Ban size={20} color="#ef4444" />,
            content: "Nous nous réservons le droit de suspendre tout compte faisant un usage abusif de nos API ou ne respectant pas les règles de courtoisie lors des échanges avec le support."
        }
    ]

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', paddingBottom: '60px' }}>
            {/* Header */}
            <div style={{ padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <ChevronLeft color="var(--text-primary)" size={24} />
                </button>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Conditions d'utilisation</h1>
            </div>

            <div style={{ padding: '0 20px' }}>
                <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(16,185,129,0.1))', borderRadius: '24px', padding: '24px', marginBottom: '32px', textAlign: 'center', border: '0.5px solid var(--border-color)' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
                        <Scale size={28} color="var(--accent-primary)" />
                    </div>
                    <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>Règles de bonne conduite</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        Pour garantir la meilleure expérience à tous les utilisateurs de Cal-Afrik.
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
            </div>
        </div>
    )
}
