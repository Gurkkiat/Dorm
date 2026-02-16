const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedMeterReadings() {
    console.log('Starting Meter Reading Seed...');

    // 1. Fetch Active Contracts (Status = 'complete' or similar, meaning occupied)
    const { data: contracts, error: contractError } = await supabase
        .from('contract')
        .select('id, room_id, status')
        .eq('status', 'complete');

    if (contractError) {
        console.error('Error fetching contracts:', contractError);
        return;
    }

    if (!contracts || contracts.length === 0) {
        console.log('No active contracts found. Skipping seed.');
        return;
    }

    console.log(`Found ${contracts.length} active contracts.`);

    let meterReadings = [];
    const now = new Date();

    // Generate reading for this month and last month
    for (const contract of contracts) {
        // Mock Data
        const prevWater = Math.floor(Math.random() * 100) + 10;
        const curWater = prevWater + Math.floor(Math.random() * 20) + 5;

        const prevElec = Math.floor(Math.random() * 1000) + 100;
        const curElec = prevElec + Math.floor(Math.random() * 200) + 50;

        meterReadings.push({
            contract_id: contract.id,
            room_id: contract.room_id,
            prev_water: prevWater,
            current_water: curWater,
            prev_electricity: prevElec,
            current_electricity: curElec,
            reading_date: now.toISOString()
        });
    }

    console.log(`Inserting ${meterReadings.length} meter readings...`);

    const { error: insertError } = await supabase
        .from('meter_reading')
        .insert(meterReadings);

    if (insertError) {
        console.error('Error inserting meter readings:', insertError);
    } else {
        console.log('Successfully seeded meter readings!');
    }
}

seedMeterReadings();
