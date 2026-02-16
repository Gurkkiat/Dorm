const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    const { data: users, error } = await supabase.from('users').select('*').limit(1);
    console.log('Error:', error);
    if (users && users.length > 0) {
        console.log('User keys:', Object.keys(users[0]));
    } else {
        console.log('No users found to check keys');
    }
}

checkUsers();
