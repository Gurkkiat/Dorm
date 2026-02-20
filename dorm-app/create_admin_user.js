const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
    console.log('--- Creating Admin User ---');

    const adminUser = {
        username: 'admin',
        password: 'password123', // Simple password for testing
        full_name: 'System Admin',
        role: 'admin',
        branch_id: null
    };

    // Check if exists
    const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('username', 'admin')
        .single();

    if (existing) {
        console.log('Admin user already exists:', existing);
        return;
    }

    const { data, error } = await supabase
        .from('users')
        .insert([adminUser])
        .select()
        .single();

    if (error) {
        console.error('Error creating admin:', error);
    } else {
        console.log('Admin user created successfully:', data);
    }
}

createAdmin();
