const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const NUM_BRANCHES = 77;
const BUILDINGS_PER_BRANCH = 5;
const ROOMS_PER_BUILDING = 50;
const BATCH_SIZE = 500;

// Thai Provinces (77)
const THAI_PROVINCES = [
    "Bangkok", "Krabi", "Kanchanaburi", "Kalasin", "Kamphaeng Phet", "Khon Kaen", "Chanthaburi", "Chachoengsao", "Chonburi", "Chainat",
    "Chaiyaphum", "Chumphon", "Chiang Rai", "Chiang Mai", "Trang", "Trat", "Tak", "Nakhon Nayok", "Nakhon Pathom", "Nakhon Phanom",
    "Nakhon Ratchasima", "Nakhon Si Thammarat", "Nakhon Sawan", "Nonthaburi", "Narathiwat", "Nan", "Bueng Kan", "Buriram", "Pathum Thani", "Prachuap Khiri Khan",
    "Prachinburi", "Pattani", "Phra Nakhon Si Ayutthaya", "Phayao", "Phang Nga", "Phatthalung", "Phichit", "Phitsanulok", "Phetchaburi", "Phetchabun",
    "Phrae", "Phuket", "Maha Sarakham", "Mukdahan", "Mae Hong Son", "Yala", "Yasothon", "Roi Et", "Ranong", "Rayong",
    "Ratchaburi", "Lopburi", "Lampang", "Lamphun", "Loei", "Sisaket", "Sakon Nakhon", "Songkhla", "Satun", "Samut Prakan",
    "Samut Songkhram", "Samut Sakhon", "Sa Kaeo", "Saraburi", "Sing Buri", "Sukhothai", "Suphan Buri", "Surat Thani", "Surin", "Nong Khai",
    "Nong Bua Lamphu", "Ang Thong", "Amnat Charoen", "Udon Thani", "Uttaradit", "Uthai Thani", "Ubon Ratchathani"
];

async function seedLargeData() {
    console.log(`Starting seed: ${NUM_BRANCHES} branches, ${BUILDINGS_PER_BRANCH} buildings/branch, ${ROOMS_PER_BUILDING} rooms/building.`);
    const startTime = Date.now();

    // 0. Cleanup Existing Data
    console.log('Cleaning up existing data...');

    // Delete dependent tables first to avoid FK constraints
    const { error: delInvErr } = await supabase.from('invoice').delete().neq('id', 0);
    if (delInvErr) console.error('Error deleting invoices:', delInvErr);

    const { error: delMaintErr } = await supabase.from('maintenance_request').delete().neq('id', 0);
    if (delMaintErr) console.error('Error deleting maintenance requests:', delMaintErr);

    const { error: delContractErr } = await supabase.from('contract').delete().neq('id', 0);
    if (delContractErr) console.error('Error deleting contracts:', delContractErr);

    // Delete in order of dependency: Room -> Building -> Branch
    const { error: delRoomErr } = await supabase.from('room').delete().neq('id', 0); // Delete all rooms
    if (delRoomErr) console.error('Error deleting rooms:', delRoomErr);

    const { error: delBldgErr } = await supabase.from('building').delete().neq('id', 0); // Delete all buildings
    if (delBldgErr) console.error('Error deleting buildings:', delBldgErr);

    const { error: delBranchErr } = await supabase.from('branch').delete().neq('id', 0); // Delete all branches
    if (delBranchErr) console.error('Error deleting branches:', delBranchErr);

    console.log('Cleanup complete. Starting insertion...');

    // 1. Generate Branches
    let branches = [];
    for (let i = 0; i < NUM_BRANCHES; i++) {
        const province = THAI_PROVINCES[i] || `Province ${i + 1}`;
        // Special case for the first branch (Bangkok) to match the seeded 'Admin User' because
        // the App Dashboard looks up branch by manager_name = localStorage.user_name
        const isFirst = i === 0;

        branches.push({
            // Let ID be auto-generated or if we need specific IDs we'd have to force it. 
            // We'll let Postgres handle IDs but we track the 'index' for naming.
            branches_name: `Branch ${province}`,
            manager_name: isFirst ? 'Admin User' : `Manager of ${province}`,
            phone: `02-${String(i + 1).padStart(7, '0')}`,
            address: province,
            city: province,
            region: 'Thailand',
        });
    }

    console.log(`Inserting ${branches.length} branches...`);
    const { data: insertedBranches, error: branchError } = await supabase
        .from('branch')
        .insert(branches)
        .select('id, branches_name, address');

    if (branchError) {
        console.error('Error inserting branches:', branchError);
        return;
    }
    console.log(`Successfully inserted ${insertedBranches.length} branches.`);

    // 2. Generate Buildings
    let buildings = [];
    // insertedBranches has the real DB IDs. 
    // We map correct B{i}D{j} names. 
    // Since insertedBranches order is not guaranteed to match our loop order 100% if async, 
    // but usually it is sequential. However, we can just use the index from the array.

    insertedBranches.forEach((branch, bIdx) => {
        // branch_index for naming: bIdx + 1
        const branchNum = bIdx + 1;
        for (let b = 1; b <= BUILDINGS_PER_BRANCH; b++) {
            buildings.push({
                branch_id: branch.id,
                name_building: `B${branchNum}D${b}`, // e.g. B1D1, B1D2...
                total_floor: 5,
                address: `${branch.address} - Bldg ${b}`,
                elec_meter: 0,
                water_meter: 0
            });
        }
    });

    console.log(`Inserting ${buildings.length} buildings...`);
    const { data: insertedBuildings, error: buildingError } = await supabase
        .from('building')
        .insert(buildings)
        .select('id, name_building, branch_id');

    if (buildingError) {
        console.error('Error inserting buildings:', buildingError);
        return;
    }
    console.log(`Successfully inserted ${insertedBuildings.length} buildings.`);

    // 3. Generate Rooms
    let totalRoomsInserted = 0;
    let roomBatch = [];

    // Need to group buildings by branch to keep naming consistent if we wanted "Room 101 of B1".
    // But room naming is usually just '101', '102'.

    for (const building of insertedBuildings) {
        const buildingId = building.id;

        for (let r = 1; r <= ROOMS_PER_BUILDING; r++) {
            const floor = Math.ceil(r / 10);
            const roomNumVal = (r % 10 === 0) ? 10 : (r % 10);
            const roomNumberStr = `${floor}${String(roomNumVal).padStart(2, '0')}`; // 101, 102...

            roomBatch.push({
                building_id: buildingId,
                room_number: roomNumberStr,
                floor: floor,
                status: 'Vacant',
                pet_status: false,
                water_unit: 0,
                elec_unit: 0,
                rent_price: 5000 + (floor * 100),
                current_residents: 0
            });

            if (roomBatch.length >= BATCH_SIZE) {
                const { error: roomError } = await supabase
                    .from('room')
                    .insert(roomBatch);

                if (roomError) {
                    console.error('Error inserting room batch:', roomError);
                } else {
                    totalRoomsInserted += roomBatch.length;
                    process.stdout.write(`\rInserted ${totalRoomsInserted} rooms...`);
                }
                roomBatch = [];
            }
        }
    }

    if (roomBatch.length > 0) {
        const { error: roomError } = await supabase
            .from('room')
            .insert(roomBatch);

        if (roomError) {
            console.error('Error inserting final room batch:', roomError);
        } else {
            totalRoomsInserted += roomBatch.length;
            console.log(`\rInserted ${totalRoomsInserted} rooms.`);
        }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nDone! Seeding took ${duration.toFixed(2)} seconds.`);
}

seedLargeData();
