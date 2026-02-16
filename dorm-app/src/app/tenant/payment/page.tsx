'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { FileText, Clock, CheckCircle, AlertCircle, ChevronRight, Wallet, Filter } from 'lucide-react';
import { Invoice } from '@/types/database';
import Loading from '@/components/ui/loading';

export default function TenantPaymentPage() {
    const [loading, setLoading] = useState(true);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

    useEffect(() => {
        async function fetchInvoices() {
            try {
                const storedUserId = localStorage.getItem('user_id');
                if (!storedUserId) return;

                // 1. Get Contract IDs for user
                const { data: contracts } = await supabase
                    .from('contract')
                    .select('id')
                    .eq('user_id', storedUserId);

                if (!contracts || contracts.length === 0) {
                    setLoading(false);
                    return;
                }

                const contractIds = contracts.map(c => c.id);

                // 2. Fetch Invoices
                const { data } = await supabase
                    .from('invoice')
                    .select('*')
                    .in('contract_id', contractIds)
                    .order('due_date', { ascending: false });

                if (data) {
                    setInvoices(data);
                }
            } catch (error) {
                console.error('Error fetching invoices:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchInvoices();
    }, []);

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'paid') return 'text-green-600 bg-green-100 border-green-200';
        if (s === 'pending') return 'text-orange-600 bg-orange-100 border-orange-200';
        if (s === 'unpaid') return 'text-red-600 bg-red-100 border-red-200';
        return 'text-gray-600 bg-gray-100 border-gray-200';
    };

    const getStatusIcon = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'paid') return <CheckCircle size={14} className="mr-1" />;
        if (s === 'pending') return <Clock size={14} className="mr-1" />;
        if (s === 'unpaid') return <AlertCircle size={14} className="mr-1" />;
        return <FileText size={14} className="mr-1" />;
    };

    // Helper for Dynamic Title
    const getInvoiceTitle = (invoice: Invoice) => {
        if (!invoice.bill_date) return `Invoice #${invoice.id}`;
        const date = new Date(invoice.bill_date);
        const monthYear = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

        if (invoice.type?.toLowerCase() === 'entry_fee') {
            return `Entry Fee (${monthYear})`;
        }
        return `Rent for ${monthYear}`;
    };

    const filteredInvoices = invoices.filter(inv => {
        if (filter === 'all') return true;
        if (filter === 'unpaid') return ['unpaid', 'pending'].includes(inv.status.toLowerCase());
        return inv.status.toLowerCase() === 'paid';
    });

    const totalUnpaid = invoices
        .filter(inv => ['unpaid', 'pending'].includes(inv.status.toLowerCase()))
        .reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0);



    // ... (inside component)

    if (loading) return <Loading />;

    return (
        <div className="max-w-7xl mx-auto pb-10 px-4 font-sans min-h-screen">

            {/* Header */}
            <div className="pt-6 pb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-[#0047AB]">My Bills</h1>
                    <p className="text-gray-500 text-sm">Manage your dormitory payments</p>
                </div>
                <div className="bg-white p-2 rounded-full shadow-sm border border-gray-100">
                    <Wallet className="text-[#0047AB]" />
                </div>
            </div>

            {/* Summary Card */}
            <div className="bg-gradient-to-br from-[#0047AB] to-[#0066FF] rounded-3xl p-6 text-white shadow-xl mb-8 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute left-[-20px] bottom-[-20px] w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />

                <div className="relative z-10">
                    <p className="text-blue-100 text-sm font-medium mb-1">Total Outstanding</p>
                    <h2 className="text-4xl font-bold mb-4">{totalUnpaid.toLocaleString()} <span className="text-lg font-normal opacity-80">THB</span></h2>

                    <div className="flex gap-2">
                        <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium flex items-center">
                            <AlertCircle size={12} className="mr-1.5" />
                            {invoices.filter(i => i.status === 'unpaid').length} Unpaid
                        </div>
                        <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-medium flex items-center">
                            <Clock size={12} className="mr-1.5" />
                            {invoices.filter(i => i.status === 'pending').length} Pending
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {['all', 'unpaid', 'paid'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`px-4 py-2 rounded-full text-sm font-bold capitalize transition-all whitespace-nowrap ${filter === f
                            ? 'bg-[#0047AB] text-white shadow-md'
                            : 'bg-white text-gray-500 border border-gray-200'
                            }`}
                    >
                        {f === 'all' ? 'All Transactions' : f}
                    </button>
                ))}
            </div>

            {/* Invoices List */}
            <div className="flex flex-col gap-4">
                {filteredInvoices.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500">No invoices found</p>
                    </div>
                ) : (
                    filteredInvoices.map((inv) => (
                        // เติม className="block" ที่ Link เพื่อให้มันแสดงผลเป็นกล่องสี่เหลี่ยมเต็มพื้นที่
                        <Link key={inv.id} href={`/tenant/payment/${inv.id}`} className="block">
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${inv.status.toLowerCase() === 'paid' ? 'bg-green-50 text-green-600' :
                                            inv.status.toLowerCase() === 'unpaid' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                                            }`}>
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-base">{getInvoiceTitle(inv)}</h3>
                                            <p className="text-xs text-gray-400 font-mono">INV-{inv.id.toString().padStart(6, '0')}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center border ${getStatusColor(inv.status)}`}>
                                        {getStatusIcon(inv.status)}
                                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1).toLowerCase()}
                                    </span>
                                </div>

                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-0.5">Due Date</p>
                                        <p className="text-sm font-medium text-gray-600">
                                            {new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-[#0047AB]">{inv.room_total_cost.toLocaleString()} <span className="text-xs font-normal text-gray-400">THB</span></span>
                                        <ChevronRight size={18} className="text-gray-300 group-hover:text-[#0047AB] transition-colors" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
