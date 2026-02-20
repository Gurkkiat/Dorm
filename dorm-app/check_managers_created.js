const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkManagers() {
    console.log('Verifying branch managers...');

    const { data: branches, error: branchError } = await supabase
        .from('branch')
        .select('id, branches_name');

    if (branchError) {
        console.error('Error fetching branches:', branchError);
        return;
    }

    // Fetch all managers
    const { data: managers, error: managerError } = await supabase
        .from('users')
        .select('id, full_name, username, branch_id')
        .eq('role', 'manager');

    if (managerError) {
        console.error('Error fetching managers:', managerError);
        return;
    }

    const branchMap = {};
    branches.forEach(b => branchMap[b.id] = b);

    const managerMap = {}; // branch_id -> manager
    managers.forEach(m => {
        if (!managerMap[m.branch_id]) {
            managerMap[m.branch_id] = [];
        }
        managerMap[m.branch_id].push(m);
    });

    let withManager = 0;
    let withoutManager = 0;

    console.log('\n--- Branch Manager Status ---');
    for (const branch of branches) {
        const branchManagers = managerMap[branch.id];
        if (branchManagers && branchManagers.length > 0) {
            const managerNames = branchManagers.map(m => `${m.full_name} (${m.username})`).join(', ');
            console.log(`[OK] ${branch.branches_name}: ${managerNames}`);
            withManager++;
        } else {
            console.log(`[MISSING] ${branch.branches_name}: No manager found`);
            withoutManager++;
        }
    }

    console.log('\n--- Summary ---');
    console.log(`Total Branches: ${branches.length}`);
    console.log(`Branches with Manager: ${withManager}`);
    console.log(`Branches without Manager: ${withoutManager}`);
}

checkManagers();
