'use client'

import { useEffect, useRef } from 'react'
import { useAppStore, getMealSlot, MealSlotKey } from '@/store/useAppStore'

// Heures de fin de chaque créneau
const SLOT_END_HOURS: Record<MealSlotKey, number> = {
    petit_dejeuner: 12,
    dejeuner: 16,
    collation: 19,
    diner: 24, // minuit = nouvelle journée
}

export function useSlotWatcher() {
    const { redistributeAfterSlot, slots } = useAppStore()
    const lastSlot = useRef<MealSlotKey>(getMealSlot(new Date().getHours()))

    useEffect(() => {
        const checkSlotChange = () => {
            const currentHour = new Date().getHours()
            const currentSlot = getMealSlot(currentHour)

            // Si on a changé de créneau
            if (currentSlot !== lastSlot.current) {
                // Redistribuer après le créneau terminé
                redistributeAfterSlot(lastSlot.current)
                lastSlot.current = currentSlot
            }
        }

        // Vérifier toutes les minutes
        const interval = setInterval(checkSlotChange, 60 * 1000)

        // Vérifier aussi au montage (cas où l'app est ouverte après un changement de créneau)
        checkSlotChange()

        return () => clearInterval(interval)
    }, [])
}