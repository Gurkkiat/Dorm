import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase. Note: use process.env to read env variables dynamically.
// Next.js handles finding these in `.env.local` during dev, or in Vercel settings in prod.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// using service role key might be better for an admin task, but we'll stick to what the original script used.
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
    try {
        console.log('--- [CRON] Generating Monthly Invoices ---');

        // Security check: Ensure this route is called with the correct Authorization header
        // that matches our CRON_SECRET. Vercel automatically sends this header.
        const authHeader = request.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

        // Allow bypassing auth in local development for testing purposes (Optional, but helpful)
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
            return NextResponse.json({ error: 'Error fetching contracts', details: contractError }, { status: 500 });
        }

        console.log(`Found ${contracts.length} active contracts.`);
        const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        const billDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 5); // Due in 5 days

        let generatedCount = 0;
        const failedInvoices: { roomId: string, error: any }[] = [];

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
                failedInvoices.push({ roomId: contract.room?.room_number, error: 'Meter reading fetch failed' });
                continue;
            }

            const reading = readings && readings.length > 0 ? readings[0] : null;

            if (!reading) {
                console.warn(`No meter reading found for Contract ${contract.id} (Room ${contract.room?.room_number}). Skipping.`);
                // We might not consider this a hard failure, just skipping.
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
                failedInvoices.push({ roomId: contract.room?.room_number, error: insertError });
            } else {
                console.log(`Generated Invoice for Room ${contract.room?.room_number}: ฿${totalCost.toFixed(2)}`);
                generatedCount++;
            }
        }

        console.log(`--- [CRON] Completed. Generated ${generatedCount} invoices. ---`);

        return NextResponse.json({
            success: true,
            message: `Generated ${generatedCount} invoices.`,
            failed: failedInvoices.length > 0 ? failedInvoices : undefined
        });

    } catch (err: any) {
        console.error('Unexpected error during cron execution:', err);
        return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
    }
}
