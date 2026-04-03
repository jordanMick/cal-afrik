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
    const [selectedItems, setSelectedItems] = useState<any[]>([]) // 🔥 MULTI
    const [isSaving, setIsSaving] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [suggestions, setSuggestions] = useState<any[]>([]) // 🔥 NOW = ARRAY OF ITEMS
    const [capturedImage, setCapturedImage] = useState<string | null>(null)

    useEffect(() => {
        loadFoods()
    }, [])

    const loadFoods = async () => {
        const res = await fetch('/api/foods')
        const json = await res.json()
        if (json.success) setFoods(json.data)
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
            if (!session) return

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

            if (!json.success || !json.data) {
                simulateAI()
                return
            }

            setSuggestions(json.data) // 🔥 IMPORTANT

        } catch (err) {
            console.error(err)
            simulateAI()
        } finally {
            setIsAnalyzing(false)
        }
    }

    // 🔥 TOGGLE MULTI
    const toggleItem = (item: any, food: any) => {
        const key = item.detected + food.id

        setSelectedItems(prev =>
            prev.find(i => i.key === key)
                ? prev.filter(i => i.key !== key)
                : [...prev, { ...item, food, key }]
        )
    }

    const handleSaveMeal = async () => {
        if (selectedItems.length === 0) return

        setIsSaving(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            for (const item of selectedItems) {
                await fetch('/api/meals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        food_item_id: item.food.id,
                        custom_name: item.food.name_fr,
                        meal_type: 'dejeuner',
                        portion_g: item.portion_g,
                        calories: item.food.calories_per_100g,
                        protein_g: item.food.protein_per_100g,
                        carbs_g: item.food.carbs_per_100g,
                        fat_g: item.food.fat_per_100g,
                        image_url: capturedImage,
                        ai_confidence: item.food.score || 100
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

    const simulateAI = () => {
        setSuggestions([])
    }

    const uploadImage = async (file: File) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`

        await supabase.storage.from('meal-images').upload(fileName, file)

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

            <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '800' }}>
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
                        onChange={(e) => e.target.files && processImage(e.target.files[0])}
                        style={{ display: 'none' }}
                    />
                </>
            ) : (
                <img src={image} style={{ width: '100%', borderRadius: '16px' }} />
            )}

            {suggestions.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    {suggestions.map((item, index) => (
                        <div key={index} style={{ marginBottom: '20px' }}>

                            <p style={{ color: '#aaa' }}>
                                👉 {item.detected}
                            </p>

                            {item.suggestions.map((food: any) => {
                                const isSelected = selectedItems.find(i => i.key === item.detected + food.id)

                                return (
                                    <div
                                        key={food.id}
                                        onClick={() => toggleItem(item, food)}
                                        style={{
                                            padding: '14px',
                                            borderRadius: '12px',
                                            marginBottom: '8px',
                                            background: isSelected ? '#C4622D' : '#1A1108',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <p style={{ color: '#fff' }}>
                                            {food.name}
                                        </p>
                                        <p style={{ color: '#aaa', fontSize: '12px' }}>
                                            Score: {food.score}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            )}

            {selectedItems.length > 0 && (
                <button
                    onClick={handleSaveMeal}
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        width: '90%',
                        left: '5%',
                        padding: '14px',
                        background: '#C4622D',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '12px'
                    }}
                >
                    Ajouter ({selectedItems.length})
                </button>
            )}
        </div>
    )
}