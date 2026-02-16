const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsertRoom() {
    // 1. Get a building ID
    const { data: buildings, error: buildError } = await supabase
        .from('building')
        .select('id')
        .limit(1);

    if (buildError || !buildings || buildings.length === 0) {
        console.error('Could not get a building ID:', buildError);
        return;
    }
    const buildingId = buildings[0].id;
    console.log(`Using building ID: ${buildingId}`);

    // 2. Try to insert a room
    const roomPayload = {
        building_id: buildingId,
        room_number: 'TEST-999',
        floor: 1,
        status: 'Vacant',
        pet_status: false,
        water_unit: 0,
        elec_unit: 0,
        rent_price: 5000,
        current_residents: 0
    };

    console.log('Attempting to insert:', roomPayload);
    const { data, error } = await supabase
        .from('room')
        .insert([roomPayload])
        .select();

    if (error) {
        console.error('Insert failed:', error);
    } else {
        console.log('Insert successful:', data);
        // Clean up
        const { error: delError } = await supabase
            .from('room')
            .delete()
            .eq('id', data[0].id);

        if (delError) console.error('Cleanup failed:', delError);
        else console.log('Cleanup successful.');
    }
}

testInsertRoom();
