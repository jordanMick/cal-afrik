'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Info, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
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
    name_standard: string; portion_g: number; calories: number
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

const ACCENT_COLOR = 'var(--accent)'
const GRADIENT = 'linear-gradient(90deg, var(--accent), #10b981)'



export default function ScannerPage() {
    const router = useRouter()
    const {
        addMeal,
        profile,
        slots,
        dailyCalories,
        setLastCoachMessage,
        pendingScannerPrefill,
        setPendingScannerPrefill,
        refreshProfile,
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
    const [totalCaloriesCoach, setTotalCaloriesCoach] = useState(0)
    const [showManualForm, setShowManualForm] = useState(false)
    const [isSavingManual, setIsSavingManual] = useState(false)
    const [showRecap, setShowRecap] = useState(false)
    const [showCoach, setShowCoach] = useState(false)
    const [coachMessage, setCoachMessage] = useState('')
    const [isLoadingCoach, setIsLoadingCoach] = useState(false)
    const [scanMode, setScanMode] = useState<'ai' | 'barcode'>('ai')
    const [isScanningBarcode, setIsScanningBarcode] = useState(false)
    const [manualFood, setManualFood] = useState<ManualFood>({ name_standard: '', portion_g: 200, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, category: 'plats_composes' })

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
                    // Si l'item a déjà ses infos (injectées par Coach Yao), on les utilise directement
                    if (item.calories !== undefined) {
                        enrichedItems.push({
                            id: item.id || `coach-${Date.now()}-${item.name}`,
                            name: item.display_name || item.name,
                            score: 100,
                            calories: item.calories,
                            protein_g: item.protein_g || 0,
                            carbs_g: item.carbs_g || 0,
                            fat_g: item.fat_g || 0,
                            portion_g: item.portion_g || item.volume_ml || 200,
                            calories_detected: item.calories,
                            protein_detected: item.protein_g || 0,
                            carbs_detected: item.carbs_g || 0,
                            fat_detected: item.fat_g || 0,
                            confidence: 100,
                            detected: item.display_name || item.name,
                            fromCoach: true,
                        })
                        totalCals += item.calories
                        continue
                    }

                    // Sinon, on fait le fetch classique
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
                    setIsSuggestionsExpanded(true)
                    setTotalCaloriesCoach(totalCals)
                    setShowRecap(true)
                    setShowCoach(false) // Pas besoin de l'avis Coach, le menu vient du planning
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
                const fullName = (f.display_name || f.name_standard || "").toLowerCase()
                // On extrait le nom court sans les parenthèses (ex: "Molou Zogbon (Bouillie de riz)" -> "molou zogbon")
                const shortName = fullName.replace(/\s*\(.*?\)/g, "").trim()

                return fullName && (
                    cleanedLower.includes(fullName) ||
                    (shortName.length > 3 && cleanedLower.includes(shortName))
                )
            })

            if (detectedInDB.length > 0) {
                detectedInDB.forEach(f => {
                    const nameEscaped = (f.display_name || f.name_standard || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
            fromCoach: true
        }

        setCoachMessage(`Menu suggéré par Yao : ${displayLabel}`)
        setMealName(displayLabel)
        setSelectedFoods([virtualFood])
        setTotalCaloriesCoach(Math.round(totalCals))
        setShowRecap(true)
        setShowCoach(false)
    }

    const currentHour = new Date().getHours()
    const currentSlotKey = getMealSlot(currentHour)
    const currentSlot = slots[currentSlotKey]
    const slotLabel = SLOT_LABELS[currentSlotKey]
    const isLastSlot = currentSlotKey === LAST_SLOT
    const slotColor = ACCENT_COLOR
    const effectiveTier = getEffectiveTier(profile)




    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' }
    const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px', display: 'block', fontWeight: '500' }

    const [scanStep, setScanStep] = useState(0)
    const [isSuggestionsExpanded, setIsSuggestionsExpanded] = useState(false)
    const scanSteps = [
        "Identification des aliments...",
        "Estimation des portions...",
        "Analyse nutritionnelle...",
        "Finalisation Yao..."
    ]

    useEffect(() => {
        let interval: any
        if (isAnalyzing) {
            setScanStep(0)
            interval = setInterval(() => {
                setScanStep(prev => (prev < scanSteps.length - 1 ? prev + 1 : prev))
            }, 1200)
        } else {
            setScanStep(0)
        }
        return () => clearInterval(interval)
    }, [isAnalyzing])

    useEffect(() => { loadFoods() }, [])




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

    const handlePayForScan = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            const res = await fetch('/api/payments/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ tier: 'scan' })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erreur inconnue');
            }

            window.location.href = data.url;
        } catch (error: any) {
            toast.error(`Erreur: ${error.message}`);
        }
    }

    const processImage = async (file: File) => {
        setIsAnalyzing(true)
        setSelectedFoods([]); setSuggestions([]); setMealName('')
        setTotalCaloriesCoach(0); setShowManualForm(false); setShowRecap(false); setCoachMessage('')
        try {
            // Compression prioritaire
            const compressedFile = await compressImage(file)
            setImage(URL.createObjectURL(compressedFile))
            const uploadedUrl = await uploadImage(compressedFile)
            setCapturedImage(uploadedUrl)
            const base64Image = await toBase64(compressedFile)
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                toast.error("Session expirée. Reconnecte-toi pour lancer l'analyse IA.")
                return
            }
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ images: [{ data: base64Image, mimeType: file.type }] })
            })
            const json = await res.json()
            console.log("💡 Réponse Coach Yao (/api/analyze):", json)

            if (json.error && json.code === 'LIMIT_REACHED') {
                setIsAnalyzing(false)
                toast.info(json.error, {
                    description: "Passe au plan Pro ou achète un scan à l'unité.",
                    action: {
                        label: "Payer 100 FCFA",
                        onClick: () => handlePayForScan()
                    },
                    duration: 10000
                })
                return
            }

            if (!json.success || !json.data) {
                if (json?.code === 'GEMINI_QUOTA_EXCEEDED') {
                    toast.error("Quota Gemini dépassé. Active la facturation Google AI Studio ou attends le reset du quota.")
                    return
                }
                if (json?.code === 'GEMINI_TEMP_UNAVAILABLE') {
                    toast.warning("Gemini est temporairement surchargé. Réessaie dans quelques secondes.")
                    return
                }
                const errorMessage = json?.error || "Analyse Gemini échouée."
                toast.error(`Erreur analyse: ${errorMessage}`)
                return
            }
            setMealName(json.meal_name || 'Repas détecté')
            setTotalCaloriesCoach(json.total_calories || 0)
            setCoachMessage(json.coach_message || '')
            const enriched: EnrichedSuggestion[] = (json.data as ScanResultItem[]).flatMap((item): EnrichedSuggestion[] => {
                const suggs = item.suggestions ?? []
                if (suggs.length > 0) return suggs.map((s): EnrichedSuggestion => ({ ...s, portion_g: item.portion_g ?? 0, calories_detected: item.calories_detected ?? 0, protein_detected: item.protein_detected ?? 0, carbs_detected: item.carbs_detected ?? 0, fat_detected: item.fat_detected ?? 0, confidence: item.confidence ?? 0, detected: item.detected ?? 'Inconnu', fromCoach: false }))
                return [{ id: `ai-${item.detected ?? 'unknown'}`, name: item.detected ?? 'Aliment inconnu', score: 0, calories: item.calories_detected ?? 0, protein_g: item.protein_detected ?? 0, carbs_g: item.carbs_detected ?? 0, fat_g: item.fat_detected ?? 0, portion_g: item.portion_g ?? 0, calories_detected: item.calories_detected ?? 0, protein_detected: item.protein_detected ?? 0, carbs_detected: item.carbs_detected ?? 0, fat_detected: item.fat_detected ?? 0, confidence: item.confidence ?? 0, detected: item.detected ?? 'Inconnu', fromCoach: true }]
            })
            setSuggestions(enriched)
            setIsSuggestionsExpanded(true)
            if (json.data[0]) { const first = json.data[0] as ScanResultItem; setManualFood({ name_standard: json.meal_name || first.detected, portion_g: first.portion_g, calories: first.calories_detected, protein_g: first.protein_detected, carbs_g: first.carbs_detected, fat_g: first.fat_detected, category: 'plats_composes' }) }
            
            // ✅ Rafraîchir le profil pour mettre à jour les compteurs de scans
            refreshProfile().catch(err => console.warn('⚠️ refreshProfile error:', err))
        } catch (err: any) {
            console.error(err)
            toast.error(`Erreur analyse: ${err?.message || "Erreur inconnue"}`)
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

        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            const scansUsed = (profile as any)?.scan_feedbacks_today || 0
            const paidScans = profile?.paid_scans_remaining || 0
            let limitReached = false
            let errorMessage = ""
            let errorDesc = ""

            if (profile?.subscription_tier === 'free' && scansUsed >= 5 && paidScans <= 0) {
                limitReached = true
                errorMessage = "Limite de 5 scans à vie atteinte."
                errorDesc = "Débloquez Coach Yao pour continuer !"
            } else if (profile?.subscription_tier === 'pro' && scansUsed >= 4 && paidScans <= 0) {
                limitReached = true
                errorMessage = "Quota quotidien atteint."
                errorDesc = "Vous avez utilisé vos 4 scans du jour."
            }

            if (limitReached) {
                toast.error(errorMessage, {
                    description: errorDesc,
                    action: {
                        label: "Débloquer (100 FCFA)",
                        onClick: () => handlePayForScan()
                    },
                    duration: 10000
                })
                return
            }
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
                    name_standard: p.product_name_fr || p.product_name || "Produit inconnu",
                    portion_g: 100,
                    calories: Math.round(nuts['energy-kcal_100g'] || 0),
                    protein_g: nuts.proteins_100g || 0,
                    carbs_g: nuts.carbohydrates_100g || 0,
                    fat_g: nuts.fat_100g || 0,
                    category: 'snacks'
                };
                setManualFood(detectedFood);
                setMealName(detectedFood.name_standard);
                setShowManualForm(true);
                if (p.image_front_url) setImage(p.image_front_url);

                // ✅ Décompte du jeton pour les gratuits
                if (session && profile?.subscription_tier === 'free') {
                    await supabase.rpc('increment_scan_feedback', { user_id_input: session.user.id })
                    refreshProfile().catch(err => console.warn('⚠️ refreshProfile error:', err))
                }
            } else {
                toast.error("Produit non trouvé.");
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
            toast.error("Aucun code-barres lisible n'a été trouvé sur cette image.");
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
            protein_g: Math.round((item.proteins_100g * (item.default_portion_g || 200)) / 100 * 10) / 10,
            carbs_g: Math.round((item.carbs_100g * (item.default_portion_g || 200)) / 100 * 10) / 10,
            fat_g: Math.round((item.lipids_100g * (item.default_portion_g || 200)) / 100 * 10) / 10,
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
        if (!manualFood.name_standard || manualFood.calories <= 0) return
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
                    name_standard: manualFood.name_standard,
                    category: manualFood.category,
                    calories_per_100g: Math.round(manualFood.calories * factor),
                    proteins_100g: Math.round(manualFood.protein_g * factor * 10) / 10,
                    carbs_100g: Math.round(manualFood.carbs_g * factor * 10) / 10,
                    lipids_100g: Math.round(manualFood.fat_g * factor * 10) / 10,
                    default_portion_g: manualFood.portion_g,
                    verified: false,
                    origin_countries: []
                })
            })
            const jsonFood = await resFood.json()
            if (!jsonFood.success) throw new Error("Erreur lors de la sauvegarde de l'aliment")

            // 2. Préparer le repas complet (Aliments déjà sélectionnés + ce nouvel aliment)
            const newFoodEntry: EnrichedSuggestion = {
                id: jsonFood.data.id,
                name: manualFood.name_standard,
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
                detected: manualFood.name_standard,
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
            const finalMealName = (mealName && mealName !== 'Repas détecté')
                ? mealName
                : (newFoodEntry.name || manualFood.name_standard);

            const resMeal = await fetch('/api/meals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    custom_name: finalMealName,
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
            } else if (jsonMeal.code === 'LIMIT_REACHED') {
                toast.error(jsonMeal.error)
                router.push('/upgrade')
            } else {
                throw new Error("Erreur lors de l'enregistrement du repas")
            }

        } catch (err) {
            console.error(err)
            toast.error("Erreur lors de l'enregistrement.")
        } finally {
            setIsSavingManual(false)
        }
    }

    const saveAIFoodToDB = async (food: EnrichedSuggestion, session: any) => {
        const factor = food.portion_g > 0 ? 100 / food.portion_g : 1
        try { await fetch('/api/foods', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ name_standard: food.name, category: 'plats_composes', calories_per_100g: Math.round(food.calories * factor), proteins_100g: Math.round(food.protein_g * factor * 10) / 10, carbs_100g: Math.round(food.carbs_g * factor * 10) / 10, lipids_100g: Math.round(food.fat_g * factor * 10) / 10, default_portion_g: food.portion_g, verified: false, origin_countries: [] }) }) } catch (err) { console.error(err) }
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
            const res = await fetch('/api/meals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({
                    custom_name: mealName || selectedFoods.map(f => f.name).join(', '),
                    meal_type: currentSlotKey,
                    portion_g: Math.round(totals.portion_g),
                    calories: Math.round(totals.calories),
                    protein_g: Math.round(totals.protein_g * 10) / 10,
                    carbs_g: Math.round(totals.carbs_g * 10) / 10,
                    fat_g: Math.round(totals.fat_g * 10) / 10,
                    image_url: capturedImage,
                    ai_confidence: Math.round(selectedFoods.reduce((sum, f) => sum + f.confidence, 0) / selectedFoods.length),
                    coach_message: coachMessage || null,
                    is_suggestion: aiFoods.length > 0 // 🔥 FLAG EXPLICITE
                })
            })
            const json = await res.json()
            if (json.success && json.data) {
                addMeal(json.data)
                router.push('/journal')
            } else if (json.code === 'LIMIT_REACHED') {
                toast.error(json.error)
                router.push('/upgrade')
            } else {
                toast.error(`Erreur enregistrement repas: ${json?.error || 'Insertion échouée'}`)
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

    const todayStr = new Date().toISOString().split('T')[0]
    const effectiveScansUsed = (effectiveTier !== 'free' && (profile as any)?.last_usage_reset_date !== todayStr)
        ? 0
        : ((profile as any)?.scan_feedbacks_today || 0)

    const paidScans = profile?.paid_scans_remaining || 0
    const isProLimit = effectiveTier === 'pro' && effectiveScansUsed >= 4
    const isFreeLimit = effectiveTier === 'free' && effectiveScansUsed >= 5
    const globalIsBlocked = (isProLimit || isFreeLimit) && paidScans <= 0

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', maxWidth: '480px', margin: '0 auto', padding: '24px', paddingBottom: '140px', position: 'relative', overflow: 'hidden' }}>

            {/* Halo couleur du créneau */}
            <div style={{ position: 'fixed', top: '-60px', right: '-60px', width: '260px', height: '260px', borderRadius: '50%', background: `radial-gradient(circle, ${slotColor}15 0%, transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '80px', left: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ padding: '24px 0 16px' }}>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>Scanner</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500', marginTop: '4px' }}>Analyse ton assiette instantanément</p>
            </div>

            {/* CRÉNEAU */}
            <div style={{ background: 'var(--bg-secondary)', border: `0.5px solid ${slotColor}30`, borderRadius: '24px', padding: '18px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2.5px', background: slotColor }} />
                <div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Créneau</p>
                    <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '15px', marginTop: '2px' }}>{slotLabel}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{displayedRemainingLabel}</p>
                    <p style={{ color: displayedRemaining < 0 ? 'var(--danger)' : (displayedRemaining === 0 ? 'var(--warning)' : slotColor), fontWeight: '800', fontSize: '16px', marginTop: '2px' }}>{displayedRemaining} kcal</p>
                </div>
            </div>

            {/* SWITCH MODE SCAN - HIDDEN IF BLOCKED */}
            {!globalIsBlocked && (
                <>
                    <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '14px', padding: '4px', marginBottom: '16px' }}>
                        <button onClick={() => { setScanMode('ai'); (window as any).isLastScanFromBarcode = false; }} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: scanMode === 'ai' ? 'var(--bg-tertiary)' : 'transparent', color: scanMode === 'ai' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}>
                            📸 Photo
                        </button>
                        <button onClick={() => setScanMode('barcode')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: scanMode === 'barcode' ? 'var(--bg-tertiary)' : 'transparent', color: scanMode === 'barcode' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s' }}>
                            🏷️ Code-barres
                        </button>
                    </div>

                    {/* AI SCAN VIEW */}
                    {scanMode === 'ai' && !image && (
                        <>
                            <div onClick={() => fileInputRef.current?.click()} style={{ height: '200px', borderRadius: '24px', background: 'var(--bg-secondary)', border: `1px dashed ${slotColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'rgba(var(--accent-rgb), 0.12)', border: `0.5px solid ${slotColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', boxShadow: `0 8px 16px rgba(var(--accent-rgb), 0.15)` }}>📷</div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>Scanner un plat</p>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) await processImage(file) }} style={{ display: 'none' }} />
                        </>
                    )}

                    {/* BARCODE SCAN VIEW */}
                    {scanMode === 'barcode' && !image && (
                        <div style={{ marginBottom: '20px' }}>
                            <div id="reader" style={{ borderRadius: '24px', overflow: 'hidden', border: `1px solid ${slotColor}30`, background: 'var(--bg-secondary)', minHeight: '250px' }}></div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '12px' }}>Place le code-barres dans le carré</p>

                            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '10px', textTransform: 'uppercase', fontWeight: '700', opacity: 0.5 }}>Ou</p>
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
                </>
            )}

            {/* PREVIEW IMAGE / SCAN ANIMATION */}
            {(image || isAnalyzing) && (
                <div style={{ position: 'relative', marginBottom: '24px', width: '100%', aspectRatio: '1/1', borderRadius: '32px', overflow: 'hidden', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }}>
                    {image && (
                        <motion.img
                            initial={{ scale: 1.1, opacity: 0 }}
                            animate={{ scale: 1, opacity: isAnalyzing ? 0.6 : 1 }}
                            src={image}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    )}

                    {isAnalyzing && (
                        <>
                            {/* Scanning Line */}
                            <motion.div
                                animate={{ top: ['0%', '100%', '0%'] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    height: '3px',
                                    background: 'linear-gradient(to right, transparent, var(--accent), transparent)',
                                    boxShadow: '0 0 20px var(--accent), 0 0 40px var(--accent)',
                                    zIndex: 10
                                }}
                            />

                            {/* Overlays d'étapes */}
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(3px)', zIndex: 5 }}>
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '15px', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1.5px solid rgba(var(--success-rgb), 0.5)', boxShadow: '0 0 20px rgba(var(--success-rgb), 0.4)' }}>
                                        <div style={{ width: '20px', height: '20px', border: '3px solid var(--success)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                    </div>
                                    <p style={{ color: '#fff', fontSize: '16px', fontWeight: '800', letterSpacing: '-0.2px', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                                        {scanSteps[scanStep]}
                                    </p>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '12px' }}>
                                        {scanSteps.map((_, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    width: i === scanStep ? '20px' : '6px',
                                                    height: '6px',
                                                    borderRadius: '3px',
                                                    background: i <= scanStep ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {!isAnalyzing && (
                        <button
                            onClick={() => { setImage(null); setSuggestions([]); setSelectedFoods([]); setMealName(''); setShowManualForm(false) }}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '40px', height: '40px', color: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            )}

            {mealName && !isAnalyzing && (
                <div style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--bg-secondary)', border: `0.5px solid ${slotColor}20`, borderRadius: '18px' }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '15px' }}>🍽️ {mealName}</p>
                    {totalCaloriesCoach > 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px', fontWeight: '500' }}>Estimation Coach Yao : ~{totalCaloriesCoach} kcal</p>}
                </div>
            )}

            {/* SUGGESTIONS ACCORDION */}
            {suggestions.length > 0 && !isAnalyzing && (
                <div style={{ marginBottom: '24px' }}>
                    <button
                        onClick={() => setIsSuggestionsExpanded(!isSuggestionsExpanded)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', borderRadius: '18px', cursor: 'pointer', marginBottom: '12px', transition: 'all 0.2s ease' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#0a0a0a', border: '1px solid rgba(var(--success-rgb), 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', boxShadow: '0 0 10px rgba(var(--success-rgb), 0.2)' }}>✨</div>
                            <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>Suggestions Coach Yao</p>
                        </div>
                        <motion.div
                            animate={{ rotate: isSuggestionsExpanded ? 180 : 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <ChevronDown size={20} />
                        </motion.div>
                    </button>

                    <AnimatePresence>
                        {isSuggestionsExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                            >
                                {suggestions.map((food, idx) => {
                                    const isSelected = !!selectedFoods.find(f => f.id === food.id)
                                    return (
                                        <div
                                            key={`${food.id}-${food.detected}-${idx}`}
                                            onClick={() => selectFood(food)}
                                            style={{
                                                padding: '16px 20px',
                                                borderRadius: '20px',
                                                background: isSelected ? 'rgba(var(--accent-rgb), 0.08)' : 'var(--bg-secondary)',
                                                cursor: 'pointer',
                                                border: isSelected ? `1px solid var(--accent)` : '0.5px solid var(--border-color)',
                                                transition: 'all 0.2s ease',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: isSelected ? `1.5px solid var(--accent)` : '1.5px solid var(--border-color)', background: isSelected ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                                        {isSelected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                                                    </div>
                                                    <p style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>{food.name || 'Plat inconnu'}</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600' }}>⚖️ {food.portion_g}g</span>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-30">COACH YAO EN ACTION...</span>
                                                <p style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: '600' }}>
                                                    {food.calories} kcal · {food.protein_g}g prot.
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* MESSAGE SI AUCUNE SUGGESTION DÉTECTÉE */}
            {!isAnalyzing && image && suggestions.length === 0 && coachMessage && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'rgba(var(--warning-rgb), 0.1)',
                        border: '1px solid rgba(var(--warning-rgb), 0.3)',
                        borderRadius: '20px',
                        padding: '20px',
                        marginBottom: '24px',
                        textAlign: 'center'
                    }}
                >
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤔</div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', lineHeight: '1.5', marginBottom: '16px' }}>
                        {coachMessage}
                    </p>
                    <button
                        onClick={() => setShowManualForm(true)}
                        style={{ background: 'var(--warning)', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                    >
                        Ajouter manuellement
                    </button>
                </motion.div>
            )}

            {/* AJOUT MANUEL (Toujours disponible si pas en cours d'analyse) */}
            {!isAnalyzing && (
                <button 
                    onClick={() => setShowManualForm(!showManualForm)} 
                    style={{ 
                        width: '100%', 
                        padding: '12px', 
                        borderRadius: '12px', 
                        background: 'transparent', 
                        border: '0.5px dashed var(--border-color)', 
                        color: 'var(--text-secondary)', 
                        cursor: 'pointer', 
                        marginBottom: '12px', 
                        fontSize: '13px',
                        display: showManualForm && !image ? 'none' : 'block' // Cacher si le formulaire est déjà ouvert au-dessus
                    }}
                >
                    {showManualForm ? '✕ Fermer le formulaire' : '✏️ Ajouter manuellement'}
                </button>
            )}

            {showManualForm && (
                <div style={{ marginBottom: '14px', padding: '18px', borderRadius: '14px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)' }}>
                    <p style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '15px', marginBottom: '2px' }}>✏️ Ajouter un aliment</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '14px' }}>Valeurs suggérées par Coach Yao</p>
                    <div style={{ marginBottom: '10px' }}><label style={labelStyle}>Nom *</label><input style={inputStyle} value={manualFood.name_standard} onChange={e => setManualFood(p => ({ ...p, name_standard: e.target.value }))} placeholder="ex: Rôti de porc" /></div>
                    <div style={{ marginBottom: '10px' }}><label style={labelStyle}>Catégorie *</label><select style={inputStyle} value={manualFood.category} onChange={e => setManualFood(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
                    <div style={{ marginBottom: '4px' }}><label style={labelStyle}>Portion (g) *</label><input style={inputStyle} type="number" value={manualFood.portion_g} onChange={e => setManualFood(p => ({ ...p, portion_g: Number(e.target.value) }))} /></div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '10px', opacity: 0.5 }}>Macros pour {manualFood.portion_g}g</p>
                    <div style={{ marginBottom: '10px' }}><label style={labelStyle}>Calories (kcal) *</label><input style={inputStyle} type="number" value={manualFood.calories} onChange={e => setManualFood(p => ({ ...p, calories: Number(e.target.value) }))} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                        {[{ key: 'protein_g', label: 'Protéines' }, { key: 'carbs_g', label: 'Glucides' }, { key: 'fat_g', label: 'Lipides' }].map(f => (
                            <div key={f.key}><label style={labelStyle}>{f.label}</label><input style={inputStyle} type="number" value={(manualFood as any)[f.key]} onChange={e => setManualFood(p => ({ ...p, [f.key]: Number(e.target.value) }))} placeholder="0" /></div>
                        ))}
                    </div>
                    <button onClick={handleSaveManualFood} disabled={isSavingManual || !manualFood.name_standard || manualFood.calories <= 0} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: (!manualFood.name_standard || manualFood.calories <= 0) ? 'var(--bg-tertiary)' : `linear-gradient(135deg, ${slotColor}, var(--accent))`, color: (!manualFood.name_standard || manualFood.calories <= 0) ? 'var(--text-muted)' : '#fff', border: 'none', fontWeight: '500', cursor: 'pointer', fontSize: '14px' }}>
                        {isSavingManual ? 'Sauvegarde...' : '✅ Sauvegarder et ajouter'}
                    </button>
                </div>
            )}

            {/* BANNER LIMITE SCANS / ASTUCE */}
            {!image && !isAnalyzing && (() => {
                if (globalIsBlocked) {
                    return (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={{
                                background: 'linear-gradient(135deg, rgba(20,20,20,0.8), rgba(40,40,40,0.8))',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(var(--accent-rgb), 0.3)',
                                borderRadius: '24px',
                                padding: '24px',
                                textAlign: 'center',
                                marginTop: '20px',
                                marginBottom: '20px',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                            }}
                        >
                            <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
                                🔒
                            </div>
                            <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>
                                Limite atteinte
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px' }}>
                                {isProLimit
                                    ? "Vous avez utilisé vos 4 scans quotidiens. Continuez votre suivi pour seulement 100 FCFA."
                                    : "Vous avez atteint vos 5 scans gratuits à vie. Débloquez la puissance de Yao pour continuer."}
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    onClick={handlePayForScan}
                                    style={{
                                        background: 'linear-gradient(135deg, var(--accent), #10b981)',
                                        color: '#fff', border: 'none', padding: '14px',
                                        borderRadius: '16px', fontSize: '14px', fontWeight: '800', cursor: 'pointer',
                                        boxShadow: '0 8px 16px rgba(var(--accent-rgb), 0.3)'
                                    }}
                                >
                                    ⚡️ Débloquer 1 scan + avis Coach (100F)
                                </button>
                                <button
                                    onClick={() => setShowManualForm(true)}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px',
                                        borderRadius: '16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                                    }}
                                >
                                    ✏️ Ajouter manuellement
                                </button>
                                <button
                                    onClick={() => router.push('/settings/subscription')}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '12px',
                                        borderRadius: '16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                                    }}
                                >
                                    💎 Voir les abonnements
                                </button>
                            </div>
                        </motion.div>
                    )
                }

                if (effectiveTier === 'free') {
                    return (
                        <div style={{
                            background: 'rgba(var(--accent-rgb), 0.05)',
                            border: '1px solid rgba(var(--accent-rgb), 0.15)',
                            borderRadius: '20px',
                            padding: '16px',
                            display: 'flex',
                            gap: '12px',
                            marginTop: '20px',
                            marginBottom: '20px'
                        }}>
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '10px',
                                background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <Info size={18} color="var(--accent)" />
                            </div>
                            <div>
                                <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>
                                    Scans disponibles · <span style={{ color: 'var(--accent)' }}>{Math.max(0, 5 - effectiveScansUsed)} restant{5 - effectiveScansUsed !== 1 ? 's' : ''}</span>
                                </p>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                    Pour une précision optimale, prends la photo sous un <b>angle de 45°</b> avec une <b>bonne lumière</b>. Place un <b>objet témoin</b> (cuillère ou main) à côté du plat pour aider Yao à estimer les portions.
                                </p>
                            </div>
                        </div>
                    )
                }

                // Pro / Premium — astuce normale sans compteur
                return (
                    <div style={{
                        background: 'rgba(var(--accent-rgb), 0.05)',
                        border: '1px solid rgba(var(--accent-rgb), 0.15)',
                        borderRadius: '20px',
                        padding: '16px',
                        display: 'flex',
                        gap: '12px',
                        marginTop: '20px',
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '10px',
                            background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                            <Info size={18} color="var(--accent)" />
                        </div>
                        <div>
                            <p style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>Astuce Précision</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                Pour une précision optimale, prends la photo sous un <b>angle de 45°</b> avec une <b>bonne lumière</b>. Place un <b>objet témoin</b> (cuillère ou main) à côté du plat pour aider Yao à estimer les portions.
                            </p>
                        </div>
                    </div>
                )
            })()}

            {/* BOUTON RÉCAP */}
            {selectedFoods.length > 0 && (
                <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', padding: '0 20px' }}>
                    <button onClick={() => { setShowRecap(true); setShowCoach(false); setCoachMessage('') }} style={{ width: '100%', padding: '14px', borderRadius: '14px', background: `linear-gradient(135deg, ${slotColor}, var(--accent))`, color: '#fff', border: 'none', fontWeight: '600', fontSize: '15px', cursor: 'pointer', boxShadow: `0 8px 24px rgba(var(--accent-rgb), 0.4)` }}>
                        Voir le récap · {Math.round(totals.calories)} kcal
                    </button>
                </div>
            )}

            {showRecap && <div onClick={() => setShowRecap(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--bg-primary-rgb), 0.85)', backdropFilter: 'blur(4px)', zIndex: 1000 }} />}

            {/* POPUP RÉCAP */}
            {showRecap && (
                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, margin: '0 auto', width: '100%', maxWidth: '480px', background: 'var(--bg-secondary)', borderRadius: '24px 24px 0 0', border: '0.5px solid var(--border-color)', zIndex: 1010, padding: '0 0 100px 0', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -10px 40px rgba(var(--bg-primary-rgb),0.2)' }}>
                    <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: '2px', background: `linear-gradient(90deg, ${slotColor}, var(--accent))` }} />
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 0' }}>
                        <div style={{ width: '36px', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px' }} />
                    </div>
                    <div style={{ padding: '18px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>Récap de ton repas</h2>
                            <span style={{ color: slotColor, fontSize: '11px', background: `${slotColor}15`, padding: '4px 10px', borderRadius: '20px', border: `0.5px solid ${slotColor}40` }}>{slotLabel}</span>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '18px' }}>{selectedFoods.map(f => f.name).join(' · ')}</p>

                        <div style={{ background: 'var(--bg-primary)', borderRadius: '16px', padding: '20px', textAlign: 'center', marginBottom: '12px', border: `0.5px solid ${slotColor}20` }}>
                            <p style={{ color: 'var(--text-primary)', fontSize: '52px', fontWeight: '700', letterSpacing: '-2px' }}>{Math.round(totals.calories)}</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>kilocalories</p>
                        </div>

                        <div style={{ background: recapExceeded ? 'rgba(var(--danger-rgb), 0.06)' : 'var(--bg-primary)', border: `0.5px solid ${recapExceeded ? 'rgba(var(--danger-rgb), 0.3)' : 'var(--border-color)'}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{isLastSlot ? `Journée · objectif ${calorieTarget} kcal` : `Créneau ${slotLabel}`}</p>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>{isLastSlot ? `${Math.round(dailyConsumed)} + ${Math.round(totals.calories)} kcal` : `${Math.round(currentSlot.consumed)} + ${Math.round(totals.calories)} kcal`}</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{recapExceeded ? '⚠️ Dépassement' : 'Restant après repas'}</p>
                                <p style={{ color: recapExceeded ? 'var(--danger)' : slotColor, fontWeight: '700', fontSize: '18px' }}>
                                    {recapExceeded ? `+${Math.abs(Math.round(recapRemainingAfter))} kcal` : `${Math.round(recapRemainingAfter)} kcal`}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                            {[
                                { label: 'Protéines', value: totals.protein_g, color: 'var(--success)' },
                                { label: 'Glucides', value: totals.carbs_g, color: 'var(--accent)' },
                                { label: 'Lipides', value: totals.fat_g, color: 'var(--warning)' },
                            ].map(m => (
                                <div key={m.label} style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '12px 8px', textAlign: 'center', border: `0.5px solid ${m.color}20` }}>
                                    <p style={{ color: m.color, fontSize: '20px', fontWeight: '600' }}>{Math.round(m.value * 10) / 10}g</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>{m.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* On n'affiche le conseil du coach QUE si ce n'est pas un menu déjà suggéré par Yao ou venant du planning */}
                        {!selectedFoods.some(f => f.id.startsWith('suggested-') || f.id.startsWith('coach-') || f.fromCoach) && (
                            <>
                                <button onClick={loadCoachMessage} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: showCoach ? 'rgba(var(--warning-rgb), 0.08)' : 'transparent', border: '0.5px solid rgba(var(--warning-rgb), 0.3)', color: 'var(--warning)', fontWeight: '500', fontSize: '13px', cursor: 'pointer', marginBottom: '12px', textAlign: 'left' }}>
                                    {showCoach ? 'Conseil personnalisé de votre coach' : 'Demander l\'avis du coach →'}
                                </button>
                                {showCoach && (
                                    <div style={{ background: 'rgba(var(--warning-rgb), 0.06)', borderRadius: '12px', padding: '14px', marginBottom: '14px', border: '0.5px solid rgba(var(--warning-rgb), 0.2)' }}>
                                        {isLoadingCoach ? (
                                            <p style={{ color: 'var(--warning)', fontSize: '13px' }}>⏳ Yao analyse ton assiette...</p>
                                        ) : coachMessage === '__FREE_USED__' ? (
                                            <div style={{ textAlign: 'center' }}>
                                                <p className="text-[10px] font-bold text-[var(--text-muted)] mt-1 uppercase tracking-widest opacity-50">ANALYSE COACH YAO</p>
                                                <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Essai gratuit déjà utilisé</p>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '1.5', marginBottom: '12px' }}>Tu as déjà vu le talent de Coach Yao ! Passe au Plan Pro pour ses conseils chaque jour.</p>
                                                <div onClick={() => router.push('/upgrade')} style={{ padding: '8px 16px', background: 'var(--warning)', color: '#000', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'inline-block' }}>Voir le Plan Pro →</div>
                                            </div>
                                        ) : coachMessage === '__PRO_LIMIT__' ? (
                                            <div style={{ textAlign: 'center' }}>
                                                <p style={{ fontSize: '24px', marginBottom: '8px' }}>⏰</p>
                                                <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Conseil du jour déjà utilisé</p>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '1.5', marginBottom: '12px' }}>Yao vous a déjà conseillé aujourd'hui. Passez au Premium pour un accès illimité !</p>
                                                <div onClick={() => router.push('/upgrade')} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', borderRadius: '8px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'inline-block' }}>Débloquer le Premium →</div>
                                            </div>
                                        ) : coachMessage ? (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                    <span style={{ fontSize: '18px' }}>💡</span>
                                                    <span style={{ color: 'var(--warning)', fontSize: '13px', fontWeight: '600' }}>Coach Yao</span>
                                                    {profile?.subscription_tier === 'free' && (
                                                        <span style={{ marginLeft: 'auto', background: 'rgba(var(--warning-rgb), 0.15)', color: 'var(--warning)', fontSize: '10px', padding: '2px 8px', borderRadius: '8px', fontWeight: '700' }}>Essai gratuit</span>
                                                    )}
                                                </div>
                                                {coachMessage
                                                    .replace(/\*\*/g, '')
                                                    .replace(/###|##|# /g, '')
                                                    .replace(/---*/g, '')
                                                    .split('\n')
                                                    .filter(l => l.trim())
                                                    .map((line, i) => (
                                                        <p key={i} style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '6px' }}>{line.trim()}</p>
                                                    ))
                                                }
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </>
                        )}

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setShowRecap(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '0.5px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>← Modifier</button>
                            <button onClick={handleSaveMeal} disabled={isSaving} style={{ flex: 2, padding: '14px', borderRadius: '12px', background: `linear-gradient(135deg, ${slotColor}, var(--accent))`, color: '#fff', border: 'none', fontWeight: '600', fontSize: '14px', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                                {isSaving ? 'Ajout...' : '✅ Ajouter au journal'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}