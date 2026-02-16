const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedMechanic() {
    console.log("Seeding mechanic user...");

    const mechanicUser = {
        username: 'mechanic_01',
        full_name: 'Mike the Mechanic',
        phone: '0812345678',
        e_mail: 'mechanic@dorm.com',
        role: 'mechanic', // Crucial field
        sex: 'Male',
        pet: 'No',
        identification_number: '1234567890123',
        identification_type: 'ID Card',
        nation: 'Thai',
        is_primary_tenant: false
    };

    // Check if exists
    const { data: existing } = await supabase
        .from('users') // confirmed table name is 'users'
        .select('id')
        .eq('username', mechanicUser.username)
        .single();

    if (existing) {
        console.log(`Mechanic user '${mechanicUser.username}' already exists. ID: ${existing.id}`);
        return;
    }

    const { data, error } = await supabase
        .from('users')
        .insert([mechanicUser])
        .select()
        .single();

    if (error) {
        console.error("Error creating mechanic:", error);
    } else {
        console.log("Mechanic created successfully!");
        console.log("Username:", mechanicUser.username);
        console.log("ID:", data.id);
        console.log("Role:", data.role);
    }
}

seedMechanic();
