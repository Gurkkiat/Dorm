
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Invoice } from '@/types/database';
import { useManager } from '../ManagerContext';
import { Search, Eye, CreditCard, TrendingUp, DollarSign, Droplets, Zap, User } from 'lucide-react';

interface InvoiceWithDetails extends Invoice {
    contract?: {
        user?: {
            full_name: string;
        };
        room?: {
            room_number: string;
            building?: { // Needed for filtering
                branch_id: number;
            }
        };
    }
}

export default function ManagerPaymentsPage() {
    const { selectedBranchId } = useManager();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<InvoiceWithDetails[]>([]);
    const [filteredData, setFilteredData] = useState<InvoiceWithDetails[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [totalPendingAmount, setTotalPendingAmount] = useState(0);

    // Utility Rates (Display Only)
    const WATER_RATE = 20;
    const ELEC_RATE = 5;

    useEffect(() => {
        fetchPendingInvoices();
    }, [selectedBranchId]);

    useEffect(() => {
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            const filtered = data.filter(inv =>
                inv.contract?.user?.full_name?.toLowerCase().includes(lower) ||
                inv.contract?.room?.room_number?.toLowerCase().includes(lower) ||
                inv.id.toString().includes(lower)
            );
            setFilteredData(filtered);
        } else {
            setFilteredData(data);
        }
    }, [data, searchTerm]);

    async function fetchPendingInvoices() {
        setLoading(true);
        try {
            let query = supabase
                .from('invoice')
                .select('*, contract:contract_id ( user:user_id ( full_name ), room:room_id ( room_number, building:building_id ( branch_id ) ) )')
                .eq('status', 'Pending')
                .order('paid_date', { ascending: false });

            if (selectedBranchId !== 'All') {
                query = query.eq('contract.room.building.branch_id', selectedBranchId);
            }

            const { data, error } = await query;

            if (error) throw error;
            const invoices = (data as unknown as InvoiceWithDetails[]) || [];
            setData(invoices);
            setFilteredData(invoices);

            // Calculate Total Pending
            const total = invoices.reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0);
            setTotalPendingAmount(total);

        } catch (error) {
            console.error('Error fetching pending invoices:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleApprove = async (id: number) => {
        if (!confirm(`Approve Invoice #${id}?`)) return;
        try {
            const { error } = await supabase
                .from('invoice')
                .update({ status: 'Paid' })
                .eq('id', id);

            if (error) throw error;
            setData(prev => prev.filter(inv => inv.id !== id));
            alert(`Invoice #${id} approved.`);
        } catch (error) {
            console.error('Error approving invoice:', error);
            alert('Error approving invoice.');
        }
    };

    const handleReject = async (id: number) => {
        if (!confirm(`Reject Invoice #${id}?`)) return;
        try {
            const { error } = await supabase
                .from('invoice')
                .update({ status: 'Unpaid', payment_slip: null })
                .eq('id', id);

            if (error) throw error;
            setData(prev => prev.filter(inv => inv.id !== id));
            alert(`Invoice #${id} rejected.`);
        } catch (error) {
            console.error('Error rejecting invoice:', error);
            alert('Error rejecting invoice.');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;

    const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="h-full flex flex-col p-6 bg-gray-50/50 gap-6 overflow-y-auto">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Welcome Back, Manager</h1>
                    <p className="text-gray-500 text-sm mt-1">{currentDate}</p>
                </div>
            </div>

            {/* Widgets Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Total Pending Card (Credit Card Style) */}
                <div className="bg-gradient-to-br from-[#0047AB] to-[#003380] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden h-48 flex flex-col justify-between">
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4">
                        <CreditCard size={120} />
                    </div>

                    <div className="flex justify-between items-start z-10">
                        <div>
                            <p className="text-blue-200 text-sm font-medium">Total Pending Amount</p>
                            <h2 className="text-3xl font-bold mt-1">฿ {totalPendingAmount.toLocaleString()}</h2>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                            <TrendingUp size={20} />
                        </div>
                    </div>

                    <div className="z-10">
                        <div className="flex gap-4 mt-4">
                            <div>
                                <p className="text-xs text-blue-300">Water Rate</p>
                                <p className="font-bold">{WATER_RATE} ฿/Unit</p>
                            </div>
                            <div>
                                <p className="text-xs text-blue-300">Elec Rate</p>
                                <p className="font-bold">{ELEC_RATE} ฿/Unit</p>
                            </div>
                        </div>
                        <p className="text-xs text-blue-200 mt-4 text-right">Updated Just Now</p>
                    </div>
                </div>

                {/* Monthly Goals / Stats (Simple Placeholder for now) */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-48">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-700">Pending Invoices</h3>
                        <span className="bg-blue-100 text-blue-600 py-1 px-3 rounded-full text-xs font-bold">Monthly</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-[#0047AB]">{data.length}</div>
                            <p className="text-gray-400 text-sm">Invoices Waiting</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment History / List Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-lg text-gray-800">Pending Invoices</h3>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search Room or Name"
                            className="bg-gray-100 text-gray-700 text-sm rounded-full px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    </div>
                </div>

                <div className="overflow-auto flex-1 p-4">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="py-4 px-4 rounded-l-lg">Room / Tenant</th>
                                <th className="py-4 px-4">Breakdown</th>
                                <th className="py-4 px-4">Total</th>
                                <th className="py-4 px-4">Due Date</th>
                                <th className="py-4 px-4">Slip</th>
                                <th className="py-4 px-4 rounded-r-lg text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-50">
                            {filteredData.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">{row.contract?.user?.full_name || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500">Room {row.contract?.room?.room_number || '-'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex gap-4 text-xs">
                                            <div className="flex items-center gap-1 text-cyan-600" title={`Water (${WATER_RATE} ฿/unit)`}>
                                                <Droplets size={12} />
                                                <span>{(row.room_water_cost || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-yellow-600" title={`Elec (${ELEC_RATE} ฿/unit)`}>
                                                <Zap size={12} />
                                                <span>{(row.room_elec_cost || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-gray-600" title="Rent">
                                                <DollarSign size={12} />
                                                <span>{(row.room_rent_cost || 0).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 font-bold text-[#0047AB]">
                                        ฿ {(row.room_total_cost || 0).toLocaleString()}
                                    </td>
                                    <td className="py-4 px-4 text-gray-500">
                                        {row.due_date ? new Date(row.due_date).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="py-4 px-4">
                                        {row.payment_slip ? (
                                            <a
                                                href={row.payment_slip}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 text-xs font-medium"
                                            >
                                                <Eye size={14} /> View
                                            </a>
                                        ) : (
                                            <span className="text-gray-300 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleApprove(row.id)}
                                                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(row.id)}
                                                className="bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-red-100"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-gray-400">
                                        No pending invoices found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
