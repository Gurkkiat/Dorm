const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Contracts (Last 5) ---');
    const { data: contracts, error: err1 } = await supabase
        .from('contract')
        .select(`
            id, status, contract_number, room_id,
            room ( id, room_number, building_id, building ( id, name_building, branch_id ) )
        `)
        .order('id', { ascending: false })
        .limit(5);

    if (err1) console.error(err1);
    else console.log(JSON.stringify(contracts, null, 2));

    console.log('\n--- Invoices (Last 5) ---');
    const { data: invoices, error: err2 } = await supabase
        .from('invoice')
        .select('id, contract_id, status, type, room_total_cost')
        .order('id', { ascending: false })
        .limit(5);

    if (err2) console.error(err2);
    else console.log(JSON.stringify(invoices, null, 2));
}

checkData();
