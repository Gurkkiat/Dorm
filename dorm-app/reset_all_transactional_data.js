const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAllData() {
    console.log('!!! WARNING: RESETING ALL TRANSACTIONAL DATA !!!');
    console.log('This will delete Invoices, Meter Readings, Maintenance Requests, and Contracts.');
    console.log('Users, Buildings, and Equipment will remain.');

    // 1. Delete Income & Expenses (Leaf Nodes that reference Invoice/Maintenance)
    const { error: incError } = await supabase.from('income').delete().neq('id', 0);
    if (incError) console.error('Error deleting income:', incError);
    else console.log('- Income deleted.');

    const { error: expError } = await supabase.from('expenses').delete().neq('id', 0);
    if (expError) console.error('Error deleting expenses:', expError);
    else console.log('- Expenses deleted.');

    // 2. Delete Invoices (Referenced by Income, References Contract)
    const { error: invoiceError } = await supabase.from('invoice').delete().neq('id', 0);
    if (invoiceError) console.error('Error deleting invoices:', invoiceError);
    else console.log('- Invoices deleted.');

    // 3. Delete Maintenance Timeline (Child of Request)
    const { error: timelineError } = await supabase.from('maintenance_timeline').delete().neq('id', 0);
    if (timelineError) console.error('Error deleting timelines:', timelineError);
    else console.log('- Maintenance Timelines deleted.');

    // 4. Delete Maintenance Requests (Referenced by Expenses)
    const { error: maintError } = await supabase.from('maintenance_request').delete().neq('id', 0);
    if (maintError) console.error('Error deleting maintenance requests:', maintError);
    else console.log('- Maintenance Requests deleted.');

    // 5. Delete Meter Readings (Child of Contract)
    const { error: meterError } = await supabase.from('meter_reading').delete().neq('id', 0);
    if (meterError) console.error('Error deleting meter readings:', meterError);
    else console.log('- Meter Readings deleted.');

    // 6. Delete Contracts (Parent of Invoice, Meter Reading)
    const { error: contractError } = await supabase.from('contract').delete().neq('id', 0);
    if (contractError) console.error('Error deleting contracts:', contractError);
    else console.log('- Contracts deleted.');

    // 7. Reset Rooms
    console.log('Resetting Room Status to Vaccant...');
    const { error: roomError } = await supabase
        .from('room')
        .update({ status: 'Vaccant', current_residents: 0, water_unit: 0, elec_unit: 0 })
        .neq('id', 0);

    if (roomError) console.error('Error resetting rooms:', roomError);
    else console.log('- Rooms reset to Vaccant.');

    // 8. Delete Users (Tenants only)
    console.log('Deleting Tenant Users...');
    const { error: userError } = await supabase
        .from('users')
        .delete()
        .in('role', ['tenant', 'User']); // Delete both 'tenant' and 'User' roles

    if (userError) console.error('Error deleting tenant users:', userError);
    else console.log('- Tenant users deleted.');

    console.log('--- DATA RESET COMPLETE ---');
}

resetAllData();
