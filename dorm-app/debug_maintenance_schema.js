const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMaintenanceSchema() {
    console.log('Fetching maintenance_request columns...');
    const { data: reqs, error } = await supabase.from('maintenance_request').select('*').limit(1);

    if (error) {
        console.error('Error fetching maintenance_request:', error);
        // Try 'maintenance' just in case
        const { data: main, error: mainError } = await supabase.from('maintenance').select('*').limit(1);
        if (mainError) {
            console.error('Error fetching maintenance:', mainError);
        } else if (main && main.length > 0) {
            console.log('Maintenance keys:', Object.keys(main[0]));
        }
        return;
    }

    if (reqs && reqs.length > 0) {
        console.log('Maintenance Request keys:', Object.keys(reqs[0]));
    } else {
        console.log('No maintenance requests found.');
    }
}

checkMaintenanceSchema();
