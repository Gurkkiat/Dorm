const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setPendingInvoice() {
    console.log('Setting an invoice to Pending...');

    // Find an Unpaid invoice
    // Or restart from scratch if none found or force update recent one

    // Let's just update the one we touched last time or any Unpaid one
    const { data: invoice, error: fetchError } = await supabase
        .from('invoice')
        .select('id')
        .or('status.eq.Unpaid,status.eq.Pending')
        .limit(1)
        .single();

    if (fetchError || !invoice) {
        console.error('No suitable invoice found to update.');
        return;
    }

    console.log(`Updating Invoice ID ${invoice.id} to Pending with correct mock path...`);

    const { error: updateError } = await supabase
        .from('invoice')
        .update({ status: 'Pending', payment_slip: '/mock_slip.svg' }) // Changed to .svg
        .eq('id', invoice.id);

    if (updateError) {
        console.error('Error updating invoice:', updateError);
    } else {
        console.log(`Invoice ${invoice.id} set to Pending with /mock_slip.svg`);
    }
}

setPendingInvoice();
