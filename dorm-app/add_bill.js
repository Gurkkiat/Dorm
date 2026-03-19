/**
 * add_bill.js
 * Usage: node add_bill.js <username> <water_units> <elec_units>
 * Example: node add_bill.js kerkerk 5 20
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addBill() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log('Usage: node add_bill.js <username> <water_units_consumed> <elec_units_consumed> [bill_date_YYYY-MM-DD]');
        console.log('Example: node add_bill.js test 5 20');
        console.log('Example: node add_bill.js test 5 20 2024-01-01');
        process.exit(1);
    }

    const [username, waterUnits, elecUnits, customDate] = args;
    const baseDate = customDate ? new Date(customDate) : new Date();
    
    if (customDate && isNaN(baseDate.getTime())) {
        console.error('INVALID DATE:', customDate);
        process.exit(1);
    }
    
    console.log(`Adding bill for ${username} (Date: ${baseDate.toISOString().split('T')[0]})`);
    console.log(`Usage: Water=${waterUnits}, Elec=${elecUnits}`);

    try {
        // 1. Get User
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('username', username)
            .single();

        if (userError || !user) throw new Error('User not found: ' + username);
        console.log(`Found user: ${user.full_name} (ID: ${user.id})`);

        // 2. Get Active Contract & Room
        const { data: contract, error: contractError } = await supabase
            .from('contract')
            .select('*, room:room_id(*, building:building_id(branch:branch_id(*)))')
            .eq('user_id', user.id)
            .in('status', ['Active', 'active', 'Complete', 'complete', 'incomplete'])
            .single();

        if (contractError || !contract) throw new Error('Active contract not found for ' + username);
        
        const room = contract.room;
        console.log(`Found active contract in Room ${room.room_number}. Current Totals: Water=${room.water_unit}, Elec=${room.elec_unit}`);

        // 3. Calculate New Totals
        const prevWater = room.water_unit || 0;
        const prevElec = room.elec_unit || 0;
        const currentWater = prevWater + Number(waterUnits);
        const currentElec = prevElec + Number(elecUnits);

        // 4. Calculate Costs (Using standard rates: Water=18, Elec=5)
        const waterRate = 18;
        const elecRate = 5;
        // Use room rent as fallback if contract rent is 0
        const roomRent = contract.rent_price || room.rent_price || 0;
        
        const waterCost = Number(waterUnits) * waterRate;
        const elecCost = Number(elecUnits) * elecRate;
        const totalCost = roomRent + waterCost + elecCost;

        // 5. Insert Meter Reading
        const { data: meter, error: meterError } = await supabase
            .from('meter_reading')
            .insert({
                contract_id: contract.id,
                prev_water: prevWater,
                current_water: currentWater,
                prev_electricity: prevElec,
                current_electricity: currentElec,
                reading_date: baseDate.toISOString()
            })
            .select()
            .single();

        if (meterError) throw meterError;
        console.log('- Meter Reading recorded.');

        // 6. Insert Invoice
        const dueDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoice')
            .insert({
                contract_id: contract.id,
                room_total_cost: totalCost,
                status: 'Pending', 
                type: 'Monthly',
                bill_date: baseDate.toISOString(),
                due_date: dueDate.toISOString(),
                room_rent_cost: roomRent,
                room_water_cost: waterCost,
                room_elec_cost: elecCost
            })
            .select()
            .single();

        if (invoiceError) throw invoiceError;
        console.log(`- Invoice created: ID ${invoice.id}, Status: Pending`);
        console.log(`- Dates: Bill=${baseDate.toISOString().split('T')[0]}, Due=${dueDate.toISOString().split('T')[0]}`);
        console.log(`- Breakdown: Rent=${roomRent}, Water=${waterCost}, Elec=${elecCost} | Total: ${totalCost} THB`);

        // 7. Update Room
        const { error: roomUpdateError } = await supabase
            .from('room')
            .update({
                water_unit: currentWater,
                elec_unit: currentElec
            })
            .eq('id', room.id);
        
        if (roomUpdateError) throw roomUpdateError;
        console.log('- Room totals updated.');

        console.log('--- DONE ---');
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

addBill();
