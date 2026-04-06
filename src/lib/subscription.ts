import { UserProfile } from "@/types"

export type SubscriptionTier = 'free' | 'pro' | 'premium'

export const SUBSCRIPTION_RULES = {
    free: {
        maxScansPerDay: 1,
        hasGraph: false,
        hasAutomaticRecalculation: false,
        hasCoachKofi: false,
    },
    pro: {
        maxScansPerDay: 1000, // Illimité en pratique
        hasGraph: true,
        hasAutomaticRecalculation: true,
        hasCoachKofi: false,
    },
    premium: {
        maxScansPerDay: 1000,
        hasGraph: true,
        hasAutomaticRecalculation: true,
        hasCoachKofi: true,
    }
}

export function checkPermission(profile: UserProfile | null, feature: keyof typeof SUBSCRIPTION_RULES.free) {
    if (!profile) return false
    const tier = profile.subscription_tier || 'free'
    return SUBSCRIPTION_RULES[tier][feature]
}
