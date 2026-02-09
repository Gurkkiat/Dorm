
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Invoice } from '@/types/database';

interface InvoiceWithDetails extends Invoice {
    contract?: {
        user?: {
            full_name: string;
            room?: {
                room_number: string;
            }
        }
    }
}

export default function ManagerPaymentsPage() {
    const [pendingInvoices, setPendingInvoices] = useState<InvoiceWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPendingInvoices();
    }, []);

    async function fetchPendingInvoices() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('invoice')
                .select('*, contract:contract_id ( user:user_id ( full_name, room:room_id ( room_number ) ) )')
                .eq('status', 'Pending')
                .order('paid_date', { ascending: false });

            if (error) throw error;
            // Supabase query types are complex to infer perfectly with deep joins, so we assert here
            setPendingInvoices((data as unknown as InvoiceWithDetails[]) || []);
        } catch (error) {
            console.error('Error fetching pending invoices:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleApprove = async (id: number) => {
        try {
            const { error } = await supabase
                .from('invoice')
                .update({
                    status: 'Paid',
                    // paid_date is already set when user uploads slip, but we can update it if needed to approval time
                })
                .eq('id', id);

            if (error) throw error;

            // Refresh list
            setPendingInvoices(prev => prev.filter(inv => inv.id !== id));
            alert(`Invoice #${id} approved.`);
        } catch (error) {
            console.error('Error approving invoice:', error);
            alert('Error approving invoice.');
        }
    };

    const handleReject = async (id: number) => {
        try {
            const { error } = await supabase
                .from('invoice')
                .update({
                    status: 'Unpaid', // or 'Rejected' if you prefer
                    payment_slip: null, // Clear the invalid slip? Or keep it for record?
                })
                .eq('id', id);

            if (error) throw error;

            // Refresh list
            setPendingInvoices(prev => prev.filter(inv => inv.id !== id));
            alert(`Invoice #${id} rejected.`);
        } catch (error) {
            console.error('Error rejecting invoice:', error);
            alert('Error rejecting invoice.');
        }
    };

    if (loading) return <div className="p-8">Loading pending payments...</div>;

    return (
        <div className="max-w-6xl mx-auto p-8">
            <h1 className="text-2xl font-bold mb-6">Manager Dashboard: Pending Payments</h1>

            <div className="bg-white shadow overflow-hidden rounded-md">
                <ul className="divide-y divide-gray-200">
                    {pendingInvoices.length === 0 ? (
                        <li className="p-4 text-center text-gray-500">No pending payments.</li>
                    ) : (
                        pendingInvoices.map((invoice) => (
                            <li key={invoice.id} className="p-4 sm:px-6 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-indigo-600">
                                            Invoice #{invoice.id}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            Tenant: {invoice.contract?.user?.full_name || 'Unknown'} <br />
                                            Room: {invoice.contract?.user?.room?.room_number || 'N/A'}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            Amount: <strong>{invoice.room_total_cost} THB</strong>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end space-y-2">
                                        {invoice.payment_slip ? (
                                            <a
                                                href={invoice.payment_slip}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-500 text-xs hover:underline"
                                            >
                                                View Slip
                                            </a>
                                        ) : (
                                            <span className="text-gray-400 text-xs">No Slip</span>
                                        )}

                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleApprove(invoice.id)}
                                                className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(invoice.id)}
                                                className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>
        </div>
    );
}
