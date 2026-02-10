const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local
const envPath = path.resolve(__dirname, '.env.local');
const envConfig = require('dotenv').config({ path: envPath }).parsed || {};

// Fallback to manual parsing if dotenv fails or plain file reading
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

async function checkRoomColumns() {
    const { data, error } = await supabase
        .from('room')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching room:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Room keys:', Object.keys(data[0]));
    } else {
        console.log('No rooms found to check columns.');
    }
}

checkRoomColumns();
