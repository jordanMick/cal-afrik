import { createClient } from '@supabase/supabase-js'

// 🔐 Variables d'environnement
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 🧠 Vérification (important pour debug)
if (!supabaseUrl) {
    throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL manquant")
}

if (!supabaseAnonKey) {
    throw new Error("❌ NEXT_PUBLIC_SUPABASE_ANON_KEY manquant")
}

// ✅ Client Supabase (UNIQUE dans toute l'app)
export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'calafrik-auth',
        }
    }
)
