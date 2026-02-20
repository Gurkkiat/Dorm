const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Using anon key might be enough if policies allow, but service_role is better for admin tasks if available. Assuming anon for now as per other scripts.
const supabase = createClient(supabaseUrl, supabaseKey);

const maleNames = [
    'Adam', 'Michel', 'David', 'James', 'Robert', 'John', 'Michael', 'William', 'Richard', 'Joseph',
    'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul',
    'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason',
    'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin',
    'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Gregory', 'Frank', 'Alexander', 'Raymond', 'Patrick', 'Jack'
];

const femaleNames = [
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
    'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
    'Dorothy', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia',
    'Kathleen', 'Amy', 'Shirley', 'Angela', 'Helen', 'Anna', 'Brenda', 'Pamela', 'Nicole', 'Emma',
    'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel', 'Catherine', 'Carolyn', 'Janet', 'Ruth', 'Maria'
];

const allNames = [...maleNames, ...femaleNames];

function getRandomName(index) {
    // Use index to deterministically pick a name if possible, or just random
    return allNames[index % allNames.length];
}

async function createBranchManagers() {
    console.log('Starting branch manager creation...');

    // 1. Fetch all branches
    const { data: branches, error: branchError } = await supabase
        .from('branch')
        .select('*');

    if (branchError) {
        console.error('Error fetching branches:', branchError);
        return;
    }

    console.log(`Found ${branches.length} branches.`);

    let createdCount = 0;
    let existingCount = 0;

    for (let i = 0; i < branches.length; i++) {
        const branch = branches[i];

        // 2. Check if manager exists for this branch
        const { data: existingManagers, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'manager')
            .eq('branch_id', branch.id);

        if (checkError) {
            console.error(`Error checking managers for branch ${branch.id}:`, checkError);
            continue;
        }

        if (existingManagers && existingManagers.length > 0) {
            console.log(`Branch ${branch.branches_name} (ID: ${branch.id}) already has a manager.`);
            existingCount++;
            continue;
        }

        // 3. Create new manager
        const firstName = getRandomName(i);
        const lastName = 'Manager';
        const fullName = `${firstName} ${lastName}`;
        const username = `manager_${firstName.toLowerCase()}_${branch.id}`; // Ensure uniqueness
        const email = `${username}@dorm.com`;

        // Use a simple password as per other seed scripts
        const password = '123';

        const newUser = {
            username: username,
            password: password,
            full_name: fullName,
            phone: `08${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
            e_mail: email,
            role: 'manager',
            sex: i % 2 === 0 ? 'Male' : 'Female',
            pet: 'No',
            identification_number: Math.floor(Math.random() * 1000000000000).toString().padStart(13, '0'),
            identification_type: 'ID Card',
            nation: 'Thai',
            is_primary_tenant: false,
            branch_id: branch.id
        };

        const { data: createdUser, error: createError } = await supabase
            .from('users')
            .insert([newUser])
            .select();

        if (createError) {
            console.error(`Error creating manager for branch ${branch.id}:`, createError);
        } else {
            console.log(`Created manager: ${fullName} (${username}) for branch ${branch.branches_name}`);
            createdCount++;
        }
    }

    console.log('------------------------------------------------');
    console.log(`Process complete.`);
    console.log(`Managers exists: ${existingCount}`);
    console.log(`Managers created: ${createdCount}`);
}

createBranchManagers();
