
'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Invoice, Contract } from '@/types/database';
import { Building, Check, X } from 'lucide-react';

interface InvoiceWithDetails extends Invoice {
    contract?: Contract & {
        user?: { full_name: string; phone: string };
        room?: { room_number: string; rent_price: number };
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

    useEffect(() => {
        async function fetchInvoice() {
            setLoading(true);
            try {
                // Fetch Invoice with Contract -> User + Room
                const { data, error } = await supabase
                    .from('invoice')
                    .select('*, contract:contract_id(*, user:user_id(full_name, phone), room:room_id(room_number, rent_price))')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setInvoice(data as unknown as InvoiceWithDetails);
            } catch (err) {
                console.error('Error fetching invoice:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchInvoice();
    }, [id]);

    const handleAction = async (newStatus: 'Paid' | 'Unpaid' | 'Pending') => {
        if (!invoice || processing) return;
        setProcessing(true);
        // Proceed directly without confirmation dialog


        try {
            const { error } = await supabase
                .from('invoice')
                .update({
                    status: newStatus,
                    paid_date: newStatus === 'Paid' ? new Date().toISOString() : null
                })
                .eq('id', invoice.id);

            if (error) throw error;

            // [NEW] If Entry Fee is Paid, activate contract & occupy room
            if (newStatus === 'Paid' && invoice.type === 'entry_fee' && invoice.contract_id) {
                // 1. Update Contract to 'complete' (Active)
                await supabase
                    .from('contract')
                    .update({ status: 'complete' }) // or 'active' depending on your naming convention, user said 'complete' -> 'occupied'
                    .eq('id', invoice.contract_id);

                // 2. Update Room to 'occupied'
                // We need room_id from contract. invoice.contract has it if we fetched it.
                if (invoice.contract?.room_id) {
                    await supabase
                        .from('room')
                        .update({ status: 'occupied' })
                        .eq('id', invoice.contract.room_id);
                }
            }

            if (error) throw error;
            router.push('/manager/tenants');
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update status.');
            setProcessing(false);
        }
    };

    if (loading) return <div className="text-center p-10 text-white">Loading Invoice...</div>;
    if (!invoice) return <div className="text-center p-10 text-white">Invoice not found.</div>;

    const items = [
        { label: 'ค่าประกันหอพัก', amount: invoice.room_deposit_cost },
        { label: 'ค่าเช่าห้อง', amount: (invoice.contract?.status === 'complete' ? (invoice.contract?.room?.rent_price || 0) : 0) }, // Hide if not complete
        { label: 'ค่าไฟ', amount: invoice.room_elec_cost },
        { label: 'ค่าน้ำ', amount: invoice.room_water_cost },
        { label: 'ค่าซ่อมแซม', amount: invoice.room_repair_cost },
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
                        <span className="w-1/6 text-right">Prize</span>
                        <span className="w-1/6 text-right">Total</span>
                    </div>

                    {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between py-1 text-sm">
                            <span className="w-1/2">{item.label}</span>
                            <span className="w-1/6 text-center">1</span>
                            <span className="w-1/6 text-right">{item.amount.toLocaleString()}</span>
                            <span className="w-1/6 text-right font-bold">{item.amount.toLocaleString()}</span>
                        </div>
                    ))}

                    <div className="flex justify-end mt-4 pt-4 border-t border-white/30 text-xl font-bold">
                        <span className="underline decoration-double underline-offset-4">{displayTotal.toLocaleString()}</span>
                    </div>
                </div>

                <div className="border-b border-white/30 my-6" />

                {/* Slip Viewer Button - [NEW] */}
                <div className="mb-6 text-center">
                    <button
                        onClick={() => setIsSlipOpen(true)}
                        className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 w-full transition-colors"
                    >
                        View Payment Slip
                    </button>
                </div>

                {/* Actions */}
                <div className="text-center">
                    {invoice.status === 'Paid' ? (
                        <div className="mb-6 p-4 bg-green-500/20 text-green-800 rounded-lg border border-green-500/30">
                            <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                                <Check size={24} /> Paid
                            </h3>
                            <p className="text-sm">This invoice has been verified.</p>
                        </div>
                    ) : invoice.status === 'Unpaid' ? (
                        <div className="mb-6 p-4 bg-yellow-500/20 text-yellow-800 rounded-lg border border-yellow-500/30">
                            <h3 className="text-xl font-bold mb-2">Waiting for Payment</h3>
                            <p className="text-sm">The tenant has not uploaded a payment slip yet.</p>
                            <p className="text-xs opacity-70 mt-1">(Actions will appear here once a slip is uploaded)</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-lg font-bold mb-6">
                                {invoice.payment_slip
                                    ? "Do you want to confirm the tenant's payment?"
                                    : "Ready to issue this invoice to the tenant?"}
                            </p>

                            <div className="flex justify-center gap-6">
                                {/* Approve / Issue Button */}
                                <button
                                    disabled={processing}
                                    onClick={() => handleAction(invoice.payment_slip ? 'Paid' : 'Unpaid')}
                                    className={`bg-white rounded-xl p-2 shadow-lg transition-transform group ${processing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
                                    title={invoice.payment_slip ? "Confirm Payment" : "Issue Invoice"}
                                >
                                    <div className="bg-green-500 rounded-lg p-3 flex items-center gap-2">
                                        <Check size={32} className="text-white" strokeWidth={3} />
                                        {!invoice.payment_slip && <span className="text-white font-bold pr-2">Issue</span>}
                                    </div>
                                </button>

                                {/* Reject Button - Only if there is a slip to reject contextually, or if we want to allow 'Unpaid' (Reject) explicitly */}
                                {invoice.payment_slip && (
                                    <button
                                        disabled={processing}
                                        onClick={() => handleAction('Unpaid')}
                                        className={`bg-white rounded-xl p-2 shadow-lg transition-transform group ${processing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
                                        title="Reject Payment"
                                    >
                                        <div className="bg-red-500 rounded-lg p-3">
                                            <X size={32} className="text-white" strokeWidth={3} />
                                        </div>
                                    </button>
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
