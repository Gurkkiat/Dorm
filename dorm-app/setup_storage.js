const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Prefer service role key for admin tasks like creating buckets
const keyToUse = serviceRoleKey || supabaseKey;

if (!supabaseUrl || !keyToUse) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, keyToUse);

async function setupBucket() {
    console.log('Checking storage buckets...');

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('Error listing buckets:', listError);
        return;
    }

    const bucketName = 'maintenance-photos';
    const existingBucket = buckets.find(b => b.name === bucketName);

    if (existingBucket) {
        console.log(`Bucket '${bucketName}' already exists.`);
    } else {
        console.log(`Bucket '${bucketName}' not found. Creating...`);

        const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true, // Make it public so we can easily read the images
            fileSizeLimit: 5242880, // 5MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
        });

        if (createError) {
            console.error('Error creating bucket:', createError);
            console.log('NOTE: If this failed due to permissions, you might need to create the bucket manually in the Supabase Dashboard.');
        } else {
            console.log(`Bucket '${bucketName}' created successfully.`);
        }
    }
}

setupBucket();
