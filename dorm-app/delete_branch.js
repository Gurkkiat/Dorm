/**
 * delete_branch.js
 * Usage: node delete_branch.js <branch_name>
 * Example: node delete_branch.js "Sukhumvit 38"
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteBranch() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.log('Usage: node delete_branch.js <branch_name>');
        process.exit(1);
    }

    const branchName = args[0];
    console.log(`Deleting Branch: ${branchName} and all its content...`);

    try {
        // 1. Get Branch ID
        const { data: branch, error: branchError } = await supabase
            .from('branch')
            .select('id')
            .eq('branches_name', branchName)
            .single();

        if (branchError || !branch) throw new Error('Branch not found: ' + branchName);
        const branchId = branch.id;

        // 2. Get Buildings
        const { data: buildings } = await supabase.from('building').select('id').eq('branch_id', branchId);
        const buildingIds = buildings.map(b => b.id);

        if (buildingIds.length > 0) {
            // 3. Get Rooms
            const { data: rooms } = await supabase.from('room').select('id').in('building_id', buildingIds);
            const roomIds = rooms.map(r => r.id);

            if (roomIds.length > 0) {
                // 4. Get Contracts
                const { data: contracts } = await supabase.from('contract').select('id').in('room_id', roomIds);
                const contractIds = contracts.map(c => c.id);

                if (contractIds.length > 0) {
                    console.log(`Deleting ${contractIds.length} contracts and related bills...`);
                    await supabase.from('invoice').delete().in('contract_id', contractIds);
                    await supabase.from('meter_reading').delete().in('contract_id', contractIds);
                    await supabase.from('contract').delete().in('id', contractIds);
                }

                console.log(`Deleting ${roomIds.length} rooms and maintenance...`);
                await supabase.from('maintenance_request').delete().in('room_id', roomIds);
                await supabase.from('room').delete().in('id', roomIds);
            }

            console.log(`Deleting ${buildingIds.length} buildings...`);
            await supabase.from('building').delete().in('id', buildingIds);
        }

        // 5. Delete Branch
        await supabase.from('branch').delete().eq('id', branchId);
        console.log(`Successfully deleted Branch ${branchName}.`);

    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

deleteBranch();
