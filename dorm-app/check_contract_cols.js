const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local
const envPath = path.resolve(__dirname, '.env.local');
const envConfig = require('dotenv').config({ path: envPath }).parsed || {};

// Fallback to manual parsing
if (!envConfig.NEXT_PUBLIC_SUPABASE_URL) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            envConfig[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
    });
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkContractColumns() {
    const { data, error } = await supabase
        .from('contract')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching contract:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Contract keys:', Object.keys(data[0]));
    } else {
        // If no data, try to insert a dummy to see error or just print "No data"
        // But we need to see keys. If no data, we can't see keys easily with just SELECT * on supabase-js without data.
        // Actually, we can assume if no data, we might not be able to check keys easily this way.
        // Let's try to select specific column 'rent_price' and see if it errors.
        console.log('No contracts found. Testing selection of rent_price...');
        const { error: colError } = await supabase.from('contract').select('rent_price').limit(1);
        if (colError) {
            console.log('Error selecting rent_price:', colError.message);
        } else {
            console.log('Successfully selected rent_price (column exists).');
        }
    }
}

checkContractColumns();
