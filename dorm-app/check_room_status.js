const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoomStatus() {
    const { data: rooms } = await supabase.from('room').select('status');
    console.log([...new Set(rooms.map(r => r.status))]);
}

checkRoomStatus();
