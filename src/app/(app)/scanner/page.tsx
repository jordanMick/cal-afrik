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
}

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

    useEffect(() => {
        loadFoods()
    }, [])

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

        try {
            const previewUrl = URL.createObjectURL(file)
            setImage(previewUrl)

            const uploadedUrl = await uploadImage(file)
            setCapturedImage(uploadedUrl)

            const base64Image = await toBase64(file)

            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                simulateAI()
                return
            }

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

            if (!json.success || !json.data) {
                simulateAI()
                return
            }

            // ✅ Stocker le nom du repas et total calories IA
            setMealName(json.meal_name || 'Repas détecté')
            setTotalCaloriesAI(json.total_calories || 0)

            // ✅ Transformer chaque composant : prendre la meilleure suggestion (score le plus haut)
            // et l'enrichir avec les valeurs de portion de l'IA
            const enriched: EnrichedSuggestion[] = (json.data as ScanResultItem[]).flatMap(item => {
                return (item.suggestions || []).map(suggestion => ({
                    ...suggestion,
                    portion_g: item.portion_g,
                    calories_detected: item.calories_detected,
                    protein_detected: item.protein_detected,
                    carbs_detected: item.carbs_detected,
                    fat_detected: item.fat_detected,
                    confidence: item.confidence,
                    detected: item.detected,
                }))
            })

            console.log("✅ ENRICHED SUGGESTIONS:", enriched)
            setSuggestions(enriched)

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
            fitnessKeywords.some(keyword =>
                food.name_fr.toLowerCase().includes(keyword)
            )
        )
        // Simuler le format enrichi
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
                calories_detected: Math.round((food.calories_per_100g * (food.default_portion_g || 200)) / 100),
                protein_detected: Math.round((food.protein_per_100g * (food.default_portion_g || 200)) / 100 * 10) / 10,
                carbs_detected: Math.round((food.carbs_per_100g * (food.default_portion_g || 200)) / 100 * 10) / 10,
                fat_detected: Math.round((food.fat_per_100g * (food.default_portion_g || 200)) / 100 * 10) / 10,
                confidence: 50,
                detected: food.name_fr,
            }))
        setSuggestions(simulated)
    }

    const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        await processImage(file)
    }

    // ✅ Toggle sélection
    const selectFood = (food: EnrichedSuggestion) => {
        setSelectedFoods(prev =>
            prev.find(f => f.id === food.id)
                ? prev.filter(f => f.id !== food.id)
                : [...prev, food]
        )
    }

    // ✅ Calcul des totaux depuis les portions détectées par l'IA
    const getTotals = () => {
        return selectedFoods.reduce((acc, food) => ({
            calories: acc.calories + food.calories,
            protein_g: acc.protein_g + food.protein_g,
            carbs_g: acc.carbs_g + food.carbs_g,
            fat_g: acc.fat_g + food.fat_g,
            portion_g: acc.portion_g + food.portion_g,
        }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, portion_g: 0 })
    }

    const handleSaveMeal = async () => {
        if (selectedFoods.length === 0) return
        setIsSaving(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const totals = getTotals()

            // Nom du repas = nom du repas IA ou noms des aliments sélectionnés
            const finalMealName = mealName || selectedFoods.map(f => f.name).join(', ')

            console.log("🚀 SAVING MEAL:", { finalMealName, totals })

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

        const { error } = await supabase.storage
            .from('meal-images')
            .upload(fileName, file)

        if (error) return null

        const { data } = supabase.storage
            .from('meal-images')
            .getPublicUrl(fileName)

        return data.publicUrl
    }

    const totals = getTotals()

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0F0A06',
            maxWidth: '480px',
            margin: '0 auto',
            padding: '24px',
            paddingBottom: '120px'
        }}>
            <h1 style={{
                color: '#fff',
                fontSize: '28px',
                fontWeight: '800',
                marginBottom: '20px'
            }}>
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
                <img src={image} style={{ width: '100%', borderRadius: '16px' }} />
            )}

            {/* ─── ANALYSE EN COURS ─── */}
            {isAnalyzing && (
                <p style={{ color: '#aaa', marginTop: '15px' }}>
                    Analyse en cours...
                </p>
            )}

            {/* ─── NOM DU REPAS DÉTECTÉ ─── */}
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
            {suggestions.length > 0 && (
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
                                <p style={{ color: '#fff', fontWeight: '600' }}>
                                    {food.name || "Plat inconnu"}
                                </p>
                                <p style={{ color: '#aaa', fontSize: '12px' }}>
                                    📍 Détecté comme : {food.detected}
                                </p>
                                <p style={{ color: '#aaa', fontSize: '12px' }}>
                                    ⚖️ Portion : {food.portion_g}g
                                </p>
                                <p style={{ color: isSelected ? '#fff' : '#C4622D', fontSize: '13px', fontWeight: '600', marginTop: '4px' }}>
                                    🔥 {food.calories} kcal · {food.protein_g}g prot · {food.carbs_g}g glucides · {food.fat_g}g lip
                                </p>
                                <p style={{ color: '#555', fontSize: '11px' }}>
                                    Score match : {food.score} · Confiance IA : {food.confidence}%
                                </p>
                            </div>
                        )
                    })}
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
                        Récap sélection
                    </p>
                    <p style={{ color: '#aaa', fontSize: '13px' }}>
                        🔥 {Math.round(totals.calories)} kcal
                    </p>
                    <p style={{ color: '#aaa', fontSize: '13px' }}>
                        💪 {Math.round(totals.protein_g * 10) / 10}g protéines
                    </p>
                    <p style={{ color: '#aaa', fontSize: '13px' }}>
                        🌾 {Math.round(totals.carbs_g * 10) / 10}g glucides
                    </p>
                    <p style={{ color: '#aaa', fontSize: '13px' }}>
                        🫒 {Math.round(totals.fat_g * 10) / 10}g lipides
                    </p>
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