
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkContracts() {
    console.log('--- Checking Contract Numbers ---');
    const { data, error } = await supabase
        .from('contract')
        .select('id, contract_number, status')
        .order('id', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.table(data);
    }
}

checkContracts();
