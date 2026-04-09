import { UserProfile } from "@/types"

export type SubscriptionTier = 'free' | 'pro' | 'premium'

export const SUBSCRIPTION_RULES = {
    free: {
        maxScansPerDay: 2,
        maxCoachFeedbackPerDay: 0, // géré par has_used_free_lifetime_feedback
        hasGraph: false,
        hasAutomaticRecalculation: false,
        hasCoachYao: false,
    },
    pro: {
        maxScansPerDay: 1000, // Illimité en pratique
        maxCoachFeedbackPerDay: 1,
        hasGraph: true,
        hasAutomaticRecalculation: true,
        hasCoachYao: true,
    },
    premium: {
        maxScansPerDay: 1000,
        maxCoachFeedbackPerDay: Infinity,
        hasGraph: true,
        hasAutomaticRecalculation: true,
        hasCoachYao: true,
    }
}

export function getEffectiveTier(profile: any | null): SubscriptionTier {
    if (!profile) return 'free'
    const tier = (profile.subscription_tier || 'free').toLowerCase() as SubscriptionTier
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
