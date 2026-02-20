const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const tenants = [
    { thaiName: 'เกริกเกียรติ ทวีขวัญ', username: 'krerkkiat' },
    { thaiName: 'กฤตธี ปานทอง', username: 'kritthi' },
    { thaiName: 'ชนาเดช กุลกรอม', username: 'chanadech' },
    { thaiName: 'พัชรพล จันทร์แพ', username: 'patcharapol' },
    { thaiName: 'ณัฐเศรษฐ์ ศรีกลัด', username: 'natthaset' },
    { thaiName: 'เทพทัต พึ่งศักดิ์', username: 'theptat' },
    { thaiName: 'พรประเสริฐ กอนมน', username: 'pornprasert' },
    { thaiName: 'ธนเดช สุขสมพงษ์', username: 'thanadech' },
    { thaiName: 'กฤษกร ดำมินเศก', username: 'kritsakorn' },
    { thaiName: 'ภาณุพงศ์ ภู่ระหงษ์', username: 'panupong' },
    { thaiName: 'สิริวัฒน์ ชำนาญช่าง', username: 'siriwat' }
];

async function seedTenants() {
    console.log('Seeding specific tenants...');

    for (let i = 0; i < tenants.length; i++) {
        const t = tenants[i];
        const user = {
            username: t.username,
            password: '123',
            full_name: t.thaiName,
            phone: `08${String(i).padStart(8, '0')}`, // Dummy phone
            e_mail: `${t.username}@example.com`,
            role: 'tenant', // Using 'tenant' as it was the majority role
            sex: 'Male', // Defaulting to Male as names seem masculine, but can be updated
            pet: 'None',
            identification_number: `1${String(i).padStart(12, '0')}`, // Dummy ID
            identification_type: 'National ID',
            nation: 'Thai',
            is_primary_tenant: true
        };

        const { data, error } = await supabase
            .from('users')
            .upsert(user, { onConflict: 'username' })
            .select();

        if (error) {
            console.error(`Error seeding ${t.username}:`, error.message);
        } else {
            console.log(`Seeded ${t.username} (${t.thaiName})`);
        }
    }

    console.log('Seeding complete.');
}

seedTenants();
