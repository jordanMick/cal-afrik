'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import type { ScanResultItem, FoodSuggestion } from '@/types'

// Suggestion enrichie avec la portion détectée par l'IA
interface EnrichedSuggestion extends FoodSuggestion {
    portion_g: number
    calories_detected: number
    protein_detected: number
    carbs_detected: number
    fat_detected: number
    confidence: number
    detected: string
    fromAI?: boolean // true si aucun match BD → suggestion vient directement de l'IA
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

export default function ScannerPage() {
    const router = useRouter()
    const { addMeal } = useAppStore()
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
    const [manualFood, setManualFood] = useState<ManualFood>({
        name_fr: '',
        portion_g: 200,
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        category: 'plats_composes',
    })

    useEffect(() => { loadFoods() }, [])

    const loadFoods = async () => {
        try {
            const res = await fetch('/api/foods')
            const json = await res.json()
            if (json.success) setFoods(json.data)
        } catch (err) {
            console.error(err)
        }
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
            reader.onload = () => resolve(reader.result!.toString().split(",")[1])
            reader.onerror = reject
        })

    const processImage = async (file: File) => {
        setIsAnalyzing(true)
        setSelectedFoods([])
        setSuggestions([])
        setMealName('')
        setTotalCaloriesAI(0)
        setShowManualForm(false)

        try {
            const previewUrl = URL.createObjectURL(file)
            setImage(previewUrl)

            const uploadedUrl = await uploadImage(file)
            setCapturedImage(uploadedUrl)

            const base64Image = await toBase64(file)
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) { simulateAI(); return }

            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    images: [{ data: base64Image, mimeType: file.type }]
                })
            })

            const json = await res.json()
            console.log("🧠 RAW AI RESPONSE:", json)

            if (!json.success || !json.data) { simulateAI(); return }

            setMealName(json.meal_name || 'Repas détecté')
            setTotalCaloriesAI(json.total_calories || 0)

            // ✅ Pour chaque composant :
            // - S'il a des suggestions BD → les afficher normalement
            // - S'il n'a aucun match BD → créer une suggestion "fromAI" avec les valeurs IA
            const enriched: EnrichedSuggestion[] = (json.data as ScanResultItem[])
                .flatMap((item): EnrichedSuggestion[] => {

                    const suggestions = item.suggestions ?? []

                    if (suggestions.length > 0) {
                        return suggestions.map((suggestion): EnrichedSuggestion => ({
                            ...suggestion,
                            portion_g: item.portion_g ?? 0,
                            calories_detected: item.calories_detected ?? 0,
                            protein_detected: item.protein_detected ?? 0,
                            carbs_detected: item.carbs_detected ?? 0,
                            fat_detected: item.fat_detected ?? 0,
                            confidence: item.confidence ?? 0,
                            detected: item.detected ?? "Inconnu",
                            fromAI: false,
                        }))
                    }

                    return [{
                        id: `ai-${item.detected ?? 'unknown'}`,
                        name: item.detected ?? "Aliment inconnu",
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
                        detected: item.detected ?? "Inconnu",
                        fromAI: true,
                    }]
                })

            console.log("✅ ENRICHED SUGGESTIONS:", enriched)
            setSuggestions(enriched)

            // Pré-remplir le formulaire manuel avec les valeurs IA
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
        const fitnessKeywords = ["riz", "poulet", "oeuf", "thon", "plantain"]
        const filtered = foods.filter(food =>
            fitnessKeywords.some(kw => food.name_fr.toLowerCase().includes(kw))
        )
        const simulated: EnrichedSuggestion[] = (filtered.length > 0 ? filtered.slice(0, 5) : foods.slice(0, 5))
            .map(food => ({
                id: food.id,
                name: food.name_fr,
                score: 50,
                calories: Math.round((food.calories_per_100g * (food.default_portion_g || 200)) / 100),
                protein_g: Math.round((food.protein_per_100g * (food.default_portion_g || 200)) / 100 * 10) / 10,
                carbs_g: Math.round((food.carbs_per_100g * (food.default_portion_g || 200)) / 100 * 10) / 10,
                fat_g: Math.round((food.fat_per_100g * (food.default_portion_g || 200)) / 100 * 10) / 10,
                portion_g: food.default_portion_g || 200,
                calories_detected: 0,
                protein_detected: 0,
                carbs_detected: 0,
                fat_detected: 0,
                confidence: 50,
                detected: food.name_fr,
                fromAI: false,
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
            prev.find(f => f.id === food.id)
                ? prev.filter(f => f.id !== food.id)
                : [...prev, food]
        )
    }

    const getTotals = () => {
        return selectedFoods.reduce((acc, food) => ({
            calories: acc.calories + food.calories,
            protein_g: acc.protein_g + food.protein_g,
            carbs_g: acc.carbs_g + food.carbs_g,
            fat_g: acc.fat_g + food.fat_g,
            portion_g: acc.portion_g + food.portion_g,
        }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, portion_g: 0 })
    }

    // ✅ Sauvegarder l'aliment manuel dans Supabase food_items puis l'ajouter au repas
    const handleSaveManualFood = async () => {
        if (!manualFood.name_fr || manualFood.calories <= 0) return
        setIsSavingManual(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // Convertir les valeurs de la portion vers pour 100g
            const factor = manualFood.portion_g > 0 ? 100 / manualFood.portion_g : 1

            const res = await fetch('/api/foods', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    name_fr: manualFood.name_fr,
                    category: manualFood.category,
                    calories_per_100g: Math.round(manualFood.calories * factor),
                    protein_per_100g: Math.round(manualFood.protein_g * factor * 10) / 10,
                    carbs_per_100g: Math.round(manualFood.carbs_g * factor * 10) / 10,
                    fat_per_100g: Math.round(manualFood.fat_g * factor * 10) / 10,
                    default_portion_g: manualFood.portion_g,
                    verified: false,
                    origin_country: [],
                })
            })

            const json = await res.json()
            console.log("✅ FOOD SAVED TO DB:", json)

            if (json.success && json.data) {
                const newFood: EnrichedSuggestion = {
                    id: json.data.id,
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
                    fromAI: false,
                }
                setSelectedFoods(prev => [...prev, newFood])
                setShowManualForm(false)
            }

        } catch (err) {
            console.error(err)
        } finally {
            setIsSavingManual(false)
        }
    }

    // ✅ Sauvegarder un aliment IA dans food_items
    const saveAIFoodToDB = async (food: EnrichedSuggestion, session: any) => {
        const factor = food.portion_g > 0 ? 100 / food.portion_g : 1

        try {
            const res = await fetch('/api/foods', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    name_fr: food.name,
                    category: 'plats_composes',
                    calories_per_100g: Math.round(food.calories * factor),
                    protein_per_100g: Math.round(food.protein_g * factor * 10) / 10,
                    carbs_per_100g: Math.round(food.carbs_g * factor * 10) / 10,
                    fat_per_100g: Math.round(food.fat_g * factor * 10) / 10,
                    default_portion_g: food.portion_g,
                    verified: false,
                    origin_country: [],
                })
            })
            const json = await res.json()
            console.log(`✅ FOOD SAVED TO DB: ${food.name}`, json)
        } catch (err) {
            // On ne bloque pas le repas si la sauvegarde BD échoue
            console.error(`❌ Impossible de sauvegarder ${food.name} en BD:`, err)
        }
    }

    const handleSaveMeal = async () => {
        if (selectedFoods.length === 0) return
        setIsSaving(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // ✅ Sauvegarder en BD tous les aliments fromAI sélectionnés
            const aiFoods = selectedFoods.filter(f => f.fromAI)
            if (aiFoods.length > 0) {
                console.log(`📥 Sauvegarde de ${aiFoods.length} aliment(s) IA en BD...`)
                await Promise.all(aiFoods.map(food => saveAIFoodToDB(food, session)))
            }

            const totals = getTotals()
            const finalMealName = mealName || selectedFoods.map(f => f.name).join(', ')

            const res = await fetch('/api/meals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    custom_name: finalMealName,
                    portion_g: Math.round(totals.portion_g),
                    calories: Math.round(totals.calories),
                    protein_g: Math.round(totals.protein_g * 10) / 10,
                    carbs_g: Math.round(totals.carbs_g * 10) / 10,
                    fat_g: Math.round(totals.fat_g * 10) / 10,
                    image_url: capturedImage,
                    ai_confidence: Math.round(
                        selectedFoods.reduce((sum, f) => sum + f.confidence, 0) / selectedFoods.length
                    )
                }),
            })

            const json = await res.json()
            console.log("✅ MEAL SAVED:", json)
            router.push('/journal')

        } catch (err) {
            console.error(err)
        } finally {
            setIsSaving(false)
        }
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

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        borderRadius: '8px',
        background: '#0F0A06',
        border: '1px solid #333',
        color: '#fff',
        fontSize: '14px',
        boxSizing: 'border-box',
    }

    const labelStyle: React.CSSProperties = {
        color: '#aaa',
        fontSize: '12px',
        marginBottom: '4px',
        display: 'block',
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0F0A06',
            maxWidth: '480px',
            margin: '0 auto',
            padding: '24px',
            paddingBottom: '140px'
        }}>
            <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', marginBottom: '20px' }}>
                Scanner
            </h1>

            {/* ─── IMAGE ─── */}
            {!image ? (
                <>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            height: '180px',
                            borderRadius: '16px',
                            background: '#1A1108',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#aaa',
                            cursor: 'pointer'
                        }}
                    >
                        📷 Ajouter une photo
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageCapture}
                        style={{ display: 'none' }}
                    />
                </>
            ) : (
                <div style={{ position: 'relative' }}>
                    <img src={image} style={{ width: '100%', borderRadius: '16px' }} />
                    <button
                        onClick={() => {
                            setImage(null)
                            setSuggestions([])
                            setSelectedFoods([])
                            setMealName('')
                            setShowManualForm(false)
                        }}
                        style={{
                            position: 'absolute', top: '8px', right: '8px',
                            background: 'rgba(0,0,0,0.6)', border: 'none',
                            borderRadius: '50%', width: '32px', height: '32px',
                            color: '#fff', cursor: 'pointer', fontSize: '16px'
                        }}
                    >✕</button>
                </div>
            )}

            {/* ─── ANALYSE EN COURS ─── */}
            {isAnalyzing && (
                <p style={{ color: '#aaa', marginTop: '15px', textAlign: 'center' }}>
                    🔍 Analyse en cours...
                </p>
            )}

            {/* ─── NOM DU REPAS ─── */}
            {mealName && !isAnalyzing && (
                <div style={{ marginTop: '16px' }}>
                    <p style={{ color: '#C4622D', fontWeight: '700', fontSize: '16px' }}>
                        🍽️ {mealName}
                    </p>
                    {totalCaloriesAI > 0 && (
                        <p style={{ color: '#777', fontSize: '13px' }}>
                            Estimation IA : ~{totalCaloriesAI} kcal au total
                        </p>
                    )}
                </div>
            )}

            {/* ─── SUGGESTIONS ─── */}
            {suggestions.length > 0 && !isAnalyzing && (
                <div style={{ marginTop: '20px' }}>
                    <p style={{ color: '#777', marginBottom: '10px' }}>
                        Sélectionne les aliments présents
                    </p>

                    {suggestions.map((food) => {
                        const isSelected = !!selectedFoods.find(f => f.id === food.id)
                        return (
                            <div
                                key={`${food.id}-${food.detected}`}
                                onClick={() => selectFood(food)}
                                style={{
                                    padding: '14px',
                                    borderRadius: '12px',
                                    marginBottom: '10px',
                                    background: isSelected ? '#C4622D' : '#1A1108',
                                    cursor: 'pointer',
                                    border: isSelected ? '2px solid #E07040' : '2px solid transparent'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <p style={{ color: '#fff', fontWeight: '600', margin: 0 }}>
                                        {food.name || "Plat inconnu"}
                                    </p>
                                    {food.fromAI && (
                                        <span style={{
                                            background: '#2A1F00', color: '#F5A623',
                                            fontSize: '10px', fontWeight: '700',
                                            padding: '2px 8px', borderRadius: '20px',
                                            border: '1px solid #F5A623'
                                        }}>
                                            Suggestion IA
                                        </span>
                                    )}
                                </div>

                                {food.fromAI && (
                                    <p style={{ color: '#F5A623', fontSize: '11px', marginTop: '4px' }}>
                                        ⚠️ Non trouvé dans la base — valeurs estimées par l'IA
                                    </p>
                                )}

                                <p style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>
                                    ⚖️ Portion : {food.portion_g}g
                                </p>
                                <p style={{ color: isSelected ? '#fff' : '#C4622D', fontSize: '13px', fontWeight: '600', marginTop: '4px' }}>
                                    🔥 {food.calories} kcal · {food.protein_g}g prot · {food.carbs_g}g glucides · {food.fat_g}g lip
                                </p>
                                {!food.fromAI && (
                                    <p style={{ color: '#555', fontSize: '11px' }}>
                                        Score match : {food.score} · Confiance IA : {food.confidence}%
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ─── BOUTON AJOUT MANUEL ─── */}
            {!isAnalyzing && image && (
                <button
                    onClick={() => setShowManualForm(!showManualForm)}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '12px',
                        background: 'transparent',
                        border: '1px solid #333',
                        color: '#aaa',
                        cursor: 'pointer',
                        marginTop: '12px',
                        fontSize: '14px'
                    }}
                >
                    {showManualForm ? '✕ Fermer le formulaire' : '✏️ Ajouter manuellement'}
                </button>
            )}

            {/* ─── FORMULAIRE AJOUT MANUEL ─── */}
            {showManualForm && (
                <div style={{
                    marginTop: '16px',
                    padding: '20px',
                    borderRadius: '16px',
                    background: '#1A1108',
                    border: '1px solid #333'
                }}>
                    <p style={{ color: '#fff', fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>
                        ✏️ Ajouter un aliment
                    </p>
                    <p style={{ color: '#777', fontSize: '12px', marginBottom: '16px' }}>
                        Valeurs pré-remplies par l'IA — corrige si nécessaire.
                    </p>

                    {/* Nom */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={labelStyle}>Nom de l'aliment *</label>
                        <input
                            style={inputStyle}
                            value={manualFood.name_fr}
                            onChange={e => setManualFood(p => ({ ...p, name_fr: e.target.value }))}
                            placeholder="ex: Rôti de porc"
                        />
                    </div>

                    {/* Catégorie */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={labelStyle}>Catégorie *</label>
                        <select
                            style={inputStyle}
                            value={manualFood.category}
                            onChange={e => setManualFood(p => ({ ...p, category: e.target.value }))}
                        >
                            {CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Portion */}
                    <div style={{ marginBottom: '4px' }}>
                        <label style={labelStyle}>Portion (g) *</label>
                        <input
                            style={inputStyle}
                            type="number"
                            value={manualFood.portion_g}
                            onChange={e => setManualFood(p => ({ ...p, portion_g: Number(e.target.value) }))}
                            placeholder="200"
                        />
                    </div>
                    <p style={{ color: '#555', fontSize: '11px', marginBottom: '12px' }}>
                        Les macros ci-dessous sont pour cette portion ({manualFood.portion_g}g)
                    </p>

                    {/* Calories */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={labelStyle}>Calories (kcal) *</label>
                        <input
                            style={inputStyle}
                            type="number"
                            value={manualFood.calories}
                            onChange={e => setManualFood(p => ({ ...p, calories: Number(e.target.value) }))}
                            placeholder="0"
                        />
                    </div>

                    {/* Macros */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>Protéines (g)</label>
                            <input
                                style={inputStyle}
                                type="number"
                                value={manualFood.protein_g}
                                onChange={e => setManualFood(p => ({ ...p, protein_g: Number(e.target.value) }))}
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Glucides (g)</label>
                            <input
                                style={inputStyle}
                                type="number"
                                value={manualFood.carbs_g}
                                onChange={e => setManualFood(p => ({ ...p, carbs_g: Number(e.target.value) }))}
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Lipides (g)</label>
                            <input
                                style={inputStyle}
                                type="number"
                                value={manualFood.fat_g}
                                onChange={e => setManualFood(p => ({ ...p, fat_g: Number(e.target.value) }))}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSaveManualFood}
                        disabled={isSavingManual || !manualFood.name_fr || manualFood.calories <= 0}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '10px',
                            background: (!manualFood.name_fr || manualFood.calories <= 0) ? '#333' : '#C4622D',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 'bold',
                            cursor: (!manualFood.name_fr || manualFood.calories <= 0) ? 'not-allowed' : 'pointer',
                            opacity: isSavingManual ? 0.7 : 1,
                            fontSize: '14px'
                        }}
                    >
                        {isSavingManual ? "Sauvegarde..." : "✅ Sauvegarder et ajouter au repas"}
                    </button>
                </div>
            )}

            {/* ─── RÉCAP SÉLECTION ─── */}
            {selectedFoods.length > 0 && (
                <div style={{
                    marginTop: '20px',
                    padding: '16px',
                    borderRadius: '12px',
                    background: '#1A1108',
                    border: '1px solid #C4622D'
                }}>
                    <p style={{ color: '#fff', fontWeight: '700', marginBottom: '8px' }}>
                        Récap · {selectedFoods.length} aliment{selectedFoods.length > 1 ? 's' : ''}
                    </p>
                    <p style={{ color: '#aaa', fontSize: '13px' }}>🔥 {Math.round(totals.calories)} kcal</p>
                    <p style={{ color: '#aaa', fontSize: '13px' }}>💪 {Math.round(totals.protein_g * 10) / 10}g protéines</p>
                    <p style={{ color: '#aaa', fontSize: '13px' }}>🌾 {Math.round(totals.carbs_g * 10) / 10}g glucides</p>
                    <p style={{ color: '#aaa', fontSize: '13px' }}>🫒 {Math.round(totals.fat_g * 10) / 10}g lipides</p>
                </div>
            )}

            {/* ─── BOUTON SAUVEGARDER ─── */}
            {selectedFoods.length > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: '70px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                    maxWidth: '480px',
                    padding: '0 24px'
                }}>
                    <button
                        onClick={handleSaveMeal}
                        disabled={isSaving}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '12px',
                            background: '#C4622D',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            opacity: isSaving ? 0.7 : 1,
                            cursor: isSaving ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isSaving ? "Ajout..." : `Ajouter ${selectedFoods.length} aliment${selectedFoods.length > 1 ? 's' : ''} · ${Math.round(totals.calories)} kcal`}
                    </button>
                </div>
            )}
        </div>
    )
}