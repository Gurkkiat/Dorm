const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testFetch() {
  console.log('Testing fetch from maintenance_timeline...');
  const { data, error } = await supabase.from('maintenance_timeline').select('*').limit(1);
  if (error) {
    console.error('Error fetching timeline:', JSON.stringify(error, null, 2));
  } else {
    console.log('Successfully fetched timeline:', data);
  }

  console.log('Testing join query...');
  const { data: joinData, error: joinError } = await supabase
    .from('maintenance_request')
    .select(`
      id,
      timeline:maintenance_timeline(*)
    `)
    .limit(1);

  if (joinError) {
    console.error('Error fetching join:', JSON.stringify(joinError, null, 2));
  } else {
    console.log('Successfully fetched join:', JSON.stringify(joinData, null, 2));
  }
}

testFetch();
