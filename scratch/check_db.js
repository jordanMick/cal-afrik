
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDB() {
    console.log("Checking food_items table...");
    const { data, error } = await supabase.from('food_items').select('*').limit(1);
    
    if (error) {
        console.error("Error fetching food_items:", error);
        return;
    }
    
    if (data && data.length > 0) {
        console.log("Found 1 item. Columns are:");
        console.log(Object.keys(data[0]));
        console.log("Values for this item:", data[0]);
    } else {
        console.log("The food_items table is EMPTY!");
    }
}

checkDB();
