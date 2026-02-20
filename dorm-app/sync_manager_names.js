const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncManagerNames() {
    console.log('Syncing manager names from users to branch table...');

    // 1. Fetch all managers
    const { data: managers, error: userError } = await supabase
        .from('users')
        .select('full_name, branch_id')
        .eq('role', 'manager');

    if (userError) {
        console.error('Error fetching managers:', userError);
        return;
    }

    // 2. Map branch_id to manager name
    const managerMap = {};
    managers.forEach(m => {
        if (m.branch_id) {
            managerMap[m.branch_id] = m.full_name;
        }
    });

    // 3. Update branches
    const { data: branches, error: branchError } = await supabase
        .from('branch')
        .select('id, branches_name');

    if (branchError) {
        console.error('Error fetching branches:', branchError);
        return;
    }

    let updatedCount = 0;
    for (const branch of branches) {
        const managerName = managerMap[branch.id];

        if (managerName) {
            const { error: updateError } = await supabase
                .from('branch')
                .update({ manager_name: managerName })
                .eq('id', branch.id);

            if (updateError) {
                console.error(`Error updating branch ${branch.id}:`, updateError.message);
            } else {
                console.log(`Updated branch ${branch.id} (${branch.branches_name}) with manager: ${managerName}`);
                updatedCount++;
            }
        } else {
            console.warn(`No manager found for branch ${branch.id} (${branch.branches_name})`);
        }
    }

    console.log(`Sync complete. Updated ${updatedCount} branches.`);
}

syncManagerNames();
