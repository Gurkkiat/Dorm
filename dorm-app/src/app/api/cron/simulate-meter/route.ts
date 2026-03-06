import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration for 1-minute intervals (20x larger than the local 3s script)
const ELEC_INCREMENT_MIN = 0.0100;
const ELEC_INCREMENT_MAX = 0.0500;
const WATER_INCREMENT_MIN = 0.0020;
const WATER_INCREMENT_MAX = 0.0100;

export async function GET(request: Request) {
    try {
        console.log('--- [CRON] Starting Smart Meter Simulation (1 min interval) ---');

        // Security check: Ensure this route is called with the correct Authorization header
        const authHeader = request.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

        const isLocalDev = process.env.NODE_ENV === 'development';
        const urlParams = new URL(request.url).searchParams;
        const localSecret = urlParams.get('secret');

        if (!isLocalDev && authHeader !== expectedAuth) {
            console.error('Unauthorized cron invocation attempt.');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (isLocalDev && localSecret !== process.env.CRON_SECRET) {
            console.error('Unauthorized local cron invocation attempt.');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch Active/Complete Contracts
        const { data: contracts, error } = await supabase
            .from('contract')
            .select('id')
            .in('status', ['active', 'Active', 'complete', 'Complete']);

        if (error) {
            console.error('Error fetching contracts:', error.message);
            return NextResponse.json({ error: 'Error fetching contracts', details: error }, { status: 500 });
        }

        if (!contracts || contracts.length === 0) {
            console.log('No active contracts found for simulation.');
            return NextResponse.json({ success: true, message: 'No active contracts to simulate.' });
        }

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
            }
        });

        await Promise.all(updates);

        console.log(`--- [CRON] Simulation Completed for ${contracts.length} contracts. ---`);
        return NextResponse.json({
            success: true,
            message: `Simulation completed for ${contracts.length} contracts.`
        });

    } catch (err: any) {
        console.error('Unexpected error during simulation cron:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
    }
}
