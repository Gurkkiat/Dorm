
'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Invoice, Contract } from '@/types/database';
import { Building, Check, X } from 'lucide-react';

interface InvoiceWithDetails extends Invoice {
    contract?: Contract & {
        user?: { full_name: string; phone: string };
        room?: { room_number: string };
    };
}

export default function VerifyInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchInvoice() {
            setLoading(true);
            try {
                // Fetch Invoice with Contract -> User + Room
                const { data, error } = await supabase
                    .from('invoice')
                    .select('*, contract:contract_id(*, user:user_id(full_name, phone), room:room_id(room_number))')
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
        if (!invoice) return;
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
            router.push('/manager/tenants');
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update status.');
        }
    };

    if (loading) return <div className="text-center p-10 text-white">Loading Invoice...</div>;
    if (!invoice) return <div className="text-center p-10 text-white">Invoice not found.</div>;

    const items = [
        { label: 'ค่าประกันหอพัก', amount: invoice.room_deposit_cost },
        { label: 'ค่าเช่าห้อง', amount: invoice.contract?.rent_price || 0 }, // Using contract rent price potentially, or invoice could store it? Using contract rent here if invoice rent is 0 or missing? But schema says room_total_cost. Usually rent is implicit or fetched. Let's assume contract rent for now if not explicit in invoice schema besides total.
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

                {/* Actions */}
                <div className="text-center">
                    <p className="text-lg font-bold mb-6">Do you want to confirm the tenant&apos;s payment?</p>

                    <div className="flex justify-center gap-6">
                        <button
                            disabled={processing}
                            onClick={() => handleAction('Unpaid')}
                            className={`bg-white rounded-xl p-2 shadow-lg transition-transform group ${processing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
                        >
                            <div className="bg-green-500 rounded-lg p-3">
                                <Check size={32} className="text-white" strokeWidth={3} />
                            </div>
                        </button>

                        <button
                            disabled={processing}
                            onClick={() => handleAction('Pending')}
                            className={`bg-white rounded-xl p-2 shadow-lg transition-transform group ${processing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
                        >
                            <div className="bg-red-500 rounded-lg p-3">
                                <X size={32} className="text-white" strokeWidth={3} />
                            </div>
                        </button>
                    </div>

                    <p className="mt-8 text-xs text-center italic opacity-70 px-4">
                        ** Please check the repair list to make sure it is correct and has been repaired. **
                    </p>
                </div>

            </div>
        </div>
    );
}
