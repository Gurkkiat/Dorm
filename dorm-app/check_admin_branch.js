const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminBranch() {
    console.log('--- Checking Admin User Branch ---');

    // Look for branch where manager_name is 'Admin User'
    const { data: branch, error } = await supabase
        .from('branch')
        .select('*')
        .eq('manager_name', 'Admin User')
        .single();

    if (error) {
        console.error('Error finding branch for Admin User:', error);
    } else {
        console.log('Found branch for Admin User:');
        console.table([branch]);
    }
}

checkAdminBranch();
