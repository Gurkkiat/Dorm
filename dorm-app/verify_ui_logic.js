const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyQueries() {
    console.log('--- Verifying UI Logic Queries ---');

    // 1. Fetch All Branches
    console.log('1. Fetching All Branches...');
    const { data: branches, error: branchError } = await supabase
        .from('branch')
        .select('id, city, branches_name')
        .order('id')
        .limit(5); // Limit for safety

    if (branchError) console.error('Error fetching branches:', branchError);
    else console.log(`Fetched ${branches.length} branches. First:`, branches[0]);

    if (!branches || branches.length === 0) return;
    const testBranchId = branches[0].id;

    // 2. Fetch Buildings for Branch
    console.log(`\n2. Fetching Buildings for Branch ID ${testBranchId}...`);
    const { data: buildings, error: buildingError } = await supabase
        .from('building')
        .select('id, name_building')
        .eq('branch_id', testBranchId)
        .order('name_building')
        .limit(5);

    if (buildingError) console.error('Error fetching buildings:', buildingError);
    else console.log(`Fetched ${buildings.length} buildings. First:`, buildings[0]);

    if (!buildings || buildings.length === 0) return;
    const testBuildingId = buildings[0].id;

    // 3. Fetch Rooms for Building (Simulating Contract Page)
    console.log(`\n3. Fetching Rooms for Building ID ${testBuildingId}...`);
    const { data: rooms, error: roomError } = await supabase
        .from('room')
        .select('*, building:building_id!inner(branch_id)')
        .eq('building_id', testBuildingId)
        .order('room_number')
        .limit(5);

    if (roomError) console.error('Error fetching rooms:', roomError);
    else console.log(`Fetched ${rooms.length} rooms. First:`, rooms[0]);

    // 4. Fetch Contracts (Simulating Tenant Page)
    console.log('\n4. Fetching Contracts with Joins (Simulating Tenant Page)...');
    const { data: contracts, error: contractError } = await supabase
        .from('contract')
        .select('*, room:room_id!inner(room_number, building_id, rent_price, building:building_id!inner(branch_id, name_building)), user:user_id(full_name, sex, is_primary_tenant)')
        .order('id', { ascending: true })
        .limit(5);

    if (contractError) console.error('Error fetching contracts:', contractError);
    else {
        console.log(`Fetched ${contracts.length} contracts.`);
        if (contracts.length > 0) {
            console.log('First Contract Sample:', JSON.stringify(contracts[0], null, 2));
        }
    }
}

verifyQueries();
