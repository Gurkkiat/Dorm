const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSamples() {
    console.log('--- Verifying Data Samples ---');

    console.log('\n1. Checking Branch Addresses (Should be Provinces)...');
    const { data: branches, error: brError } = await supabase
        .from('branch')
        .select('id, branches_name, address, city')
        .limit(5);

    if (brError) console.error(brError);
    else console.table(branches);

    console.log('\n2. Checking Building Names (Should be BxDye)...');
    const { data: buildings, error: blError } = await supabase
        .from('building')
        .select('id, name_building, branch_id')
        .limit(10); // Check first 10 to see B1D1, B1D2, B2D1 etc.

    if (blError) console.error(blError);
    else console.table(buildings);

    // Check a middle one
    const { data: midBuildings } = await supabase
        .from('building')
        .select('id, name_building, branch_id')
        .range(100, 105);

    if (midBuildings) {
        console.log('\n... Middle buildings sample ...');
        console.table(midBuildings);
    }
}

checkSamples();
