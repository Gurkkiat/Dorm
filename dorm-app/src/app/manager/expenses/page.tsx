'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Receipt, Trash2, Search, X, Loader2, Building2, Calendar, DollarSign, Image as ImageIcon, ExternalLink, Pencil, Wrench, CheckCircle } from 'lucide-react';
import { useManager } from '../ManagerContext';
import { Expenses, Building } from '@/types/database';

export default function ManagerExpensesPage() {
    const { selectedBranchId } = useManager();
    const [expenses, setExpenses] = useState<Expenses[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');

    const [activeTab, setActiveTab] = useState<'expenses' | 'approvals'>('expenses');
    const [pendingParts, setPendingParts] = useState<any[]>([]);

    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
    
    // Default to current date
    const today = new Date().toISOString().split('T')[0];
    const [formData, setFormData] = useState({
        building_id: '',
        amount: '',
        category: 'Electricity Bill',
        note: '',
        paid_at: today
    });

    const CATEGORIES = ['Electricity Bill', 'Water Bill', 'Maintenance', 'Internet', 'Other'];

    useEffect(() => {
        if (selectedBranchId !== null) {
            fetchData();
        }
    }, [selectedBranchId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Expenses
            let expenseQuery = supabase
                .from('expenses')
                .select('*, building:building_id(name_building)')
                .order('paid_at', { ascending: false });

            if (selectedBranchId !== 'All') {
                expenseQuery = expenseQuery.eq('branch_id', selectedBranchId);
            }

            const { data: expensesData, error: expenseError } = await expenseQuery;
            if (expenseError) throw expenseError;
            setExpenses((expensesData as unknown as Expenses[]) || []);

            // Fetch Pending Parts
            const { data: partsData, error: partsError } = await supabase
                .from('maintenance_parts')
                .select('*, maintenance_request!inner(id, issue_description, room_id, room:room_id(floor, room_number, building:building_id(id, name_building, branch_id)))')
                .eq('status', 'pending');
            
            if (partsError) console.error('Error fetching parts:', partsError);
            
            let filteredParts = partsData || [];
            if (selectedBranchId !== 'All') {
                filteredParts = filteredParts.filter((p: any) => 
                    p.maintenance_request?.room?.building?.branch_id === selectedBranchId
                );
            }
            setPendingParts(filteredParts);

            // Fetch Buildings for this branch
            if (selectedBranchId !== 'All') {
                const { data: buildingData, error: buildingError } = await supabase
                    .from('building')
                    .select('*')
                    .eq('branch_id', selectedBranchId)
                    .order('name_building');
                if (buildingError) throw buildingError;
                setBuildings(buildingData || []);
            } else {
                // If 'All' is selected, fetch all buildings (for admins)
                const { data: allBuildingData } = await supabase.from('building').select('*').order('name_building');
                setBuildings(allBuildingData || []);
            }

        } catch (err) {
            console.error('Error fetching expenses:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (selectedBranchId === 'All') {
            alert('Please select a specific branch from the sidebar to record an expense.');
            return;
        }

        setSubmitting(true);
        try {
            let receipt_url = editingExpenseId ? expenses.find(ex => ex.id === editingExpenseId)?.receipt_url : null;

            // Upload image if provided
            if (receiptFile) {
                const fileExt = receiptFile.name.split('.').pop();
                const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('expenses')
                    .upload(fileName, receiptFile);
                    
                if (uploadError) {
                    throw new Error('Failed to upload receipt image: ' + uploadError.message);
                }

                const { data } = supabase.storage.from('expenses').getPublicUrl(fileName);
                receipt_url = data.publicUrl;
            }

            const payload = {
                branch_id: Number(selectedBranchId),
                building_id: formData.building_id ? Number(formData.building_id) : null,
                amount: Number(formData.amount),
                category: formData.category,
                note: formData.note,
                paid_at: formData.paid_at.includes('T') ? formData.paid_at : formData.paid_at + 'T00:00:00Z',
                receipt_url: receipt_url
            };

            if (editingExpenseId) {
                const { error } = await supabase.from('expenses').update(payload).eq('id', editingExpenseId);
                if (error) throw error;
                alert('Expense updated successfully!');
            } else {
                const { error } = await supabase.from('expenses').insert([payload]);
                if (error) throw error;
                alert('Expense recorded successfully!');
            }

            setShowModal(false);
            setEditingExpenseId(null);
            setReceiptFile(null);
            setFormData({ building_id: '', amount: '', category: 'Electricity Bill', note: '', paid_at: today });
            fetchData();
        } catch (err: any) {
            alert('Error recording expense: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditClick = (expense: Expenses) => {
        setFormData({
            building_id: expense.building_id?.toString() || '',
            amount: expense.amount.toString(),
            category: expense.category,
            note: expense.note || '',
            paid_at: new Date(expense.paid_at).toISOString().split('T')[0]
        });
        setEditingExpenseId(expense.id);
        setShowModal(true);
    };

    const handleDeleteExpense = async (expense: Expenses) => {
        if (!confirm(`Are you sure you want to delete this ${expense.category} expense of ฿${expense.amount.toLocaleString()}?`)) return;
        try {
            const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
            if (error) throw error;
            setExpenses(prev => prev.filter(e => e.id !== expense.id));
        } catch (err: any) {
            alert(err.message || 'Failed to delete expense.');
        }
    };

    const handleApprovePart = async (part: any) => {
        if (!confirm(`Approve purchase of "${part.part_name}" for ฿${part.price}?`)) return;
        
        try {
            // 1. Update part status
            const { error: updateError } = await supabase
                .from('maintenance_parts')
                .update({ status: 'approved' })
                .eq('id', part.id);
            if (updateError) throw updateError;

            // 2. Insert into expenses
            const branchId = selectedBranchId === 'All' ? part.maintenance_request?.room?.building?.branch_id : selectedBranchId;
            const payload = {
                branch_id: Number(branchId),
                building_id: part.maintenance_request?.room?.building?.id || null,
                amount: Number(part.price),
                category: 'Maintenance',
                note: `[Approved Part] ${part.part_name} - Ref Job #${part.maintenance_id}`,
                paid_at: today + 'T00:00:00Z',
            };
            const { error: insertError } = await supabase.from('expenses').insert([payload]);
            if (insertError) throw insertError;

            alert('Part approved and recorded to expenses!');
            fetchData();
        } catch (err: any) {
            alert('Error approving part: ' + err.message);
        }
    };
    
    const handleRejectPart = async (part: any) => {
        if (!confirm(`Reject purchase of "${part.part_name}"?`)) return;
        try {
            const { error: updateError } = await supabase
                .from('maintenance_parts')
                .update({ status: 'rejected' })
                .eq('id', part.id);
            if (updateError) throw updateError;
            alert('Part rejected!');
            fetchData();
        } catch (err: any) {
            alert('Error rejecting part: ' + err.message);
        }
    };

    // Calculate analytics for top metric cards
    const currentMonthExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.paid_at);
        const now = new Date();
        return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
    });

    const totalCurrentMonth = currentMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPreviousMonth = expenses.filter(e => {
        const expenseDate = new Date(e.paid_at);
        const now = new Date();
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return expenseDate.getMonth() === prevMonth.getMonth() && expenseDate.getFullYear() === prevMonth.getFullYear();
    }).reduce((sum, e) => sum + Number(e.amount), 0);

    const filteredExpenses = expenses.filter(e => {
        const matchesSearch = e.note?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              e.building?.name_building?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'All' || e.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Branch Expenses</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage utility bills and operational costs</p>
                </div>
                <button
                    onClick={() => {
                        setEditingExpenseId(null);
                        setReceiptFile(null);
                        setFormData({ building_id: '', amount: '', category: 'Electricity Bill', note: '', paid_at: today });
                        setShowModal(true);
                    }}
                    className="bg-[#0047AB] hover:bg-[#003380] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    Record Expense
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-white rounded-xl w-fit border border-slate-200 shadow-sm shrink-0">
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'expenses'
                        ? 'bg-[#0047AB] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Expenses List
                </button>
                <button
                    onClick={() => setActiveTab('approvals')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === 'approvals'
                        ? 'bg-[#0047AB] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    Part Approvals
                    {pendingParts.length > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-black ${activeTab === 'approvals' ? 'bg-white text-[#0047AB]' : 'bg-red-100 text-red-600'}`}>
                            {pendingParts.length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'expenses' ? (
                <>
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex justify-center items-center shrink-0 shadow-inner">
                        <DollarSign size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">This Month</p>
                        <h2 className="text-2xl font-black text-slate-800">
                            ฿{totalCurrentMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h2>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex justify-center items-center shrink-0 shadow-inner">
                        <Calendar size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Last Month</p>
                        <h2 className="text-2xl font-black text-slate-800">
                            ฿{totalPreviousMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h2>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex justify-center items-center shrink-0 shadow-inner">
                        <Receipt size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Records</p>
                        <h2 className="text-2xl font-black text-slate-800">
                            {expenses.length} <span className="text-sm font-bold text-slate-400">Bills</span>
                        </h2>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 items-center shrink-0 flex-wrap">
                <div className="bg-white rounded-xl border border-slate-200 flex items-center gap-3 px-4 py-2 shadow-sm flex-1 min-w-[250px]">
                    <Search size={18} className="text-slate-400 shrink-0" />
                    <input
                        type="text"
                        placeholder="Search by note or building name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="flex-1 bg-transparent focus:outline-none text-slate-700 placeholder-slate-400 text-sm py-0.5"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                            <X size={16} />
                        </button>
                    )}
                </div>
                <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0047AB] cursor-pointer"
                >
                    <option value="All">All Categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* Expense List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="py-4 px-6">Payment Date</th>
                                <th className="py-4 px-6">Building</th>
                                <th className="py-4 px-6">Category</th>
                                <th className="py-4 px-6">Amount</th>
                                <th className="py-4 px-6 w-1/3">Notes</th>
                                <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {loading ? (
                                <tr><td colSpan={6} className="py-12 text-center text-slate-400">
                                    <Loader2 size={28} className="animate-spin mx-auto mb-2 text-slate-300" />
                                    Loading expenses...
                                </td></tr>
                            ) : filteredExpenses.length === 0 ? (
                                <tr><td colSpan={6} className="py-12 text-center text-slate-400">
                                    No expenses found. Click "Record Expense" to add a new bill.
                                </td></tr>
                            ) : (
                                filteredExpenses.map(expense => (
                                    <tr key={expense.id} className="hover:bg-slate-50/70 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <Calendar size={14} className="text-slate-400" />
                                                {new Date(expense.paid_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {expense.building ? (
                                                <div className="flex items-center gap-2">
                                                    <Building2 size={16} className="text-indigo-500" />
                                                    <span className="font-bold text-slate-800">{expense.building.name_building}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Branch Area (General)</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="font-bold text-slate-700">{expense.category}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="font-black text-red-600 text-base">
                                                ฿{Number(expense.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-slate-500">
                                            {expense.note || <span className="italic opacity-50">No notes</span>}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {expense.receipt_url && (
                                                    <a
                                                        href={expense.receipt_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="View Receipt"
                                                    >
                                                        <ExternalLink size={16} />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleEditClick(expense)}
                                                    className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Edit Expense"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteExpense(expense)}
                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Delete Expense"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400 bg-slate-50/50">
                    Showing {filteredExpenses.length} records
                </div>
            </div>
            </>
            ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                    <Wrench size={20} className="text-slate-400" />
                    <h2 className="text-lg font-bold text-slate-800">Pending Parts Requests</h2>
                </div>
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-white text-slate-500 text-xs uppercase font-semibold border-b border-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="py-4 px-6">Date</th>
                                <th className="py-4 px-6">Location</th>
                                <th className="py-4 px-6 w-1/3">Part Details</th>
                                <th className="py-4 px-6">Price</th>
                                <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {loading ? (
                                <tr><td colSpan={5} className="py-12 text-center text-slate-400">
                                    <Loader2 size={28} className="animate-spin mx-auto mb-2 text-slate-300" />
                                    Loading requests...
                                </td></tr>
                            ) : pendingParts.length === 0 ? (
                                <tr><td colSpan={5} className="py-12 text-center text-slate-400">
                                    No pending part requests from mechanics at the moment.
                                </td></tr>
                            ) : (
                                pendingParts.map((part) => (
                                    <tr key={part.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2 text-slate-700 font-medium">
                                                <Calendar size={14} className="text-slate-400" />
                                                {new Date(part.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 flex items-center gap-1.5"><Building2 size={14} className="text-indigo-500"/> {part.maintenance_request?.room?.building?.name_building || 'Unknown'}</span>
                                                <span className="text-xs text-slate-500">Floor {part.maintenance_request?.room?.floor} - Rm {part.maintenance_request?.room?.room_number}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700 text-base">{part.part_name}</span>
                                                <span className="text-xs text-slate-500 mt-0.5 line-clamp-1">Ref: {part.maintenance_request?.issue_description}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="font-black text-red-600 text-base">
                                                ฿{Number(part.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleRejectPart(part)}
                                                    className="px-3 py-1.5 text-slate-500 hover:text-red-600 font-bold hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleApprovePart(part)}
                                                    className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold rounded-lg transition-all flex items-center gap-1"
                                                >
                                                    <CheckCircle size={16} /> Approve
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* Record Expense Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-[#0047AB]">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Receipt size={20} className="text-blue-200" />
                                {editingExpenseId ? 'Edit Utility Bill' : 'Record Utility Bill'}
                            </h2>
                            <button onClick={() => {
                                setShowModal(false);
                                setEditingExpenseId(null);
                                setReceiptFile(null);
                            }} className="p-1.5 hover:bg-[#003380] rounded-lg transition-colors text-blue-200 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Building <span className="font-normal text-slate-400">(Optional)</span></label>
                                <select
                                    value={formData.building_id}
                                    onChange={e => setFormData({ ...formData, building_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                >
                                    <option value="">— General Branch Expense —</option>
                                    {buildings.map(b => (
                                        <option key={b.id} value={b.id}>{b.name_building}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                    >
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Payment Date</label>
                                    <input
                                        type="date" required
                                        value={formData.paid_at}
                                        onChange={e => setFormData({ ...formData, paid_at: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Total Amount (฿)</label>
                                <input
                                    type="number" required min="0" step="0.01"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB] font-black text-lg"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Receipt Image <span className="font-normal text-slate-400">(Optional)</span></label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-[#0047AB] hover:bg-blue-50/50 transition-colors relative">
                                    <div className="space-y-1 text-center">
                                        {receiptFile ? (
                                            <div className="flex flex-col items-center">
                                                <ImageIcon className="mx-auto h-12 w-12 text-[#0047AB]" />
                                                <p className="text-sm font-medium text-slate-700 mt-2">{receiptFile.name}</p>
                                                <button 
                                                    type="button" 
                                                    onClick={(e) => { e.preventDefault(); setReceiptFile(null); }}
                                                    className="text-xs text-red-500 font-bold hover:text-red-700 mt-1 cursor-pointer z-10 relative"
                                                >
                                                    Remove file
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <ImageIcon className="mx-auto h-12 w-12 text-slate-400" />
                                                <div className="flex text-sm text-slate-600 justify-center">
                                                    <label className="relative cursor-pointer bg-transparent rounded-md font-bold text-[#0047AB] focus-within:outline-none hover:text-[#003380]">
                                                        <span>Upload a file</span>
                                                        <input
                                                            type="file"
                                                            className="sr-only"
                                                            accept="image/*"
                                                            onChange={e => {
                                                                if (e.target.files && e.target.files[0]) {
                                                                    setReceiptFile(e.target.files[0]);
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                    <p className="pl-1">or drag and drop</p>
                                                </div>
                                                <p className="text-xs text-slate-500">PNG, JPG, JPEG up to 5MB</p>
                                            </>
                                        )}
                                    </div>
                                    {!receiptFile && (
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            accept="image/*"
                                            onChange={e => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setReceiptFile(e.target.files[0]);
                                                    e.target.value = ''; // Reset input so same file can be selected again if removed
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Notes / Description <span className="font-normal text-slate-400">(Optional)</span></label>
                                <textarea
                                    value={formData.note}
                                    onChange={e => setFormData({ ...formData, note: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB] resize-none h-20"
                                    placeholder="e.g. Electricity bill for March 2026..."
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingExpenseId(null);
                                        setReceiptFile(null);
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2.5 bg-[#0047AB] text-white rounded-xl font-bold hover:bg-[#003380] transition-colors shadow-md flex justify-center items-center gap-2"
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : (editingExpenseId ? <Pencil size={16} /> : <Plus size={16} />)}
                                    {editingExpenseId ? 'Save Changes' : 'Save Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
