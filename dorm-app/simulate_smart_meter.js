const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const UPDATE_INTERVAL_MS = 3000; // Update every 3 seconds
const ELEC_INCREMENT_MIN = 0.0005;
const ELEC_INCREMENT_MAX = 0.0025;
const WATER_INCREMENT_MIN = 0.0001;
const WATER_INCREMENT_MAX = 0.0005;

async function simulateSmartMeter() {
    console.log('--- Starting Smart Meter Simulation ---');
    console.log(`Updating every ${UPDATE_INTERVAL_MS}ms...`);
    console.log('Press Ctrl+C to stop.');

    setInterval(async () => {
        try {
            // 1. Fetch Active/Complete Contracts
            const { data: contracts, error } = await supabase
                .from('contract')
                .select('id')
                .in('status', ['active', 'Active', 'complete', 'Complete']);

            if (error) {
                console.error('Error fetching contracts:', error.message);
                return;
            }

            if (!contracts || contracts.length === 0) return;

            // 2. Process each contract
            const updates = contracts.map(async (contract) => {
                // Get latest reading
                const { data: latestReading } = await supabase
                    .from('meter_reading')
                    .select('*')
                    .eq('contract_id', contract.id)
                    .order('reading_date', { ascending: false })
                    .limit(1)
                    .single();

                if (!latestReading) {
                    // SEED Initial Reading if none exists
                    console.log(`Seeding initial reading for Contract ${contract.id}...`);
                    const { error: insertError } = await supabase
                        .from('meter_reading')
                        .insert([{
                            contract_id: contract.id,
                            reading_date: new Date().toISOString(),
                            prev_water: 100,
                            current_water: 100.0001,
                            prev_electricity: 1000,
                            current_electricity: 1000.0001
                        }]);

                    if (insertError) console.error(`Failed to seed Contract ${contract.id}:`, insertError.message);
                    return;
                }

                // Calculate increments
                const elecInc = Math.random() * (ELEC_INCREMENT_MAX - ELEC_INCREMENT_MIN) + ELEC_INCREMENT_MIN;
                const waterInc = Math.random() * (WATER_INCREMENT_MAX - WATER_INCREMENT_MIN) + WATER_INCREMENT_MIN;

                const newElec = (latestReading.current_electricity || 0) + elecInc;
                const newWater = (latestReading.current_water || 0) + waterInc;

                // Update the record
                const { error: updateError } = await supabase
                    .from('meter_reading')
                    .update({
                        current_electricity: newElec,
                        current_water: newWater
                    })
                    .eq('id', latestReading.id);

                if (updateError) {
                    console.error(`Failed to update Contract ${contract.id}:`, updateError.message);
                } else {
                    // console.log(`Updated Contract ${contract.id}: Elec ${newElec.toFixed(4)}`);
                }
            });

            await Promise.all(updates);
            process.stdout.write('.'); // progress indicator

        } catch (err) {
            console.error('Simulation Loop Error:', err);
        }
    }, UPDATE_INTERVAL_MS);
}

simulateSmartMeter();
