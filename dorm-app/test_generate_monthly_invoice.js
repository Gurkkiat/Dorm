const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedEquipmentForActiveRooms() {
    console.log('--- Seeding Equipment for Active Rooms ---');

    // 1. Get Active Contracts
    const { data: contracts, error } = await supabase
        .from('contract')
        .select('id, room_id, status')
        .in('status', ['active', 'Active', 'complete', 'Complete']);

    if (error) {
        console.error('Error fetching contracts:', error);
        return;
    }

    console.log(`Found ${contracts.length} active contracts.`);

    for (const contract of contracts) {
        const roomId = contract.room_id;

        // Check if equipment exists
        const { data: existing, error: checkError } = await supabase
            .from('equipment')
            .select('id')
            .eq('room_id', roomId);

        if (existing && existing.length > 0) {
            console.log(`Room ${roomId} already has ${existing.length} items. Skipping.`);
            continue;
        }

        console.log(`Seeding equipment for Room ${roomId}...`);

        const equipmentList = [
            {
                room_id: roomId,
                name: 'Air Conditioner',
                is_elec: true,
                status_equipment: 'Good',
                purchase_at: new Date().toISOString(),
                serial_number: `AC-${roomId}-${Date.now()}`
            },
            {
                room_id: roomId,
                name: 'Water Heater',
                is_elec: true,
                status_equipment: 'Good',
                purchase_at: new Date().toISOString(),
                serial_number: `WH-${roomId}-${Date.now()}`
            },
            {
                room_id: roomId,
                name: 'Bed',
                is_elec: false,
                status_equipment: 'Good',
                purchase_at: new Date().toISOString(),
                serial_number: `BD-${roomId}-${Date.now()}`
            },
            {
                room_id: roomId,
                name: 'Wardrobe',
                is_elec: false,
                status_equipment: 'Good',
                purchase_at: new Date().toISOString(),
                serial_number: `WD-${roomId}-${Date.now()}`
            }
        ];

        const { error: insertError } = await supabase
            .from('equipment')
            .insert(equipmentList);

        if (insertError) {
            console.error(`Failed to seed Room ${roomId}:`, insertError);
        } else {
            console.log(`Successfully seeded Room ${roomId}.`);
        }
    }
}

seedEquipmentForActiveRooms();
