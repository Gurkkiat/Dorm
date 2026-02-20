const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateMonthlyInvoices() {
    console.log('--- Generating Monthly Invoices ---');

    // 1. Fetch Active Contracts
    const { data: contracts, error: contractError } = await supabase
        .from('contract')
        .select(`
            id, 
            room_id, 
            user_id, 
            water_config_type, 
            water_fixed_price,
            room:room_id ( rent_price, room_number )
        `)
        .in('status', ['active', 'Active', 'complete', 'Complete']);

    if (contractError) {
        console.error('Error fetching contracts:', contractError);
        return;
    }

    console.log(`Found ${contracts.length} active contracts.`);
    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    const billDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5); // Due in 5 days

    let generatedCount = 0;

    for (const contract of contracts) {
        // 2. Fetch Latest Meter Reading
        const { data: readings, error: readingError } = await supabase
            .from('meter_reading')
            .select('*')
            .eq('contract_id', contract.id)
            .order('reading_date', { ascending: false })
            .limit(1);

        if (readingError) {
            console.error(`Error fetching reading for Contract ${contract.id}:`, readingError);
            continue;
        }

        const reading = readings && readings.length > 0 ? readings[0] : null;

        if (!reading) {
            console.warn(`No meter reading found for Contract ${contract.id} (Room ${contract.room?.room_number}). Skipping.`);
            continue;
        }

        // 3. Calculate Costs
        const rentCost = contract.room?.rent_price || 0;

        // Electricity: 5 THB/Unit
        const elecUsage = reading.current_electricity - reading.prev_electricity;
        const elecCost = Math.max(0, elecUsage * 5);

        // Water: 18 THB/Unit OR Fixed
        let waterCost = 0;
        if (contract.water_config_type === 'fixed') {
            waterCost = contract.water_fixed_price || 100; // Default 100 if null
        } else {
            const waterUsage = reading.current_water - reading.prev_water;
            waterCost = Math.max(0, waterUsage * 18); // Rate: 18
        }

        const totalCost = rentCost + elecCost + waterCost;

        // 4. Create Invoice
        // Check if invoice already exists for this reading/month to prevent duplicates (Optional but good)
        // For now, we just insert.

        const invoiceData = {
            contract_id: contract.id,
            room_id: contract.room_id, // Redundant but good for quick access if schema allows
            user_id: contract.user_id, // Redundant but good for quick access

            // Costs
            room_rent_cost: rentCost,
            room_elec_cost: parseFloat(elecCost.toFixed(2)),
            room_water_cost: parseFloat(waterCost.toFixed(2)),
            room_total_cost: parseFloat(totalCost.toFixed(2)),
            room_repair_cost: 0,
            room_deposit_cost: 0,

            // Metadata
            type: 'monthly',
            status: 'Unpaid',
            bill_date: billDate.toISOString(),
            due_date: dueDate.toISOString(),
            // Assuming we don't need 'building_id' here if it's derived from room, 
            // but if schema requires it, we'd need to fetch or derive it.
            // Let's rely on contract -> room -> building relation for queries.
        };

        // Note: verify if `invoice` table needs `room_id` / `user_id` explicitly. 
        // Based on `types/database.ts`: Invoice interface has contract_id. 
        // It mostly likely doesn't *require* room_id/user_id if relations handle it, 
        // BUT the previous fetch in payments/page.tsx used inner joins via contract. 
        // However, some schemas duplicate these for performance. 
        // Checking `src/types/database.ts` again...
        // Interface Invoice: id, contract_id, room_deposit_cost, room_rent_cost, etc...
        // It DOES NOT explicitly list room_id or user_id in the interface I saw earlier.
        // Wait, line 59 in `payments/page.tsx`: 
        // .select('*, contract:contract_id ...')
        // It seems `contract_id` is the key. 
        // But `test_generate_monthly_invoice.js` (which was actually equipment seed) didn't show insert structure.
        // Let's assume standard normalization: link via `contract_id`.
        // BUT, looking at `mock_data` or schemas might reveal if we need to insert room_id.
        // I will check `src/types/database.ts` again. It showed:
        // export interface Invoice { id: number; contract_id: number; ... }
        // So likely we only need `contract_id`. 
        // Let's remove room_id/user_id from insert object to be safe/clean, 
        // OR check schema. actually `seed_pending_invoice` updated an existing one.

        // Let's try inserting with just `contract_id`.
        const { data: newInvoice, error: insertError } = await supabase
            .from('invoice')
            .insert({
                contract_id: contract.id,
                room_rent_cost: rentCost,
                room_elec_cost: parseFloat(elecCost.toFixed(2)),
                room_water_cost: parseFloat(waterCost.toFixed(2)),
                room_total_cost: parseFloat(totalCost.toFixed(2)),
                room_repair_cost: 0,
                room_deposit_cost: 0,
                type: 'monthly',
                status: 'Unpaid',
                bill_date: billDate.toISOString(),
                due_date: dueDate.toISOString()
            })
            .select();

        if (insertError) {
            console.error(`Failed to create invoice for Room ${contract.room?.room_number}:`, insertError);
        } else {
            console.log(`Generated Invoice for Room ${contract.room?.room_number}: ฿${totalCost.toFixed(2)}`);
            generatedCount++;
        }
    }

    console.log(`--- Completed. Generated ${generatedCount} invoices. ---`);
}

generateMonthlyInvoices();
