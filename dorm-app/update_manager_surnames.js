const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const surnames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
];

function getRandomSurname(index) {
    return surnames[index % surnames.length];
}

async function updateManagerSurnames() {
    console.log('Starting manager surname update...');

    // 1. Fetch all managers
    const { data: managers, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'manager');

    if (fetchError) {
        console.error('Error fetching managers:', fetchError);
        return;
    }

    console.log(`Found ${managers.length} managers.`);
    let updatedCount = 0;

    for (let i = 0; i < managers.length; i++) {
        const manager = managers[i];

        // Check if name ends with " Manager"
        if (manager.full_name && manager.full_name.endsWith(' Manager')) {
            const firstName = manager.full_name.split(' ')[0];
            const newSurname = getRandomSurname(i + manager.id); // Mix index and ID for randomness
            const newFullName = `${firstName} ${newSurname}`;

            // 2. Update Users table
            const { error: userUpdateError } = await supabase
                .from('users')
                .update({ full_name: newFullName })
                .eq('id', manager.id);

            if (userUpdateError) {
                console.error(`Error updating user ${manager.id}:`, userUpdateError.message);
                continue;
            }

            // 3. Update Branch table (if linked)
            if (manager.branch_id) {
                const { error: branchUpdateError } = await supabase
                    .from('branch')
                    .update({ manager_name: newFullName })
                    .eq('id', manager.branch_id);

                if (branchUpdateError) {
                    console.error(`Error updating branch ${manager.branch_id}:`, branchUpdateError.message);
                }
            }

            console.log(`Updated: ${manager.full_name} -> ${newFullName} (Branch: ${manager.branch_id})`);
            updatedCount++;
        }
    }

    console.log(`Update complete. Updated ${updatedCount} managers.`);
}

updateManagerSurnames();
