/**
 * seed_equipment_50.js
 * Seeds 50 different types of equipment across all rooms.
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const EQUIPMENT_TYPES = [
    { name: 'Air Conditioner', is_elec: true },
    { name: 'Water Heater', is_elec: true },
    { name: 'Bed Frame (Queen Size)', is_elec: false },
    { name: 'Mattress (Queen Size)', is_elec: false },
    { name: 'Wardrobe (Built-in)', is_elec: false },
    { name: 'Study Desk', is_elec: false },
    { name: 'Ergonomic Chair', is_elec: false },
    { name: 'Refrigerator (2 Doors)', is_elec: true },
    { name: 'Microwave Oven', is_elec: true },
    { name: 'Smart Television (43")', is_elec: true },
    { name: 'Electric Kettle', is_elec: true },
    { name: 'Table Lamp', is_elec: true },
    { name: 'Blackout Curtains', is_elec: false },
    { name: 'Trash Can (Pedal Type)', is_elec: false },
    { name: 'Full-length Mirror', is_elec: false },
    { name: 'Wall Bookshelf', is_elec: false },
    { name: 'Shoe Rack', is_elec: false },
    { name: 'Stand Fan', is_elec: true },
    { name: 'Exhaust Fan (Bathroom)', is_elec: true },
    { name: 'Smart Door Lock', is_elec: true },
    { name: 'Smoke Detector', is_elec: true },
    { name: 'Fire Extinguisher', is_elec: false },
    { name: 'Power Strip (4 Sockets)', is_elec: true },
    { name: 'Wi-Fi Router', is_elec: true },
    { name: 'Window Mosquito Screen', is_elec: false },
    { name: 'Stainless Steel Sink Tap', is_elec: false },
    { name: 'Rain Shower Head', is_elec: false },
    { name: 'Dual Flush Toilet System', is_elec: false },
    { name: 'Wall-mounted Towel Rack', is_elec: false },
    { name: 'Automatic Soap Dispenser', is_elec: true },
    { name: 'Memory Foam Pillows (Set of 2)', is_elec: false },
    { name: 'Bedside Table', is_elec: false },
    { name: 'Soft Area Rug', is_elec: false },
    { name: 'Wooden Hangers (Set of 10)', is_elec: false },
    { name: 'Digital Wall Clock', is_elec: true },
    { name: 'Decorative Picture Frame', is_elec: false },
    { name: 'Induction Cooker', is_elec: true },
    { name: 'Non-stick Pot & Pan Set', is_elec: false },
    { name: 'Ceramic Plates & Bowls Set', is_elec: false },
    { name: 'Stainless Steel Cutlery Set', is_elec: false },
    { name: 'Compact Dish Rack', is_elec: false },
    { name: 'Steam Iron', is_elec: true },
    { name: 'Foldable Ironing Board', is_elec: false },
    { name: 'Handheld Vacuum Cleaner', is_elec: true },
    { name: 'Microfiber Mop & Broom Set', is_elec: false },
    { name: 'Laundry Basket', is_elec: false },
    { name: 'Foldable Clothes Drying Rack', is_elec: false },
    { name: 'Welcome Door Mat', is_elec: false },
    { name: 'Extension Cord (5m)', is_elec: true },
    { name: 'Plug-in Night Light', is_elec: true }
];

async function seed() {
    console.log('Seeding 50 types of equipment...');

    // Delete existing equipment first to avoid duplicates if re-running
    const { error: delError } = await supabase.from('equipment').delete().neq('id', 0);
    if (delError) console.error('Error cleaning equipment:', delError);

    // Get all rooms
    const { data: rooms } = await supabase.from('room').select('id, room_number');
    if (!rooms) return;

    console.log(`Assigning equipment to ${rooms.length} rooms...`);

    const allRecords = [];

    for (const room of rooms) {
        // Every room gets at least these basics
        const basics = EQUIPMENT_TYPES.slice(0, 10);
        
        // And a random selection of 10-15 other items
        const shuffled = EQUIPMENT_TYPES.slice(10).sort(() => 0.5 - Math.random());
        const randomItems = shuffled.slice(0, 10 + Math.floor(Math.random() * 6));

        const roomEquipment = [...basics, ...randomItems];

        roomEquipment.forEach((type, idx) => {
            allRecords.push({
                room_id: room.id,
                name: type.name,
                is_elec: type.is_elec,
                serial_number: `EQ-${room.room_number}-${(idx + 1).toString().padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                status_equipment: 'Good',
                purchase_at: new Date(Date.now() - Math.random() * 31536000000).toISOString(), // Bought in last year
                last_maintained_at: new Date().toISOString(),
                maintained_count: 0
            });
        });
    }

    // Insert in batches
    const BATCH_SIZE = 200;
    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
        const batch = allRecords.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('equipment').insert(batch);
        if (error) {
            console.error('Error inserting batch:', error.message);
        } else {
            console.log(`Inserted ${i + batch.length} / ${allRecords.length} records...`);
        }
    }

    console.log('Done! All equipment seeded.');
}

seed();
