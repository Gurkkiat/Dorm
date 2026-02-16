const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePassword() {
    console.log("Updating mechanic password...");

    const username = 'mechanic_01';
    const newPassword = '123'; // Simple default password

    const { data, error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('username', username)
        .select();

    if (error) {
        console.error("Error updating password:", error);
    } else {
        console.log(`Password for '${username}' updated successfully to '${newPassword}'`);
    }
}

updatePassword();
