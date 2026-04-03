'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'

export default function ScannerPage() {
    const router = useRouter()
    const { addMeal } = useAppStore()

    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [image, setImage] = useState<string | null>(null)
    const [foods, setFoods] = useState<any[]>([])
    const [selectedFoods, setSelectedFoods] = useState<any[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [capturedImage, setCapturedImage] = useState<string | null>(null)

    useEffect(() => {
        loadFoods()
    }, [])

    const loadFoods = async () => {
        try {
            const res = await fetch('/api/foods')
            const json = await res.json()

            if (json.success) {
                setFoods(json.data)
            }
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
                    images: [
                        {
                            data: base64Image,
                            mimeType: file.type
                        }
                    ]
                })
            })

            const json = await res.json()

            // 🔥 DEBUG COMPLET
            console.log("🧠 RAW AI DATA:", json.data)

            if (json.data) {
                console.table(
                    json.data.map((i: any) => ({
                        detected: i.detected,
                        portion: i.portion_g,
                        suggestions: i.suggestions?.length || 0
                    }))
                )
            }

            if (!json.success || !json.data) {
                simulateAI()
                return
            }

            // 🔥 FLATTEN (IMPORTANT POUR TOI)
            const flatFoods = json.data.flatMap((item: any) => item.suggestions || [])

            console.log("🔥 FLATTEN FOODS:", flatFoods)

            setSuggestions(flatFoods)

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

        setSuggestions(filtered.length > 0 ? filtered.slice(0, 5) : foods.slice(0, 5))
    }

    const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        await processImage(file)
    }

    // ✅ MULTI
    const selectFood = (food: any) => {
        setSelectedFoods(prev =>
            prev.find(f => f.id === food.id)
                ? prev.filter(f => f.id !== food.id)
                : [...prev, food]
        )
    }

    function buildMealName(selectedFoods: any[]) {

        if (selectedFoods.length === 0) return "Repas"

        const base = selectedFoods.find(f =>
            f.category?.toLowerCase().includes("glucide")
        )

        const baseName = base?.name || base?.name_fr

        const others = selectedFoods.filter(f => f !== base)
        const otherNames = others.map(f => f.name || f.name_fr)

        if (!baseName) {
            return selectedFoods.map(f => f.name || f.name_fr).join(", ")
        }

        if (otherNames.length === 0) return baseName

        return `${baseName} avec ${otherNames.join(", ")}`
    }

    const handleSaveMeal = async () => {
        const mealName = buildMealName(selectedFoods)
        console.log("🚀 SENDING MEAL:", selectedFoods)
        if (selectedFoods.length === 0) return

        setIsSaving(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            for (const food of selectedFoods) {
                console.log("📡 CALLING API /api/meals")
                await fetch('/api/meals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        food_item_id: food.id,
                        custom_name: mealName,
                        portion_g: food.default_portion_g || 200,
                        calories: food.calories_per_100g,
                        protein_g: food.protein_per_100g,
                        carbs_g: food.carbs_per_100g,
                        fat_g: food.fat_per_100g,
                        image_url: capturedImage,
                        ai_confidence: food.score || 100
                    }),
                })
            }

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

            {isAnalyzing && (
                <p style={{ color: '#aaa', marginTop: '15px' }}>
                    Analyse en cours...
                </p>
            )}

            {suggestions.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <p style={{ color: '#777', marginBottom: '10px' }}>
                        Suggestions
                    </p>

                    {suggestions.map((food) => (
                        <div
                            key={food.id}
                            onClick={() => selectFood(food)}
                            style={{
                                padding: '14px',
                                borderRadius: '12px',
                                marginBottom: '10px',
                                background: selectedFoods.find(f => f.id === food.id) ? '#C4622D' : '#1A1108',
                                cursor: 'pointer'
                            }}
                        >
                            <p style={{ color: '#fff', fontWeight: '600' }}>
                                {food.name || food.name_fr || "Plat inconnu"}
                            </p>

                            <p style={{ color: '#aaa', fontSize: '12px' }}>
                                🔥 Score: {food.score ?? 0}
                            </p>

                            <p style={{ color: '#aaa', fontSize: '12px' }}>
                                {food.calories_per_100g ?? 0} kcal / 100g
                            </p>
                        </div>
                    ))}
                </div>
            )}

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
                            opacity: isSaving ? 0.7 : 1
                        }}
                    >
                        {isSaving ? "Ajout..." : `Ajouter (${selectedFoods.length})`}
                    </button>
                </div>
            )}
        </div>
    )
}