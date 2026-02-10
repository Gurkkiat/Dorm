const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHierarchy() {
    console.log('--- Building Table ---');
    const { data: b } = await supabase.from('building').select('*').limit(1);
    if (b && b.length) console.log(Object.keys(b[0]));

    console.log('\n--- Room Table ---');
    const { data: r } = await supabase.from('room').select('*').limit(1);
    if (r && r.length) console.log(Object.keys(r[0]));

    // Check if branch table has any hidden columns or data that helps
    console.log('\n--- Branch Data Sample ---');
    const { data: br } = await supabase.from('branch').select('*').limit(3);
    console.log(br);
}

checkHierarchy();
