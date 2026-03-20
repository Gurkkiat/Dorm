'use client';

import { useEffect, useState, use, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, CheckCircle, CreditCard, QrCode, MapPin, Calendar, Home, FileText, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import Image from 'next/image';
import DormLogo from '@/app/dorm_logo-white.png';
import { Invoice, Contract, User } from '@/types/database';

interface InvoiceDetail extends Invoice {
    contract?: Contract & {
        user?: User;
        room?: {
            room_number: string;
            rent_price: number;
            building?: {
                name_building: string;
                water_meter: number;
                elec_meter: number;
                water_config_type?: 'unit' | 'fixed';
                water_fixed_price?: number | null;
                branch?: {
                    branches_name: string;
                }
            }
        };
    };
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const invoiceId = resolvedParams.id;

    const router = useRouter();
    const invoiceRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'none' | 'credit_card' | 'qrcode'>('none');
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

    const handleDownload = async () => {
        if (!invoiceRef.current) return;
        try {
            // html-to-image is much more robust for modern CSS / Next.js
            const dataUrl = await toPng(invoiceRef.current, { cacheBust: true, pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `Invoice-${invoice?.id || 'export'}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Failed to export image', err);
            alert('Failed to export image.');
        }
    };

    useEffect(() => {
        async function fetchInvoice() {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('invoice')
                    .select('*, contract:contract_id(*, user:user_id(*, is_primary_tenant), room:room_id(room_number, rent_price, building:building_id(name_building, water_meter, elec_meter, water_config_type, water_fixed_price, branch:branch_id(branches_name))))')
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

                // [REMOVED] Premature room status update to 'occupied'. 
                // This must wait for Manager Verification in VerifyInvoicePage.

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
            alert('Payment Successful!');
        } catch (error) {
            console.error('Error updating payment status:', error);
            alert('Failed to submit payment');
        }
    };

    const handleTenantConfirmMeeting = async () => {
        if (!invoice) return;
        try {
            const { error } = await supabase
                .from('invoice')
                .update({ meeting_status: 'pending_manager_confirm' })
                .eq('id', invoice.id);
            if (error) throw error;
            alert('Meeting confirmed. Waiting for manager finalization.');
            setInvoice({ ...invoice, meeting_status: 'pending_manager_confirm' });
        } catch (error) {
            console.error('Error confirming meeting:', error);
            alert('Failed to confirm meeting');
        }
    };

    if (loading) return <div className="p-8 text-center text-[#0047AB] font-bold">Loading Invoice...</div>;
    if (!invoice) return <div className="p-8 text-center text-red-500">Invoice not found</div>;

    // Calculate Units based on Cost / Rate
    const building = invoice.contract?.room?.building;

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
            label: 'ค่าหอพัก',
            amount: invoice.room_rent_cost || 0,
            unit: 1,
            price: invoice.room_rent_cost || 0
        },
        {
            label: 'ค่าประกันหอพัก',
            amount: invoice.room_deposit_cost,
            unit: 1,
            price: invoice.room_deposit_cost
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

    const status = invoice.status.toLowerCase();

    // Helper to generic dynamic title
    const getInvoiceTitle = () => {
        if (!invoice.bill_date) return 'Tax Invoice';
        const date = new Date(invoice.bill_date);
        const monthYear = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

        if (invoice.type?.toLowerCase() === 'entry_fee') {
            return `Entry Fee (${monthYear})`;
        }
        return `Rent at ${monthYear}`;
    };

    // Helper to compute actual status including Overdue
    const getComputedStatus = () => {
        let s = status;
        // Only show Overdue if the bill has been issued (status is unpaid)
        if (s === 'unpaid' && invoice.due_date && new Date(invoice.due_date) < new Date()) {
            s = 'overdue';
        }
        return s;
    };

    const computedStatus = getComputedStatus();

    // Helper for Badge Color
    const getBadgeClass = (s: string) => {
        if (s === 'paid') return 'bg-green-500 text-white';
        if (s === 'unpaid') return 'bg-yellow-400 text-yellow-900 border-yellow-500';
        if (s === 'pending') return 'bg-white text-black border-gray-200';
        if (s === 'overdue') return 'bg-red-500 text-white border-red-600';
        return 'bg-gray-200 text-gray-800';
    };

    return (
        <div className="max-w-5xl mx-auto pb-12 px-4 font-sans lg:px-8">
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-[#0047AB] font-bold hover:underline"
                >
                    <ArrowLeft size={20} className="mr-2" /> Back
                </button>
                <button
                    onClick={handleDownload}
                    className="flex items-center bg-[#0047AB] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#003380] transition-colors shadow-md text-sm"
                >
                    <Download size={16} className="mr-2" /> Export Bill
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Invoice Details Container */}
                <div ref={invoiceRef} className="flex-1 w-full bg-[#0047AB] rounded-3xl overflow-hidden shadow-2xl text-white relative min-w-0">
                    {/* Header */}
                    <div className="p-6 pb-4 relative max-w-3xl mx-auto">
                        {/* Background Pattern */}
                        <div className="absolute right-0 top-0 w-32 h-32 opacity-10 pointer-events-none select-none">
                            <div className="text-[120px] font-bold text-white/20 leading-none">📋</div>
                        </div>

                        <div className="flex justify-between items-start mb-6 z-10 relative">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="text-white">
                                        <div className="w-10 h-10 flex items-center justify-center">
                                            <Image src={DormLogo} alt="DMS Logo" className="w-full h-full object-contain drop-shadow" />
                                        </div>
                                    </div>
                                    <div className="leading-tight">
                                        <h2 className="font-bold text-sm tracking-wide">DORMITORY</h2>
                                        <p className="text-[10px] opacity-80 tracking-wide">MANAGEMENT<br />SYSTEM</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <h1 className="text-2xl font-bold tracking-tight whitespace-nowrap">{getInvoiceTitle()}</h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs opacity-60 font-mono">INV-{invoice.id.toString().padStart(6, '0')}</p>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getBadgeClass(computedStatus)}`}>
                                        {computedStatus}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="border-b border-white/20 mb-6" />

                        {/* Enhanced Bill To Section */}
                        <div className="mb-6 grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl backdrop-blur-sm">
                            <div className="col-span-2">
                                <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2">Bill to</h3>
                                <p className="font-bold text-lg leading-tight">{invoice.contract?.user?.full_name || 'Unknown'}</p>
                                <p className="font-light text-sm opacity-90 mt-1">
                                    {invoice.contract?.user?.phone || '-'}
                                </p>
                            </div>

                            {/* Location Details */}
                            <div className="col-span-1">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1 opacity-70">
                                        <MapPin size={12} />
                                        <p className="text-[10px] uppercase font-bold">Branch</p>
                                    </div>
                                    <p className="font-medium text-sm truncate">{building?.branch?.branches_name || '-'}</p>
                                </div>
                            </div>

                            <div className="col-span-1">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1 opacity-70">
                                        <Home size={12} />
                                        <p className="text-[10px] uppercase font-bold">Room</p>
                                    </div>
                                    <p className="font-medium text-sm truncate">
                                        {invoice.contract?.room?.room_number || '-'} <span className="text-xs opacity-70">({building?.name_building})</span>
                                    </p>
                                </div>
                            </div>

                            {/* Date Details */}
                            <div className="col-span-1 border-t border-white/10 pt-2">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1 opacity-70">
                                        <FileText size={12} />
                                        <p className="text-[10px] uppercase font-bold">Bill Date</p>
                                    </div>
                                    <p className="font-medium text-sm">
                                        {invoice.bill_date ? new Date(invoice.bill_date).toLocaleDateString('en-GB') : '-'}
                                    </p>
                                </div>
                            </div>

                            <div className="col-span-1 border-t border-white/10 pt-2">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1 opacity-70">
                                        <Clock size={12} />
                                        <p className="text-[10px] uppercase font-bold">Due Date</p>
                                    </div>
                                    <p className={`font-medium text-sm ${computedStatus === 'overdue' ? 'text-red-400 font-bold' : 'text-yellow-200'}`}>
                                        {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : '-'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-2 border-b border-white/20 text-xs uppercase tracking-widest font-bold pb-2 mb-2 opacity-80">
                            <div className="col-span-5">Description</div>
                            <div className="col-span-2 text-center">Unit</div>
                            <div className="col-span-2 text-right">Price</div>
                            <div className="col-span-3 text-right">Total</div>
                        </div>

                        {/* Table Body */}
                        <div className="flex flex-col gap-3 min-h-[120px]">
                            {items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 font-light text-sm items-center">
                                    <div className="col-span-5 truncate font-medium">{item.label}</div>
                                    <div className="col-span-2 text-center bg-white/10 rounded px-1 text-xs py-0.5">{Number.isInteger(item.unit) ? item.unit : parseFloat(item.unit.toFixed(3))}</div>
                                    <div className="col-span-2 text-right opacity-80 text-xs">{item.price.toLocaleString()}</div>
                                    <div className="col-span-3 text-right font-bold">{item.amount.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>

                        <div className="border-b-2 border-white/30 mt-6 mb-4" />

                        <div className="flex justify-between items-end mb-2">
                            <span className="text-sm opacity-70 font-bold uppercase tracking-widest">Total Amount</span>
                            <span className="text-4xl font-bold tracking-tight">
                                {invoice.room_total_cost.toLocaleString()} <span className="text-sm font-normal opacity-70">THB</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Status & Payment Footer/Sidebar */}
                <div className="w-full lg:w-[400px] lg:shrink-0 bg-[#0047AB] rounded-3xl overflow-hidden shadow-2xl text-white relative flex flex-col justify-center min-h-[300px]">
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-sm pointer-events-none" />

                    <div className="relative z-10 w-full p-8 flex flex-col items-center justify-center">

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
                        {(computedStatus === 'pending') && (
                            <div className="flex flex-col items-center text-center">
                                <Clock size={80} className="text-[#FF9100] mb-4" />
                                <h2 className="text-3xl font-bold mb-2">WAITING FOR<br />PAYMENT</h2>
                                <p className="text-[10px] opacity-70 mt-2 uppercase">Please wait for payment confirmation from the dormitory manager.</p>
                            </div>
                        )}

                        {/* CASE 2: UNPAID/OVERDUE - Selection */}
                        {((computedStatus === 'unpaid' || computedStatus === 'overdue') && paymentMethod === 'none') && (
                            <div className="w-full flex flex-col items-center">
                                <p className="mb-6 text-lg font-medium">Select your payment method</p>
                                <div className="flex gap-6">
                                    {/* Credit Card Button */}
                                    <button
                                        onClick={() => setPaymentMethod('credit_card')}
                                        className="bg-white text-[#0047AB] rounded-2xl p-4 w-32 h-32 flex flex-col items-center justify-center gap-2 hover:bg-gray-100 transition-colors shadow-lg group"
                                    >
                                        <div className="bg-blue-50 p-3 rounded-full group-hover:bg-blue-100 transition-colors">
                                            <CreditCard size={32} />
                                        </div>
                                        <span className="text-xs font-bold mt-1">CREDIT CARD</span>
                                    </button>
                                    {/* QR Code Button */}
                                    <button
                                        onClick={() => {
                                            setPaymentMethod('qrcode');
                                            setTimeLeft(300); // Reset timer
                                        }}
                                        className="bg-white text-[#0047AB] rounded-2xl p-4 w-32 h-32 flex flex-col items-center justify-center gap-2 hover:bg-gray-100 transition-colors shadow-lg group"
                                    >
                                        <div className="bg-blue-50 p-3 rounded-full group-hover:bg-blue-100 transition-colors">
                                            <QrCode size={32} />
                                        </div>
                                        <span className="text-xs font-bold mt-1">QR CODE</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CASE 2a: UNPAID/OVERDUE - Credit Card */}
                        {((computedStatus === 'unpaid' || computedStatus === 'overdue') && paymentMethod === 'credit_card') && (
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
                                        <label className="text-xs ml-1 opacity-80">Card number</label>
                                        <input type="text" placeholder="1234 5678 9012 3456" className="w-full p-3 rounded-xl bg-white text-[#0047AB] placeholder:text-blue-300 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
                                    </div>
                                    <div>
                                        <label className="text-xs ml-1 opacity-80">Name on card</label>
                                        <input type="text" placeholder="Ex. Krittee Panthong" className="w-full p-3 rounded-xl bg-white text-[#0047AB] placeholder:text-blue-300 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs ml-1 opacity-80">Expiry date</label>
                                            <input type="text" placeholder="01 / 19" className="w-full p-3 rounded-xl bg-white text-[#0047AB] placeholder:text-blue-300 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required />
                                        </div>
                                        <div>
                                            <label className="text-xs ml-1 opacity-80">Security Code</label>
                                            <div className="flex gap-2">
                                                <input type="password" placeholder="•••" className="w-full p-3 rounded-xl bg-white text-[#0047AB] placeholder:text-blue-300 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full" maxLength={3} required />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 my-2">
                                        <input type="checkbox" id="remember" className="w-4 h-4 rounded" />
                                        <label htmlFor="remember" className="text-xs opacity-80">Remember your credit card</label>
                                    </div>

                                    <button type="submit" className="w-full bg-[#4CAF50] hover:bg-[#45a049] text-white py-3 rounded font-bold transition-colors shadow-lg mt-2">
                                        PAY {invoice.room_total_cost.toLocaleString()} THB
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* CASE 2b: UNPAID/OVERDUE - QR Code */}
                        {((computedStatus === 'unpaid' || computedStatus === 'overdue') && paymentMethod === 'qrcode') && (
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
                        {(computedStatus === 'paid') && (
                            <div className="flex flex-col items-center text-center">
                                {invoice.meeting_status === 'pending_manager' ? (
                                    <>
                                        <div className="bg-orange-500 rounded-full p-4 mb-4 shadow-lg">
                                            <Clock size={64} className="text-white" />
                                        </div>
                                        <h2 className="text-2xl font-bold mb-1">PAYMENT LATE</h2>
                                        <p className="text-xs opacity-70 mt-2">Your payment was over 7 days late. The manager will propose a mandatory meeting soon.</p>
                                    </>
                                ) : invoice.meeting_status === 'pending_tenant' ? (
                                    <>
                                        <div className="bg-rose-500 rounded-full p-4 mb-4 shadow-lg">
                                            <Calendar size={64} className="text-white" />
                                        </div>
                                        <h2 className="text-2xl font-bold mb-1">SCHEDULE MEETING</h2>
                                        <p className="text-xs opacity-90 mt-2 mb-4">Please confirm the required meeting regarding your late payment.</p>
                                        <div className="w-full bg-white text-black p-4 rounded-xl text-left text-sm space-y-2 mb-4 shadow-inner">
                                            <p><strong>Proposed Date:</strong> {invoice.meeting_date}</p>
                                            <p><strong>Proposed Time:</strong> {invoice.meeting_time}</p>
                                            {invoice.meeting_note && <p><strong>Note:</strong> {invoice.meeting_note}</p>}
                                        </div>
                                        <button 
                                            onClick={handleTenantConfirmMeeting}
                                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-6 rounded-lg transition-colors w-full"
                                        >
                                            Confirm Appointment
                                        </button>
                                    </>
                                ) : invoice.meeting_status === 'pending_manager_confirm' ? (
                                    <>
                                        <div className="bg-blue-500 rounded-full p-4 mb-4 shadow-lg">
                                            <Clock size={64} className="text-white" />
                                        </div>
                                        <h2 className="text-2xl font-bold mb-1">WAITING FOR MANAGER</h2>
                                        <p className="text-xs opacity-70 mt-2">You confirmed the meeting. The manager will finalize it shortly.</p>
                                    </>
                                ) : invoice.meeting_status === 'confirmed' ? (
                                    <>
                                        <div className="bg-[#4CAF50] rounded-full p-4 mb-4 shadow-lg">
                                            <CheckCircle size={64} className="text-white" />
                                        </div>
                                        <h2 className="text-2xl font-bold mb-1">MEETING CONFIRMED</h2>
                                        <p className="text-xs opacity-70 mt-2">The meeting has been confirmed. You received a 50 penalty on your score.</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-[#4CAF50] rounded-full p-4 mb-4 shadow-lg">
                                            <CheckCircle size={64} className="text-white" />
                                        </div>
                                        <h2 className="text-3xl font-bold mb-1">PAYMENT SUCCESSFUL</h2>
                                        <p className="text-xs opacity-70 mt-2 uppercase">Your transaction has been confirmed.<br />Thank you for your payment!</p>
                                    </>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
