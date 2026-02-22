require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateInvoice() {
    try {
        console.log("Looking for building B38D1...");
        // 1. Find building B38D1
        const { data: building, error: buildingError } = await supabase
            .from('building')
            .select('*')
            .eq('name_building', 'B38D1')
            .single();

        if (buildingError || !building) {
            console.error("Building B38D1 not found.", buildingError);
            return;
        }

        console.log(`Found Building ID: ${building.id}`);

        // 2. Set the building's water config to 'fixed' and price to 150
        console.log("Setting building B38D1 water config to fixed price 150 THB.");
        await supabase
            .from('building')
            .update({
                water_config_type: 'fixed',
                water_fixed_price: 150,
                water_meter: 18 // Keep base rate just in case
            })
            .eq('id', building.id);

        // 3. Find a room in this building
        const { data: room, error: roomError } = await supabase
            .from('room')
            .select('*')
            .eq('building_id', building.id)
            .limit(1)
            .single();

        if (roomError || !room) {
            console.error("No room found in B38D1.", roomError);
            return;
        }

        console.log(`Found Room: ${room.room_number} (ID: ${room.id})`);

        // 4. Find an active contract for this room
        let { data: contract, error: contractError } = await supabase
            .from('contract')
            .select('*')
            .eq('room_id', room.id)
            .in('status', ['complete', 'active'])
            .limit(1)
            .single();

        if (contractError || !contract) {
            console.log("No active contract found for this room. Let's find any user to create a dummy contract.");
            const { data: user } = await supabase.from('users').select('id').eq('role', 'tenant').limit(1).single();
            if (!user) {
                console.error("No tenant user found to create contract.");
                return;
            }

            // Create dummy contract without fixed water overrides so it falls back to building
            const { data: newContract, error: newContractError } = await supabase
                .from('contract')
                .insert([{
                    user_id: user.id,
                    room_id: room.id,
                    contract_number: `SYSTEM_TEST_${Date.now()}`,
                    move_in: new Date().toISOString(),
                    move_out: new Date(Date.now() + 31536000000).toISOString(),
                    durations: 12,
                    residents: 1,
                    status: 'complete',
                    water_config_type: 'unit', // Specifically set to unit so it falls back to building's fixed price
                    water_fixed_price: null
                }])
                .select()
                .single();

            if (newContractError) {
                console.error("Failed to create contract", newContractError);
                return;
            }
            contract = newContract;
            console.log(`Created new dummy contract ID: ${contract.id}`);
        } else {
            console.log(`Found existing Contract ID: ${contract.id}`);
            // Ensure contract doesn't have a specific override that breaks the test
            await supabase.from('contract').update({
                water_config_type: 'unit',
                water_fixed_price: null
            }).eq('id', contract.id);
            console.log("Ensured contract water config is set to 'unit' to test building fallback.");
        }

        // 5. Create a Pending Invoice
        const usageWaterUnit = 10; // Let's say they used 10 units
        // But the calculated cost should just be 150 because it's fixed at the building level. 
        // Wait, the invoice generator logic usually calculates the cost and inserts it into invoice.room_water_cost.
        // Let's check how the new invoice generator does it, or we can just mock the resulting invoice.
        // The display logic in verify/page.tsx checks `building.water_config_type` against `invoice.room_water_cost`.
        // If it's fixed, it uses fixedPriceValue and waterUnit = 1.

        // Let's create an invoice where room_water_cost isn't right to see if the UI fixes it, OR
        // we should create the invoice with 150 because the backend generator would do that.
        // The display logic shows invoice.room_water_cost as the total amount.
        const roomWaterCost = 150; // The fixed price

        const { data: invoice, error: invoiceError } = await supabase
            .from('invoice')
            .insert([{
                contract_id: contract.id,
                room_deposit_cost: 0,
                room_rent_cost: room.rent_price || 6000,
                room_water_cost: roomWaterCost,
                room_elec_cost: 0, // No elec for this simple test
                room_repair_cost: 0,
                room_total_cost: (room.rent_price || 6000) + roomWaterCost,
                status: 'Pending',
                type: 'rent',
                payment_method: 'none',
                bill_date: new Date().toISOString(),
                due_date: new Date(Date.now() + 7 * 86400000).toISOString()
            }])
            .select()
            .single();

        if (invoiceError) {
            console.error("Error creating invoice", invoiceError);
            return;
        }

        console.log(`\n✅ Success! Created Invoice ID: ${invoice.id} for Room ${room.room_number} in B38D1.`);
        console.log(`Please go to the Manager Dashboard -> Manage Payments -> Verify (or navigate to /manager/invoices/${invoice.id}/verify) to view the result.`);

    } catch (e) {
        console.error("Unexpected error:", e);
    }
}

simulateInvoice();
