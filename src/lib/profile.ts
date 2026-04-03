import { supabase } from './supabase'

export async function getOrCreateProfile(userId: string) {
    // vérifier si profile existe
    const { data: existing } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

    if (existing) return existing

    // sinon créer
    const { data, error } = await supabase
        .from('user_profiles')
        .insert({
            user_id: userId,
            name: "Utilisateur",
            onboarding_done: false
        })
        .select()
        .single()

    if (error) {
        console.error(error)
        return null
    }

    return data
}
