const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
    console.log('--- Clearing Tenant Data ---');

    try {
        // 1. Find all Contracts (to get Room IDs)
        const { data: contracts, error: fetchError } = await supabase
            .from('contract')
            .select('id, room_id, user_id');

        if (fetchError) throw fetchError;

        if (!contracts || contracts.length === 0) {
            console.log('No contracts to clear.');
        } else {
            console.log(`Found ${contracts.length} contracts.`);

            const contractIds = contracts.map(c => c.id);
            const roomIds = [...new Set(contracts.map(c => c.room_id))]; // Unique Room IDs
            const userIds = [...new Set(contracts.map(c => c.user_id))];

            // 2. Delete Invoices linking to these contracts
            const { data: invoices, error: fetchInvoiceError } = await supabase
                .from('invoice')
                .select('id')
                .in('contract_id', contractIds);

            if (fetchInvoiceError) throw fetchInvoiceError;

            if (invoices && invoices.length > 0) {
                const invoiceIds = invoices.map(i => i.id);

                // 2a. Delete Income related to invoices
                const { error: incomeError } = await supabase
                    .from('income')
                    .delete()
                    .in('invoice_id', invoiceIds);

                if (incomeError) throw incomeError;
                console.log('Deleted related income records.');

                // 2b. Delete Invoices
                const { error: deleteInvoiceError } = await supabase
                    .from('invoice')
                    .delete()
                    .in('id', invoiceIds);

                if (deleteInvoiceError) throw deleteInvoiceError;
                console.log('Deleted invoices.');
            } else {
                console.log('No invoices to delete.');
            }

            // 3. Delete Contracts
            const { error: contractError } = await supabase
                .from('contract')
                .delete()
                .in('id', contractIds);

            if (contractError) throw contractError;
            console.log('Deleted contracts.');

            // 4. Reset Room Status
            if (roomIds.length > 0) {
                const { error: roomError } = await supabase
                    .from('room')
                    .update({ status: 'vacant', current_residents: 0 })
                    .in('id', roomIds);

                if (roomError) throw roomError;
                console.log(`Reset status for ${roomIds.length} rooms.`);
            }

            // 5. Delete Users (Tenants only)
            if (userIds.length > 0) {
                const { error: userError } = await supabase
                    .from('users')
                    .delete()
                    .in('id', userIds)
                    .eq('role', 'tenant'); // Safety check

                if (userError) throw userError;
                console.log(`Deleted ${userIds.length} tenant users.`);
            }
        }

        // Final cleanup: Delete any users with role 'tenant' that might not have contracts (orphans)
        const { error: orphanError, count } = await supabase
            .from('users')
            .delete({ count: 'exact' })
            .eq('role', 'tenant');

        if (orphanError) throw orphanError;
        // Note: count might not be available in all delete operations depending on setup, but it's fine.
        console.log(`Final cleanup complete.`);


        console.log('--- Data Cleared Successfully ---');

    } catch (error) {
        console.error('Error clearing data:', error);
    }
}

clearData();
