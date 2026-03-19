/**
 * delete_room.js
 * Usage: node delete_room.js <room_number> <building_name>
 * Example: node delete_room.js 201 "Building 2"
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteRoom() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: node delete_room.js <room_number> <building_name>');
        process.exit(1);
    }

    const [roomNumber, buildingName] = args;
    console.log(`Searching for Room ${roomNumber} in ${buildingName}...`);

    try {
        // 1. Get Room ID
        const { data: room, error: roomError } = await supabase
            .from('room')
            .select('id, building_id, building:building_id(name_building)')
            .eq('room_number', roomNumber)
            .eq('building:building_id.name_building', buildingName)
            .single();

        // Wait, the filter above might not work if building is a nested select
        // Let's do it separately
        const { data: rooms, error: roomsError } = await supabase
            .from('room')
            .select('id, room_number, building_id, building:building_id(name_building)');

        const targetRoom = rooms.find(r => r.room_number == roomNumber && r.building?.name_building === buildingName);

        if (!targetRoom) throw new Error(`Room ${roomNumber} in ${buildingName} not found.`);
        console.log(`Found Room ID: ${targetRoom.id}`);

        // 2. Find all Contracts for this room
        const { data: contracts } = await supabase.from('contract').select('id').eq('room_id', targetRoom.id);
        const contractIds = contracts.map(c => c.id);

        if (contractIds.length > 0) {
            console.log(`Deleting data for ${contractIds.length} contracts...`);

            // 3. Delete Invoices & Meter Readings
            await supabase.from('invoice').delete().in('contract_id', contractIds);
            await supabase.from('meter_reading').delete().in('contract_id', contractIds);
            console.log('- Invoices and Meter Readings deleted.');

            // 4. Delete Maintenance
            await supabase.from('maintenance_request').delete().eq('room_id', targetRoom.id);
            console.log('- Maintenance requests deleted.');

            // 5. Delete Contracts
            await supabase.from('contract').delete().eq('room_id', targetRoom.id);
            console.log('- Contracts deleted.');
        }

        // 6. Delete Room
        const { error: delError } = await supabase.from('room').delete().eq('id', targetRoom.id);
        if (delError) throw delError;

        console.log(`Successfully deleted Room ${roomNumber}.`);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

deleteRoom();
