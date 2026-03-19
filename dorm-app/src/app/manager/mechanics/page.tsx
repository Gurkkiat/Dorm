'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Wrench, Trash2, Search, X, Loader2, UserCog } from 'lucide-react';
import { useManager } from '../ManagerContext';

interface UserData {
    id: number;
    username: string;
    full_name: string;
    role: string;
    branch_id: number | null;
    e_mail?: string;
    phone?: string;
}

export default function ManagerMechanicsPage() {
    const { selectedBranchId } = useManager();
    const [mechanics, setMechanics] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        phone: ''
    });

    useEffect(() => {
        if (selectedBranchId !== null) {
            fetchData();
        }
    }, [selectedBranchId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('users')
                .select('id, username, full_name, role, branch_id, e_mail, phone')
                .eq('role', 'mechanic')
                .order('id', { ascending: false });

            if (selectedBranchId !== 'All') {
                query = query.eq('branch_id', selectedBranchId);
            }

            const { data, error } = await query;
            if (error) throw error;

            setMechanics((data as unknown as UserData[]) || []);
        } catch (err) {
            console.error('Error fetching mechanics:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMechanic = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (selectedBranchId === 'All') {
            alert('Please select a specific branch from the sidebar to assign a mechanic to.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                username: formData.username,
                password: formData.password,
                full_name: formData.full_name,
                role: 'mechanic',
                branch_id: selectedBranchId ? Number(selectedBranchId) : null,
                phone: formData.phone || null,
                sex: 'Not Specified',
                pet: 'None',
                identification_number: '-',
                identification_type: 'National ID',
                nation: 'Thai',
                is_primary_tenant: false
            };

            const { error } = await supabase.from('users').insert([payload]);
            if (error) throw error;

            alert('Mechanic created successfully!');
            setShowModal(false);
            setFormData({ username: '', password: '', full_name: '', phone: '' });
            fetchData();
        } catch (err: any) {
            alert('Error creating mechanic: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteMechanic = async (user: UserData) => {
        if (!confirm(`Are you sure you want to delete mechanic "${user.full_name}" (@${user.username})? This cannot be undone.`)) return;
        try {
            const { error } = await supabase.from('users').delete().eq('id', user.id);
            if (error) {
                if (error.code === '23503') throw new Error('Mechanic has historical data tied to them (like maintenance jobs) and cannot be deleted natively.');
                throw error;
            }
            setMechanics(prev => prev.filter(u => u.id !== user.id));
        } catch (err: any) {
            alert(err.message || 'Failed to delete mechanic.');
        }
    };

    const filteredMechanics = mechanics.filter(m => {
        return m.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               m.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="h-full flex flex-col gap-6 p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Branch Mechanics</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage maintenance staff for this branch</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-[#0047AB] hover:bg-[#003380] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    Add Mechanic
                </button>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl border border-slate-200 flex items-center gap-3 px-4 py-2.5 shadow-sm shrink-0">
                <Search size={18} className="text-slate-400 shrink-0" />
                <input
                    type="text"
                    placeholder="Search mechanics by name or username..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent focus:outline-none text-slate-700 placeholder-slate-400 text-sm"
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Content List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100 sticky top-0">
                            <tr>
                                <th className="py-4 px-6">Mechanic Details</th>
                                <th className="py-4 px-6">Role</th>
                                <th className="py-4 px-6">Contact Info</th>
                                <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {loading ? (
                                <tr><td colSpan={4} className="py-12 text-center text-slate-400">
                                    <Loader2 size={28} className="animate-spin mx-auto mb-2 text-slate-300" />
                                    Loading mechanics...
                                </td></tr>
                            ) : filteredMechanics.length === 0 ? (
                                <tr><td colSpan={4} className="py-12 text-center text-slate-400">
                                    No mechanics found for this branch. Click "Add Mechanic" to assign one.
                                </td></tr>
                            ) : (
                                filteredMechanics.map(m => (
                                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors group">
                                        <td className="py-3.5 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-black text-sm shrink-0">
                                                    {m.full_name?.charAt(0)?.toUpperCase() || 'M'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{m.full_name}</p>
                                                    <p className="text-xs text-slate-400 font-mono">@{m.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-6">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-orange-100 text-orange-700 border-orange-200">
                                                <Wrench size={12} />
                                                Mechanic
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-6 text-slate-600 font-medium text-xs">
                                            {m.phone || m.e_mail ? (
                                                <div className="flex flex-col gap-0.5">
                                                    {m.phone && <span>{m.phone}</span>}
                                                    {m.e_mail && <span className="text-slate-400 font-normal">{m.e_mail}</span>}
                                                </div>
                                            ) : (
                                                <span className="italic text-slate-300">—</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-6 text-right">
                                            <button
                                                onClick={() => handleDeleteMechanic(m)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Delete Mechanic"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400 bg-slate-50/50">
                    Showing {filteredMechanics.length} mechanics
                </div>
            </div>

            {/* Add Mechanic Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-[#0047AB]">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <UserCog size={20} className="text-blue-200" />
                                Add New Mechanic
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-[#003380] rounded-lg transition-colors text-blue-200 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateMechanic} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                                <input
                                    type="text" required
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                    placeholder="e.g. Somsak Wrenchman"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                    placeholder="e.g. 0812345678"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                                    <input
                                        type="text" required
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                        placeholder="username"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                                    <input
                                        type="text" required
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                        placeholder="password"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2 bg-[#0047AB] text-white rounded-xl font-bold hover:bg-[#003380] transition-colors shadow-md flex justify-center items-center gap-2"
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Create Mechanic
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
