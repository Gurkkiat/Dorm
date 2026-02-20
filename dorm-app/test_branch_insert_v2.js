const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testExplicitId() {
    console.log('Testing insertion of branch with explicit ID -1...');

    const newBranch = {
        id: -1,
        branches_name: 'Test Branch Explicit ID',
        address: 'Test Address',
        phone: '0000000000',
        city: 'Test City',
        region: 'Test Region'
    };

    const { data, error } = await supabase
        .from('branch')
        .insert([newBranch])
        .select();

    if (error) {
        console.error('Error inserting with explicit ID:', error);
    } else {
        console.log('Successfully inserted branch with ID -1:', data);

        // Clean up
        const { error: deleteError } = await supabase.from('branch').delete().eq('id', -1);
        if (deleteError) console.error('Error cleaning up:', deleteError);
        else console.log('Cleanup successful.');
    }
}

testExplicitId();
