const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listBranches() {
    console.log('Listing branches...');
    const { data, error } = await supabase
        .from('branch')
        .select('id, branches_name, city, region')
        .order('id');

    if (error) {
        console.error('Error fetching branches:', error);
        return;
    }

    console.log(`Found ${data.length} branches:`);
    data.forEach(b => {
        console.log(`ID: ${b.id}, Name: ${b.branches_name}, City: ${b.city}, Region: ${b.region}`);
    });
}

listBranches();
