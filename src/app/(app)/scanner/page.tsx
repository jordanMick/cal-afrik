'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore, getMealSlot, SLOT_LABELS, MealSlotKey } from '@/store/useAppStore'
import { supabase } from '@/lib/supabase'
import type { ScanResultItem, EnrichedSuggestion } from '@/types'

// UI Components
import { Button } from '@/components/ui/Button'
import { ScannerHeader } from '@/components/scanner/ScannerHeader'
import { ImageUpload } from '@/components/scanner/ImageUpload'
import { AnalysisResults } from '@/components/scanner/AnalysisResults'
import { ManualFoodForm } from '@/components/scanner/ManualFoodForm'
import { MealRecap } from '@/components/scanner/MealRecap'

interface ManualFood {
    name_fr: string; portion_g: number; calories: number
    protein_g: number; carbs_g: number; fat_g: number; category: string
}

const LAST_SLOT: MealSlotKey = 'diner'

const SLOT_COLORS: Record<MealSlotKey, string> = {
    petit_dejeuner: '#f59e0b',
    dejeuner: '#10b981',
    collation: '#ec4899',
    diner: '#6366f1',
}

export default function ScannerPage() {
    const router = useRouter()
    const { addMeal, profile, slots, setLastCoachMessage } = useAppStore()

    // States
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
    const [manualFood, setManualFood] = useState<ManualFood>({ name_fr: '', portion_g: 200, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, category: 'plats_composes' })

    // Data derived
    const currentHour = new Date().getHours()
    const currentSlotKey = getMealSlot(currentHour)
    const currentSlot = slots[currentSlotKey]
    const slotLabel = SLOT_LABELS[currentSlotKey]
    const isLastSlot = currentSlotKey === LAST_SLOT
    const slotColor = SLOT_COLORS[currentSlotKey] ?? '#6366f1'

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

    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result!.toString().split(',')[1])
        reader.onerror = reject
    })

    const processImage = async (file: File) => {
        setIsAnalyzing(true)
        setSelectedFoods([]); setSuggestions([]); setMealName('')
        setTotalCaloriesAI(0); setShowManualForm(false); setShowRecap(false); setCoachMessage(''); setShowCoach(false)
        try {
            setImage(URL.createObjectURL(file))
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
                        fromAI: false 
                    }))
                }
                return [{ 
                    id: `ai-${item.detected ?? Date.now()}`, 
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
                    fromAI: true 
                }]
            })
            setSuggestions(enriched)
            if (json.data[0]) { 
                const first = json.data[0] as ScanResultItem
                setManualFood({ name_fr: json.meal_name || first.detected, portion_g: first.portion_g, calories: first.calories_detected, protein_g: first.protein_detected, carbs_g: first.carbs_detected, fat_g: first.fat_detected, category: 'plats_composes' }) 
            }
        } catch (err) { console.error(err); simulateAI() }
        finally { setIsAnalyzing(false) }
    }

    const simulateAI = () => {
        const filtered = foods.filter(food => ['riz', 'poulet', 'oeuf', 'thon', 'plantain'].some(kw => food.name_fr.toLowerCase().includes(kw)))
        setSuggestions((filtered.length > 0 ? filtered.slice(0, 5) : foods.slice(0, 5)).map(food => ({ 
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
            fromAI: false 
        })))
    }

    const toggleFoodSelection = (food: EnrichedSuggestion) => {
        setSelectedFoods(prev => prev.find(f => f.id === food.id) ? prev.filter(f => f.id !== food.id) : [...prev, food])
    }

    const getTotals = () => selectedFoods.reduce((acc, food) => ({ 
        calories: acc.calories + food.calories, 
        protein_g: acc.protein_g + food.protein_g, 
        carbs_g: acc.carbs_g + food.carbs_g, 
        fat_g: acc.fat_g + food.fat_g, 
        portion_g: acc.portion_g + food.portion_g 
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, portion_g: 0 })

    const loadCoachMessage = async () => {
        if (coachMessage) { setShowCoach(true); return }
        setIsLoadingCoach(true); setShowCoach(true)
        try {
            const totals = getTotals()
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            const res = await fetch('/api/coach', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, 
                body: JSON.stringify({ 
                    selectedFoods: selectedFoods.map(f => f.name), 
                    totals: { calories: Math.round(totals.calories), protein_g: Math.round(totals.protein_g * 10) / 10, carbs_g: Math.round(totals.carbs_g * 10) / 10, fat_g: Math.round(totals.fat_g * 10) / 10 }, 
                    slotLabel, 
                    slotTarget: isLastSlot ? calorieTarget : currentSlot.target, 
                    slotConsumed: isLastSlot ? dailyConsumed : currentSlot.consumed, 
                    slotRemaining: isLastSlot ? dailyRemainingNow : currentSlot.remaining, 
                    calorieTarget 
                }) 
            })
            const json = await res.json()
            const msg = json.success ? json.message : 'Bon repas ! Continue comme ça 💪'
            setCoachMessage(msg); setLastCoachMessage(msg)
        } catch { setCoachMessage('Bon repas ! Continue à bien manger 💪') }
        finally { setIsLoadingCoach(false) }
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
            const json = await res.json()
            if (json.success && json.data) { 
                setSelectedFoods(prev => [...prev, { 
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
                    fromAI: false 
                }])
                setShowManualForm(false) 
            }
        } catch (err) { console.error(err) }
        finally { setIsSavingManual(false) }
    }

    const handleSaveMeal = async () => {
        if (selectedFoods.length === 0) return
        setIsSaving(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            
            const aiFoods = selectedFoods.filter(f => f.fromAI)
            if (aiFoods.length > 0) {
                await Promise.all(aiFoods.map(async (food) => {
                    const factor = food.portion_g > 0 ? 100 / food.portion_g : 1
                     await fetch('/api/foods', { 
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, 
                        body: JSON.stringify({ name_fr: food.name, category: 'plats_composes', calories_per_100g: Math.round(food.calories * factor), protein_per_100g: Math.round(food.protein_g * factor * 10) / 10, carbs_per_100g: Math.round(food.carbs_g * factor * 10) / 10, fat_per_100g: Math.round(food.fat_g * factor * 10) / 10, default_portion_g: food.portion_g, verified: false, origin_country: [] }) 
                    })
                }))
            }

            const totals = getTotals()
            const res = await fetch('/api/meals', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, 
                body: JSON.stringify({ 
                    custom_name: mealName || selectedFoods.map(f => f.name).join(', '), 
                    portion_g: Math.round(totals.portion_g), 
                    calories: Math.round(totals.calories), 
                    protein_g: Math.round(totals.protein_g * 10) / 10, 
                    carbs_g: Math.round(totals.carbs_g * 10) / 10, 
                    fat_g: Math.round(totals.fat_g * 10) / 10, 
                    image_url: capturedImage, 
                    ai_confidence: Math.round(selectedFoods.reduce((sum, f) => sum + f.confidence, 0) / selectedFoods.length), 
                    coach_message: coachMessage || null 
                }) 
            })
            const json = await res.json()
            if (json.success && json.data) addMeal(json.data)
            router.push('/journal')
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
    const recapRemainingAfter = isLastSlot ? dailyRemainingNow - totals.calories : currentSlot.target - currentSlot.consumed - totals.calories
    const recapExceeded = recapRemainingAfter < 0

    return (
        <div className="min-h-screen bg-zinc-950 pb-36 p-6 max-w-[480px] mx-auto relative overflow-hidden">
            {/* Halo décoratif subtil */}
            <div 
                className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] blur-[120px] rounded-full opacity-[0.08]" 
                style={{ backgroundColor: slotColor }} 
            />

            <ScannerHeader 
                slotLabel={slotLabel}
                slotColor={slotColor}
                displayedRemaining={displayedRemaining}
                displayedRemainingLabel={displayedRemainingLabel}
            />

            <ImageUpload 
                image={image}
                onImageChange={processImage}
                onClear={() => { setImage(null); setSuggestions([]); setSelectedFoods([]); setMealName('') }}
                isAnalyzing={isAnalyzing}
                slotColor={slotColor}
            />

            <div className="space-y-8">
                <AnalysisResults 
                    mealName={mealName}
                    totalCalories={totalCaloriesAI}
                    suggestions={suggestions}
                    selectedFoods={selectedFoods}
                    onSelect={toggleFoodSelection}
                    slotColor={slotColor}
                />

                {!isAnalyzing && image && (
                    <ManualFoodForm 
                        isOpen={showManualForm}
                        onToggle={() => setShowManualForm(!showManualForm)}
                        manualFood={manualFood}
                        setManualFood={setManualFood}
                        onSave={handleSaveManualFood}
                        isSaving={isSavingManual}
                        slotColor={slotColor}
                    />
                )}
            </div>

            {/* Bouton récapitulatif flottant */}
            {selectedFoods.length > 0 && (
                <div className="fixed bottom-24 left-0 right-0 max-w-[480px] mx-auto px-6 z-40">
                    <Button 
                        fullWidth 
                        onClick={() => setShowRecap(true)}
                        className="h-14 rounded-2xl shadow-2xl shadow-black/40"
                        style={{ backgroundColor: slotColor }}
                    >
                       📊 Voir le récapitulatif • {Math.round(totals.calories)} kcal
                    </Button>
                </div>
            )}

            <MealRecap 
                isOpen={showRecap}
                onClose={() => setShowRecap(false)}
                onSave={handleSaveMeal}
                isSaving={isSaving}
                selectedFoods={selectedFoods}
                totals={totals}
                slotLabel={slotLabel}
                slotColor={slotColor}
                recapRemainingAfter={recapRemainingAfter}
                recapExceeded={recapExceeded}
                coachMessage={coachMessage}
                isLoadingCoach={isLoadingCoach}
                onLoadCoach={loadCoachMessage}
                showCoach={showCoach}
            />
        </div>
    )
}