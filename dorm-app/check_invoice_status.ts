
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatuses() {
    const { data, error } = await supabase
        .from('invoice')
        .select('status');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const statuses = [...new Set(data.map(d => d.status))];
    console.log('Distinct Invoice Statuses:', statuses);
}

checkStatuses();
