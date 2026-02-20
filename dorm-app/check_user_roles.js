const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
    console.log('Checking user roles...');
    const { data, error } = await supabase
        .from('users')
        .select('role');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const roles = {};
    data.forEach(u => {
        roles[u.role] = (roles[u.role] || 0) + 1;
    });

    console.log('Roles found:', roles);
}

checkRoles();
