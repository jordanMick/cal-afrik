import { supabase } from './supabase'

export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
        return null
    }

    return data.user
}
