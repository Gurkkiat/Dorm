const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTenants() {
    console.log('Verifying seeded tenants...');

    const { data, error } = await supabase
        .from('users')
        .select('username, full_name, role')
        .eq('role', 'tenant');

    if (error) {
        console.error('Error fetching tenants:', error);
        return;
    }

    console.log(`Found ${data.length} tenants:`);
    data.forEach(u => {
        console.log(`- ${u.username} (${u.full_name})`);
    });
}

verifyTenants();
