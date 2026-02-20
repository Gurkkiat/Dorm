const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTenantDashboard() {
    console.log('Starting Tenant Dashboard Debug...');

    // 1. Get a sample Tenant User
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'tenant')
        .limit(1)
        .single();

    if (userError || !user) {
        console.error('Error fetching tenant user:', userError);
        return;
    }

    console.log(`\nDebugging for Tenant: ${user.full_name} (ID: ${user.id})`);

    // 2. Fetch Active Contracts
    // Dashboard Logic: .in('status', ['Active', 'active', 'complete', 'Complete'])
    const { data: contract, error: contractError } = await supabase
        .from('contract')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['Active', 'active', 'complete', 'Complete', 'incomplete']) // Checking 'incomplete' too just in case
        .single(); // Dashboard uses .single() which might fail if multiple exist?

    if (contractError) {
        console.error('Error fetching contract:', contractError);
        // Let's see ALL contracts if single failed
        const { data: allContracts } = await supabase.from('contract').select('*').eq('user_id', user.id);
        console.log('All contracts for this user:', allContracts);
        return;
    }

    if (!contract) {
        console.log('No active contract found for user.');
        return;
    }

    console.log(`\nFound Contract ID: ${contract.id} (Status: ${contract.status}, Room ID: ${contract.room_id})`);

    // 3. Fetch Invoices
    const { data: invoices, error: invoiceError } = await supabase
        .from('invoice')
        .select('*')
        .eq('contract_id', contract.id)
        .order('due_date', { ascending: false });

    if (invoiceError) {
        console.error('Error fetching invoices:', invoiceError);
    } else {
        console.log(`\nFound ${invoices.length} invoices.`);

        // Debug Totals Logic
        const unpaid = invoices.filter(inv => inv.status.toLowerCase() === 'unpaid' || inv.status.toLowerCase() === 'pending');
        const totalDue = unpaid.reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0);

        console.log('Unpaid/Pending Invoices:', unpaid.length);
        console.log('Total Due Calculated:', totalDue);

        unpaid.forEach(inv => console.log(` - Invoice ${inv.id}: Status=${inv.status}, Cost=${inv.room_total_cost}`));
    }

    // 4. Fetch Maintenance
    const { data: maintenance, error: maintError } = await supabase
        .from('maintenance_request')
        .select('*')
        .eq('room_id', contract.room_id);

    if (maintError) {
        console.error('Error fetching maintenance:', maintError);
    } else {
        console.log(`\nFound ${maintenance.length} maintenance requests for Room ${contract.room_id}.`);
        maintenance.forEach(m => console.log(` - Request ${m.id}: Status=${m.status_technician}`));

        // Dashboard uses: .not('status_technician', 'in', '("Completed","Done","completed","done","Cancelled","cancelled")')
        // Let's verify manually
        const active = maintenance.filter(m => {
            const s = m.status_technician?.toLowerCase();
            return !['completed', 'done', 'cancelled'].includes(s);
        });
        console.log('Active Requests Calculated:', active.length);
    }
}

debugTenantDashboard();
