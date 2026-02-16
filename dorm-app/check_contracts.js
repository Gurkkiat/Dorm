const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkContracts() {
    console.log("Checking contracts...");

    // Get total count
    const { count, error: countError } = await supabase
        .from('contract')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error("Error counting contracts:", countError);
        return;
    }
    console.log(`Total contracts: ${count}`);

    // Get a sample of contracts
    const { data: contracts, error } = await supabase
        .from('contract')
        .select('id, user_id, room_id, status, start_date, end_date')
        .limit(10);

    if (error) {
        console.error("Error fetching contracts:", error);
    } else {
        console.log("Sample contracts:", contracts);
    }

    // Check distinct statuses
    const { data: statuses, error: statusError } = await supabase
        .from('contract')
        .select('status');

    if (!statusError) {
        const distinctStatuses = [...new Set(statuses.map(c => c.status))];
        console.log("Distinct statuses found:", distinctStatuses);
    }
}

checkContracts();
