const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyRenumbering() {
    console.log('Verifying branch renumbering...');

    // 1. Check Branch IDs
    const { data: branches, error: branchError } = await supabase
        .from('branch')
        .select('id, branches_name')
        .order('id', { ascending: true });

    if (branchError) {
        console.error('Error fetching branches:', branchError);
        return;
    }

    console.log(`Found ${branches.length} branches.`);
    let isSequential = true;
    for (let i = 0; i < branches.length; i++) {
        if (branches[i].id !== i + 1) {
            console.error(`Mismatch at index ${i}: Expected ID ${i + 1}, found ${branches[i].id}`);
            isSequential = false;
        }
    }

    if (isSequential) {
        console.log('[OK] Branch IDs are sequential (1 to n).');
    } else {
        console.error('[FAIL] Branch IDs are NOT sequential.');
    }

    // 2. Check Managers link
    const { data: managers, error: managerError } = await supabase
        .from('users')
        .select('id, username, branch_id')
        .eq('role', 'manager');

    if (managerError) {
        console.error('Error fetching managers:', managerError);
    } else {
        console.log(`Checking ${managers.length} managers...`);
        let managersOk = true;
        for (const m of managers) {
            // Check if branch exists
            const branchExists = branches.find(b => b.id === m.branch_id);
            if (!branchExists) {
                console.error(`[FAIL] Manager ${m.username} links to non-existent branch ${m.branch_id}`);
                managersOk = false;
            }

            // Check username pattern (manager_name_ID)
            const parts = m.username.split('_');
            const idInUsername = parseInt(parts[parts.length - 1]);
            if (!isNaN(idInUsername) && idInUsername !== m.branch_id) {
                console.warn(`[WARN] Manager ${m.username} has mismatching ID in username (Linked to ${m.branch_id})`);
            }
        }
        if (managersOk) console.log('[OK] All managers linked to valid branches.');
    }

    // 3. Check Buildings link
    const { data: buildings, error: buildingError } = await supabase
        .from('building')
        .select('id, branch_id');

    if (buildingError) {
        console.error('Error fetching buildings:', buildingError);
    } else {
        console.log(`Checking ${buildings.length} buildings...`);
        let buildingsOk = true;
        for (const b of buildings) {
            const branchExists = branches.find(br => br.id === b.branch_id);
            if (!branchExists) {
                console.error(`[FAIL] Building ${b.id} links to non-existent branch ${b.branch_id}`);
                buildingsOk = false;
            }
        }
        if (buildingsOk) console.log('[OK] All buildings linked to valid branches.');
    }
}

verifyRenumbering();
