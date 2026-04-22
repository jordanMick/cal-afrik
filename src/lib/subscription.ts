import { UserProfile } from "@/types"

export type SubscriptionTier = 'free' | 'pro' | 'premium'

export const SUBSCRIPTION_RULES = {
    free: {
        maxScansPerDay: 5, // 5 scans à vie
        maxCoachFeedbackPerDay: 5, // 5 analyses détaillées à vie
        maxChatMessagesPerDay: 10, // 10 messages à vie
        hasGraph: false,
        hasAutomaticRecalculation: false,
        hasCoachYao: false,
    },
    pro: {
        maxScansPerDay: 4, // 4 par jour
        maxCoachFeedbackPerDay: 2, // 2 analyses par jour
        maxChatMessagesPerDay: 10, // 10 par jour
        hasGraph: true,
        hasAutomaticRecalculation: true,
        hasCoachYao: true,
    },
    premium: {
        maxScansPerDay: 1000,
        maxCoachFeedbackPerDay: Infinity,
        maxChatMessagesPerDay: 30, // 30 par jour
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
