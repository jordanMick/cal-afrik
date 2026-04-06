'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore, getMealSlot, SLOT_LABELS, SLOT_PCT } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import type { ScanResultItem, FoodSuggestion } from '@/types'

interface EnrichedSuggestion extends FoodSuggestion {
    portion_g: number
    calories_detected: number
    protein_detected: number
    carbs_detected: number
    fat_detected: number
    confidence: number
    detected: string
    fromAI?: boolean
}

interface ManualFood {
    name_fr: string
    portion_g: number
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    category: string
}

const CATEGORIES = [
    { value: 'cereales', label: '🌾 Céréales' },
    { value: 'tubercules', label: '🥔 Tubercules' },
    { value: 'legumineuses', label: '🫘 Légumineuses' },
    { value: 'viandes', label: '🥩 Viandes' },
    { value: 'poissons', label: '🐟 Poissons' },
    { value: 'legumes', label: '🥦 Légumes' },
    { value: 'sauces', label: '🍲 Sauces' },
    { value: 'boissons', label: '🥤 Boissons' },
    { value: 'snacks', label: '🍿 Snacks' },
    { value: 'plats_composes', label: '🍽️ Plats composés' },
]

const LAST_SLOT = 'diner'

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    background: '#0a0a0a', border: '0.5px solid #333', color: '#fff',
    fontSize: '14px', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
    color: '#666', fontSize: '12px', marginBottom: '4px', display: 'block',
}

export default function ScannerPage() {
    const router = useRouter()
    const { addMeal, profile, slots, dailyCalories, setLastCoachMessage } = useAppStore()
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [image, setImage] = useState<string | null>(null)
    const [foods, setFoods] = useState<any[]>([])
    const [selectedFoods, setSelectedFoods] = useState<EnrichedSuggestion[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [suggestions, setSuggestions] = useState<EnrichedSuggestion[]>([])
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [mealName, setMealName] = useState<string>('')
    const [totalCaloriesAI, setTotalCaloriesAI] = useState<number>(0)
    const [showManualForm, setShowManualForm] = useState(false)
    const [isSavingManual, setIsSavingManual] = useState(false)
    const [showRecap, setShowRecap] = useState(false)
    const [showCoach, setShowCoach] = useState(false)
    const [coachMessage, setCoachMessage] = useState<string>('')
    const [isLoadingCoach, setIsLoadingCoach] = useState(false)

    const [manualFood, setManualFood] = useState<ManualFood>({
        name_fr: '', portion_g: 200, calories: 0,
        protein_g: 0, carbs_g: 0, fat_g: 0, category: 'plats_composes',
    })

    const currentHour = new Date().getHours()
    const currentSlotKey = getMealSlot(currentHour)
    const currentSlot = slots[currentSlotKey]
    const slotLabel = SLOT_LABELS[currentSlotKey]
    const isLastSlot = currentSlotKey === LAST_SLOT

    const calorieTarget = profile?.calorie_target ?? 0
    const dailyConsumed = Object.values(slots).reduce((acc, s) => acc + s.consumed, 0)
    const dailyRemainingNow = calorieTarget - dailyConsumed
    const displayedRemaining = isLastSlot ? Math.max(0, dailyRemainingNow) : Math.max(0, currentSlot.remaining)
    const displayedRemainingLabel = isLastSlot ? 'Restant journée' : 'Restant créneau'

    useEffect(() => { loadFoods() }, [])

    const loadFoods = async () => {
        try {
            const res = await fetch('/api/foods')
            const json = await res.json()
            if (json.success) setFoods(json.data)
        } catch (err) { console.error(err) }
    }

    useEffect(() => {
        const file = (window as any).tempImage
        if (file && foods.length > 0) {
            processImage(file)
                ; (window as any).tempImage = null
        }
    }, [foods])

    const toBase64 = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => resolve(reader.result!.toString().split(',')[1])
            reader.onerror = reject
        })

    const processImage = async (file: File) => {
        setIsAnalyzing(true)
        setSelectedFoods([]); setSuggestions([]); setMealName('')
        setTotalCaloriesAI(0); setShowManualForm(false)
        setShowRecap(false); setCoachMessage('')

        try {
            const previewUrl = URL.createObjectURL(file)
            setImage(previewUrl)
            const uploadedUrl = await uploadImage(file)
            setCapturedImage(uploadedUrl)
            const base64Image = await toBase64(file)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { simulateAI(); return }

            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ images: [{ data: base64Image, mimeType: file.type }] })
            })
            const json = await res.json()
            if (!json.success || !json.data) { simulateAI(); return }

            setMealName(json.meal_name || 'Repas détecté')
            setTotalCaloriesAI(json.total_calories || 0)

            const enriched: EnrichedSuggestion[] = (json.data as ScanResultItem[]).flatMap((item): EnrichedSuggestion[] => {
                const suggs = item.suggestions ?? []
                if (suggs.length > 0) {
                    return suggs.map((s): EnrichedSuggestion => ({
                        ...s,
                        portion_g: item.portion_g ?? 0,
                        calories_detected: item.calories_detected ?? 0,
                        protein_detected: item.protein_detected ?? 0,
                        carbs_detected: item.carbs_detected ?? 0,
                        fat_detected: item.fat_detected ?? 0,
                        confidence: item.confidence ?? 0,
                        detected: item.detected ?? 'Inconnu',
                        fromAI: false,
                    }))
                }
                return [{
                    id: `ai-${item.detected ?? 'unknown'}`,
                    name: item.detected ?? 'Aliment inconnu',
                    score: 0,
                    calories: item.calories_detected ?? 0,
                    protein_g: item.protein_detected ?? 0,
                    carbs_g: item.carbs_detected ?? 0,
                    fat_g: item.fat_detected ?? 0,
                    portion_g: item.portion_g ?? 0,
                    calories_detected: item.calories_detected ?? 0,
                    protein_detected: item.protein_detected ?? 0,
                    carbs_detected: item.carbs_detected ?? 0,
                    fat_detected: item.fat_detected ?? 0,
                    confidence: item.confidence ?? 0,
                    detected: item.detected ?? 'Inconnu',
                    fromAI: true,
                }]
            })
            setSuggestions(enriched)

            if (json.data[0]) {
                const first = json.data[0] as ScanResultItem
                setManualFood({
                    name_fr: json.meal_name || first.detected,
                    portion_g: first.portion_g,
                    calories: first.calories_detected,
                    protein_g: first.protein_detected,
                    carbs_g: first.carbs_detected,
                    fat_g: first.fat_detected,
                    category: 'plats_composes',
                })
            }
        } catch (err) {
            console.error(err)
            simulateAI()
        } finally {
            setIsAnalyzing(false)
        }
    }

    const simulateAI = () => {
        const fitnessKeywords = ['riz', 'poulet', 'oeuf', 'thon', 'plantain']
        const filtered = foods.filter(food => fitnessKeywords.some(kw => food.name_fr.toLowerCase().includes(kw)))
        const simulated: EnrichedSuggestion[] = (filtered.length > 0 ? filtered.slice(0, 5) : foods.slice(0, 5))
            .map(food => ({
                id: food.id, name: food.name_fr, score: 50,
                calories: Math.round((food.calories_per_100g * (food.default_portion_g || 200)) / 100),
                protein_g: Math.round((food.protein_per_100g * (food.default_portion_g || 200)) / 100 * 10) / 10,
                carbs_g: Math.round((food.carbs_per_100g * (food.default_portion_g || 200)) / 100 * 10) / 10,
                fat_g: Math.round((food.fat_per_100g * (food.default_portion_g || 200)) / 100 * 10) / 10,
                portion_g: food.default_portion_g || 200,
                calories_detected: 0, protein_detected: 0, carbs_detected: 0, fat_detected: 0,
                confidence: 50, detected: food.name_fr, fromAI: false,
            }))
        setSuggestions(simulated)
    }

    const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        await processImage(file)
    }

    const selectFood = (food: EnrichedSuggestion) => {
        setSelectedFoods(prev =>
            prev.find(f => f.id === food.id) ? prev.filter(f => f.id !== food.id) : [...prev, food]
        )
    }

    const getTotals = () => selectedFoods.reduce((acc, food) => ({
        calories: acc.calories + food.calories,
        protein_g: acc.protein_g + food.protein_g,
        carbs_g: acc.carbs_g + food.carbs_g,
        fat_g: acc.fat_g + food.fat_g,
        portion_g: acc.portion_g + food.portion_g,
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, portion_g: 0 })

    const loadCoachMessage = async () => {
        if (coachMessage) { setShowCoach(true); return }
        setIsLoadingCoach(true); setShowCoach(true)
        try {
            const totals = getTotals()
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const storeState = useAppStore.getState()
            const freshSlot = storeState.slots[currentSlotKey]
            const res = await fetch('/api/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    selectedFoods: selectedFoods.map(f => f.name),
                    totals: {
                        calories: Math.round(totals.calories),
                        protein_g: Math.round(totals.protein_g * 10) / 10,
                        carbs_g: Math.round(totals.carbs_g * 10) / 10,
                        fat_g: Math.round(totals.fat_g * 10) / 10,
                    },
                    slotLabel,
                    slotTarget: isLastSlot ? calorieTarget : freshSlot.target,
                    slotConsumed: isLastSlot ? dailyConsumed : freshSlot.consumed,
                    slotRemaining: isLastSlot ? dailyRemainingNow : freshSlot.remaining,
                    dailyCalories: storeState.dailyCalories,
                    calorieTarget,
                })
            })
            const json = await res.json()
            const msg = json.success ? json.message : 'Bon repas ! Continue comme ça 💪'
            setCoachMessage(msg)
            setLastCoachMessage(msg)
        } catch (err) {
            console.error(err)
            setCoachMessage('Bon repas ! Continue à bien manger 💪')
        } finally {
            setIsLoadingCoach(false)
        }
    }

    const handleSaveManualFood = async () => {
        if (!manualFood.name_fr || manualFood.calories <= 0) return
        setIsSavingManual(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const factor = manualFood.portion_g > 0 ? 100 / manualFood.portion_g : 1
            const res = await fetch('/api/foods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    name_fr: manualFood.name_fr, category: manualFood.category,
                    calories_per_100g: Math.round(manualFood.calories * factor),
                    protein_per_100g: Math.round(manualFood.protein_g * factor * 10) / 10,
                    carbs_per_100g: Math.round(manualFood.carbs_g * factor * 10) / 10,
                    fat_per_100g: Math.round(manualFood.fat_g * factor * 10) / 10,
                    default_portion_g: manualFood.portion_g, verified: false, origin_country: [],
                })
            })
            const json = await res.json()
            if (json.success && json.data) {
                const newFood: EnrichedSuggestion = {
                    id: json.data.id, name: manualFood.name_fr, score: 100,
                    calories: manualFood.calories, protein_g: manualFood.protein_g,
                    carbs_g: manualFood.carbs_g, fat_g: manualFood.fat_g,
                    portion_g: manualFood.portion_g,
                    calories_detected: manualFood.calories, protein_detected: manualFood.protein_g,
                    carbs_detected: manualFood.carbs_g, fat_detected: manualFood.fat_g,
                    confidence: 100, detected: manualFood.name_fr, fromAI: false,
                }
                setSelectedFoods(prev => [...prev, newFood])
                setShowManualForm(false)
            }
        } catch (err) { console.error(err) }
        finally { setIsSavingManual(false) }
    }

    const saveAIFoodToDB = async (food: EnrichedSuggestion, session: any) => {
        const factor = food.portion_g > 0 ? 100 / food.portion_g : 1
        try {
            await fetch('/api/foods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    name_fr: food.name, category: 'plats_composes',
                    calories_per_100g: Math.round(food.calories * factor),
                    protein_per_100g: Math.round(food.protein_g * factor * 10) / 10,
                    carbs_per_100g: Math.round(food.carbs_g * factor * 10) / 10,
                    fat_per_100g: Math.round(food.fat_g * factor * 10) / 10,
                    default_portion_g: food.portion_g, verified: false, origin_country: [],
                })
            })
        } catch (err) { console.error(err) }
    }

    const handleSaveMeal = async () => {
        if (selectedFoods.length === 0) return
        setIsSaving(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const aiFoods = selectedFoods.filter(f => f.fromAI)
            if (aiFoods.length > 0) await Promise.all(aiFoods.map(food => saveAIFoodToDB(food, session)))
            const totals = getTotals()
            const finalMealName = mealName || selectedFoods.map(f => f.name).join(', ')
            const res = await fetch('/api/meals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    custom_name: finalMealName,
                    portion_g: Math.round(totals.portion_g),
                    calories: Math.round(totals.calories),
                    protein_g: Math.round(totals.protein_g * 10) / 10,
                    carbs_g: Math.round(totals.carbs_g * 10) / 10,
                    fat_g: Math.round(totals.fat_g * 10) / 10,
                    image_url: capturedImage,
                    ai_confidence: Math.round(selectedFoods.reduce((sum, f) => sum + f.confidence, 0) / selectedFoods.length),
                    coach_message: coachMessage || null,
                }),
            })
            const json = await res.json()
            if (json.success && json.data) addMeal(json.data)
            router.push('/journal')
        } catch (err) { console.error(err) }
        finally { setIsSaving(false) }
    }

    const uploadImage = async (file: File) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const { error } = await supabase.storage.from('meal-images').upload(fileName, file)
        if (error) return null
        const { data } = supabase.storage.from('meal-images').getPublicUrl(fileName)
        return data.publicUrl
    }

    const totals = getTotals()
    const recapRemainingAfter = isLastSlot
        ? dailyRemainingNow - totals.calories
        : currentSlot.target - currentSlot.consumed - totals.calories
    const recapExceeded = recapRemainingAfter < 0
    const recapLabel = isLastSlot ? `Journée · objectif ${calorieTarget} kcal` : `Créneau ${slotLabel}`
    const recapConsumedLabel = isLastSlot
        ? `${Math.round(dailyConsumed)} + ${Math.round(totals.calories)} kcal`
        : `${Math.round(currentSlot.consumed)} + ${Math.round(totals.calories)} kcal`

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', maxWidth: '480px', margin: '0 auto', padding: '24px', paddingBottom: '140px' }}>
            <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '500', marginBottom: '16px' }}>Scanner</h1>

            {/* CRÉNEAU */}
            <div style={{ background: '#161616', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <p style={{ color: '#555', fontSize: '11px' }}>Créneau actuel</p>
                    <p style={{ color: '#fff', fontWeight: '500', fontSize: '13px' }}>{slotLabel}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#555', fontSize: '11px' }}>{displayedRemainingLabel}</p>
                    <p style={{ color: displayedRemaining <= 0 ? '#ff5555' : '#fff', fontWeight: '500', fontSize: '13px' }}>
                        {displayedRemaining} kcal
                    </p>
                </div>
            </div>

            {/* IMAGE */}
            {!image ? (
                <>
                    <div onClick={() => fileInputRef.current?.click()} style={{
                        height: '180px', borderRadius: '14px',
                        background: '#111', border: '0.5px dashed #333',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexDirection: 'column', gap: '6px', marginBottom: '14px'
                    }}>
                        <span style={{ fontSize: '28px' }}>📷</span>
                        <p style={{ color: '#555', fontSize: '13px' }}>Ajouter une photo</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageCapture} style={{ display: 'none' }} />
                </>
            ) : (
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                    <img src={image} style={{ width: '100%', borderRadius: '14px' }} />
                    <button onClick={() => { setImage(null); setSuggestions([]); setSelectedFoods([]); setMealName(''); setShowManualForm(false) }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', border: '0.5px solid #333', borderRadius: '50%', width: '30px', height: '30px', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
                        ✕
                    </button>
                </div>
            )}

            {isAnalyzing && (
                <p style={{ color: '#555', marginBottom: '14px', textAlign: 'center', fontSize: '13px' }}>🔍 Analyse en cours...</p>
            )}

            {mealName && !isAnalyzing && (
                <div style={{ marginBottom: '14px' }}>
                    <p style={{ color: '#fff', fontWeight: '500', fontSize: '15px' }}>🍽️ {mealName}</p>
                    {totalCaloriesAI > 0 && <p style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>Estimation IA : ~{totalCaloriesAI} kcal</p>}
                </div>
            )}

            {/* SUGGESTIONS */}
            {suggestions.length > 0 && !isAnalyzing && (
                <div style={{ marginBottom: '14px' }}>
                    <p style={{ color: '#555', fontSize: '12px', marginBottom: '10px' }}>Sélectionne les aliments présents</p>
                    {suggestions.map((food) => {
                        const isSelected = !!selectedFoods.find(f => f.id === food.id)
                        return (
                            <div key={`${food.id}-${food.detected}`} onClick={() => selectFood(food)} style={{
                                padding: '12px 14px', borderRadius: '12px', marginBottom: '8px',
                                background: isSelected ? '#fff' : '#161616',
                                cursor: 'pointer',
                                border: isSelected ? 'none' : '0.5px solid #2a2a2a',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <p style={{ color: isSelected ? '#000' : '#fff', fontWeight: '500', fontSize: '13px' }}>
                                        {food.name || 'Plat inconnu'}
                                    </p>
                                    {food.fromAI && (
                                        <span style={{
                                            background: isSelected ? '#e0e0e0' : '#1e1e1e',
                                            color: isSelected ? '#444' : '#888',
                                            fontSize: '10px', fontWeight: '500',
                                            padding: '2px 8px', borderRadius: '20px',
                                            border: `0.5px solid ${isSelected ? '#ccc' : '#333'}`
                                        }}>Suggestion IA</span>
                                    )}
                                </div>
                                {food.fromAI && (
                                    <p style={{ color: isSelected ? '#555' : '#555', fontSize: '11px', marginBottom: '4px' }}>
                                        ⚠️ Non trouvé dans la base — valeurs estimées
                                    </p>
                                )}
                                <p style={{ color: isSelected ? '#333' : '#666', fontSize: '11px' }}>⚖️ Portion : {food.portion_g}g</p>
                                <p style={{ color: isSelected ? '#000' : '#aaa', fontSize: '12px', fontWeight: '500', marginTop: '2px' }}>
                                    🔥 {food.calories} kcal · {food.protein_g}g prot · {food.carbs_g}g gluc · {food.fat_g}g lip
                                </p>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* AJOUT MANUEL */}
            {!isAnalyzing && image && (
                <button onClick={() => setShowManualForm(!showManualForm)} style={{
                    width: '100%', padding: '12px', borderRadius: '12px',
                    background: 'transparent', border: '0.5px dashed #333',
                    color: '#555', cursor: 'pointer', marginBottom: '12px', fontSize: '13px'
                }}>
                    {showManualForm ? '✕ Fermer le formulaire' : '✏️ Ajouter manuellement'}
                </button>
            )}

            {showManualForm && (
                <div style={{ marginBottom: '14px', padding: '18px', borderRadius: '14px', background: '#161616', border: '0.5px solid #2a2a2a' }}>
                    <p style={{ color: '#fff', fontWeight: '500', fontSize: '15px', marginBottom: '2px' }}>✏️ Ajouter un aliment</p>
                    <p style={{ color: '#555', fontSize: '12px', marginBottom: '14px' }}>Valeurs pré-remplies par l'IA — corrige si nécessaire.</p>

                    <div style={{ marginBottom: '10px' }}>
                        <label style={labelStyle}>Nom de l'aliment *</label>
                        <input style={inputStyle} value={manualFood.name_fr} onChange={e => setManualFood(p => ({ ...p, name_fr: e.target.value }))} placeholder="ex: Rôti de porc" />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={labelStyle}>Catégorie *</label>
                        <select style={inputStyle} value={manualFood.category} onChange={e => setManualFood(p => ({ ...p, category: e.target.value }))}>
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                        <label style={labelStyle}>Portion (g) *</label>
                        <input style={inputStyle} type="number" value={manualFood.portion_g} onChange={e => setManualFood(p => ({ ...p, portion_g: Number(e.target.value) }))} />
                    </div>
                    <p style={{ color: '#333', fontSize: '11px', marginBottom: '10px' }}>Les macros ci-dessous sont pour cette portion ({manualFood.portion_g}g)</p>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={labelStyle}>Calories (kcal) *</label>
                        <input style={inputStyle} type="number" value={manualFood.calories} onChange={e => setManualFood(p => ({ ...p, calories: Number(e.target.value) }))} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                        {[{ key: 'protein_g', label: 'Protéines (g)' }, { key: 'carbs_g', label: 'Glucides (g)' }, { key: 'fat_g', label: 'Lipides (g)' }].map(f => (
                            <div key={f.key}>
                                <label style={labelStyle}>{f.label}</label>
                                <input style={inputStyle} type="number" value={(manualFood as any)[f.key]} onChange={e => setManualFood(p => ({ ...p, [f.key]: Number(e.target.value) }))} placeholder="0" />
                            </div>
                        ))}
                    </div>
                    <button onClick={handleSaveManualFood} disabled={isSavingManual || !manualFood.name_fr || manualFood.calories <= 0} style={{
                        width: '100%', padding: '12px', borderRadius: '10px',
                        background: (!manualFood.name_fr || manualFood.calories <= 0) ? '#222' : '#fff',
                        color: (!manualFood.name_fr || manualFood.calories <= 0) ? '#444' : '#000',
                        border: 'none', fontWeight: '500', cursor: 'pointer', fontSize: '14px'
                    }}>
                        {isSavingManual ? 'Sauvegarde...' : '✅ Sauvegarder et ajouter au repas'}
                    </button>
                </div>
            )}

            {/* BOUTON RÉCAP */}
            {selectedFoods.length > 0 && (
                <div style={{ position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', padding: '0 20px' }}>
                    <button onClick={() => { setShowRecap(true); setShowCoach(false); setCoachMessage('') }} style={{
                        width: '100%', padding: '14px', borderRadius: '12px',
                        background: '#fff', color: '#000', border: 'none',
                        fontWeight: '500', fontSize: '15px', cursor: 'pointer'
                    }}>
                        Voir le récap · {Math.round(totals.calories)} kcal
                    </button>
                </div>
            )}

            {/* OVERLAY */}
            {showRecap && <div onClick={() => setShowRecap(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 40 }} />}

            {/* POPUP RÉCAP */}
            {showRecap && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto',
                    width: '100%', maxWidth: '480px',
                    background: '#111', borderRadius: '20px 20px 0 0',
                    border: '0.5px solid #2a2a2a', zIndex: 50,
                    padding: '0 0 100px 0', maxHeight: '90vh', overflowY: 'auto'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                        <div style={{ width: '36px', height: '4px', background: '#333', borderRadius: '2px' }} />
                    </div>

                    <div style={{ padding: '18px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '500' }}>Récap de ton repas</h2>
                            <span style={{ color: '#666', fontSize: '11px', background: '#1e1e1e', padding: '4px 10px', borderRadius: '20px', border: '0.5px solid #333' }}>
                                {slotLabel}
                            </span>
                        </div>
                        <p style={{ color: '#555', fontSize: '12px', marginBottom: '18px' }}>
                            {selectedFoods.map(f => f.name).join(' · ')}
                        </p>

                        {/* Calories */}
                        <div style={{ background: '#0a0a0a', borderRadius: '14px', padding: '18px', textAlign: 'center', marginBottom: '10px' }}>
                            <p style={{ color: '#fff', fontSize: '48px', fontWeight: '500', letterSpacing: '-2px' }}>{Math.round(totals.calories)}</p>
                            <p style={{ color: '#555', fontSize: '13px' }}>kilocalories</p>
                        </div>

                        {/* Bandeau restant */}
                        <div style={{
                            background: recapExceeded ? 'rgba(255,85,85,0.06)' : '#111',
                            border: `0.5px solid ${recapExceeded ? '#552222' : '#2a2a2a'}`,
                            borderRadius: '12px', padding: '12px 14px', marginBottom: '14px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <div>
                                <p style={{ color: '#555', fontSize: '11px' }}>{recapLabel}</p>
                                <p style={{ color: '#444', fontSize: '12px', marginTop: '2px' }}>{recapConsumedLabel}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ color: '#555', fontSize: '11px' }}>
                                    {recapExceeded ? '⚠️ Dépassement' : 'Restant après repas'}
                                </p>
                                <p style={{ color: recapExceeded ? '#ff5555' : '#fff', fontWeight: '500', fontSize: '18px' }}>
                                    {recapExceeded
                                        ? `+${Math.abs(Math.round(recapRemainingAfter))} kcal`
                                        : `${Math.round(recapRemainingAfter)} kcal`}
                                </p>
                            </div>
                        </div>

                        {/* Macros */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                            {[
                                { label: 'Protéines', value: totals.protein_g },
                                { label: 'Glucides', value: totals.carbs_g },
                                { label: 'Lipides', value: totals.fat_g },
                            ].map(m => (
                                <div key={m.label} style={{ background: '#0a0a0a', borderRadius: '12px', padding: '12px 10px', textAlign: 'center' }}>
                                    <p style={{ color: '#fff', fontSize: '20px', fontWeight: '500' }}>{Math.round(m.value * 10) / 10}g</p>
                                    <p style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{m.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Coach */}
                        <button onClick={loadCoachMessage} style={{
                            width: '100%', padding: '12px', borderRadius: '12px',
                            background: showCoach ? '#161616' : 'transparent',
                            border: '0.5px solid #333', color: '#888',
                            fontWeight: '500', fontSize: '13px', cursor: 'pointer',
                            marginBottom: '12px', textAlign: 'left'
                        }}>
                            {showCoach ? '🤖 Conseil du coach' : '💡 Voir le conseil du coach →'}
                        </button>

                        {showCoach && (
                            <div style={{ background: '#0a0a0a', borderRadius: '12px', padding: '14px', marginBottom: '14px', border: '0.5px solid #2a2a2a' }}>
                                {isLoadingCoach
                                    ? <p style={{ color: '#555', fontSize: '13px' }}>⏳ Analyse en cours...</p>
                                    : <p style={{ color: '#aaa', fontSize: '13px', lineHeight: '1.6' }}>{coachMessage}</p>
                                }
                            </div>
                        )}

                        {/* Boutons */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setShowRecap(false)} style={{
                                flex: 1, padding: '14px', borderRadius: '12px',
                                background: '#1a1a1a', border: '0.5px solid #333',
                                color: '#fff', fontWeight: '500', fontSize: '14px', cursor: 'pointer'
                            }}>← Modifier</button>
                            <button onClick={handleSaveMeal} disabled={isSaving} style={{
                                flex: 2, padding: '14px', borderRadius: '12px',
                                background: '#fff', color: '#000', border: 'none',
                                fontWeight: '500', fontSize: '14px', cursor: 'pointer',
                                opacity: isSaving ? 0.7 : 1
                            }}>
                                {isSaving ? 'Ajout...' : '✅ Ajouter au journal'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}