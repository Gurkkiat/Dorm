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
        postcode: '00000',
        contact_person: 'Test Person',
        line_id: 'testline',
        map_url: 'http://test.com',
        color: '#000000',
        bank_name: 'Test Bank',
        bank_account_name: 'Test Account',
        bank_account_number: '000000',
        promptpay_number: '000'
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
