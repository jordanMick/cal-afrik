'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore, getMealSlot, SLOT_LABELS, type MealSlotKey } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import { getEffectiveTier } from '@/lib/subscription'
import type { ScanResultItem, FoodSuggestion } from '@/types'
import { Html5Qrcode } from 'html5-qrcode'

interface EnrichedSuggestion extends FoodSuggestion {
    portion_g: number; calories_detected: number; protein_detected: number
    carbs_detected: number; fat_detected: number; confidence: number
    detected: string; fromCoach?: boolean
}

interface ManualFood {
    name_fr: string; portion_g: number; calories: number
    protein_g: number; carbs_g: number; fat_g: number; category: string
}

const CATEGORIES = [
    { value: 'cereales', label: '🌾 Céréales' }, { value: 'tubercules', label: '🥔 Tubercules' },
    { value: 'legumineuses', label: '🫘 Légumineuses' }, { value: 'viandes', label: '🥩 Viandes' },
    { value: 'poissons', label: '🐟 Poissons' }, { value: 'legumes', label: '🥦 Légumes' },
    { value: 'sauces', label: '🍲 Sauces' }, { value: 'boissons', label: '🥤 Boissons' },
    { value: 'snacks', label: '🍿 Snacks' }, { value: 'plats_composes', label: '🍽️ Plats composés' },
]

const LAST_SLOT = 'diner'

const ACCENT_COLOR = '#6366f1'
const GRADIENT = 'linear-gradient(90deg, #6366f1, #10b981)'

function normalizeMenuText(raw: string): string {
    const base = raw
        .replace(/\*\*/g, '')
        .replace(/\s{2,}/g, ' ')
        // Force le passage à la ligne avant chaque jour (ex: Lundi, Mardi)
        .replace(/\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/gi, '\n$1')
        // Force le passage à la ligne avant chaque créneau (ex: Petit-déjeuner, Dîner)
        .replace(/\s+(Petit-d[ée]jeuner|Petit-d[ée]j|D[ée]jeuner|Collation|D[îi]ner)\b/gi, '\n$1')
        // Force le passage à la ligne avant les puces et les flèches
        .replace(/\s*-\s+/g, '\n- ')
        .replace(/\s*→\s*/g, '\n→ ')
        .replace(/a definir/gi, 'Repas local équilibré')
        .trim()

    return base
}

function renderMenuBlock(menuText: string, mode: 'today' | 'tomorrow' | 'week', currentSlotKey?: string, isSavingActivity?: boolean, onLogSuggestion?: (fullText: string, slotKey: string) => void, slots?: any, slotColor?: string) {
    // On cache le bloc DATA pour le rendu UI mais on garde le texte propre
    const sep = '---DATA---'
    const dataIdx = menuText.indexOf(sep)
    const cleanMenuText = dataIdx !== -1 ? menuText.substring(0, dataIdx).trim() : menuText
    
    const normalized = normalizeMenuText(cleanMenuText)
    const lines = normalized
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)

    const rows: React.ReactNode[] = []
    let currentDayBlock: React.ReactNode[] = []
    let currentDayKey = ''
    let pendingButtons: React.ReactNode[] = []
    const renderedSlots = new Set<string>()

    const flushDayBlock = () => {
        // 1. Toujours vider les boutons en attente
        if (pendingButtons.length > 0) {
            const btns = (
                <div key={`pending-btns-${Math.random()}`} style={{ marginTop: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pendingButtons.map((b, i) => <div key={`pb-${i}`}>{b}</div>)}
                </div>
            )
            if (currentDayKey) currentDayBlock.push(btns)
            else rows.push(btns)
            pendingButtons = []
        }

        // 2. Bloc de jour (Planning)
        if (!currentDayKey || currentDayBlock.length === 0) return

        rows.push(
            <div key={`day-${currentDayKey}`} style={{ 
                marginTop: '12px', 
                marginBottom: '16px',
                padding: '16px', 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
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
                    <p key={`menu-line-${idx}`} style={{ color: '#c7d2fe', fontSize: '12px', fontWeight: '800', marginTop: idx === 0 ? '0' : '12px', letterSpacing: '0.2px' }}>
                        {line}
                    </p>
                )
            } else {
                flushDayBlock()
                const forcedSplit = line.match(/^[-*\s]*((?:\d+\.\s*)?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+\d{1,2}\/\d{1,2})?)[:\s]*(.*)$/i)
                const dateTitle = forcedSplit ? forcedSplit[1] : line
                const trailing = forcedSplit ? forcedSplit[2] : ''
                currentDayKey = `${idx}-${dateTitle}`
                currentDayBlock.push(
                    <div key={`header-tag-${idx}`} style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                        padding: '4px 14px', 
                        borderRadius: '99px', 
                        marginBottom: '12px',
                        boxShadow: '0 4px 12px rgba(245,158,11,0.2)'
                    }}>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>Jour</span>
                        <span style={{ color: '#fff', fontSize: '13px', fontWeight: '800' }}>{dateTitle}</span>
                    </div>
                )
                if (trailing) {
                    currentDayBlock.push(
                        <p key={`menu-line-trailing-${idx}`} style={{ color: '#e5e7eb', fontSize: '12px', lineHeight: '1.6', wordBreak: 'break-word', marginTop: '6px' }}>
                            {trailing}
                        </p>
                    )
                }
            }
            return
        }

        if (isMealLine) {
            const mealMatch = line.match(/^[\s*-]*(Petit-d[ée]jeuner|Petit-d[ée]j|D[ée]jeuner|Collation|D[îi]ner)\b.*?:/i)
            let buttonNode = null

            if (mealMatch && mode === 'today' && onLogSuggestion) {
                const slotPrefix = mealMatch[1].toLowerCase()
                const SLOT_MAP: Record<string, string> = {
                    'petit-déjeuner': 'petit_dejeuner', 'petit-dejeuner': 'petit_dejeuner',
                    'petit-déj': 'petit_dejeuner', 'petit-dej': 'petit_dejeuner',
                    'déjeuner': 'dejeuner', 'dejeuner': 'dejeuner',
                    'collation': 'collation', 'dîner': 'diner', 'diner': 'diner'
                }
                const lineSlotKey = SLOT_MAP[slotPrefix]

                if (renderedSlots.has(lineSlotKey)) {
                    buttonNode = null
                } else {
                    renderedSlots.add(lineSlotKey)
                    const isCurrentSlot = lineSlotKey === currentSlotKey
                const slotHasMeal = slots && slots[lineSlotKey] && slots[lineSlotKey].consumed > 0
                const buttonDisabled = !isCurrentSlot || isSavingActivity || slotHasMeal

                // Correction : On utilise les heures du store pour les messages
                const SLOT_START_HOURS_STORE: Record<string, number> = { petit_dejeuner: 0, dejeuner: 12, collation: 16, diner: 19 }
                const startHour = SLOT_START_HOURS_STORE[lineSlotKey] || 0
                const currentHour = new Date().getHours()
                const isFuture = currentHour < startHour

                buttonNode = (
                    <button
                        disabled={buttonDisabled}
                        onClick={() => onLogSuggestion(menuText, lineSlotKey)}
                        style={{
                            marginTop: '10px',
                            padding: '8px 16px',
                            borderRadius: '12px',
                            border: 'none',
                            background: buttonDisabled ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, ${slotColor}, ${slotColor}dd)`,
                            color: buttonDisabled ? '#444' : '#fff',
                            fontSize: '11px',
                            fontWeight: '800',
                            cursor: buttonDisabled ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: buttonDisabled ? 'none' : `0 4px 15px ${slotColor}40`,
                            opacity: buttonDisabled && slotHasMeal ? 0.8 : 1,
                        }}
                    >
                        {slotHasMeal ? '✨ Enregistré ✓' : <><span>Choisir ce menu</span> <span style={{ opacity: 0.7 }}>→</span></>}
                    </button>
                )
                  }
            }

            const node = (
                <div key={`menu-line-${idx}`} style={{ marginTop: '10px', marginBottom: '14px' }}>
                    <p style={{ color: '#e5e7eb', fontSize: '12px', lineHeight: '1.6', wordBreak: 'break-word', marginTop: '6px' }}>
                        {line}
                    </p>
                </div>
            )
            if (buttonNode) pendingButtons.push(buttonNode)
            if (currentDayKey) currentDayBlock.push(node)
            else rows.push(node)
            return
        }

        const node = (
            <p key={`menu-line-${idx}`} style={{ color: '#ddd', fontSize: '12px', lineHeight: '1.55', marginTop: '6px', wordBreak: 'break-word' }}>
                {line}
            </p>
        )
        if (currentDayKey) currentDayBlock.push(node)
        else rows.push(node)
    })

    flushDayBlock()
    return rows
}

export default function ScannerPage() {
    const router = useRouter()
    const { 
        addMeal, 
        profile, 
        slots, 
        dailyCalories, 
        setLastCoachMessage, 
        chatSuggestedMenus, 
        clearChatSuggestedMenu,
        pendingScannerPrefill,
        setPendingScannerPrefill,
    } = useAppStore()
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [image, setImage] = useState<string | null>(null)
    const [foods, setFoods] = useState<any[]>([])
    const [selectedFoods, setSelectedFoods] = useState<EnrichedSuggestion[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [suggestions, setSuggestions] = useState<EnrichedSuggestion[]>([])
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [mealName, setMealName] = useState('')
    const [totalCaloriesAI, setTotalCaloriesAI] = useState(0)
    const [showManualForm, setShowManualForm] = useState(false)
    const [isSavingManual, setIsSavingManual] = useState(false)
    const [showRecap, setShowRecap] = useState(false)
    const [showCoach, setShowCoach] = useState(false)
    const [coachMessage, setCoachMessage] = useState('')
    const [isLoadingCoach, setIsLoadingCoach] = useState(false)
    const [scanMode, setScanMode] = useState<'ai' | 'barcode'>('ai')
    const [isScanningBarcode, setIsScanningBarcode] = useState(false)
    const [menuTab, setMenuTab] = useState<'today' | 'tomorrow' | 'week'>('today')
    const [showWeekMenuPopup, setShowWeekMenuPopup] = useState(false)
    const [manualFood, setManualFood] = useState<ManualFood>({ name_fr: '', portion_g: 200, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, category: 'plats_composes' })

    // ─── Pont Coach → Scanner : traitement du pre-fill ───────────────
    useEffect(() => {
        if (!pendingScannerPrefill || !pendingScannerPrefill.items.length) return

        const processPrefill = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                const authHeaders: any = { 'Content-Type': 'application/json' }
                if (session) authHeaders.Authorization = `Bearer ${session.access_token}`

                const enrichedItems: EnrichedSuggestion[] = []
                let totalCals = 0

                for (const item of pendingScannerPrefill.items) {
                    // ✅ Utilise /api/foods?search= au lieu de Supabase direct (évite le 400)
                    const res = await fetch(
                        `/api/foods?search=${encodeURIComponent(item.name)}&limit=1`,
                        { headers: authHeaders }
                    )
                    const json = await res.json()
                    const food = json.success && json.data?.length > 0 ? json.data[0] : null

                    if (!food) {
                        console.warn(`⚠️ Aliment non trouvé en BD : ${item.name}`)
                        continue
                    }

                    // Conversion volume → grammes via densité (défaut 1.0 g/ml)
                    const density = Number(food.density_g_ml) || 1.0
                    const portionG = Math.round(item.volume_ml * density)

                    const cals = Math.round((Number(food.calories_per_100g) * portionG) / 100)
                    const prot = Math.round(((Number(food.proteins_100g) || 0) * portionG) / 100 * 10) / 10
                    const carbs = Math.round(((Number(food.carbs_100g) || 0) * portionG) / 100 * 10) / 10
                    const fat = Math.round(((Number(food.lipids_100g) || 0) * portionG) / 100 * 10) / 10
                    totalCals += cals

                    enrichedItems.push({
                        id: food.id,
                        name: food.display_name || food.name_standard,
                        score: 100,
                        calories: cals,
                        protein_g: prot,
                        carbs_g: carbs,
                        fat_g: fat,
                        portion_g: portionG,
                        calories_detected: cals,
                        protein_detected: prot,
                        carbs_detected: carbs,
                        fat_detected: fat,
                        confidence: 100,
                        detected: food.display_name || food.name_standard,
                        fromCoach: false,
                    })
                }

                if (enrichedItems.length > 0) {
                    setMealName('Menu Coach Yao')
                    setSuggestions(enrichedItems)
                    setSelectedFoods(enrichedItems)
                    setTotalCaloriesAI(totalCals)
                    setShowRecap(true)
                } else {
                    // Aucun aliment trouvé en BD — on affiche quand même un recap générique
                    console.warn('⚠️ Aucun aliment du prefill trouvé en BD. Vérifier les name_standard.')
                }
            } catch (err) {
                console.error('❌ Prefill scanner error:', err)
            } finally {
                setPendingScannerPrefill(null)
            }
        }

        processPrefill()
    }, [pendingScannerPrefill])


    const handleSelectSuggestion = (fullText: string, slotKey: string) => {
        if (!fullText) return
        
        // On affiche un label court pour l'UI
        const displayLabel = `Menu ${SLOT_LABELS[slotKey as MealSlotKey] || slotKey}`

        // --- LOGIQUE DE CALCUL VIA TA BASE DE DONNÉES ---
        let totalCals = 0;
        let totalProt = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        
        const cleanedLower = fullText.toLowerCase()
        
        // --- 1. Tenter l'extraction via bloc ---DATA--- (Précis) ---
        const sep = '---DATA---'
        const dataIdx = fullText.indexOf(sep)
        let dataParsedSuccessfully = false

        if (dataIdx !== -1 && foods) {
            try {
                const jsonPart = fullText.substring(dataIdx + sep.length).trim()
                const data = JSON.parse(jsonPart)
                if (data.items && Array.isArray(data.items)) {
                    data.items.forEach((item: any) => {
                        const food = foods.find(f => f.name_standard === item.name)
                        if (food) {
                            const portion = item.volume_ml || food.default_portion_g || 150
                            totalCals += (food.calories_per_100g * portion) / 100
                            totalProt += ((food.proteins_100g || 0) * portion) / 100
                            totalCarbs += ((food.carbs_100g || 0) * portion) / 100
                            totalFat += ((food.lipids_100g || 0) * portion) / 100
                        }
                    })
                    dataParsedSuccessfully = totalCals > 0
                }
            } catch (err) {
                console.warn('⚠️ handleSelectSuggestion data parse error:', err)
            }
        }

        // --- 2. Fallback via regex (Moins précis) if no data or parse failed ---
        if (!dataParsedSuccessfully) {
            const detectedInDB = (foods || []).filter(f => {
                const fullName = (f.display_name || f.name_standard || f.name_fr || "").toLowerCase()
                // On extrait le nom court sans les parenthèses (ex: "Molou Zogbon (Bouillie de riz)" -> "molou zogbon")
                const shortName = fullName.replace(/\s*\(.*?\)/g, "").trim()
                
                return fullName && (
                    cleanedLower.includes(fullName) || 
                    (shortName.length > 3 && cleanedLower.includes(shortName))
                )
            })

            if (detectedInDB.length > 0) {
                detectedInDB.forEach(f => {
                    const nameEscaped = (f.display_name || f.name_standard || f.name_fr || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    const portionRegex = new RegExp(`${nameEscaped}.*?\\(?(\\d+)\\s*g\\)?`, 'i')
                    const portionMatch = fullText.match(portionRegex)
                    const portion = portionMatch ? parseInt(portionMatch[1]) : (f.default_portion_g || 200)
                    
                    totalCals += (f.calories_per_100g * portion) / 100
                    totalProt += ((f.proteins_100g || 0) * portion) / 100
                    totalCarbs += ((f.carbs_100g || 0) * portion) / 100
                    totalFat += ((f.lipids_100g || 0) * portion) / 100
                })
            } else {
                totalCals = slotKey === 'dejeuner' || slotKey === 'diner' ? 700 : (slotKey === 'collation' ? 250 : 500)
            }
        }

        const virtualFood: EnrichedSuggestion = {
            id: `suggested-${slotKey}-${Date.now()}`,
            name: displayLabel,
            score: 100,
            calories: Math.round(totalCals),
            protein_g: Math.round(totalProt * 10) / 10,
            carbs_g: Math.round(totalCarbs * 10) / 10,
            fat_g: Math.round(totalFat * 10) / 10,
            portion_g: 250,
            calories_detected: Math.round(totalCals),
            protein_detected: totalProt,
            carbs_detected: totalCarbs,
            fat_detected: totalFat,
            confidence: 100,
            detected: displayLabel,
            fromCoach: false
        }

        setMealName(displayLabel)
        setSelectedFoods([virtualFood])
        setTotalCaloriesAI(Math.round(totalCals))
        setShowRecap(true)
        setShowCoach(false)
        setCoachMessage('')
    }

    const currentHour = new Date().getHours()
    const currentSlotKey = getMealSlot(currentHour)
    const currentSlot = slots[currentSlotKey]
    const slotLabel = SLOT_LABELS[currentSlotKey]
    const isLastSlot = currentSlotKey === LAST_SLOT
    const slotColor = ACCENT_COLOR
    const effectiveTier = getEffectiveTier(profile)
    const canAccessFutureMenus = effectiveTier === 'pro' || effectiveTier === 'premium'
    const todayStr = new Date().toISOString().split('T')[0]
    let activeMenuText = (chatSuggestedMenus.date === todayStr)
        ? (menuTab === 'today'
            ? chatSuggestedMenus.today?.[currentSlotKey]
            : menuTab === 'tomorrow'
                ? chatSuggestedMenus.tomorrow
                : chatSuggestedMenus.week)
        : null

    // Fallback intelligent : si menuTab === 'today' ou 'tomorrow' est vide, on cherche dans 'week'
    if ((menuTab === 'today' || menuTab === 'tomorrow') && !activeMenuText && chatSuggestedMenus.date === todayStr && chatSuggestedMenus.week) {
        const targetDate = new Date()
        if (menuTab === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1)
        
        const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
        const targetDay = dayNames[targetDate.getDay()]
        const formattedDate = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}`
        const dateKey = `${targetDay} ${formattedDate}`
        
        const weekText = chatSuggestedMenus.week
        const dateIdx = weekText?.toLowerCase().indexOf(dateKey.toLowerCase()) ?? -1
        
        if (dateIdx !== -1) {
            const nextDayIdx = weekText.toLowerCase().indexOf(dayNames[(targetDate.getDay() + 1) % 7], dateIdx + 10)
            let dayContent = nextDayIdx !== -1 
                ? weekText.substring(dateIdx, nextDayIdx).trim()
                : weekText.substring(dateIdx).trim()

            if (menuTab === 'tomorrow') {
                activeMenuText = dayContent
            } else {
                // Pour 'today', on cherche le créneau spécifique (Petit-déj, Déjeuner, etc.)
                const slotKeywords: Record<string, string[]> = {
                    petit_dejeuner: ['petit', 'matin'],
                    dejeuner: ['dejeuner', 'midi'],
                    collation: ['collation', 'gouter', '4h'],
                    diner: ['diner', 'soir']
                }
                const keywords = slotKeywords[currentSlotKey] || []
                
                // On cherche la ligne du créneau
                // Extraction de la partie texte propre (avant ---DATA---)
                const sep = '---DATA---'
                const dataIdx = dayContent.indexOf(sep)
                const displayText = dataIdx !== -1 ? dayContent.substring(0, dataIdx).trim() : dayContent
                const lines = displayText.split('\n')
                const slotLineIdx = lines.findIndex(l => keywords.some(k => l.toLowerCase().includes(k)))
                
                if (slotLineIdx !== -1) {
                    // On prend la ligne du slot + les lignes suivantes jusqu'au prochain slot connu
                    const allSlots = ['petit', 'dejeuner', 'collation', 'diner']
                    let extracted = lines[slotLineIdx]
                    for (let i = slotLineIdx + 1; i < lines.length; i++) {
                        if (allSlots.some(s => lines[i].toLowerCase().includes(s))) break
                        extracted += '\n' + lines[i]
                    }
                    activeMenuText = extracted.trim()
                }
            }
        }
    }

    useEffect(() => {
        if (!canAccessFutureMenus && (menuTab === 'tomorrow' || menuTab === 'week')) {
            setMenuTab('today')
        }
    }, [canAccessFutureMenus, menuTab])



    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '10px', background: '#0f0f0f', border: '0.5px solid #2a2a2a', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }
    const labelStyle: React.CSSProperties = { color: '#555', fontSize: '12px', marginBottom: '4px', display: 'block', fontWeight: '500' }

    useEffect(() => { loadFoods() }, [])

    // Restauration des menus suggérés depuis Supabase (sync cross-device)
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0]
        const currentUid = profile?.user_id || profile?.id
        
        // Si le store local est déjà à jour pour aujourd'hui ET l'utilisateur actuel, pas besoin de fetcher
        if (chatSuggestedMenus.date === today && chatSuggestedMenus.user_id === currentUid) return

        const restoreMenusFromSupabase = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return

                const { data: profileData } = await supabase
                    .from('user_profiles')
                    .select('suggested_menus_json')
                    .eq('user_id', session.user.id)
                    .single()

                const remote = profileData?.suggested_menus_json
                if (!remote || remote.date !== today) return

                // Restaurer chaque type de menu dans le store
                const { setChatSuggestedMenu } = useAppStore.getState()
                if (remote.week) setChatSuggestedMenu('week', remote.week)
                if (remote.tomorrow) setChatSuggestedMenu('tomorrow', remote.tomorrow)
                if (remote.today && typeof remote.today === 'object') {
                    for (const [slot, msg] of Object.entries(remote.today)) {
                        if (msg) setChatSuggestedMenu('today', msg as string, slot)
                    }
                }
                console.log('✅ Menus suggérés restaurés depuis Supabase')
            } catch (err) {
                console.error('⚠️ restoreMenusFromSupabase error:', err)
            }
        }

        restoreMenusFromSupabase()
    }, [])


    const loadFoods = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const headers: any = {}
            if (session) headers.Authorization = `Bearer ${session.access_token}`

            const res = await fetch('/api/foods', { headers })
            const json = await res.json()
            if (json.success) {
                const safeFoods = (json.data || []).filter((item: any) => !!item?.name_standard)
                setFoods(safeFoods)
            }
        } catch (err) { console.error(err) }
    }

    useEffect(() => {
        const file = (window as any).tempImage
        if (file && foods.length > 0) { processImage(file); (window as any).tempImage = null }
    }, [foods])

    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result!.toString().split(',')[1])
        reader.onerror = reject
    })

    const compressImage = (file: File, maxWidth = 1200, quality = 0.9): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = (event) => {
                const img = new Image()
                img.src = event.target?.result as string
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    let width = img.width
                    let height = img.height

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width
                            width = maxWidth
                        }
                    } else {
                        if (height > maxWidth) {
                            width *= maxWidth / height
                            height = maxWidth
                        }
                    }

                    canvas.width = width
                    canvas.height = height
                    const ctx = canvas.getContext('2d')
                    ctx?.drawImage(img, 0, 0, width, height)

                    const outputType = (file.type === 'image/png' || file.type === 'image/webp')
                        ? file.type
                        : 'image/jpeg'
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve(new File([blob], file.name, { type: outputType }))
                        } else {
                            reject(new Error('Canvas error'))
                        }
                    }, outputType, quality)
                }
            }
            reader.onerror = reject
        })
    }

    const processImage = async (file: File) => {
        setIsAnalyzing(true)
        setSelectedFoods([]); setSuggestions([]); setMealName('')
        setTotalCaloriesAI(0); setShowManualForm(false); setShowRecap(false); setCoachMessage('')
        try {
            // Compression prioritaire
            const compressedFile = await compressImage(file)
            setImage(URL.createObjectURL(compressedFile))
            const uploadedUrl = await uploadImage(compressedFile)
            setCapturedImage(uploadedUrl)
            const base64Image = await toBase64(compressedFile)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                alert("Session expirée. Reconnecte-toi pour lancer l'analyse IA.")
                return
            }
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ images: [{ data: base64Image, mimeType: file.type }] })
            })
            const json = await res.json()
            console.log("💡 Réponse Coach Yao (/api/analyze):", json)

            // ✅ LOGIQUE COMBO 2 : Scans + Suggestions Coach Yao
            const effectiveTier = profile?.subscription_tier || 'free';
            if (effectiveTier === 'free' && (profile?.scan_feedbacks_today || 0) >= 2) {
                alert("Tu as atteint ta limite de 2 actions gratuites pour aujourd'hui (Scans + Suggestions).")
                router.push('/upgrade')
                return
            }

            if (json.error && json.code === 'LIMIT_REACHED') {
                setIsAnalyzing(false)
                alert("🚀 Limite de scan atteinte ! Passez au plan Pro pour scanner sans limite.")
                router.push('/upgrade')
                return
            }

            if (!json.success || !json.data) {
                if (json?.code === 'GEMINI_QUOTA_EXCEEDED') {
                    alert("Quota Gemini dépassé. Active la facturation Google AI Studio ou attends le reset du quota.")
                    return
                }
                if (json?.code === 'GEMINI_TEMP_UNAVAILABLE') {
                    alert("Gemini est temporairement surchargé. Réessaie dans quelques secondes.")
                    return
                }
                const errorMessage = json?.error || "Analyse Gemini échouée."
                alert(`Erreur analyse: ${errorMessage}`)
                return
            }
            setMealName(json.meal_name || 'Repas détecté')
            setTotalCaloriesAI(json.total_calories || 0)
            const enriched: EnrichedSuggestion[] = (json.data as ScanResultItem[]).flatMap((item): EnrichedSuggestion[] => {
                const suggs = item.suggestions ?? []
                if (suggs.length > 0) return suggs.map((s): EnrichedSuggestion => ({ ...s, portion_g: item.portion_g ?? 0, calories_detected: item.calories_detected ?? 0, protein_detected: item.protein_detected ?? 0, carbs_detected: item.carbs_detected ?? 0, fat_detected: item.fat_detected ?? 0, confidence: item.confidence ?? 0, detected: item.detected ?? 'Inconnu', fromCoach: false }))
                return [{ id: `ai-${item.detected ?? 'unknown'}`, name: item.detected ?? 'Aliment inconnu', score: 0, calories: item.calories_detected ?? 0, protein_g: item.protein_detected ?? 0, carbs_g: item.carbs_detected ?? 0, fat_g: item.fat_detected ?? 0, portion_g: item.portion_g ?? 0, calories_detected: item.calories_detected ?? 0, protein_detected: item.protein_detected ?? 0, carbs_detected: item.carbs_detected ?? 0, fat_detected: item.fat_detected ?? 0, confidence: item.confidence ?? 0, detected: item.detected ?? 'Inconnu', fromCoach: true }]
            })
            setSuggestions(enriched)
            if (json.data[0]) { const first = json.data[0] as ScanResultItem; setManualFood({ name_fr: json.meal_name || first.detected, portion_g: first.portion_g, calories: first.calories_detected, protein_g: first.protein_detected, carbs_g: first.carbs_detected, fat_g: first.fat_detected, category: 'plats_composes' }) }
        } catch (err: any) {
            console.error(err)
            alert(`Erreur analyse: ${err?.message || "Erreur inconnue"}`)
        }
        finally { setIsAnalyzing(false) }
    }

    // LOGIQUE SCAN CODE-BARRES (FIX ÉCRAN NOIR)
    const qrScannerRef = useRef<Html5Qrcode | null>(null)

    useEffect(() => {
        let isMounted = true;

        const startScanner = async () => {
            if (scanMode === 'barcode' && !image) {
                // Attendre un court instant que le DOM soit prêt
                await new Promise(r => setTimeout(r, 100));

                const element = document.getElementById("reader");
                if (!element) return;

                try {
                    if (!qrScannerRef.current) {
                        qrScannerRef.current = new Html5Qrcode("reader");
                    }

                    if (isMounted) {
                        await qrScannerRef.current.start(
                            { facingMode: "environment" },
                            { fps: 10, qrbox: { width: 250, height: 250 } },
                            onScanSuccess,
                            onScanFailure
                        );
                    }
                } catch (err) {
                    console.error("Erreur caméra:", err);
                }
            }
        };

        startScanner();

        return () => {
            isMounted = false;
            if (qrScannerRef.current && qrScannerRef.current.isScanning) {
                qrScannerRef.current.stop().catch(e => console.error("Erreur stop:", e));
            }
        };
    }, [scanMode, image]);

    async function onScanSuccess(decodedText: string) {
        if (qrScannerRef.current) qrScannerRef.current.stop().catch(e => console.error(e));

        // --- VÉRIFICATION LIMITE SCAN PRODUIT (COMBO 2) ---
        const { data: { session } } = await supabase.auth.getSession()
        if (session && profile?.subscription_tier === 'free' && (profile?.scan_feedbacks_today || 0) >= 2) {
            alert("Tu as atteint ta limite de 2 actions gratuites (Scans + Suggestions).")
            router.push('/upgrade')
            return
        }

        (window as any).isLastScanFromBarcode = true;
        setScanMode('ai');
        setIsAnalyzing(true);
        try {
            const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${decodedText}.json`);
            const json = await res.json();
            if (json.status === 1 && json.product) {
                const p = json.product;
                const nuts = p.nutriments;
                const detectedFood: ManualFood = {
                    name_fr: p.product_name_fr || p.product_name || "Produit inconnu",
                    portion_g: 100,
                    calories: Math.round(nuts['energy-kcal_100g'] || 0),
                    protein_g: nuts.proteins_100g || 0,
                    carbs_g: nuts.carbohydrates_100g || 0,
                    fat_g: nuts.fat_100g || 0,
                    category: 'snacks'
                };
                setManualFood(detectedFood);
                setMealName(detectedFood.name_fr);
                setShowManualForm(true);
                if (p.image_front_url) setImage(p.image_front_url);

                // ✅ Décompte du jeton pour les gratuits
                if (session && profile?.subscription_tier === 'free') {
                    await supabase.rpc('increment_scan_feedback', { user_id_input: session.user.id })
                }
            } else {
                alert("Produit non trouvé.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsAnalyzing(false);
        }
    }

    function onScanFailure() {
        // Muet : on ne fait rien, on attend juste que ça scanne
    }

    const handleFileScan = async (file: File) => {
        // --- VÉRIFICATION LIMITE SCAN PRODUIT ---
        const { data: { session: checkSession } } = await supabase.auth.getSession()
        if (checkSession && profile?.subscription_tier === 'free') {
            const today = new Date().toISOString().split('T')[0]
            const { count } = await supabase
                .from('meals')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', checkSession.user.id)
                .eq('ai_confidence', -1)
                .gte('logged_at', `${today}T00:00:00.000Z`)
                .lte('logged_at', `${today}T23:59:59.999Z`)

            if (count !== null && count >= 5) {
                alert("🚀 Limite de scan de produits atteinte (5/jour en mode gratuit). Passez au plan Pro pour scanner sans limite !")
                router.push('/upgrade')
                return
            }
        }

        (window as any).isLastScanFromBarcode = true;
        setIsAnalyzing(true);
        try {
            if (!qrScannerRef.current) {
                qrScannerRef.current = new Html5Qrcode("reader");
            }
            const decodedText = await qrScannerRef.current.scanFile(file, true);
            await onScanSuccess(decodedText);
        } catch (err) {
            console.error(err);
            alert("Aucun code-barres lisible n'a été trouvé sur cette image.");
        } finally {
            setIsAnalyzing(false);
        }
    }

    const simulateAI = () => {
        const safeFoods = (foods || []).filter((item: any) => !!item?.name_standard)
        const filtered = safeFoods.filter((item: any) => {
            const lowerName = item?.name_standard?.toLowerCase?.() || ""
            return ['riz', 'poulet', 'oeuf', 'thon', 'plantain'].some(kw => lowerName.includes(kw))
        })
        const sourceFoods = filtered.length > 0 ? filtered.slice(0, 5) : safeFoods.slice(0, 5)
        setSuggestions(sourceFoods.map((item: any) => ({
            id: item.id,
            name: item.name_standard,
            score: 50,
            calories: Math.round((item.calories_per_100g * (item.default_portion_g || 200)) / 100),
            protein_g: Math.round((item.protein_per_100g * (item.default_portion_g || 200)) / 100 * 10) / 10,
            carbs_g: Math.round((item.carbs_per_100g * (item.default_portion_g || 200)) / 100 * 10) / 10,
            fat_g: Math.round((item.fat_per_100g * (item.default_portion_g || 200)) / 100 * 10) / 10,
            portion_g: item.default_portion_g || 200,
            calories_detected: 0,
            protein_detected: 0,
            carbs_detected: 0,
            fat_detected: 0,
            confidence: 50,
            detected: item.name_standard,
            fromCoach: false
        })))
    }

    const selectFood = (food: EnrichedSuggestion) => setSelectedFoods(prev => prev.find(f => f.id === food.id) ? prev.filter(f => f.id !== food.id) : [...prev, food])

    const getTotals = () => selectedFoods.reduce((acc, food) => ({ calories: acc.calories + food.calories, protein_g: acc.protein_g + food.protein_g, carbs_g: acc.carbs_g + food.carbs_g, fat_g: acc.fat_g + food.fat_g, portion_g: acc.portion_g + food.portion_g }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, portion_g: 0 })

    const loadCoachMessage = async () => {
        setShowCoach(true)
        if (coachMessage) return
        setIsLoadingCoach(true)
        try {
            const totals = getTotals()
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const storeState = useAppStore.getState()
            const freshSlot = storeState.slots[currentSlotKey]
            const res = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ selectedFoods: selectedFoods.map(f => f.name), totals: { calories: Math.round(totals.calories), protein_g: Math.round(totals.protein_g * 10) / 10, carbs_g: Math.round(totals.carbs_g * 10) / 10, fat_g: Math.round(totals.fat_g * 10) / 10 }, slotLabel, slotTarget: isLastSlot ? calorieTarget : freshSlot.target, slotConsumed: isLastSlot ? dailyConsumed : freshSlot.consumed, slotRemaining: isLastSlot ? dailyRemainingNow : freshSlot.remaining, dailyCalories: storeState.dailyCalories, calorieTarget }) })
            const json = await res.json()
            if (json.code === 'FREE_LIFETIME_USED') {
                setCoachMessage('__FREE_USED__')
            } else if (json.code === 'PRO_DAILY_LIMIT') {
                setCoachMessage('__PRO_LIMIT__')
            } else {
                const msg = json.success ? json.message : 'Bon repas ! Continue comme ça 💪'
                setCoachMessage(msg); setLastCoachMessage(msg)
            }
        } catch { setCoachMessage('Bon repas ! Continue à bien manger 💪') }
        finally { setIsLoadingCoach(false) }
    }

    const handleSaveManualFood = async () => {
        if (!manualFood.name_fr || manualFood.calories <= 0) return
        setIsSavingManual(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // 1. Sauvegarder l'aliment dans la base de données (pour futur usage)
            const factor = manualFood.portion_g > 0 ? 100 / manualFood.portion_g : 1
            const resFood = await fetch('/api/foods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    name_fr: manualFood.name_fr,
                    category: manualFood.category,
                    calories_per_100g: Math.round(manualFood.calories * factor),
                    protein_per_100g: Math.round(manualFood.protein_g * factor * 10) / 10,
                    carbs_per_100g: Math.round(manualFood.carbs_g * factor * 10) / 10,
                    fat_per_100g: Math.round(manualFood.fat_g * factor * 10) / 10,
                    default_portion_g: manualFood.portion_g,
                    verified: false,
                    origin_country: []
                })
            })
            const jsonFood = await resFood.json()
            if (!jsonFood.success) throw new Error("Erreur lors de la sauvegarde de l'aliment")

            // 2. Préparer le repas complet (Aliments déjà sélectionnés + ce nouvel aliment)
            const newFoodEntry: EnrichedSuggestion = {
                id: jsonFood.data.id,
                name: manualFood.name_fr,
                score: 100,
                calories: manualFood.calories,
                protein_g: manualFood.protein_g,
                carbs_g: manualFood.carbs_g,
                fat_g: manualFood.fat_g,
                portion_g: manualFood.portion_g,
                calories_detected: manualFood.calories,
                protein_detected: manualFood.protein_g,
                carbs_detected: manualFood.carbs_g,
                fat_detected: manualFood.fat_g,
                confidence: 100,
                detected: manualFood.name_fr,
                fromCoach: false
            }

            const allFoods = [...selectedFoods, newFoodEntry]
            const finalTotals = allFoods.reduce((acc, f) => ({
                calories: acc.calories + f.calories,
                protein_g: acc.protein_g + f.protein_g,
                carbs_g: acc.carbs_g + f.carbs_g,
                fat_g: acc.fat_g + f.fat_g,
                portion_g: acc.portion_g + f.portion_g
            }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, portion_g: 0 })

            // 3. Sauvegarder le repas (Meal) directement
            const isBarcode = scanMode === 'barcode' || !!(window as any).isLastScanFromBarcode;
            const resMeal = await fetch('/api/meals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    custom_name: mealName || allFoods.map(f => f.name).join(', '),
                    meal_type: currentSlotKey,
                    portion_g: Math.round(finalTotals.portion_g),
                    calories: Math.round(finalTotals.calories),
                    protein_g: Math.round(finalTotals.protein_g * 10) / 10,
                    carbs_g: Math.round(finalTotals.carbs_g * 10) / 10,
                    fat_g: Math.round(finalTotals.fat_g * 10) / 10,
                    image_url: capturedImage,
                    ai_confidence: isBarcode ? -1 : 100, // -1 marque le scan code-barres
                    coach_message: null
                })
            })

            const jsonMeal = await resMeal.json()
            if (jsonMeal.success && jsonMeal.data) {
                addMeal(jsonMeal.data)
                router.push('/journal')
            }

        } catch (err) {
            console.error(err)
            alert("Erreur lors de l'enregistrement.")
        } finally {
            setIsSavingManual(false)
        }
    }

    const saveAIFoodToDB = async (food: EnrichedSuggestion, session: any) => {
        const factor = food.portion_g > 0 ? 100 / food.portion_g : 1
        try { await fetch('/api/foods', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ name_fr: food.name, category: 'plats_composes', calories_per_100g: Math.round(food.calories * factor), protein_per_100g: Math.round(food.protein_g * factor * 10) / 10, carbs_per_100g: Math.round(food.carbs_g * factor * 10) / 10, fat_per_100g: Math.round(food.fat_g * factor * 10) / 10, default_portion_g: food.portion_g, verified: false, origin_country: [] }) }) } catch (err) { console.error(err) }
    }

    const handleSaveMeal = async () => {
        if (selectedFoods.length === 0) return
        setIsSaving(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const aiFoods = selectedFoods.filter(f => f.fromCoach)
            if (aiFoods.length > 0) await Promise.all(aiFoods.map(food => saveAIFoodToDB(food, session)))
            const totals = getTotals()
            const res = await fetch('/api/meals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ custom_name: mealName || selectedFoods.map(f => f.name).join(', '), meal_type: currentSlotKey, portion_g: Math.round(totals.portion_g), calories: Math.round(totals.calories), protein_g: Math.round(totals.protein_g * 10) / 10, carbs_g: Math.round(totals.carbs_g * 10) / 10, fat_g: Math.round(totals.fat_g * 10) / 10, image_url: capturedImage, ai_confidence: Math.round(selectedFoods.reduce((sum, f) => sum + f.confidence, 0) / selectedFoods.length), coach_message: coachMessage || null }) })
            const json = await res.json()
            if (json.success && json.data) {
                addMeal(json.data)
                router.push('/journal')
            } else {
                alert(`Erreur enregistrement repas: ${json?.error || 'Insertion échouée'}`)
            }
        } catch (err) { console.error(err) }
        finally { setIsSaving(false) }
    }

    const uploadImage = async (file: File) => {
        const fileName = `${Date.now()}.${file.name.split('.').pop()}`
        const { error } = await supabase.storage.from('meal-images').upload(fileName, file)
        if (error) return null
        return supabase.storage.from('meal-images').getPublicUrl(fileName).data.publicUrl
    }

    const totals = getTotals()
    const calorieTarget = profile?.calorie_target ?? 2000
    // On utilise directement la valeur globale plus fiable
    const dailyConsumed = dailyCalories
    const dailyRemainingNow = calorieTarget - dailyConsumed
    const recapRemainingAfter = isLastSlot ? dailyRemainingNow - totals.calories : (currentSlot?.target || 0) - (currentSlot?.consumed || 0) - totals.calories
    const recapExceeded = recapRemainingAfter < 0
    const displayedRemaining = Math.max(0, isLastSlot ? dailyRemainingNow : (currentSlot?.remaining ?? 0))
    const displayedRemainingLabel = isLastSlot ? "Restant journée" : "Restant créneau"

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', maxWidth: '480px', margin: '0 auto', padding: '24px', paddingBottom: '140px', position: 'relative', overflow: 'hidden' }}>

            {/* Halo couleur du créneau */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '260px', height: '260px', borderRadius: '50%', background: `radial-gradient(circle, ${slotColor}15 0%, transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '80px', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ padding: '24px 0 16px' }}>
                <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>Scanner</h1>
                <p style={{ color: '#555', fontSize: '13px', fontWeight: '500', marginTop: '4px' }}>Analyse ton assiette instantanément</p>
            </div>

            {/* CRÉNEAU */}
            <div style={{ background: '#141414', border: `0.5px solid ${slotColor}30`, borderRadius: '24px', padding: '18px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2.5px', background: slotColor }} />
                <div>
                    <p style={{ color: '#444', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Créneau</p>
                    <p style={{ color: '#fff', fontWeight: '700', fontSize: '15px', marginTop: '2px' }}>{slotLabel}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#444', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{displayedRemainingLabel}</p>
                    <p style={{ color: displayedRemaining < 0 ? '#f87171' : (displayedRemaining === 0 ? '#fbbf24' : slotColor), fontWeight: '800', fontSize: '16px', marginTop: '2px' }}>{displayedRemaining} kcal</p>
                </div>
            </div>

            {/* Menus suggérés par Yao (via chat) */}
            {!image && !isAnalyzing && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', background: '#141414', borderRadius: '14px', padding: '4px', marginBottom: '10px' }}>
                        <button onClick={() => setMenuTab('today')} style={{ flex: 1, padding: '9px', borderRadius: '10px', border: 'none', background: menuTab === 'today' ? '#1e1e1e' : 'transparent', color: menuTab === 'today' ? '#fff' : '#555', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                            Aujourd'hui
                        </button>
                        <button
                            onClick={() => {
                                if (!canAccessFutureMenus) {
                                    alert("Menu Demain réservé aux plans Pro et Premium.")
                                    return
                                }
                                setMenuTab('tomorrow')
                            }}
                            style={{ flex: 1, padding: '9px', borderRadius: '10px', border: 'none', background: menuTab === 'tomorrow' ? '#1e1e1e' : 'transparent', color: menuTab === 'tomorrow' ? '#fff' : '#555', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                        >
                            Demain {!canAccessFutureMenus ? '🔒' : ''}
                        </button>
                        <button
                            onClick={() => {
                                if (!canAccessFutureMenus) {
                                    alert("Menu Semaine réservé aux plans Pro et Premium.")
                                    return
                                }
                                setMenuTab('week')
                            }}
                            style={{ flex: 1, padding: '9px', borderRadius: '10px', border: 'none', background: menuTab === 'week' ? '#1e1e1e' : 'transparent', color: menuTab === 'week' ? '#fff' : '#555', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                        >
                            Semaine {!canAccessFutureMenus ? '🔒' : ''}
                        </button>
                    </div>

                    <div style={{ 
                        background: 'rgba(20,20,20,0.4)', 
                        backdropFilter: 'blur(20px)',
                        border: `1px solid ${slotColor}20`, 
                        borderRadius: '24px', 
                        padding: '18px 20px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <p style={{ color: slotColor, fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                    Menu suggéré par Yao
                                </p>
                                {activeMenuText && (
                                    <button
                                        onClick={() => {
                                            if (confirm("Effacer cette suggestion ?")) {
                                                clearChatSuggestedMenu(menuTab, menuTab === 'today' ? currentSlotKey : undefined)
                                            }
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                                        title="Supprimer la suggestion"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6m4-6v6"/></svg>
                                    </button>
                                )}
                            </div>
                            {menuTab === 'week' && activeMenuText && (
                                <button
                                    onClick={() => setShowWeekMenuPopup(true)}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '999px',
                                        border: `0.5px solid ${slotColor}50`,
                                        background: 'transparent',
                                        color: slotColor,
                                        fontSize: '16px',
                                        fontWeight: '700',
                                        lineHeight: 1,
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                    }}
                                    aria-label="Afficher le menu semaine en popup"
                                    title="Voir tout"
                                >
                                    →
                                </button>
                            )}
                        </div>
                        {activeMenuText ? (
                            <div style={{ marginTop: '8px', maxHeight: menuTab === 'week' ? '450px' : 'none', overflowY: 'auto', paddingRight: '4px' }}>
                                {renderMenuBlock(activeMenuText, menuTab, currentSlotKey, isSaving, handleSelectSuggestion, slots, slotColor)}
                            </div>
                        ) : (
                            <p style={{ color: '#888', fontSize: '12px', lineHeight: '1.55', marginTop: '8px' }}>
                                Tu verras le menu suggéré par Yao ici. Demande un menu depuis le chat.
                            </p>
                        )}

                        {/* Rappel permanent pour le prochain repas si prêt */}
                        {(() => {
                            if (menuTab !== 'today') return null
                            const SLOT_ORDER: MealSlotKey[] = ['petit_dejeuner', 'dejeuner', 'collation', 'diner']
                            const SLOT_HOURS: Record<string, number> = { petit_dejeuner: 0, dejeuner: 12, collation: 16, diner: 19 }
                            const currentIndex = SLOT_ORDER.indexOf(currentSlotKey as MealSlotKey)
                            const futureSlot = SLOT_ORDER.slice(currentIndex + 1).find(sk => 
                                chatSuggestedMenus.today && chatSuggestedMenus.today[sk]
                            )
                            if (!futureSlot) return null

                            return (
                                <div style={{ marginTop: '12px', padding: '10px', borderRadius: '10px', background: `${slotColor}08`, border: `0.5px dashed ${slotColor}30` }}>
                                    <p style={{ color: slotColor, fontSize: '11px', lineHeight: '1.4', fontWeight: '600' }}>
                                        📅 Suggestion prête pour le <b>{SLOT_LABELS[futureSlot]}</b> à <b>{SLOT_HOURS[futureSlot]}:00</b>.
                                    </p>
                                </div>
                            )
                        })()}
                        <button
                            onClick={() => router.push('/coach')}
                            style={{ marginTop: '10px', padding: '8px 10px', borderRadius: '10px', border: `0.5px solid ${slotColor}50`, background: 'transparent', color: slotColor, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        >
                            Ouvrir le chat
                        </button>
                    </div>
                </div>
            )}

            {showWeekMenuPopup && (
                <>
                    <div
                        onClick={() => setShowWeekMenuPopup(false)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1200 }}
                    />
                    <div style={{
                        position: 'fixed',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 'calc(100% - 32px)',
                        maxWidth: '460px',
                        maxHeight: '82vh',
                        overflowY: 'auto',
                        background: '#111',
                        border: '0.5px solid #252525',
                        borderRadius: '18px',
                        padding: '14px',
                        zIndex: 1210,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <p style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase' }}>Menu semaine</p>
                            <button
                                onClick={() => setShowWeekMenuPopup(false)}
                                style={{ background: 'transparent', border: '0.5px solid #333', borderRadius: '8px', color: '#aaa', cursor: 'pointer', width: '28px', height: '28px' }}
                            >
                                ✕
                            </button>
                        </div>
                        <div>{activeMenuText ? renderMenuBlock(activeMenuText, 'week', undefined, undefined, undefined, undefined, slotColor) : null}</div>
                    </div>
                </>
            )}

            {/* SWITCH MODE SCAN */}
            <div style={{ display: 'flex', background: '#141414', borderRadius: '14px', padding: '4px', marginBottom: '16px' }}>
                <button onClick={() => { setScanMode('ai'); (window as any).isLastScanFromBarcode = false; }} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: scanMode === 'ai' ? '#1e1e1e' : 'transparent', color: scanMode === 'ai' ? '#fff' : '#555', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}>
                    📸 Photo
                </button>
                <button onClick={() => setScanMode('barcode')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: scanMode === 'barcode' ? '#1e1e1e' : 'transparent', color: scanMode === 'barcode' ? '#fff' : '#555', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}>
                    🏷️ Code-barres
                </button>
            </div>

            {/* AI SCAN VIEW */}
            {scanMode === 'ai' && !image && (
                <>
                    <div onClick={() => fileInputRef.current?.click()} style={{ height: '200px', borderRadius: '24px', background: '#141414', border: `1px dashed ${slotColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: `${slotColor}12`, border: `0.5px solid ${slotColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', boxShadow: `0 8px 16px ${slotColor}15` }}>📷</div>
                        <p style={{ color: '#555', fontSize: '14px', fontWeight: '600' }}>Scanner un plat</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) await processImage(file) }} style={{ display: 'none' }} />
                </>
            )}

            {/* BARCODE SCAN VIEW */}
            {scanMode === 'barcode' && !image && (
                <div style={{ marginBottom: '20px' }}>
                    <div id="reader" style={{ borderRadius: '24px', overflow: 'hidden', border: `1px solid ${slotColor}30`, background: '#141414', minHeight: '250px' }}></div>
                    <p style={{ color: '#555', fontSize: '12px', textAlign: 'center', marginTop: '12px' }}>Place le code-barres dans le carré</p>

                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <p style={{ color: '#444', fontSize: '11px', marginBottom: '10px', textTransform: 'uppercase', fontWeight: '700' }}>Ou</p>
                        <button
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (e: any) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileScan(file);
                                };
                                input.click();
                            }}
                            style={{
                                background: 'transparent',
                                border: `1px solid ${slotColor}30`,
                                color: slotColor,
                                padding: '10px 20px',
                                borderRadius: '12px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            🖼️ Choisir une image
                        </button>
                    </div>
                </div>
            )}

            {/* PREVIEW IMAGE (SHARED) */}
            {image && (
                <div style={{ position: 'relative', marginBottom: '20px' }}>
                    <img src={image} style={{ width: '100%', borderRadius: '24px', border: '0.5px solid #222' }} />
                    <button onClick={() => { setImage(null); setSuggestions([]); setSelectedFoods([]); setMealName(''); setShowManualForm(false) }}
                        style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.8)', border: '0.5px solid #333', borderRadius: '50%', width: '36px', height: '36px', color: '#fff', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
            )}

            {isAnalyzing && (
                <div style={{ textAlign: 'center', padding: '16px', marginBottom: '14px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: `${slotColor}12`, border: `0.5px solid ${slotColor}30`, borderRadius: '20px' }}>
                        <span style={{ fontSize: '14px' }}>🔍</span>
                        <p style={{ color: slotColor, fontSize: '13px', fontWeight: '500' }}>Analyse en cours...</p>
                    </div>
                </div>
            )}

            {mealName && !isAnalyzing && (
                <div style={{ marginBottom: '20px', padding: '16px 20px', background: '#141414', border: `0.5px solid ${slotColor}20`, borderRadius: '18px' }}>
                    <p style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>🍽️ {mealName}</p>
                    {totalCaloriesAI > 0 && <p style={{ color: '#555', fontSize: '12px', marginTop: '4px', fontWeight: '500' }}>Estimation Coach Yao : ~{totalCaloriesAI} kcal</p>}
                </div>
            )}

            {/* SUGGESTIONS */}
            {suggestions.length > 0 && !isAnalyzing && (
                <div style={{ marginBottom: '20px' }}>
                    <p style={{ color: '#444', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Vérifie la composition</p>
                    {suggestions.map((food, idx) => {
                        const isSelected = !!selectedFoods.find(f => f.id === food.id)
                        return (
                            <div key={`${food.id}-${food.detected}`} onClick={() => selectFood(food)} style={{ padding: '16px 20px', borderRadius: '20px', marginBottom: '12px', background: isSelected ? 'rgba(99,102,241,0.08)' : '#141414', cursor: 'pointer', border: isSelected ? `1px solid ${ACCENT_COLOR}` : '0.5px solid #222', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: isSelected ? `1.5px solid ${ACCENT_COLOR}` : '1.5px solid #333', background: isSelected ? ACCENT_COLOR : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                            {isSelected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                                        </div>
                                        <p style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>{food.name || 'Plat inconnu'}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#555', fontSize: '11px', fontWeight: '600' }}>⚖️ {food.portion_g}g</span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">COACH YAO EN ACTION...</span>
                                    <p style={{ color: isSelected ? ACCENT_COLOR : '#666', fontSize: '12px', fontWeight: '600' }}>
                                        {food.calories} kcal · {food.protein_g}g prot.
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* AJOUT MANUEL */}
            {!isAnalyzing && image && (
                <button onClick={() => setShowManualForm(!showManualForm)} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'transparent', border: '0.5px dashed #2a2a2a', color: '#444', cursor: 'pointer', marginBottom: '12px', fontSize: '13px' }}>
                    {showManualForm ? '✕ Fermer le formulaire' : '✏️ Ajouter manuellement'}
                </button>
            )}

            {showManualForm && (
                <div style={{ marginBottom: '14px', padding: '18px', borderRadius: '14px', background: '#141414', border: '0.5px solid #222' }}>
                    <p style={{ color: '#fff', fontWeight: '500', fontSize: '15px', marginBottom: '2px' }}>✏️ Ajouter un aliment</p>
                    <p style={{ color: '#444', fontSize: '12px', marginBottom: '14px' }}>Valeurs suggérées par Coach Yao</p>
                    <div style={{ marginBottom: '10px' }}><label style={labelStyle}>Nom *</label><input style={inputStyle} value={manualFood.name_fr} onChange={e => setManualFood(p => ({ ...p, name_fr: e.target.value }))} placeholder="ex: Rôti de porc" /></div>
                    <div style={{ marginBottom: '10px' }}><label style={labelStyle}>Catégorie *</label><select style={inputStyle} value={manualFood.category} onChange={e => setManualFood(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                    <div style={{ marginBottom: '4px' }}><label style={labelStyle}>Portion (g) *</label><input style={inputStyle} type="number" value={manualFood.portion_g} onChange={e => setManualFood(p => ({ ...p, portion_g: Number(e.target.value) }))} /></div>
                    <p style={{ color: '#2a2a2a', fontSize: '11px', marginBottom: '10px' }}>Macros pour {manualFood.portion_g}g</p>
                    <div style={{ marginBottom: '10px' }}><label style={labelStyle}>Calories (kcal) *</label><input style={inputStyle} type="number" value={manualFood.calories} onChange={e => setManualFood(p => ({ ...p, calories: Number(e.target.value) }))} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                        {[{ key: 'protein_g', label: 'Protéines' }, { key: 'carbs_g', label: 'Glucides' }, { key: 'fat_g', label: 'Lipides' }].map(f => (
                            <div key={f.key}><label style={labelStyle}>{f.label}</label><input style={inputStyle} type="number" value={(manualFood as any)[f.key]} onChange={e => setManualFood(p => ({ ...p, [f.key]: Number(e.target.value) }))} placeholder="0" /></div>
                        ))}
                    </div>
                    <button onClick={handleSaveManualFood} disabled={isSavingManual || !manualFood.name_fr || manualFood.calories <= 0} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: (!manualFood.name_fr || manualFood.calories <= 0) ? '#1e1e1e' : `linear-gradient(135deg, ${slotColor}, #6366f1)`, color: (!manualFood.name_fr || manualFood.calories <= 0) ? '#333' : '#fff', border: 'none', fontWeight: '500', cursor: 'pointer', fontSize: '14px' }}>
                        {isSavingManual ? 'Sauvegarde...' : '✅ Sauvegarder et ajouter'}
                    </button>
                </div>
            )}

            {/* BOUTON RÉCAP */}
            {selectedFoods.length > 0 && (
                <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', padding: '0 20px' }}>
                    <button onClick={() => { setShowRecap(true); setShowCoach(false); setCoachMessage('') }} style={{ width: '100%', padding: '14px', borderRadius: '14px', background: `linear-gradient(135deg, ${slotColor}, #6366f1)`, color: '#fff', border: 'none', fontWeight: '600', fontSize: '15px', cursor: 'pointer', boxShadow: `0 8px 24px ${slotColor}40` }}>
                        Voir le récap · {Math.round(totals.calories)} kcal
                    </button>
                </div>
            )}

            {showRecap && <div onClick={() => setShowRecap(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000 }} />}

            {/* POPUP RÉCAP */}
            {showRecap && (
                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto', width: '100%', maxWidth: '480px', background: '#111', borderRadius: '24px 24px 0 0', border: '0.5px solid #222', zIndex: 1010, padding: '0 0 100px 0', maxHeight: '90vh', overflowY: 'auto' }}>
                    <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '2px', background: `linear-gradient(90deg, ${slotColor}, #6366f1)` }} />
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 0' }}>
                        <div style={{ width: '36px', height: '4px', background: '#222', borderRadius: '2px' }} />
                    </div>
                    <div style={{ padding: '18px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>Récap de ton repas</h2>
                            <span style={{ color: slotColor, fontSize: '11px', background: `${slotColor}15`, padding: '4px 10px', borderRadius: '20px', border: `0.5px solid ${slotColor}40` }}>{slotLabel}</span>
                        </div>
                        <p style={{ color: '#444', fontSize: '12px', marginBottom: '18px' }}>{selectedFoods.map(f => f.name).join(' · ')}</p>

                        <div style={{ background: '#0a0a0a', borderRadius: '16px', padding: '20px', textAlign: 'center', marginBottom: '12px', border: `0.5px solid ${slotColor}20` }}>
                            <p style={{ color: '#fff', fontSize: '52px', fontWeight: '700', letterSpacing: '-2px' }}>{Math.round(totals.calories)}</p>
                            <p style={{ color: '#444', fontSize: '13px' }}>kilocalories</p>
                        </div>

                        <div style={{ background: recapExceeded ? 'rgba(248,113,113,0.06)' : '#141414', border: `0.5px solid ${recapExceeded ? 'rgba(248,113,113,0.3)' : '#222'}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ color: '#444', fontSize: '11px' }}>{isLastSlot ? `Journée · objectif ${calorieTarget} kcal` : `Créneau ${slotLabel}`}</p>
                                <p style={{ color: '#333', fontSize: '12px', marginTop: '2px' }}>{isLastSlot ? `${Math.round(dailyConsumed)} + ${Math.round(totals.calories)} kcal` : `${Math.round(currentSlot.consumed)} + ${Math.round(totals.calories)} kcal`}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ color: '#444', fontSize: '11px' }}>{recapExceeded ? '⚠️ Dépassement' : 'Restant après repas'}</p>
                                <p style={{ color: recapExceeded ? '#f87171' : slotColor, fontWeight: '700', fontSize: '18px' }}>
                                    {recapExceeded ? `+${Math.abs(Math.round(recapRemainingAfter))} kcal` : `${Math.round(recapRemainingAfter)} kcal`}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                            {[
                                { label: 'Protéines', value: totals.protein_g, color: '#6366f1' },
                                { label: 'Glucides', value: totals.carbs_g, color: '#f59e0b' },
                                { label: 'Lipides', value: totals.fat_g, color: '#10b981' },
                            ].map(m => (
                                <div key={m.label} style={{ background: '#0a0a0a', borderRadius: '12px', padding: '12px 8px', textAlign: 'center', border: `0.5px solid ${m.color}20` }}>
                                    <p style={{ color: m.color, fontSize: '20px', fontWeight: '600' }}>{Math.round(m.value * 10) / 10}g</p>
                                    <p style={{ color: '#444', fontSize: '11px', marginTop: '2px' }}>{m.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* On n'affiche le conseil du coach QUE si ce n'est pas un menu déjà suggéré par Yao */}
                        {!selectedFoods.some(f => f.id.startsWith('suggested-')) && (
                            <>
                                <button onClick={loadCoachMessage} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: showCoach ? 'rgba(245,158,11,0.08)' : 'transparent', border: '0.5px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontWeight: '500', fontSize: '13px', cursor: 'pointer', marginBottom: '12px', textAlign: 'left' }}>
                                    {showCoach ? 'Conseil personnalisé de votre coach' : 'Demander l\'avis du coach →'}
                                </button>
                                {showCoach && (
                                    <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: '12px', padding: '14px', marginBottom: '14px', border: '0.5px solid rgba(245,158,11,0.2)' }}>
                                        {isLoadingCoach ? (
                                            <p style={{ color: '#f59e0b', fontSize: '13px' }}>⏳ Yao analyse ton assiette...</p>
                                        ) : coachMessage === '__FREE_USED__' ? (
                                            <div style={{ textAlign: 'center' }}>
                                                <p className="text-[10px] font-bold text-white/30 mt-1 uppercase tracking-widest">ANALYSE COACH YAO</p>
                                                <p style={{ color: '#fff', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Essai gratuit déjà utilisé</p>
                                                <p style={{ color: '#888', fontSize: '11px', lineHeight: '1.5', marginBottom: '12px' }}>Tu as déjà vu le talent de Coach Yao ! Passe au Plan Pro pour ses conseils chaque jour.</p>
                                                <div onClick={() => router.push('/upgrade')} style={{ padding: '8px 16px', background: '#f59e0b', color: '#000', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'inline-block' }}>Voir le Plan Pro →</div>
                                            </div>
                                        ) : coachMessage === '__PRO_LIMIT__' ? (
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ fontSize: '24px', marginBottom: '8px' }}>⏰</p>
                                                <p style={{ color: '#fff', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Conseil du jour déjà utilisé</p>
                                                <p style={{ color: '#888', fontSize: '11px', lineHeight: '1.5', marginBottom: '12px' }}>Yao vous a déjà conseillé aujourd'hui. Passez au Premium pour un accès illimité !</p>
                                                <div onClick={() => router.push('/upgrade')} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'inline-block' }}>Débloquer le Premium →</div>
                                            </div>
                                        ) : coachMessage ? (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                    <span style={{ fontSize: '18px' }}>💡</span>
                                                    <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>Coach Yao</span>
                                                    {profile?.subscription_tier === 'free' && (
                                                        <span style={{ marginLeft: 'auto', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '10px', padding: '2px 8px', borderRadius: '8px', fontWeight: '700' }}>Essai gratuit</span>
                                                    )}
                                                </div>
                                                <p style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.6' }}>{coachMessage}</p>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </>
                        )}

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setShowRecap(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#1a1a1a', border: '0.5px solid #222', color: '#fff', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>← Modifier</button>
                            <button onClick={handleSaveMeal} disabled={isSaving} style={{ flex: 2, padding: '14px', borderRadius: '12px', background: `linear-gradient(135deg, ${slotColor}, #6366f1)`, color: '#fff', border: 'none', fontWeight: '600', fontSize: '14px', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                                {isSaving ? 'Ajout...' : '✅ Ajouter au journal'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}