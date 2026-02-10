const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  try {
    console.log('--- Users Table Columns ---');
    const { data: user, error: userError } = await supabase.from('users').select('*').limit(1);
    if (user && user.length) {
      console.log(Object.keys(user[0]));
    } else {
      console.log('No user data or error:', userError);
    }

    console.log('\n--- Branch Table Columns ---');
    const { data: branch, error: branchError } = await supabase.from('branch').select('*').limit(1);
    if (branch && branch.length) {
      console.log(Object.keys(branch[0]));
    } else {
      console.log('No branch data or error:', branchError);
    }
  } catch (err) {
    console.error(err);
  }
}

checkSchema();
