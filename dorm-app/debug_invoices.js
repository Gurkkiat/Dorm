const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInvoices() {
    console.log('Checking invoices...');

    // Fetch all statuses
    const { data, error } = await supabase
        .from('invoice')
        .select('status, id')
        .limit(100);

    if (error) {
        console.error('Error:', error);
        return;
    }

    // Count statuses
    const counts = {};
    data.forEach(row => {
        const s = row.status || 'NULL';
        counts[s] = (counts[s] || 0) + 1;
    });

    console.log('Invoice Status Counts:', counts);
}

checkInvoices();
