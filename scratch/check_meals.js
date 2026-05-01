const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    const { data, error } = await supabase.from('meals').select('*').limit(1);
    if (error) {
        console.error(error);
        return;
    }
    if (data.length > 0) {
        console.log(Object.keys(data[0]));
    } else {
        console.log("No data in meals, trying to get columns from schema...");
    }
}
check();
