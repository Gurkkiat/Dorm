const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const universityMapping = {
    'Bangkok': 'Chulalongkorn University',
    'Chiang Mai': 'Chiang Mai University',
    'Khon Kaen': 'Khon Kaen University',
    'Songkhla': 'Prince of Songkla University',
    'Phitsanulok': 'Naresuan University',
    'Chon Buri': 'Burapha University',
    'Pathum Thani': 'Thammasat University',
    'Nakhon Pathom': 'Mahidol University',
    'Chiang Rai': 'Mae Fah Luang University',
    'Phayao': 'University of Phayao',
    'Maha Sarakham': 'Mahasarakham University',
    'Ubon Ratchathani': 'Ubon Ratchathani University',
    'Nakhon Ratchasima': 'Suranaree University of Technology',
    'Nonthaburi': 'Sukhothai Thammathirat Open University',
    'Samut Prakan': 'Huachiew Chalermprakiet University',
    'Phuket': 'Prince of Songkla University (Phuket Campus)',
    'Nakhon Si Thammarat': 'Walailak University',
    'Surat Thani': 'Suratthani Rajabhat University',
    'Pattani': 'Prince of Songkla University (Pattani Campus)',
    'Yala': 'Yala Rajabhat University',
    'Narathiwat': 'Princess of Naradhiwas University',
    'Lopburi': 'Thepsatri Rajabhat University',
    'Ayutthaya': 'Ayutthaya Rajabhat University',
    'Nakhon Sawan': 'Nakhon Sawan Rajabhat University',
    'Kanchanaburi': 'Kanchanaburi Rajabhat University',
    'Phetchaburi': 'Phetchaburi Rajabhat University',
    'Ratchaburi': 'Muban Chombueng Rajabhat University',
    'Buriram': 'Buriram Rajabhat University',
    'Roi Et': 'Roi Et Rajabhat University',
    'Sakon Nakhon': 'Sakon Nakhon Rajabhat University',
    'Surin': 'Surin Rajabhat University',
    'Udon Thani': 'Udon Thani Rajabhat University',
    'Loei': 'Loei Rajabhat University',
    'Chaiyaphum': 'Chaiyaphum Rajabhat University',
    'Kalasin': 'Kalasin University',
    'Sisaket': 'Sisaket Rajabhat University',
    'Nakhon Phanom': 'Nakhon Phanom University',
    'Mukdahan': 'Mukdahan Community College', // Fallback
    'Yasothon': 'Yasothon Community College', // Fallback
    'Amnat Charoen': 'Mahidol University (Amnat Charoen Campus)',
    'Nong Bua Lamphu': 'Nong Bua Lamphu Community College',
    'Nong Khai': 'Khon Kaen University (Nong Khai Campus)',
    'Bueng Kan': 'Bueng Kan Community College',
    'Lamphun': 'Mahachulalongkornrajavidyalaya University (Lamphun)',
    'Lampang': 'Lampang Rajabhat University',
    'Uttaradit': 'Uttaradit Rajabhat University',
    'Phrae': 'Maejo University (Phrae Campus)',
    'Nan': 'Nan Community College',
    'Sukhothai': 'Ramkhamhaeng University (Sukhothai)',
    'Tak': 'Tak Rajabhat University',
    'Kamphaeng Phet': 'Kamphaeng Phet Rajabhat University',
    'Phichit': 'Phichit Community College',
    'Phetchabun': 'Phetchabun Rajabhat University',
    'Uthai Thani': 'Ramkhamhaeng University (Uthai Thani)',
    'Chainat': 'Chainat Community College',
    'Sing Buri': 'Sing Buri Community College',
    'Ang Thong': 'Ang Thong Community College',
    'Saraburi': 'Saraburi Technical College', // Fallback
    'Nakhon Nayok': 'Srinakharinwirot University (Ongkharak)',
    'Prachin Buri': 'King Mongkut\'s University of Technology North Bangkok (Prachin Buri)',
    'Sa Kaeo': 'Burapha University (Sa Kaeo Campus)',
    'Chachoengsao': 'Rajabhat Rajanagarindra University',
    'Chanthaburi': 'Rambhai Barni Rajabhat University',
    'Trat': 'Trat Community College',
    'Rayong': 'King Mongkut\'s University of Technology North Bangkok (Rayong)',
    'Prachuap Khiri Khan': 'Rajamangala University of Technology Rattanakosin (Wang Klai Kangwon)',
    'Chumphon': 'King Mongkut\'s Institute of Technology Ladkrabang (Prince of Chumphon)',
    'Ranong': 'Ranong Community College',
    'Phang Nga': 'Phang Nga Community College',
    'Krabi': 'Krabi Physical Education College',
    'Trang': 'Prince of Songkla University (Trang Campus)',
    'Phatthalung': 'Thaksin University (Phatthalung Campus)',
    'Satun': 'Satun Community College'
};

async function updateBranchNames() {
    console.log('Updating branch names...');

    const { data: branches, error: fetchError } = await supabase
        .from('branch')
        .select('id, city');

    if (fetchError) {
        console.error('Error fetching branches:', fetchError);
        return;
    }

    for (const branch of branches) {
        let uniName = universityMapping[branch.city];

        if (!uniName) {
            // Generic fallback
            uniName = `${branch.city} University`;
        }

        const newName = `${uniName} Branch`;

        const { error: updateError } = await supabase
            .from('branch')
            .update({ branches_name: newName })
            .eq('id', branch.id);

        if (updateError) {
            console.error(`Error updating branch ${branch.id} (${branch.city}):`, updateError.message);
        } else {
            console.log(`Updated branch ${branch.id} to "${newName}"`);
        }
    }

    console.log('Update complete.');
}

updateBranchNames();
