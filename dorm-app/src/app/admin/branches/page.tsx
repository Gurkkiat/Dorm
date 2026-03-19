'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Building2, MapPin, Phone, User } from 'lucide-react';
// Note: Phone and User icons are still used in the branch table rows
import { Branch } from '@/types/database';

export default function ManageBranchesPage() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [processing, setProcessing] = useState(false);

    const [formData, setFormData] = useState({
        branches_name: '',
        address: '',
        city: '',
        region: ''
    });

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('branch')
                .select('*')
                .order('id');
            if (error) throw error;
            setBranches(data || []);
        } catch (error) {
            console.error('Error fetching branches:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            const { error } = await supabase
                .from('branch')
                .insert([formData]);
            
            if (error) throw error;
            
            alert('Branch created successfully!');
            setShowModal(false);
            setFormData({
                branches_name: '',
                address: '',
                city: '',
                region: ''
            });
            fetchBranches();
        } catch (err: any) {
            console.error('Error creating branch:', err);
            alert('Error creating branch: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manage Branches</h1>
                    <p className="text-slate-500 text-sm mt-1">Add and track all dormitory branches</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    Add Branch
                </button>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-auto flex-1">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading branches...</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                                <tr>
                                    <th className="py-4 px-6">Branch Name</th>
                                    <th className="py-4 px-6">Manager</th>
                                    <th className="py-4 px-6">Location</th>
                                    <th className="py-4 px-6">Contact</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-50">
                                {branches.map((branch) => (
                                    <tr key={branch.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 p-2 rounded-lg text-blue-600 flex items-center justify-center">
                                                    <Building2 size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{branch.branches_name}</p>
                                                    <p className="text-xs text-slate-500">ID: {branch.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <User size={14} className="text-slate-400" />
                                                <span className="text-slate-700 font-medium">{branch.manager_name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-start gap-2 max-w-xs">
                                                <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-slate-700">{branch.address}</p>
                                                    <p className="text-xs font-bold text-slate-500 mt-0.5">{branch.city}, {branch.region}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <Phone size={14} className="text-slate-400" />
                                                <span className="text-slate-700">{branch.phone}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {branches.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-slate-400">
                                            No branches found in the system.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add Branch Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Building2 size={20} className="text-slate-500" />
                                Add New Branch
                            </h2>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <form id="branch-form" onSubmit={handleCreateBranch} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Branch Name</label>
                                    <input 
                                        type="text" required 
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                        value={formData.branches_name}
                                        onChange={e => setFormData({...formData, branches_name: e.target.value})}
                                        placeholder="e.g. Chiang Mai University Branch"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Address</label>
                                    <textarea 
                                        required rows={2}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                        value={formData.address}
                                        onChange={e => setFormData({...formData, address: e.target.value})}
                                        placeholder="Full address details"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">City / Province</label>
                                        <input 
                                            type="text" required 
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none"
                                            value={formData.city}
                                            onChange={e => setFormData({...formData, city: e.target.value})}
                                            placeholder="Chiang Mai"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Region</label>
                                        <select
                                            required
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                            value={formData.region}
                                            onChange={e => setFormData({...formData, region: e.target.value})}
                                        >
                                            <option value="">-- Select Region --</option>
                                            <option value="Northern">Northern</option>
                                            <option value="Northeastern">Northeastern</option>
                                            <option value="Central">Central</option>
                                            <option value="Eastern">Eastern</option>
                                            <option value="Western">Western</option>
                                            <option value="Southern">Southern</option>
                                        </select>
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
                                form="branch-form"
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors shadow-md"
                            >
                                {processing ? 'Creating...' : 'Create Branch'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
