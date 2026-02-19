const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedUsers() {
    console.log('Seeding users...');

    const users = [
        {
            username: 'admin_user',
            password: '123',
            full_name: 'Admin User',
            phone: '0812345678',
            e_mail: 'admin@example.com',
            role: 'Admin',
            sex: 'Male',
            pet: 'None',
            identification_number: '1234567890123',
            identification_type: 'National ID',
            nation: 'Thai',
            is_primary_tenant: true
        },
        {
            username: 'test_user',
            password: '123',
            full_name: 'Test Tenant',
            phone: '0898765432',
            e_mail: 'tenant@example.com',
            role: 'User',
            sex: 'Female',
            pet: 'Cat',
            identification_number: '9876543210987',
            identification_type: 'National ID',
            nation: 'Thai',
        },
        {
            username: 'test_user',
            password: '123',
            full_name: 'Test Tenant',
            phone: '0898765432',
            e_mail: 'tenant@example.com',
            role: 'User',
            sex: 'Female',
            pet: 'Cat',
            identification_number: '9876543210987',
            identification_type: 'National ID',
            nation: 'Thai',
            is_primary_tenant: true
        }
    ];

    // Fetch Branch ID for Manager
    const { data: branchData, error: branchError } = await supabase
        .from('branch')
        .select('id')
        .ilike('branches_name', '%Bangkok%') // Adjust if needed
        .limit(1)
        .single();

    if (branchError) {
        console.warn('Could not find Bangkok branch. skipping manager_a creation or defaulting to null.');
    }

    const bangkokBranchId = branchData ? branchData.id : null;

    if (bangkokBranchId) {
        users.push({
            username: 'manager_a',
            password: '123',
            full_name: 'Manager A',
            phone: '0811111111',
            e_mail: 'manager_a@example.com',
            role: 'Manager',
            sex: 'Male',
            pet: 'None',
            identification_number: '1111111111111',
            identification_type: 'National ID',
            nation: 'Thai',
            is_primary_tenant: false,
            branch_id: bangkokBranchId
        });
    } else {
        console.log('Skipping manager_a creation: No Bangkok branch found.');
    }

    for (const user of users) {
        // Check if user exists
        const { data: existing, error: checkError } = await supabase
            .from('users')
            .select('*')
            .eq('username', user.username)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is code for no rows found when using .single()
            console.error(`Error checking user ${user.username}:`, checkError.message);
            continue;
        }

        if (existing) {
            console.log(`User ${user.username} already exists. Updating password...`);
            // Update password
            const { error: updateError } = await supabase
                .from('users')
                .update({ password: user.password })
                .eq('username', user.username);

            if (updateError) {
                console.error(`Error updating user ${user.username}:`, updateError.message);
            } else {
                console.log(`User ${user.username} updated successfully.`);
            }
        } else {
            const { data: inserted, error: insertError } = await supabase
                .from('users')
                .insert([user])
                .select();

            if (insertError) {
                console.error(`Error inserting user ${user.username}:`, insertError.message);
            } else {
                console.log(`User ${user.username} inserted successfully.`);
            }
        }
    }
    console.log('Seeding complete.');
}

seedUsers();
