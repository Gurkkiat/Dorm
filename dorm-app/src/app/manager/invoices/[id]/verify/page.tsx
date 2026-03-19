
'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Invoice, Contract } from '@/types/database';
import { Building, Check, X } from 'lucide-react';

interface InvoiceWithDetails extends Invoice {
    contract?: Contract & {
        user?: { id: number; full_name: string; phone: string; tenant_score: number };
        room?: { room_number: string; rent_price: number; building?: { elec_meter: number; water_meter: number; water_config_type: 'unit' | 'fixed'; water_fixed_price: number | null } };
        room_id?: number;
    };
}

export default function VerifyInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false); // [NEW]

    const [isSlipOpen, setIsSlipOpen] = useState(false); // [NEW]

    // Form states for meeting
    const [meetingDate, setMeetingDate] = useState('');
    const [meetingTime, setMeetingTime] = useState('');
    const [meetingNote, setMeetingNote] = useState('');

    const fetchInvoiceData = async () => {
        setLoading(true);
        try {
            // Fetch Invoice with Contract -> User + Room
            const { data, error } = await supabase
                .from('invoice')
                .select('*, contract:contract_id(*, user:user_id(id, full_name, phone, tenant_score), room:room_id(room_number, rent_price, building:building_id(elec_meter, water_meter, water_config_type, water_fixed_price)))')
                .eq('id', id)
                .single();

            if (error) throw error;
            setInvoice(data as unknown as InvoiceWithDetails);
        } catch (err) {
            console.error('Error fetching invoice:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoiceData();
    }, [id]);

    const handleAction = async (newStatus: 'Paid' | 'Unpaid' | 'Pending') => {
        if (!invoice || processing) return;
        setProcessing(true);

        try {
            const finalStatus = (newStatus === 'Paid' && !invoice.payment_slip) ? 'Unpaid' : newStatus;
            const updatePayload: any = {
                status: finalStatus,
                paid_date: finalStatus === 'Paid' ? new Date().toISOString() : null
            };

            // If we are rejecting a slip, clear it
            if (newStatus === 'Unpaid' && invoice.payment_slip) {
                updatePayload.payment_slip = null;
            }

            let requiresMeeting = false;

            // [NEW] Overdue Penalty & Meeting Logic
            console.log('--- Handle Action Debug ---');
            console.log('newStatus:', newStatus);
            console.log('invoice.id:', invoice.id);
            console.log('invoice.type:', invoice.type);
            console.log('invoice.due_date:', invoice.due_date);



            if ((finalStatus.toLowerCase() === 'paid' || finalStatus.toLowerCase() === 'unpaid') && invoice.due_date && invoice.type?.toLowerCase() !== 'entry_fee') {
                const dueDt = new Date(invoice.due_date);
                const paidDt = new Date();
                const diffTime = Date.UTC(paidDt.getFullYear(), paidDt.getMonth(), paidDt.getDate()) - 
                                Date.UTC(dueDt.getFullYear(), dueDt.getMonth(), dueDt.getDate());
                const daysOverdue = Math.floor(diffTime / (1000 * 3600 * 24));

                if (daysOverdue > 7) {
                    updatePayload.meeting_status = 'pending_manager';
                    requiresMeeting = true;
                    
                    const penaltyStatus = (invoice as any).penalty_status || 'none';
                    if (penaltyStatus !== 'extreme') {
                        const deduction = penaltyStatus === 'late' ? 40 : 50;
                        if (invoice.contract?.user?.id) {
                            const currentScore = invoice.contract.user.tenant_score ?? 100;
                            const newScore = Math.max(0, currentScore - deduction);

                            await supabase
                                .from('users')
                                .update({ tenant_score: newScore })
                                .eq('id', invoice.contract.user.id);

                            await supabase.from('notifications').insert({
                                user_id: invoice.contract.user.id,
                                type: 'penalty',
                                title: 'Point Deduction: Severe Late Payment',
                                description: `You have been deducted 50 points for Invoice #${invoice.id} (Paid ${daysOverdue} days late).`,
                                link: `/tenant/point?userId=${invoice.contract.user.id}`,
                                is_read: false
                            });

                            updatePayload.penalty_status = 'extreme';
                        }
                    }
                } else if (daysOverdue > 0 && daysOverdue <= 7) {
                    const penaltyStatus = (invoice as any).penalty_status || 'none';
                    if (penaltyStatus === 'none') {
                        if (invoice.contract?.user?.id) {
                            const currentScore = invoice.contract.user.tenant_score ?? 100;
                            const newScore = Math.max(0, currentScore - 10);
                            
                            await supabase
                                .from('users')
                                .update({ tenant_score: newScore })
                                .eq('id', invoice.contract.user.id);
                            
                                await supabase.from('notifications').insert({
                                    user_id: invoice.contract.user.id,
                                    type: 'penalty',
                                    title: 'Point Deduction: Late Payment',
                                    description: `You have been deducted 10 points for Invoice #${invoice.id} (Paid ${daysOverdue} days late).`,
                                    link: `/tenant/point?userId=${invoice.contract.user.id}`,
                                    is_read: false
                                });

                            updatePayload.penalty_status = 'late';
                        }
                    }
                }
            }

            const { error } = await supabase
                .from('invoice')
                .update(updatePayload)
                .eq('id', invoice.id);

            if (error) throw error;

            // [NEW] If Entry Fee is Paid, activate contract & occupy room
            if (newStatus === 'Paid' && invoice.type === 'entry_fee' && invoice.contract_id) {
                await supabase.from('contract').update({ status: 'complete' }).eq('id', invoice.contract_id);
                if (invoice.contract?.room_id) {
                    await supabase.from('room').update({ status: 'occupied' }).eq('id', invoice.contract.room_id);
                }
            }

            if (requiresMeeting) {
                alert('Payment verified! However, it is over 7 days late. Please schedule a mandatory meeting with the tenant.');
                await fetchInvoiceData();
                setProcessing(false);
            } else {
                router.push('/manager/tenants');
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update status.');
            setProcessing(false);
        }
    };

    const handleScheduleMeeting = async () => {
        if (!invoice || !meetingDate || !meetingTime) {
            alert('Please fill in both Date and Time.');
            return;
        }
        setProcessing(true);
        try {
            const { error } = await supabase
                .from('invoice')
                .update({
                    meeting_status: 'pending_tenant',
                    meeting_date: meetingDate,
                    meeting_time: meetingTime,
                    meeting_note: meetingNote
                })
                .eq('id', invoice.id);
            if (error) throw error;
            alert('Meeting request sent to tenant successfully.');
            router.push('/manager/tenants');
        } catch (err) {
            console.error('Error scheduling meeting:', err);
            alert('Failed to schedule meeting.');
            setProcessing(false);
        }
    };

    const confirmFinalMeeting = async () => {
        if (!invoice || !invoice.contract?.user?.id) return;
        setProcessing(true);
        try {
            const { error: invErr } = await supabase
                .from('invoice')
                .update({ meeting_status: 'confirmed' })
                .eq('id', invoice.id);
            if (invErr) throw invErr;

            // Points already deducted in handleAction for extreme late
            
            // Notify Manager
            await supabase.from('notifications').insert({
                user_id: 1, // Adjust if needed
                type: 'system',
                title: 'Mandatory Meeting Finalized',
                description: `Meeting confirmed for ${invoice.contract?.user?.full_name}.`
            });

            alert('Meeting confirmed.');
            router.push('/manager/tenants');
        } catch (err) {
            console.error('Error confirming meeting:', err);
            alert('Failed to confirm meeting.');
            setProcessing(false);
        }
    };

    if (loading) return <div className="text-center p-10 text-white">Loading Invoice...</div>;
    if (!invoice) return <div className="text-center p-10 text-white">Invoice not found.</div>;

    const building = (invoice.contract?.room as any)?.building;

    // Fetch rates from building
    const elecRate = building?.elec_meter || 5; // Fallback to 5 if not set
    let waterRate = building?.water_meter || 18; // Fallback to 18 if not set
    let waterUnit = invoice.room_water_cost > 0 ? invoice.room_water_cost / waterRate : 0;

    // Check if water is fixed price (either at contract level or building level)
    let isFixedWater = false;
    let fixedPriceValue = 0;

    if ((invoice.contract as any)?.water_config_type === 'fixed') {
        isFixedWater = true;
        fixedPriceValue = (invoice.contract as any)?.water_fixed_price || invoice.room_water_cost;
    } else if ((building as any)?.water_config_type === 'fixed') {
        isFixedWater = true;
        fixedPriceValue = (building as any)?.water_fixed_price || invoice.room_water_cost;
    }

    if (isFixedWater) {
        waterRate = fixedPriceValue;
        waterUnit = invoice.room_water_cost > 0 ? 1 : 0;
    }

    const items = [
        {
            label: 'ค่าประกันหอพัก',
            amount: invoice.room_deposit_cost,
            unit: 1,
            price: invoice.room_deposit_cost
        },
        {
            label: 'ค่าเช่าห้อง',
            amount: invoice.room_rent_cost || 0,
            unit: 1,
            price: invoice.room_rent_cost || 0
        },
        {
            label: 'ค่าไฟ',
            amount: invoice.room_elec_cost,
            unit: invoice.room_elec_cost > 0 ? invoice.room_elec_cost / elecRate : 0,
            price: elecRate
        },
        {
            label: 'ค่าน้ำ',
            amount: invoice.room_water_cost,
            unit: waterUnit,
            price: waterRate
        },
        {
            label: 'ค่าซ่อมแซม',
            amount: invoice.room_repair_cost,
            unit: 1,
            price: invoice.room_repair_cost
        },
    ].filter(i => i.amount > 0);

    // Calculate total from items to verify or just use invoice.room_total_cost
    const displayTotal = invoice.room_total_cost;

    return (
        <div className="min-h-screen bg-white md:bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-[#0047AB] w-full max-w-md rounded-3xl shadow-2xl p-8 text-white relative overflow-hidden">
                {/* Background Pattern */}
                <Building className="absolute -right-12 -top-12 text-white/10 w-64 h-64" />

                {/* Header */}
                <div className="flex items-center gap-4 mb-2">
                    <Building size={40} className="shrink-0" />
                    <div>
                        <h2 className="text-xs font-bold tracking-widest uppercase opacity-80">Dormitory</h2>
                        <h2 className="text-xs font-bold tracking-widest uppercase opacity-80">Management</h2>
                        <h2 className="text-xs font-bold tracking-widest uppercase opacity-80">System</h2>
                    </div>
                    <h1 className="ml-auto text-4xl font-bold">Invoice</h1>
                </div>
                <div className="border-b border-white/30 my-4" />

                {/* Bill To */}
                <div className="mb-6">
                    <h3 className="text-xl font-bold mb-1">Bill to :</h3>
                    <p className="text-lg">{invoice.contract?.user?.full_name}</p>
                    <p className="text-sm opacity-80">Room: {invoice.contract?.room?.room_number}</p>
                    <p className="text-sm opacity-80">{invoice.contract?.user?.phone}</p>
                </div>

                {/* Table */}
                <div className="mb-8">
                    <div className="flex justify-between border-b border-white/50 pb-2 mb-2 font-bold text-lg">
                        <span className="w-1/2">Description</span>
                        <span className="w-1/6 text-center">Unit</span>
                        <span className="w-1/6 text-right">Price</span>
                        <span className="w-1/6 text-right">Total</span>
                    </div>

                    {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between py-1 text-sm">
                            <span className="w-1/2">{item.label}</span>
                            <span className="w-1/6 text-center">{Number.isInteger(item.unit) ? item.unit : parseFloat(item.unit.toFixed(3))}</span>
                            <span className="w-1/6 text-right">{item.price.toLocaleString()}</span>
                            <span className="w-1/6 text-right font-bold">{item.amount.toLocaleString()}</span>
                        </div>
                    ))}

                    <div className="flex justify-end mt-4 pt-4 border-t border-white/30 text-xl font-bold">
                        <span className="underline decoration-double underline-offset-4">{displayTotal.toLocaleString()}</span>
                    </div>
                </div>

                <div className="border-b border-white/30 my-6" />

                {/* Actions */}
                <div className="text-center">
                    {invoice.meeting_status === 'pending_manager' ? (
                        <div className="mt-6 p-6 bg-white rounded-2xl text-black shadow-inner border border-rose-200">
                            <h3 className="text-lg font-bold text-rose-600 mb-4">Mandatory Meeting (Overdue {'>'} 7 Days)</h3>
                            <p className="text-sm text-gray-600 mb-4">Please propose a meeting date/time to discuss the late payment.</p>
                            <div className="space-y-3 text-left">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                                    <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0047AB] outline-none" min={new Date().toISOString().split('T')[0]} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Time</label>
                                    <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0047AB] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Note to Tenant (Optional)</label>
                                    <textarea value={meetingNote} onChange={e => setMeetingNote(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#0047AB] outline-none" rows={2} placeholder="E.g., Please see me at the office." />
                                </div>
                                <button
                                    onClick={handleScheduleMeeting}
                                    disabled={processing}
                                    className="w-full mt-2 bg-[#0047AB] text-white font-bold p-3 rounded-xl hover:bg-[#00388A] transition-colors"
                                >
                                    Send Meeting Request
                                </button>
                            </div>
                        </div>
                    ) : invoice.meeting_status === 'pending_manager_confirm' ? (
                        <div className="mt-6 p-6 bg-white rounded-2xl text-black shadow-inner border border-blue-200">
                            <h3 className="text-lg font-bold text-[#0047AB] mb-4">Confirm Appointment</h3>
                            <p className="text-sm text-gray-600 mb-4">The tenant has responded to the meeting request.</p>
                            <div className="bg-gray-50 p-4 rounded-xl text-left text-sm space-y-2 mb-4">
                                <p><strong>Tenant:</strong> {invoice.contract?.user?.full_name}</p>
                                <p><strong>Date:</strong> {invoice.meeting_date}</p>
                                <p><strong>Time:</strong> {invoice.meeting_time}</p>
                                {invoice.meeting_note && <p><strong>Tenant Note:</strong> {invoice.meeting_note}</p>}
                            </div>
                            <button
                                onClick={confirmFinalMeeting}
                                disabled={processing}
                                className="w-full bg-green-500 text-white font-bold p-3 rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <Check size={20} />
                                Confirm Appointment
                            </button>
                        </div>
                    ) : invoice.meeting_status === 'pending_tenant' ? (
                        <div className="mt-6 mb-6 p-4 bg-orange-500/20 text-orange-200 rounded-lg border border-orange-500/30">
                            <h3 className="text-xl font-bold mb-2">Waiting for Tenant Response</h3>
                            <p className="text-sm">You have scheduled a meeting. Waiting for the tenant to confirm or resubmit the form.</p>
                        </div>
                    ) : invoice.meeting_status === 'confirmed' ? (
                        <div className="mt-6 mb-6 p-4 bg-purple-500/20 text-purple-200 rounded-lg border border-purple-500/30">
                            <h3 className="text-xl font-bold mb-2 flex justify-center items-center gap-2"><Check size={24} /> Meeting Confirmed</h3>
                            <p className="text-sm">Meeting confirmed. Tenant has been penalized 50 points.</p>
                        </div>
                    ) : invoice.status?.toLowerCase() === 'paid' ? (
                        <div className="mb-6 p-4 bg-green-500/20 text-green-800 rounded-lg border border-green-500/30">
                            <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                                <Check size={24} /> Paid
                            </h3>
                            <p className="text-sm">This invoice has been verified.</p>
                        </div>
                    ) : invoice.status?.toLowerCase() === 'unpaid' ? (
                        <div className="mb-6 p-4 bg-yellow-500/20 text-white rounded-lg border border-yellow-500/30">
                            <h3 className="text-xl font-bold mb-2">Waiting for Payment</h3>
                            <p className="text-sm">The tenant has not uploaded a payment slip yet.</p>
                            <p className="text-xs opacity-70 mt-1">(Actions will appear here once a slip is uploaded)</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-lg font-bold mb-6 text-center">
                                {invoice.payment_slip
                                    ? "Please review the payment slip before approval."
                                    : "Please review the invoice before issuing."}
                            </p>

                            <div className="flex justify-center gap-6">
                                {invoice.payment_slip ? (
                                    <>
                                        {/* Approve Payment Button */}
                                        <button
                                            disabled={processing}
                                            onClick={() => handleAction('Paid')}
                                            className={`bg-white rounded-xl p-2 shadow-lg transition-transform group ${processing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
                                            title="Approve Payment"
                                        >
                                            <div className="bg-green-500 rounded-lg p-3 flex items-center gap-2">
                                                <Check size={28} className="text-white" strokeWidth={3} />
                                                <span className="text-white font-bold pr-2">Approve</span>
                                            </div>
                                        </button>

                                        {/* Reject Payment Button */}
                                        <button
                                            disabled={processing}
                                            onClick={() => handleAction('Unpaid')}
                                            className={`bg-white rounded-xl p-2 shadow-lg transition-transform group ${processing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
                                            title="Reject Payment"
                                        >
                                            <div className="bg-red-500 rounded-lg p-3 flex items-center gap-2">
                                                <X size={28} className="text-white" strokeWidth={3} />
                                                <span className="text-white font-bold pr-2">Reject</span>
                                            </div>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {/* Issue Invoice (Approve) Button */}
                                        <button
                                            disabled={processing}
                                            onClick={() => handleAction('Paid')}
                                            className={`bg-white rounded-xl p-2 shadow-lg transition-transform group ${processing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
                                            title="Issue Invoice"
                                        >
                                            <div className="bg-green-500 rounded-lg p-3 flex items-center gap-2">
                                                <Check size={28} className="text-white" strokeWidth={3} />
                                                <span className="text-white font-bold pr-2">Approve</span>
                                            </div>
                                        </button>

                                        {/* Placeholder Reject Button */}
                                        <button
                                            disabled={processing}
                                            onClick={(e) => { e.preventDefault(); /* No action */ }}
                                            className="bg-white rounded-xl p-2 shadow-lg transition-transform group hover:scale-110 cursor-pointer"
                                            title="Reject (Placeholder)"
                                        >
                                            <div className="bg-red-500 rounded-lg p-3 flex items-center gap-2">
                                                <X size={28} className="text-white" strokeWidth={3} />
                                                <span className="text-white font-bold pr-2">Reject</span>
                                            </div>
                                        </button>
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    <p className="mt-8 text-xs text-center italic opacity-70 px-4">
                        ** Please check the repair list to make sure it is correct and has been repaired. **
                    </p>
                </div>

                {/* Slip Modal - [NEW] */}
                {isSlipOpen && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setIsSlipOpen(false)}>
                        <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => setIsSlipOpen(false)}
                                className="absolute -top-12 right-0 text-white hover:text-gray-300"
                            >
                                <X size={40} />
                            </button>
                            <img
                                src={invoice.payment_slip || '/mock_slip.svg'}
                                alt="Payment Slip"
                                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl bg-white"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = '/mock_slip.svg'; // Fallback
                                    (e.target as HTMLImageElement).onerror = null;
                                }}
                            />
                            <p className="text-white mt-4 text-center">
                                Click background or X to close
                            </p>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
