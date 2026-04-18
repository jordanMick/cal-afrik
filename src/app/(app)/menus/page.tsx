'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, UtensilsCrossed, MessageSquareText } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore, getMealSlot, SLOT_LABELS, type MealSlotKey } from '@/store/useAppStore'
import { getEffectiveTier } from '@/lib/subscription'

function normalizeMenuText(raw: string): string {
    const base = raw
        .replace(/\*\*/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi, '\n$1')
        .replace(/\s+(Petit-d[ée]jeuner|Petit-d[ée]j|D[ée]jeuner|Collation|D[îi]ner)\b/gi, '\n$1')
        .replace(/\s*-\s+/g, '\n- ')
        .replace(/\s*→\s*/g, '\n→ ')
        .replace(/a definir/gi, 'Repas local équilibré')
        .trim()
    return base
}

function renderMenuBlock(menuText: string) {
    const sep = '---DATA---'
    const dataIdx = menuText.indexOf(sep)
    const cleanMenuText = dataIdx !== -1 ? menuText.substring(0, dataIdx).trim() : menuText

    const normalized = normalizeMenuText(cleanMenuText)
    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean)

    const rows: React.ReactNode[] = []
    let currentDayBlock: React.ReactNode[] = []
    let currentDayKey = ''

    const flushDayBlock = () => {
        if (!currentDayKey || currentDayBlock.length === 0) return
        rows.push(
            <div key={`day-${currentDayKey}`} style={{
                marginTop: '12px', marginBottom: '16px', padding: '16px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
                {currentDayBlock}
            </div>
        )
        currentDayBlock = []
        currentDayKey = ''
    }

    lines.forEach((line, idx) => {
        const isHeader = /^(menu\s+)/i.test(line) ||
            /^[-*\s]*(\d+\.\s*)?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+\d{1,2}\/\d{1,2})?[:\s]*/i.test(line)
        const isMealLine = /^[\s*-]*(Petit-d[ée]jeuner|Petit-d[ée]j|D[ée]jeuner|Collation|D[îi]ner)\b.*?:/i.test(line)

        if (isHeader) {
            if (/^menu\s+/i.test(line)) {
                flushDayBlock()
                rows.push(
                    <p key={`menu-line-${idx}`} style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '800', marginTop: idx === 0 ? '0' : '12px' }}>
                        {line}
                    </p>
                )
            } else {
                flushDayBlock()
                const forcedSplit = line.match(/^[-*\s]*((?:\d+\.\s*)?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+\d{1,2}\/\d{1,2})?)[:\s]*(.*)$/i)
                const dateTitle = forcedSplit ? forcedSplit[1] : line
                currentDayKey = `${idx}-${dateTitle}`
                currentDayBlock.push(
                    <div key={`header-tag-${idx}`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: 'linear-gradient(135deg, var(--warning), #d97706)',
                        padding: '4px 14px', borderRadius: '99px', marginBottom: '12px'
                    }}>
                        <span style={{ color: '#fff', fontSize: '14px', fontWeight: '800' }}>{dateTitle}</span>
                    </div>
                )
            }
            return
        }

        const node = (
            <p key={`menu-line-${idx}`} style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.55', marginTop: '6px', wordBreak: 'break-word' }}>
                {line}
            </p>
        )
        if (currentDayKey) currentDayBlock.push(node)
        else rows.push(node)
    })

    flushDayBlock()
    return rows
}

export default function MenusPage() {
    const router = useRouter()
    const { profile, chatSuggestedMenus } = useAppStore()
    const [menuTab, setMenuTab] = useState<'today' | 'tomorrow' | 'week'>('today')

    const effectiveTier = getEffectiveTier(profile)
    const canAccessFutureMenus = effectiveTier === 'pro' || effectiveTier === 'premium'

    const currentHour = new Date().getHours()
    const currentSlotKey = getMealSlot(currentHour)
    const todayStr = new Date().toISOString().split('T')[0]

    const renderTodaySlots = () => {
        const slots: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
        const todayMenus = chatSuggestedMenus.date === todayStr ? (chatSuggestedMenus.today || {}) : {}
        const activeSlots = slots.filter(s => !!todayMenus[s])

        if (activeSlots.length === 0) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '40vh', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                        <UtensilsCrossed size={36} color="var(--accent)" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>Aucun menu aujourd'hui</h3>
                    <button onClick={() => router.push('/coach')} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'linear-gradient(135deg, var(--accent), var(--success))', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '16px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
                        <MessageSquareText size={20} /> Parler au Coach
                    </button>
                </div>
            )
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {activeSlots.map(slot => {
                    const text = todayMenus[slot]!
                    // Sécurité : si le menu contient explicitement "demain", on prévient l'utilisateur
                    const appearsToBeTomorrow = text.toLowerCase().includes('demain') || text.toLowerCase().includes('dimanche') 

                    return (
                        <div key={slot} style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ padding: '4px 10px', background: slot === currentSlotKey ? 'var(--accent)' : 'var(--bg-tertiary)', borderRadius: '8px', color: slot === currentSlotKey ? '#fff' : 'var(--text-muted)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>
                                    {SLOT_LABELS[slot]} {slot === currentSlotKey ? ' (Actuel)' : ''}
                                </div>
                                {appearsToBeTomorrow && <span style={{ fontSize: '10px', color: 'var(--warning)', fontWeight: 700 }}>⚠️ Semble être pour demain</span>}
                            </div>
                            {renderMenuBlock(text)}
                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button onClick={() => { useAppStore.getState().clearChatSuggestedMenu('today', slot); toast.success("Menu supprimé"); }} style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Supprimer</button>
                                {text.includes('---DATA---') && (
                                    <button onClick={() => {
                                        const sep = '---DATA---'; const idx = text.indexOf(sep);
                                        if (idx !== -1) {
                                            try { const data = JSON.parse(text.substring(idx + sep.length).trim()); useAppStore.getState().setPendingScannerPrefill({ items: data.items, slot: slot }); router.push('/scanner'); } catch (e) { toast.error("Erreur technique"); }
                                        }
                                    }} style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent), var(--success))', color: '#fff', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>✅ Choisir</button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    const renderSingleDay = (text: string | null, kind: 'tomorrow' | 'week') => {
        if (!text || (chatSuggestedMenus.date !== todayStr)) {
            return (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Aucun menu enregistré pour {kind === 'tomorrow' ? 'demain' : 'la semaine'}.</p>
                    <button onClick={() => router.push('/coach')} style={{ padding: '12px 20px', background: 'var(--bg-tertiary)', border: 'none', borderRadius: '12px', color: 'var(--text-primary)', fontWeight: '700', cursor: 'pointer' }}>Demander un menu</button>
                </div>
            )
        }
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>{renderMenuBlock(text)}</div>
                <button onClick={() => { useAppStore.getState().clearChatSuggestedMenu(kind); toast.success("Menu supprimé"); }} style={{ width: 'fit-content', padding: '10px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Supprimer tout le menu</button>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', maxWidth: '480px', margin: '0 auto', padding: '24px', paddingBottom: '140px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <button onClick={() => router.back()} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}><ArrowLeft size={20} /></button>
                <div>
                    <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '800' }}>Planning Diet</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{menuTab === 'today' ? "Aujourd'hui" : menuTab === 'tomorrow' ? "Demain" : "Semaine"}</p>
                </div>
            </div>

            <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '14px', padding: '4px', marginBottom: '20px' }}>
                <button onClick={() => setMenuTab('today')} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'today' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'today' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '700' }}>Aujourd'hui</button>
                <button onClick={() => { if (!canAccessFutureMenus) return toast.info("Passer au plan PRO."); setMenuTab('tomorrow'); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'tomorrow' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'tomorrow' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '700' }}>Demain</button>
                <button onClick={() => { if (effectiveTier !== 'premium') return toast.info("Passer au plan Premium."); setMenuTab('week'); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: menuTab === 'week' ? 'var(--bg-tertiary)' : 'transparent', color: menuTab === 'week' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px', fontWeight: '700' }}>Semaine</button>
            </div>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', border: '0.5px solid var(--border-color)', padding: '20px', minHeight: '60vh' }}>
                {menuTab === 'today' ? renderTodaySlots() : renderSingleDay(menuTab === 'tomorrow' ? chatSuggestedMenus.tomorrow : chatSuggestedMenus.week, menuTab)}
            </div>
        </div>
    )
}