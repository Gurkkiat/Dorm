const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRooms() {
    console.log('--- Debugging Room & Contract Statuses ---');

    // 1. Fetch Rooms and check statuses
    const { data: rooms, error: roomError } = await supabase
        .from('room')
        .select('id, room_number, status, building_id');

    if (roomError) {
        console.error('Error fetching rooms:', roomError);
    } else {
        console.log(`Total Rooms: ${rooms.length}`);
        const roomStatuses = {};
        rooms.forEach(r => {
            roomStatuses[r.status] = (roomStatuses[r.status] || 0) + 1;
        });
        console.log('Room Status Breakdown:', roomStatuses);
    }

    // 2. Fetch Contracts and check statuses
    const { data: contracts, error: contractError } = await supabase
        .from('contract')
        .select('id, room_id, status');

    if (contractError) {
        console.error('Error fetching contracts:', contractError);
    } else {
        console.log(`Total Contracts: ${contracts.length}`);
        const contractStatuses = {};
        contracts.forEach(c => {
            contractStatuses[c.status] = (contractStatuses[c.status] || 0) + 1;
        });
        console.log('Contract Status Breakdown:', contractStatuses);
    }
}

debugRooms();
