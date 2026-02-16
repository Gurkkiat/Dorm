const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    console.log('--- Verifying Data Counts ---');

    const { count: branchCount, error: branchError } = await supabase
        .from('branch')
        .select('*', { count: 'exact', head: true });

    if (branchError) console.error('Error counting branches:', branchError);
    else console.log(`Total Branches: ${branchCount}`);

    const { count: buildingCount, error: buildingError } = await supabase
        .from('building')
        .select('*', { count: 'exact', head: true });

    if (buildingError) console.error('Error counting buildings:', buildingError);
    else console.log(`Total Buildings: ${buildingCount}`);

    const { count: roomCount, error: roomError } = await supabase
        .from('room')
        .select('*', { count: 'exact', head: true });

    if (roomError) console.error('Error counting rooms:', roomError);
    else console.log(`Total Rooms: ${roomCount}`);
}

checkCounts();
