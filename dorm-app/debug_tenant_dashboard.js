
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTenantDashboard() {
    console.log('--- Debugging Tenant Dashboard Data ---');

    // 1. Find Any User to check roles
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .limit(5);

    if (userError || !users || users.length === 0) {
        console.error('Error finding tenant user:', userError);
        return;
    }

    const user = users[0];
    console.log(`Testing with User: ${user.full_name} (ID: ${user.id})`);

    // 2. Check Active Contract
    const { data: contract, error: contractError } = await supabase
        .from('contract')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['Active', 'active'])
        .single();

    if (contractError) {
        console.log('Contract Error:', contractError.message);
    }

    if (!contract) {
        console.log('No Active Contract found for this user.');
        // Try finding ANY contract to see status
        const { data: allContracts } = await supabase
            .from('contract')
            .select('*')
            .eq('user_id', user.id);
        console.log('All Contracts for user:', allContracts);
        return;
    }

    console.log(`Active Contract Found: ID ${contract.id}, Room: ${contract.room_id}`);

    // 3. Check Invoices
    const { data: invoices, error: invError } = await supabase
        .from('invoice')
        .select('*')
        .eq('contract_id', contract.id);

    if (invError) console.error('Invoice Error:', invError.message);
    else {
        console.log(`Found ${invoices.length} invoices.`);
        invoices.forEach(inv => {
            console.log(`- Invoice ${inv.id}: Status="${inv.status}", Amount=${inv.room_total_cost}`);
        });
    }

    // 4. Check Maintenance
    const { data: maintenance, error: maintError } = await supabase
        .from('maintenance_request')
        .select('*')
        .eq('room_id', contract.room_id);

    if (maintError) console.error('Maintenance Error:', maintError.message);
    else {
        console.log(`Found ${maintenance.length} maintenance requests.`);
        maintenance.forEach(m => {
            console.log(`- Request ${m.id}: Status="${m.status_technician}"`);
        });
    }
}

debugTenantDashboard();
