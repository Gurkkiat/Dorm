const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Maintenance Statuses ---');
    const { data: maint } = await supabase.from('maintenance_request').select('status_technician');
    console.log([...new Set(maint.map(m => m.status_technician))]);

    console.log('\n--- Invoice Statuses ---');
    const { data: inv } = await supabase.from('invoice').select('status');
    console.log([...new Set(inv.map(i => i.status))]);

    console.log('\n--- Contract Statuses ---');
    const { data: cont } = await supabase.from('contract').select('status');
    console.log([...new Set(cont.map(c => c.status))]);
}

checkData();
