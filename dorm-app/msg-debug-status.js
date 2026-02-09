
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatus() {
    const { data, error } = await supabase.from('invoice').select('status');
    if (error) {
        console.error(error);
    } else {
        // Unique statuses
        const statuses = [...new Set(data.map(i => i.status))];
        console.log('Unique Invoice Statuses:', statuses);
    }
}

checkStatus();
