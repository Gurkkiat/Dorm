
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Invoice } from '@/types/database';
import Link from 'next/link';
// import { format } from 'date-fns'; // You might need to install date-fns or just use native Date

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchInvoices() {
            try {
                // In a real app, you'd filter by the logged-in user.
                // For now, fetching all invoices for demonstration.
                const { data, error } = await supabase
                    .from('invoice')
                    .select('*, contract:contract_id ( room_id, user_id )') // fetching related contract info if needed
                    .order('due_date', { ascending: true });

                if (error) throw error;
                setInvoices(data || []);
            } catch (error) {
                console.error('Error fetching invoices:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchInvoices();
    }, []);

    if (loading) return <div className="p-8">Loading invoices...</div>;

    return (
        <div className="max-w-4xl mx-auto p-8">
            <h1 className="text-2xl font-bold mb-6">My Invoices</h1>

            <div className="bg-white shadow overflow-hidden rounded-md">
                <ul className="divide-y divide-gray-200">
                    {invoices.length === 0 ? (
                        <li className="p-4 text-center text-gray-500">No invoices found.</li>
                    ) : (
                        invoices.map((invoice) => (
                            <li key={invoice.id}>
                                <div className="hover:bg-gray-50 block p-4 sm:px-6">
                                    <div className="flex items-center justify-between">
                                        <div className="truncate text-sm font-medium text-indigo-600">
                                            Invoice #{invoice.id} - {invoice.type}
                                        </div>
                                        <div className="ml-2 flex flex-shrink-0">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${invoice.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                                invoice.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                {invoice.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 sm:flex sm:justify-between">
                                        <div className="sm:flex">
                                            <p className="flex items-center text-sm text-gray-500">
                                                Amount: {invoice.room_total_cost} THB
                                            </p>
                                        </div>
                                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                            <p>
                                                Due: {new Date(invoice.due_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    {invoice.status !== 'Paid' && invoice.status !== 'Pending' && (
                                        <div className="mt-2 text-right">
                                            <Link
                                                href={`/invoices/${invoice.id}/payment`}
                                                className="inline-block bg-indigo-600 text-white text-xs px-3 py-1 rounded hover:bg-indigo-700"
                                            >
                                                Pay Now
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>
        </div>
    );
}
