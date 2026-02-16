const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_EQUIPMENT = [
    { name: 'Air Conditioner', is_elec: true },
    { name: 'Water Heater', is_elec: true },
    { name: 'Bed (Queen Size)', is_elec: false },
    { name: 'Wardrobe', is_elec: false },
    { name: 'Work Desk', is_elec: false },
];

async function seedEquipment() {
    console.log('Starting equipment seed...');

    // 1. Get all rooms
    const { data: rooms, error: roomError } = await supabase
        .from('room')
        .select('id, room_number');

    if (roomError) {
        console.error('Error fetching rooms:', roomError);
        return;
    }

    console.log(`Found ${rooms.length} rooms. Generating equipment...`);

    const allEquipment = [];

    for (const room of rooms) {
        // Determine number of items to add (randomly select 3-5 items)
        // For consistency for testing, let's just add all 5 to every room for now

        DEFAULT_EQUIPMENT.forEach((item, index) => {
            allEquipment.push({
                room_id: room.id,
                name: item.name,
                is_elec: item.is_elec, // Make sure column name matches DB
                serial_number: `EQ-${room.room_number}-${index}-${Date.now().toString().slice(-4)}`,
                status_equipment: 'Good',
                purchase_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
                last_maintained_at: new Date().toISOString(),
                maintained_count: 0
            });
        });
    }

    // Insert in batches to avoid payload limits
    const BATCH_SIZE = 100;
    for (let i = 0; i < allEquipment.length; i += BATCH_SIZE) {
        const batch = allEquipment.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('equipment').insert(batch);

        if (error) {
            console.error(`Error inserting batch ${i}:`, error);
        } else {
            console.log(`Inserted batch ${i / BATCH_SIZE + 1} (${batch.length} items)`);
        }
    }

    console.log('Equipment seeding completed!');
}

seedEquipment();
