const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoomSchema() {
    console.log('Checking "room" table columns...');
    const { data: rooms, error } = await supabase.from('room').select('*').limit(1);

    if (error) {
        console.error('Error fetching room:', error);
        return;
    }

    if (rooms && rooms.length > 0) {
        console.log('Room keys:', Object.keys(rooms[0]));
    } else {
        console.log('No rooms found.');
    }
}

checkRoomSchema();
