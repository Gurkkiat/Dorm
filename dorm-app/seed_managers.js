const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const maleNames = [
    'Adam', 'Michel', 'David', 'James', 'Robert', 'John', 'Michael', 'William', 'Richard', 'Joseph',
    'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul',
    'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason'
];

const femaleNames = [
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
    'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
    'Dorothy', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Sharon', 'Laura', 'Cynthia'
];

const surnames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'
];

const allNames = [...maleNames, ...femaleNames];

function getRandomName(index) {
    return allNames[index % allNames.length];
}

function getRandomSurname(index) {
    return surnames[index % surnames.length];
}

async function seedManagers() {
    console.log('Starting Manager seed process...');

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
            console.error(`Error checking managers for branch ${branch.id}:`, checkError.message);
            continue;
        }

        if (existingManagers && existingManagers.length > 0) {
            console.log(`Branch ID ${branch.id} already has a manager. Skipping.`);
            existingCount++;
            continue;
        }

        // 3. Generate Manager Data
        const firstName = getRandomName(i);
        const lastName = getRandomSurname(i + branch.id);
        const fullName = `${firstName} ${lastName}`;
        const username = `manager_${firstName.toLowerCase()}_${branch.id}`;
        const email = `${username}@dorm.com`;
        const password = '123'; // Default password for mock data

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

        // 4. Insert Manager into Users Table
        const { data: createdUser, error: createError } = await supabase
            .from('users')
            .insert([newUser])
            .select()
            .single();

        if (createError) {
            console.error(`Error creating manager for branch ${branch.id}:`, createError.message);
            continue;
        }

        // 5. Link Manager Name to Branch Table
        const { error: linkError } = await supabase
            .from('branch')
            .update({ manager_name: fullName })
            .eq('id', branch.id);

        if (linkError) {
            console.error(`Error linking manager to branch ${branch.id}:`, linkError.message);
        } else {
            console.log(`Created & Linked Manager: ${fullName} (${username}) -> Branch ${branch.id}`);
            createdCount++;
        }
    }

    console.log('\n--- Seed Complete ---');
    console.log(`Managers exists (Skipped): ${existingCount}`);
    console.log(`Managers created: ${createdCount}`);
}

seedManagers();
