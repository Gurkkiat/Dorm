const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBranchColumns() {
    console.log('Fetching branch columns...');
    const { data: branches, error } = await supabase.from('branch').select('*').limit(1);

    if (error) {
        console.error('Error fetching branch:', error);
        return;
    }

    if (branches && branches.length > 0) {
        console.log('Branch keys:', Object.keys(branches[0]));
    } else {
        console.log('No branches found.');
    }
}

checkBranchColumns();
