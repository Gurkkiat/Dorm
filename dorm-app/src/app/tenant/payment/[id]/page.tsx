'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, CheckCircle, CreditCard, QrCode } from 'lucide-react';
import { Invoice, Contract, User } from '@/types/database';

interface InvoiceDetail extends Invoice {
    contract?: Contract & {
        user?: User;
        room?: { rent_price: number };
    };
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const invoiceId = resolvedParams.id;

    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'none' | 'credit_card' | 'qrcode'>('none');
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

    useEffect(() => {
        async function fetchInvoice() {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('invoice')
                    .select('*, contract:contract_id(*, user:user_id(*, is_primary_tenant), room:room_id(rent_price))')
                    .eq('id', invoiceId)
                    .single();

                if (error) throw error;
                if (data) {
                    setInvoice(data as unknown as InvoiceDetail);
                }
            } catch (error) {
                console.error('Error fetching invoice:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchInvoice();
    }, [invoiceId]);

    // Timer logic for QR Code
    useEffect(() => {
        if (paymentMethod === 'qrcode' && timeLeft > 0) {
            const timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [paymentMethod, timeLeft]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleMockPayment = async () => {
        if (!invoice) return;

        try {
            // 1. Update invoice status to 'paid'
            const { error: invoiceError } = await supabase
                .from('invoice')
                .update({
                    status: 'paid',
                    paid_date: new Date().toISOString()
                })
                .eq('id', invoice.id);

            if (invoiceError) throw invoiceError;

            // 2. Handle Entry Fee Logic
            if (invoice.type === 'entry_fee' && invoice.contract_id) {
                // Update Contract: Status -> 'complete', Signed At -> Now
                await supabase
                    .from('contract')
                    .update({
                        status: 'complete',
                        signed_at: new Date().toISOString()
                    })
                    .eq('id', invoice.contract_id);

                // Update Roommate Contracts (Sync Status)
                if (invoice.contract?.room_id) {
                    await supabase
                        .from('contract')
                        .update({
                            status: 'complete',
                            signed_at: new Date().toISOString()
                        })
                        .eq('room_id', invoice.contract.room_id)
                        .neq('id', invoice.contract_id);
                }

                // Update Room: Status -> 'occupied'
                if (invoice.contract?.room_id) {
                    await supabase
                        .from('room')
                        .update({ status: 'occupied' })
                        .eq('id', invoice.contract.room_id);
                }

                // Fetch correct branch_id via Room -> Building
                const { data: roomData } = await supabase
                    .from('room')
                    .select('*, building:building_id(branch_id)')
                    .eq('id', invoice.contract?.room_id)
                    .single();

                const branchId = roomData?.building?.branch_id || 1;

                // Insert Income
                await supabase.from('income').insert([{
                    branch_id: branchId,
                    invoice_id: invoice.id,
                    amount: invoice.room_total_cost,
                    category: 'Entry Fee',
                    note: 'Paid via App',
                    received_at: new Date().toISOString()
                }]);

                // 3. Create First Month Invoice (Only for Primary Tenant)
                if (invoice.contract?.user?.is_primary_tenant) {
                    const rentPrice = invoice.contract?.room?.rent_price || 0;
                    await supabase.from('invoice').insert([{
                        contract_id: invoice.contract_id,
                        status: 'unpaid',
                        type: 'rent',
                        room_rent_cost: rentPrice,
                        room_water_cost: 0,
                        room_elec_cost: 0,
                        room_repair_cost: 0,
                        room_deposit_cost: 0,
                        room_total_cost: rentPrice,
                        bill_date: new Date().toISOString(),
                        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                    }]);
                }
            } else {
                // For Normal Rent Payment, also record income
                const { data: roomData } = await supabase
                    .from('room')
                    .select('*, building:building_id(branch_id)')
                    .eq('id', invoice.contract?.room_id)
                    .single();
                const branchId = roomData?.building?.branch_id || 1;

                await supabase.from('income').insert([{
                    branch_id: branchId,
                    invoice_id: invoice.id,
                    amount: invoice.room_total_cost,
                    category: 'Rent',
                    note: 'Paid via App',
                    received_at: new Date().toISOString()
                }]);
            }

            // Update local state
            setInvoice({ ...invoice, status: 'paid' });
            setPaymentMethod('none');
        } catch (error) {
            console.error('Error updating payment status:', error);
            alert('Failed to submit payment');
        }
    };

    if (loading) return <div className="p-8 text-center text-[#0047AB] font-bold">Loading Invoice...</div>;
    if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found</div>;

    const items = [
        { label: 'ค่าประกันหอพัก', amount: invoice.room_deposit_cost, unit: 1, price: invoice.room_deposit_cost },
        ...(invoice.type !== 'entry_fee'
            ? [{ label: 'ค่าเช่าห้อง', amount: invoice.contract?.room?.rent_price || 0, unit: 1, price: invoice.contract?.room?.rent_price || 0 }]
            : []),
        { label: 'ค่าไฟ', amount: invoice.room_elec_cost, unit: 1, price: invoice.room_elec_cost },
        { label: 'ค่าน้ำ', amount: invoice.room_water_cost, unit: 1, price: invoice.room_water_cost },
        { label: 'ค่าซ่อมแซม', amount: invoice.room_repair_cost, unit: 1, price: invoice.room_repair_cost },
    ].filter(i => i.amount > 0);

    const status = invoice.status.toLowerCase();

    return (
        <div className="max-w-2xl mx-auto pb-12">
            <button
                onClick={() => router.back()}
                className="flex items-center text-[#0047AB] font-bold mb-6 hover:underline"
            >
                <ArrowLeft size={20} className="mr-2" /> Back
            </button>

            <div className="bg-[#0047AB] rounded-3xl overflow-hidden shadow-2xl text-white relative">

                {/* Header */}
                <div className="p-8 border-b border-white/20">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="bg-white/20 p-2 rounded">
                                    <div className="w-6 h-6 border-2 border-white rounded-sm" />
                                </div>
                                <div className="leading-tight">
                                    <h2 className="font-bold text-sm">DORMITORY</h2>
                                    <p className="text-[10px] opacity-80">MANAGEMENT<br />SYSTEM</p>
                                </div>
                            </div>
                        </div>
                        <h1 className="text-5xl font-bold">Invoice</h1>
                    </div>

                    {/* Bill To */}
                    <div className="mb-6">
                        <h3 className="text-xl font-bold mb-2">Bill to :</h3>
                        <p className="font-light">{invoice.contract?.user?.full_name || 'Unknown'}</p>
                        <p className="font-light">
                            {invoice.contract?.user?.phone || '-'}
                        </p>
                    </div>

                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 border-b border-white text-lg font-bold pb-2">
                        <div className="col-span-6">Description</div>
                        <div className="col-span-2 text-center">Unit</div>
                        <div className="col-span-2 text-right">Price</div>
                        <div className="col-span-2 text-right">Total</div>
                    </div>

                    {/* Table Body */}
                    <div className="flex flex-col gap-4 mt-4">
                        {items.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-4 font-light">
                                <div className="col-span-6">{item.label}</div>
                                <div className="col-span-2 text-center">{item.unit}</div>
                                <div className="col-span-2 text-right">{item.price.toLocaleString()}</div>
                                <div className="col-span-2 text-right">{item.amount.toLocaleString()}</div>
                            </div>
                        ))}
                        <div className="flex justify-end mt-4 pt-2">
                            <span className="text-xl font-bold underline decoration-double underline-offset-4">
                                {invoice.room_total_cost.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Status Footer */}
                <div className="bg-white/5 p-8 min-h-[200px] flex flex-col items-center justify-center relative">

                    {/* Back Button for Payment Methods */}
                    {paymentMethod !== 'none' && status === 'unpaid' && (
                        <button
                            onClick={() => setPaymentMethod('none')}
                            className="absolute top-4 left-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}

                    {/* CASE 1: PENDING (Waiting for Confirmation) */}
                    {(status === 'pending') && (
                        <div className="flex flex-col items-center text-center">
                            <Clock size={80} className="text-[#FF9100] mb-4" />
                            <h2 className="text-3xl font-bold mb-2">WAITING FOR<br />PAYMENT</h2>
                            <p className="text-[10px] opacity-70 mt-2 uppercase">Please wait for payment confirmation from the dormitory manager.</p>
                        </div>
                    )}

                    {/* CASE 2: UNPAID - Selection */}
                    {(status === 'unpaid' && paymentMethod === 'none') && (
                        <div className="w-full flex flex-col items-center">
                            <div className="w-full border-t border-white/30 mb-6" />
                            <p className="mb-6 text-lg">Select your payment method</p>
                            <div className="flex gap-6">
                                {/* Credit Card Button */}
                                <button
                                    onClick={() => setPaymentMethod('credit_card')}
                                    className="bg-white text-[#0047AB] rounded-2xl p-4 w-32 h-32 flex flex-col items-center justify-center gap-2 hover:bg-gray-100 transition-colors shadow-lg"
                                >
                                    <CreditCard size={48} />
                                    <span className="text-xs font-bold mt-1">CREDIT CARD</span>
                                </button>
                                {/* QR Code Button */}
                                <button
                                    onClick={() => {
                                        setPaymentMethod('qrcode');
                                        setTimeLeft(300); // Reset timer
                                    }}
                                    className="bg-white text-[#0047AB] rounded-2xl p-4 w-32 h-32 flex flex-col items-center justify-center gap-2 hover:bg-gray-100 transition-colors shadow-lg"
                                >
                                    <QrCode size={48} />
                                    <span className="text-xs font-bold mt-1">QR CODE</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* CASE 2a: UNPAID - Credit Card */}
                    {(status === 'unpaid' && paymentMethod === 'credit_card') && (
                        <div className="w-full max-w-md">
                            <div className="text-center mb-6">
                                <span className="text-3xl font-bold">{invoice.room_total_cost.toLocaleString()}</span>
                                <span className="text-xl font-light ml-2">baht</span>
                            </div>

                            <div className="flex justify-center gap-4 mb-6">
                                <div className="bg-white px-2 py-1 rounded h-8 flex items-center justify-center"><span className="text-[#0047AB] font-bold text-xs">VISA</span></div>
                                <div className="bg-white px-2 py-1 rounded h-8 flex items-center justify-center"><span className="text-red-500 font-bold text-xs">MasterCard</span></div>
                                <div className="bg-white px-2 py-1 rounded h-8 flex items-center justify-center"><span className="text-blue-500 font-bold text-xs">JCB</span></div>
                            </div>

                            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleMockPayment(); }}>
                                <div>
                                    <label className="text-xs ml-1">Card number</label>
                                    <input type="text" placeholder="1234 5678 9012 3456" className="w-full p-3 rounded text-[#0047AB] text-sm" required />
                                </div>
                                <div>
                                    <label className="text-xs ml-1">Name on card</label>
                                    <input type="text" placeholder="Ex. Krittee Panthong" className="w-full p-3 rounded text-[#0047AB] text-sm" required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs ml-1">Expiry date</label>
                                        <input type="text" placeholder="01 / 19" className="w-full p-3 rounded text-[#0047AB] text-sm" required />
                                    </div>
                                    <div>
                                        <label className="text-xs ml-1">Security Code</label>
                                        <div className="flex gap-2">
                                            <input type="password" placeholder="•••" className="w-full p-3 rounded text-[#0047AB] text-sm" maxLength={3} required />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 my-2">
                                    <input type="checkbox" id="remember" className="w-4 h-4 rounded" />
                                    <label htmlFor="remember" className="text-xs">Remember your credit card</label>
                                </div>

                                <button type="submit" className="w-full bg-[#4CAF50] hover:bg-[#45a049] text-white py-3 rounded font-bold transition-colors">
                                    SUBMIT PAYMENT
                                </button>
                            </form>
                        </div>
                    )}

                    {/* CASE 2b: UNPAID - QR Code */}
                    {(status === 'unpaid' && paymentMethod === 'qrcode') && (
                        <div className="w-full max-w-sm text-center">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs opacity-80">Dormitory Management System</span>
                            </div>
                            <h3 className="text-xl font-bold mb-4 text-left">Thai QR Payment</h3>

                            <div className="bg-white p-4 rounded-xl mb-4 mx-auto w-48 h-48 flex items-center justify-center">
                                {/* Mock QR Code */}
                                <div className="grid grid-cols-2 gap-2 w-full h-full">
                                    <div className="bg-black/80 w-full h-full rounded-sm" />
                                    <div className="bg-black/80 w-full h-full rounded-sm" />
                                    <div className="bg-black/80 w-full h-full rounded-sm" />
                                    <div className="bg-black/50 w-full h-full rounded-sm relative">
                                        <div className="absolute inset-2 bg-white rounded-sm" />
                                    </div>
                                </div>
                            </div>

                            <div className="text-5xl font-bold mb-2">{invoice.room_total_cost.toLocaleString()}</div>

                            <p className="text-xs opacity-70 mb-1">Please make the payment within <span className="text-green-400 font-bold">{formatTime(timeLeft)}</span></p>

                            {/* Simulate successful scan/payment for testing */}
                            <button onClick={handleMockPayment} className="mt-4 text-[10px] text-white/30 hover:text-white underline">
                                (Simulate Scan & Pay)
                            </button>
                        </div>
                    )}

                    {/* CASE 3: PAID */}
                    {(status === 'paid') && (
                        <div className="flex flex-col items-center text-center">
                            <div className="bg-[#4CAF50] rounded-full p-4 mb-4">
                                <CheckCircle size={64} className="text-white" />
                            </div>
                            <h2 className="text-3xl font-bold mb-1">PAYMENT</h2>
                            <h2 className="text-3xl font-light mb-2">SUCCESSFUL</h2>
                            <p className="text-[10px] opacity-70 mt-4 uppercase">Thank you for being such a great tenant!</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
