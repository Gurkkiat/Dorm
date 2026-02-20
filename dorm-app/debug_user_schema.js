const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserSchema() {
    console.log('Fetching one user to check schema...');
    const { data: users, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    if (users && users.length > 0) {
        console.log('User keys:', Object.keys(users[0]));
        console.log('Sample user:', users[0]);
    } else {
        console.log('No users found.');
    }
}

checkUserSchema();
