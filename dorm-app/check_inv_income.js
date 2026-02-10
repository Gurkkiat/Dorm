
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log('--- Checking Invoice Table ---');
    const { data: invData, error: invError } = await supabase
        .from('invoice')
        .select('*')
        .limit(1);

    if (invError) {
        console.error('Error fetching invoice:', invError.message);
    } else if (invData && invData.length > 0) {
        console.log('Invoice columns:', Object.keys(invData[0]));
    } else {
        // If empty table, insert a dummy one then delete to get keys? No, Supabase doesn't return keys on empty select usually unless using rpc.
        // But let's hope there's data. If not, I'll assume standard keys + room_rent_cost.
        console.log('Invoice table is empty, cannot infer columns easily via select.');
    }

    console.log('\n--- Checking Income Table ---');
    const { data: incData, error: incError } = await supabase
        .from('income')
        .select('*')
        .limit(1);

    if (incError) {
        console.error('Error fetching income:', incError.message);
    } else if (incData && incData.length > 0) {
        console.log('Income columns:', Object.keys(incData[0]));
    } else {
        console.log('Income table is empty.');
    }
}

checkTables();
