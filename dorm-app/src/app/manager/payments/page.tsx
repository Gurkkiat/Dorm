
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Invoice } from '@/types/database';
import { useManager } from '../ManagerContext';
import { Search, Eye, CreditCard, TrendingUp, DollarSign, Droplets, Zap, User, Edit3, Trash2, AlertTriangle } from 'lucide-react';

interface InvoiceWithDetails extends Invoice {
    contract?: {
        id?: number;
        status?: string;
        user?: {
            full_name: string;
            profile_picture?: string | null;
        };
        room?: {
            room_number: string;
            floor: number;
            building?: {
                branch_id: number;
                name_building: string;
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
    const [filterStatus, setFilterStatus] = useState('All'); // Default to all statuses
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [totalPendingAmount, setTotalPendingAmount] = useState(0);
    const [totalBilledAmount, setTotalBilledAmount] = useState(0);
    const [waitingCount, setWaitingCount] = useState(0);

    // Utility Rates (Display Only)
    const WATER_RATE = 20;
    const ELEC_RATE = 5;

    useEffect(() => {
        fetchInvoices();
    }, [selectedBranchId]);

    useEffect(() => {
        let result = data;

        // 1. Filter by Date Range
        if (filterStartDate) {
            result = result.filter(inv => {
                const dateToUse = inv.due_date || inv.bill_date;
                if (!dateToUse) return false;
                return new Date(dateToUse) >= new Date(filterStartDate);
            });
        }
        if (filterEndDate) {
            result = result.filter(inv => {
                const dateToUse = inv.due_date || inv.bill_date;
                if (!dateToUse) return false;
                const end = new Date(filterEndDate);
                end.setHours(23, 59, 59, 999);
                return new Date(dateToUse) <= end;
            });
        }

        // 2. Filter by Search Term
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(inv =>
                inv.contract?.user?.full_name?.toLowerCase().includes(lower) ||
                inv.contract?.room?.room_number?.toLowerCase().includes(lower) ||
                inv.id.toString().includes(lower)
            );
        }

        // Calculate totals dynamically based on Month & Search (ignore Status filter so totals reflect the month overall)
        const billedTotal = result.reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0);
        const pendingInv = result.filter(inv => inv.status?.toLowerCase() !== 'paid');
        const unpaidTotal = pendingInv.reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0);
        const pendingCountVar = result.filter(inv => inv.status?.toLowerCase() === 'pending').length;

        setTotalBilledAmount(billedTotal);
        setTotalPendingAmount(unpaidTotal);
        setWaitingCount(pendingCountVar);

        // 3. Filter by Status
        if (filterStatus !== 'All') {
            if (filterStatus === 'Overdue') {
                result = result.filter(inv => inv.status?.toLowerCase() !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date());
            } else if (filterStatus === 'Pending') {
                result = result.filter(inv => inv.status?.toLowerCase() === 'pending');
            } else if (filterStatus === 'Unpaid') {
                result = result.filter(inv => inv.status?.toLowerCase() === 'unpaid');
            } else if (filterStatus === 'Paid') {
                result = result.filter(inv => inv.status?.toLowerCase() === 'paid');
            }
        }
        
        setFilteredData(result);
    }, [data, searchTerm, filterStatus, filterStartDate, filterEndDate]);

    async function fetchInvoices() {
        setLoading(true);
        try {
            let query = supabase
                .from('invoice')
                .select('*, contract:contract_id!inner ( id, status, user:user_id ( full_name, profile_picture ), room:room_id!inner ( room_number, floor, building:building_id!inner ( branch_id, name_building ) ) )')
                .order('bill_date', { ascending: false });

            if (selectedBranchId !== 'All') {
                query = query.eq('contract.room.building.branch_id', selectedBranchId);
            }

            const { data, error } = await query;

            if (error) throw error;
            const invoices = (data as unknown as InvoiceWithDetails[]) || [];
            setData(invoices);

            // Totals are now calculated dynamically in the useEffect

        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoading(false);
        }
    }

    const [showModal, setShowModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithDetails | null>(null);
    const [processing, setProcessing] = useState(false);

    // Update handleApprove to open modal
    const handleApprove = (invoice: InvoiceWithDetails) => {
        setSelectedInvoice(invoice);
        setShowModal(true);
    };

    // Actual Approval Logic (Moved here)
    const processApproval = async () => {
        if (!selectedInvoice) return;
        setProcessing(true);

        const isIssuance = !selectedInvoice.payment_slip;

        try {
            const newStatus = isIssuance ? 'Unpaid' : 'Paid';
            const { error } = await supabase
                .from('invoice')
                .update({ status: newStatus })
                .eq('id', selectedInvoice.id);

            if (error) throw error;

            // If paying Entry Fee, activate the Contract
            if (!isIssuance && selectedInvoice.type === 'entry_fee') {
                const { error: contractError } = await supabase
                    .from('contract')
                    .update({ status: 'complete' }) // Mark contract as Active/Complete
                    .eq('id', selectedInvoice.contract_id);

                if (contractError) console.error('Error activating contract:', contractError);
            }

            // Optimistic Update
            setData(prev => prev.map(inv =>
                inv.id === selectedInvoice.id ? { ...inv, status: newStatus } : inv
            ));

            alert(isIssuance ? `Invoice #${selectedInvoice.id} approved. Waiting for tenant payment.` : `Invoice #${selectedInvoice.id} marked as Paid. Contract Activated.`);
            closeModal();
        } catch (error) {
            console.error('Error approving invoice:', error);
            alert('Error approving invoice.');
        } finally {
            setProcessing(false);
        }
    };

    // Edit Bill State (for reject on complete contracts)
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<InvoiceWithDetails | null>(null);
    const [editForm, setEditForm] = useState<{
        room_rent_cost: number | '';
        room_water_cost: number | '';
        room_elec_cost: number | '';
        room_repair_cost: number | '';
        room_deposit_cost: number | '';
    }>({
        room_rent_cost: 0,
        room_water_cost: 0,
        room_elec_cost: 0,
        room_repair_cost: 0,
        room_deposit_cost: 0,
    });

    const handleRejectInModal = async () => {
        if (!selectedInvoice) return;
        const contractStatus = selectedInvoice.contract?.status?.toLowerCase() || '';

        if (contractStatus === 'incomplete') {
            // Case 1: Incomplete contract → delete contract and invoice
            if (!confirm(`This is a new tenant (incomplete contract).\nRejecting will DELETE this contract and invoice permanently.\n\nAre you sure?`)) return;
            setProcessing(true);
            try {
                // Delete invoice first (foreign key constraint)
                const { error: invError } = await supabase
                    .from('invoice')
                    .delete()
                    .eq('id', selectedInvoice.id);
                if (invError) throw invError;

                // Delete contract
                if (selectedInvoice.contract?.id) {
                    const { error: contractError } = await supabase
                        .from('contract')
                        .delete()
                        .eq('id', selectedInvoice.contract.id);
                    if (contractError) throw contractError;
                }

                setData(prev => prev.filter(inv => inv.id !== selectedInvoice.id));
                alert(`Contract and Invoice #${selectedInvoice.id} have been deleted.`);
                closeModal();
            } catch (error) {
                console.error('Error deleting contract:', error);
                alert('Error deleting contract. Please try again.');
            } finally {
                setProcessing(false);
            }
        } else {
            // Case 2: Complete contract → open edit bill form
            setEditingInvoice(selectedInvoice);
            setEditForm({
                room_rent_cost: selectedInvoice.room_rent_cost || 0,
                room_water_cost: selectedInvoice.room_water_cost || 0,
                room_elec_cost: selectedInvoice.room_elec_cost || 0,
                room_repair_cost: selectedInvoice.room_repair_cost || 0,
                room_deposit_cost: selectedInvoice.room_deposit_cost || 0,
            });
            closeModal();
            setShowEditModal(true);
        }
    };

    const editFormTotal = (Number(editForm.room_rent_cost) || 0) + (Number(editForm.room_water_cost) || 0) + (Number(editForm.room_elec_cost) || 0) + (Number(editForm.room_repair_cost) || 0) + (Number(editForm.room_deposit_cost) || 0);

    const handleSaveEdit = async () => {
        if (!editingInvoice) return;
        setProcessing(true);
        try {
            const finalForm = {
                room_rent_cost: Number(editForm.room_rent_cost) || 0,
                room_water_cost: Number(editForm.room_water_cost) || 0,
                room_elec_cost: Number(editForm.room_elec_cost) || 0,
                room_repair_cost: Number(editForm.room_repair_cost) || 0,
                room_deposit_cost: Number(editForm.room_deposit_cost) || 0,
            };
            const { error } = await supabase
                .from('invoice')
                .update({
                    ...finalForm,
                    room_total_cost: editFormTotal,
                    status: 'Unpaid',
                    payment_slip: null,
                })
                .eq('id', editingInvoice.id);

            if (error) throw error;

            setData(prev => prev.map(inv =>
                inv.id === editingInvoice.id
                    ? { ...inv, ...finalForm, room_total_cost: editFormTotal, status: 'Unpaid', payment_slip: null }
                    : inv
            ));
            alert(`Invoice #${editingInvoice.id} has been updated and set to Unpaid.`);
            setShowEditModal(false);
            setEditingInvoice(null);
        } catch (error) {
            console.error('Error updating invoice:', error);
            alert('Error saving changes.');
        } finally {
            setProcessing(false);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedInvoice(null);
        setProcessing(false);
    };

    const handleReject = async (invoice: InvoiceWithDetails) => {
        const contractStatus = invoice.contract?.status?.toLowerCase() || '';

        if (contractStatus === 'incomplete') {
            if (!confirm(`This is a new tenant (incomplete contract).\nRejecting will DELETE this contract and invoice permanently.\n\nAre you sure?`)) return;
            try {
                const { error: invError } = await supabase.from('invoice').delete().eq('id', invoice.id);
                if (invError) throw invError;

                if (invoice.contract?.id) {
                    const { error: contractError } = await supabase.from('contract').delete().eq('id', invoice.contract.id);
                    if (contractError) throw contractError;
                }

                setData(prev => prev.filter(inv => inv.id !== invoice.id));
                alert(`Contract and Invoice #${invoice.id} have been deleted.`);
            } catch (error) {
                console.error('Error deleting contract:', error);
                alert('Error deleting contract. Please try again.');
            }
        } else {
            // Open edit form
            setEditingInvoice(invoice);
            setEditForm({
                room_rent_cost: invoice.room_rent_cost || 0,
                room_water_cost: invoice.room_water_cost || 0,
                room_elec_cost: invoice.room_elec_cost || 0,
                room_repair_cost: invoice.room_repair_cost || 0,
                room_deposit_cost: invoice.room_deposit_cost || 0,
            });
            setShowEditModal(true);
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

                {/* Total Billed & Pending Card */}
                <div className="bg-gradient-to-br from-[#0047AB] to-[#002b6b] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                    {/* Background Pattern */}
                    <div className="absolute top-0 right-0 p-6 opacity-10 transform translate-x-8 -translate-y-8">
                        <DollarSign size={180} />
                    </div>
                    <div className="absolute bottom-0 left-0 p-6 opacity-5 transform -translate-x-8 translate-y-8">
                        <CreditCard size={120} />
                    </div>

                    <div className="relative z-10 flex flex-col h-full justify-between">
                        {/* Top: Total Billed */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                                        <TrendingUp size={16} className="text-blue-100" />
                                    </div>
                                    <p className="text-blue-100 font-medium tracking-wide text-sm uppercase">Total Billed</p>
                                </div>
                                <h2 className="text-4xl font-extrabold tracking-tight">฿ {totalBilledAmount.toLocaleString()}</h2>
                            </div>
                        </div>

                        {/* Bottom: Pending & Rates */}
                        <div className="flex justify-between items-end border-t border-white/10 pt-4 mt-auto">
                            <div>
                                <p className="text-blue-200 text-sm font-medium mb-1">Pending Amount</p>
                                <h3 className="text-2xl font-bold text-white">฿ {totalPendingAmount.toLocaleString()}</h3>
                            </div>
                            
                            <div className="flex gap-4 text-right bg-black/10 p-3 rounded-2xl backdrop-blur-sm">
                                <div>
                                    <p className="text-[10px] text-blue-200 uppercase tracking-wider mb-0.5"><Droplets size={10} className="inline mr-1"/>Water</p>
                                    <p className="font-bold text-sm">{WATER_RATE} ฿/Unit</p>
                                </div>
                                <div className="w-px bg-white/20"></div>
                                <div>
                                    <p className="text-[10px] text-blue-200 uppercase tracking-wider mb-0.5"><Zap size={10} className="inline mr-1"/>Elec</p>
                                    <p className="font-bold text-sm">{ELEC_RATE} ฿/Unit</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Waiting Invoices Card */}
                <div className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-900/5 border border-gray-100 flex flex-col justify-between min-h-[220px] relative overflow-hidden">
                    {/* Decorative Background */}
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-50 rounded-full blur-2xl opacity-60"></div>
                    <div className="absolute -left-6 -bottom-6 w-24 h-24 bg-yellow-50 rounded-full blur-2xl opacity-60"></div>

                    <div className="relative z-10 flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100/50 p-2.5 rounded-xl text-blue-600">
                                <CreditCard size={20} />
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg">Action Required</h3>
                        </div>
                        <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-1 px-4 rounded-full text-xs font-bold shadow-sm">Filtered Data</span>
                    </div>

                    <div className="relative z-10 flex-1 flex items-center justify-center">
                        <div className="text-center group">
                            <div className="relative inline-block">
                                <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#0047AB] to-blue-400 drop-shadow-sm transition-transform group-hover:scale-105 duration-300">
                                    {waitingCount}
                                </div>
                                {waitingCount > 0 && (
                                    <span className="absolute -top-2 -right-4 flex h-4 w-4">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-500 font-medium mt-2">Invoices Waiting for Approval</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment History / List Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="font-bold text-lg text-gray-800">Invoices List</h3>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                        {/* Search */}
                        <div className="relative flex-grow md:flex-grow-0">
                            <input
                                type="text"
                                placeholder="Search Room or Name"
                                className="bg-gray-100 text-gray-700 text-sm rounded-xl px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-[#0047AB] w-full md:w-56"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        </div>

                        {/* Status Filter */}
                        <select
                            className="bg-gray-100 text-gray-700 text-sm rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0047AB] flex-grow md:flex-grow-0"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Pending">Pending (Action Required)</option>
                            <option value="Unpaid">Unpaid (Waiting on Tenant)</option>
                            <option value="Paid">Paid</option>
                            <option value="Overdue">Overdue</option>
                        </select>

                        {/* Date Range Filter */}
                        <div className="flex items-center gap-2 flex-grow md:flex-grow-0">
                            <input
                                type="date"
                                className="bg-gray-100 text-gray-700 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0047AB] w-full md:w-auto"
                                value={filterStartDate}
                                onChange={(e) => setFilterStartDate(e.target.value)}
                                title="Start Date"
                            />
                            <span className="text-gray-400 text-sm">ถึง</span>
                            <input
                                type="date"
                                className="bg-gray-100 text-gray-700 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0047AB] w-full md:w-auto"
                                value={filterEndDate}
                                onChange={(e) => setFilterEndDate(e.target.value)}
                                title="End Date"
                            />
                        </div>
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
                                <th className="py-4 px-4">Status</th>
                                <th className="py-4 px-4 rounded-r-lg text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-50">
                            {filteredData.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            {row.contract?.user?.profile_picture ? (
                                                <img
                                                    src={row.contract.user.profile_picture}
                                                    alt={row.contract.user.full_name || ''}
                                                    className="w-9 h-9 rounded-full object-cover shadow-sm"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0047AB] to-[#0066FF] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                                    {(row.contract?.user?.full_name || 'U').charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-gray-800">{row.contract?.user?.full_name || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500">Room {row.contract?.room?.room_number || '-'} · {row.contract?.room?.building?.name_building || '-'} · Floor {row.contract?.room?.floor || '-'}</p>
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
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            row.status?.toLowerCase() === 'paid' ? 'bg-green-100 text-green-700' :
                                            row.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                            (row.status?.toLowerCase() !== 'paid' && row.due_date && new Date(row.due_date) < new Date()) ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-500'
                                        }`}>
                                            {row.status?.toLowerCase() === 'paid' ? 'Paid' :
                                             row.status?.toLowerCase() === 'pending' ? 'Pending' :
                                             (row.status?.toLowerCase() !== 'paid' && row.due_date && new Date(row.due_date) < new Date()) ? 'Overdue' :
                                             row.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        {row.status?.toLowerCase() === 'pending' ? (
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleApprove(row)}
                                                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
                                                >
                                                    {row.payment_slip ? 'Confirm Payment' : 'Approve'}
                                                </button>
                                                <button
                                                    onClick={() => handleReject(row)}
                                                    className="bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-red-100"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        ) : row.status?.toLowerCase() === 'unpaid' || (row.status?.toLowerCase() !== 'paid' && row.due_date && new Date(row.due_date) < new Date()) ? (
                                            <span className="text-xs text-gray-400 italic">Waiting...</span>
                                        ) : row.status?.toLowerCase() === 'paid' ? (
                                            <span className="text-xs text-green-500 font-bold">Completed</span>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-gray-400">
                                        No invoices found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Confirmation Modal */}
            {
                showModal && selectedInvoice && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
                            <div className="bg-[#0047AB] p-4 text-white">
                                <h2 className="text-xl font-bold">Verify Invoice Details</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-sm opacity-80">Invoice #{selectedInvoice.id}</p>
                                    {selectedInvoice.contract?.status?.toLowerCase() === 'incomplete' && (
                                        <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full">New Tenant</span>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="text-gray-500">Tenant</span>
                                    <span className="font-bold text-gray-800">{selectedInvoice.contract?.user?.full_name}</span>
                                </div>
                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="text-gray-500">Room</span>
                                    <span className="font-bold text-gray-800">{selectedInvoice.contract?.room?.room_number}</span>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 flex items-center gap-2"><DollarSign size={14} /> Rent</span>
                                        <span className="font-bold text-gray-800">{(selectedInvoice.room_rent_cost || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 flex items-center gap-2"><Droplets size={14} /> Water</span>
                                        <span className="font-bold text-cyan-600">{(selectedInvoice.room_water_cost || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 flex items-center gap-2"><Zap size={14} /> Electric</span>
                                        <span className="font-bold text-yellow-600">{(selectedInvoice.room_elec_cost || 0).toLocaleString()}</span>
                                    </div>
                                    {selectedInvoice.room_repair_cost > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 flex items-center gap-2"><TrendingUp size={14} /> Repair</span>
                                            <span className="font-bold text-red-500">{(selectedInvoice.room_repair_cost || 0).toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="border-t pt-2 flex justify-between font-bold text-lg text-[#0047AB]">
                                        <span>Total</span>
                                        <span>฿ {(selectedInvoice.room_total_cost || 0).toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="p-4 bg-gray-50 flex gap-3">
                                        <button
                                            onClick={handleRejectInModal}
                                            disabled={processing}
                                            className="flex-1 px-4 py-2 bg-white border border-red-200 text-red-500 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            {selectedInvoice.contract?.status?.toLowerCase() === 'incomplete' ? (
                                                <><Trash2 size={14} /> Delete</>
                                            ) : (
                                                <><Edit3 size={14} /> Edit Bill</>
                                            )}
                                        </button>
                                    <button
                                        onClick={closeModal}
                                        disabled={processing}
                                        className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={processApproval}
                                        disabled={processing}
                                        className="flex-1 px-4 py-2 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors shadow-lg"
                                    >
                                        {processing ? 'Processing...' : 'Confirm'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            {/* Edit Bill Modal */}
            {showEditModal && editingInvoice && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white">
                            <h2 className="text-xl font-bold flex items-center gap-2"><Edit3 size={20} /> Edit Invoice</h2>
                            <p className="text-sm opacity-80">Invoice #{editingInvoice.id} · {editingInvoice.contract?.user?.full_name}</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-800">Payment was rejected. Please correct the amounts below. The invoice will be set back to <strong>Unpaid</strong>.</p>
                            </div>

                            <div className="space-y-3">
                                {[
                                    { label: 'Rent', key: 'room_rent_cost', icon: <DollarSign size={14} />, color: 'text-gray-600' },
                                    { label: 'Water', key: 'room_water_cost', icon: <Droplets size={14} />, color: 'text-cyan-600' },
                                    { label: 'Electric', key: 'room_elec_cost', icon: <Zap size={14} />, color: 'text-yellow-600' },
                                    { label: 'Repair', key: 'room_repair_cost', icon: <TrendingUp size={14} />, color: 'text-red-500' },
                                    { label: 'Deposit', key: 'room_deposit_cost', icon: <CreditCard size={14} />, color: 'text-purple-600' },
                                ].map(field => (
                                    <div key={field.key} className="flex items-center gap-3">
                                        <div className={`flex items-center gap-1.5 w-24 text-sm ${field.color}`}>
                                            {field.icon}
                                            <span>{field.label}</span>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            className="flex-1 bg-gray-100 text-gray-800 text-sm font-bold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                                            value={editForm[field.key as keyof typeof editForm]}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, [field.key]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="border-t pt-3 flex justify-between items-center">
                                <span className="font-bold text-gray-700">New Total</span>
                                <span className="text-xl font-bold text-orange-600">฿ {editFormTotal.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 flex gap-3">
                            <button
                                onClick={() => { setShowEditModal(false); setEditingInvoice(null); }}
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg"
                            >
                                {processing ? 'Saving...' : 'Save & Set Unpaid'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
