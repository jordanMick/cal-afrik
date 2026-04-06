import { UserProfile } from "@/types"

export type SubscriptionTier = 'free' | 'pro' | 'premium'

export const SUBSCRIPTION_RULES = {
    free: {
        maxScansPerDay: 2,
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

export function getEffectiveTier(profile: UserProfile | null): SubscriptionTier {
    if (!profile) return 'free'
    const tier = profile.subscription_tier || 'free'
    if (tier === 'free') return 'free'
    
    // Vérification de la date d'expiration
    if (profile.subscription_expires_at) {
        const expiresAt = new Date(profile.subscription_expires_at)
        if (expiresAt < new Date()) {
            return 'free'
        }
    }
    
    return tier
}

export function checkPermission(profile: UserProfile | null, feature: keyof typeof SUBSCRIPTION_RULES.free) {
    const tier = getEffectiveTier(profile)
    return SUBSCRIPTION_RULES[tier][feature]
}
