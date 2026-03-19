import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
    try {
        console.log('--- [CRON] Checking Overdue Invoices ---');

        // Security check
        const authHeader = request.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
        const isLocalDev = process.env.NODE_ENV === 'development';
        const urlParams = new URL(request.url).searchParams;
        const localSecret = urlParams.get('secret');

        if (!isLocalDev && authHeader !== expectedAuth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (isLocalDev && localSecret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch all Unpaid invoices that are past due
        const now = new Date();
        const { data: invoices, error: invoiceError } = await supabase
            .from('invoice')
            .select('*, contract(*, user(*), room(*))')
            .eq('status', 'Unpaid')
            .lt('due_date', now.toISOString());

        if (invoiceError) {
            console.error('Error fetching overdue invoices:', invoiceError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        console.log(`Found ${invoices?.length || 0} potentially overdue invoices.`);

        let tier1Count = 0;
        let tier2Count = 0;

        for (const invoice of invoices || []) {
            const dueDate = new Date(invoice.due_date);
            const diffTime = now.getTime() - dueDate.getTime();
            const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (daysOverdue < 0) continue;

            const currentScore = invoice.contract?.user?.tenant_score ?? 100;
            const penaltyStatus = invoice.penalty_status || 'none';
            let penaltyApplied = 0;
            let newPenaltyStatus = penaltyStatus;
            let meetingRequested = false;

            // Tier 2: Extremely Late (> 7 days)
            if (daysOverdue > 7 && penaltyStatus !== 'extreme') {
                const deduction = penaltyStatus === 'late' ? 40 : 50;
                penaltyApplied = deduction;
                newPenaltyStatus = 'extreme';
                meetingRequested = true;
                tier2Count++;
            } 
            // Tier 1: Late (1-7 days)
            else if (daysOverdue >= 0 && daysOverdue <= 7 && penaltyStatus === 'none') {
                penaltyApplied = 10;
                newPenaltyStatus = 'late';
                tier1Count++;
            }

            if (penaltyApplied > 0) {
                const newScore = Math.max(0, currentScore - penaltyApplied);
                const userId = invoice.contract?.user?.id;

                // 2. Update Tenant Score
                await supabase.from('users').update({ tenant_score: newScore }).eq('id', userId);

                // 3. Update Invoice Penalty Status
                const updateData: any = { penalty_status: newPenaltyStatus };
                if (meetingRequested) {
                    updateData.meeting_status = 'pending_manager';
                }
                await supabase.from('invoice').update(updateData).eq('id', invoice.id);

                // 4. Send Notifications
                const roomNum = invoice.contract?.room?.room_number;
                
                // Notify Tenant
                await supabase.from('notifications').insert({
                    user_id: userId,
                    type: 'penalty',
                    title: 'Late Payment Penalty',
                    description: `Your invoice for Room ${roomNum} is ${daysOverdue} days overdue. ${penaltyApplied} points have been deducted. Current Score: ${newScore}`,
                    link: `/tenant/point?userId=${userId}`,
                    is_read: false
                });

                // Notify Manager if Tier 2
                if (meetingRequested) {
                    // Find manager for this branch
                    const branchId = invoice.contract?.room?.building?.branch_id;
                    const { data: managers } = await supabase.from('users').select('id').eq('role', 'manager');
                    // For now, notifying all managers or simplify if branch_id is available
                    if (managers) {
                        for (const manager of managers) {
                            await supabase.from('notifications').insert({
                                user_id: manager.id,
                                type: 'meeting',
                                title: 'Mandatory Meeting Required',
                                description: `Tenant in Room ${roomNum} is extremely late on payment (>7 days). Mandatory meeting proposed.`,
                                link: `/manager/notifications?userId=${userId}`,
                                is_read: false
                            });
                        }
                    }
                }
                
                console.log(`Penalty applied to Invoice ${invoice.id}: -${penaltyApplied} pts. New Status: ${newPenaltyStatus}`);
            }
        }

        return NextResponse.json({
            success: true,
            tier1_applied: tier1Count,
            tier2_applied: tier2Count
        });

    } catch (err: any) {
        console.error('Unexpected error in overdue cron:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
