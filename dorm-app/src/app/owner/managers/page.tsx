'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Users, ShieldCheck, Phone, Mail, UserPlus, Building2, Pencil, Trash2 } from 'lucide-react';
import { User, Branch } from '@/types/database';

export default function ManageManagersPage() {
    const [managers, setManagers] = useState<User[]>([]);
    const [branch, setBranch] = useState<Branch | null>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [editingManager, setEditingManager] = useState<User | null>(null);

    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        password: '',
        phone: '',
        e_mail: '',
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const role = localStorage.getItem('user_role')?.toLowerCase();
            const branchId = localStorage.getItem('user_branch_id');

            if (branchId) {
                const { data: branchData } = await supabase
                    .from('branch').select('*').eq('id', branchId).single();
                setBranch(branchData);
            }

            let query = supabase.from('users').select('*').eq('role', 'manager').order('id', { ascending: false });

            if (role === 'admin' && branchId) {
                query = query.eq('branch_id', branchId);
            } else if (role !== 'admin') {
                if (!branchId) throw new Error("No branch assigned.");
                query = query.eq('branch_id', branchId);
            }

            const { data: managersData, error: managerError } = await query;
            if (managerError) throw managerError;
            setManagers(managersData || []);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingManager(null);
        setFormData({
            full_name: '',
            username: '',
            password: '',
            phone: '',
            e_mail: '',
        });
        setShowModal(true);
    };

    const handleEditManager = (manager: User) => {
        setEditingManager(manager);
        setFormData({
            full_name: manager.full_name || '',
            username: manager.username || '',
            password: manager.password || '',
            phone: manager.phone || '',
            e_mail: manager.e_mail || '',
        });
        setShowModal(true);
    };

    const handleDeleteManager = async (manager: User) => {
        if (!confirm(`Are you sure you want to delete manager "${manager.full_name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', manager.id);
            
            if (error) throw error;
            
            alert('Manager deleted successfully.');
            fetchData();
        } catch (err: any) {
            console.error('Error deleting manager:', err);
            alert('Error deleting manager: ' + err.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const branchId = localStorage.getItem('user_branch_id');
        if (!branchId) {
            alert('Error: No branch assigned.');
            return;
        }

        setProcessing(true);
        try {
            if (editingManager) {
                // Update
                const { error } = await supabase
                    .from('users')
                    .update({
                        full_name: formData.full_name,
                        username: formData.username,
                        password: formData.password,
                        phone: formData.phone,
                        e_mail: formData.e_mail,
                    })
                    .eq('id', editingManager.id);
                
                if (error) throw error;
                alert('Manager updated successfully!');
            } else {
                // Create
                const { error } = await supabase
                    .from('users')
                    .insert([{
                        full_name: formData.full_name,
                        username: formData.username,
                        password: formData.password, 
                        phone: formData.phone,
                        e_mail: formData.e_mail,
                        role: 'manager',
                        is_primary_tenant: false,
                        branch_id: Number(branchId),
                        sex: 'Not Specified',
                        pet: 'None',
                        identification_number: '-',
                        identification_type: 'National ID',
                        nation: 'Thai'
                    }]);
                
                if (error) throw error;
                alert('Manager account created successfully!');
            }
            
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            console.error('Error saving manager:', err);
            alert('Error saving manager: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manage Managers</h1>
                    <p className="text-slate-500 text-sm mt-1">Personnel management for {branch?.branches_name || 'your branch'}</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <UserPlus size={18} />
                    Add Manager
                </button>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-auto flex-1">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading managers...</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                                <tr>
                                    <th className="py-4 px-6">Name</th>
                                    <th className="py-4 px-6">Username</th>
                                    <th className="py-4 px-6">Contact Info</th>
                                    <th className="py-4 px-6 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-50">
                                {managers.map((manager) => (
                                    <tr key={manager.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 flex items-center justify-center">
                                                    <Users size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{manager.full_name}</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs text-slate-500">ID: {manager.id}</p>
                                                        <div className="flex items-center gap-1 text-indigo-600 font-bold text-[10px] uppercase bg-indigo-50 px-2 py-0.5 rounded-full">
                                                            <ShieldCheck size={10} />
                                                            Mgr
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-mono font-bold">
                                                {manager.username}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Phone size={12} className="text-slate-400" />
                                                    <span className="text-slate-600 text-xs">{manager.phone || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Mail size={12} className="text-slate-400" />
                                                    <span className="text-slate-600 text-xs truncate max-w-[150px]">{manager.e_mail || '-'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => handleEditManager(manager)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Edit Manager"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteManager(manager)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Delete Manager"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {managers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-slate-400">
                                            No managers found for this branch.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Manager Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                {editingManager ? <Pencil size={20} className="text-indigo-600" /> : <UserPlus size={20} className="text-indigo-600" />}
                                {editingManager ? 'Update Manager' : 'Create Manager Account'}
                            </h2>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <form id="manager-form" onSubmit={handleSubmit} className="space-y-5">
                                
                                <div className="bg-indigo-50 text-indigo-800 p-3 rounded-xl border border-indigo-100 text-sm flex gap-2">
                                    <Building2 size={16} className="mt-0.5 shrink-0" />
                                    <div>
                                        <strong>Branch Assignment</strong>
                                        <p className="opacity-80 mt-0.5">This manager is assigned to: <strong>{branch?.branches_name}</strong></p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                                    <input 
                                        type="text" required 
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={formData.full_name}
                                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                                        placeholder="e.g. Somsak Rakthai"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                                        <input 
                                            type="text" required 
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={formData.username}
                                            onChange={e => setFormData({...formData, username: e.target.value})}
                                            placeholder="somsak_manager"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                                        <input 
                                            type="password" required 
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={formData.password}
                                            onChange={e => setFormData({...formData, password: e.target.value})}
                                            placeholder="********"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Phone</label>
                                        <input 
                                            type="tel" required 
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={formData.phone}
                                            onChange={e => setFormData({...formData, phone: e.target.value})}
                                            placeholder="08X-XXX-XXXX"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                        <input 
                                            type="email" required 
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={formData.e_mail}
                                            onChange={e => setFormData({...formData, e_mail: e.target.value})}
                                            placeholder="manager@example.com"
                                        />
                                    </div>
                                </div>

                            </form>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50">
                            <button
                                onClick={() => setShowModal(false)}
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="manager-form"
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md flex justify-center items-center"
                            >
                                {processing ? (editingManager ? 'Updating...' : 'Creating...') : (editingManager ? 'Update Manager' : 'Create Manager')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
