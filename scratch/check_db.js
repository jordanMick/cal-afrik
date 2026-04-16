
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
    const { data, error } = await supabase
        .from('food_items')
        .select('name_standard, verified')
        .limit(5)
    
    if (error) {
        console.error('Error:', error)
        return
    }
    console.log('Sample data:', data)

    const { count, error: countError } = await supabase
        .from('food_items')
        .select('*', { count: 'exact', head: true })
        .eq('verified', true)
    
    if (countError) {
        console.error('Count error:', countError)
        return
    }
    console.log('Verified foods count:', count)
}

check()
