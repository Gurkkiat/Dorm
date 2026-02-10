'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { FileText, Clock, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { Invoice } from '@/types/database';

export default function TenantPaymentPage() {
    const [loading, setLoading] = useState(true);
    const [invoices, setInvoices] = useState<Invoice[]>([]);

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
        if (s === 'paid') return 'text-green-500 bg-green-100';
        if (s === 'pending') return 'text-orange-500 bg-orange-100';
        if (s === 'unpaid') return 'text-red-500 bg-red-100';
        return 'text-gray-500 bg-gray-100';
    };

    const getStatusIcon = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'paid') return <CheckCircle size={16} />;
        if (s === 'pending') return <Clock size={16} />;
        if (s === 'unpaid') return <AlertCircle size={16} />;
        return <FileText size={16} />;
    };

    if (loading) return <div className="p-8 text-center text-[#0047AB] font-bold">Loading Payments...</div>;

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-[#0047AB] mb-6">Payment History</h1>

            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
                {invoices.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No invoices found.</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {invoices.map((inv) => (
                            <Link key={inv.id} href={`/tenant/payment/${inv.id}`}>
                                <div className="p-6 hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-full ${getStatusColor(inv.status)}`}>
                                            {getStatusIcon(inv.status)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-[#0047AB]">Invoice #{inv.id}</p>
                                            <p className="text-sm text-gray-500">Due: {new Date(inv.due_date).toLocaleDateString('th-TH')}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="font-bold text-lg">{inv.room_total_cost.toLocaleString()} THB</p>
                                            <p className={`text-xs font-bold uppercase ${getStatusColor(inv.status).split(' ')[0]}`}>
                                                {inv.status}
                                            </p>
                                        </div>
                                        <ChevronRight className="text-gray-300 group-hover:text-[#0047AB] transition-colors" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
