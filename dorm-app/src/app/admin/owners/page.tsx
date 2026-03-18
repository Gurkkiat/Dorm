'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Users, Building2, Phone, Mail, UserCheck } from 'lucide-react';
import { User, Branch } from '@/types/database';

export default function ManageOwnersPage() {
    const [owners, setOwners] = useState<(User & { branch?: Branch })[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [processing, setProcessing] = useState(false);

    const [formData, setFormData] = useState({
        full_name: '',
        username: '',
        password: '',
        phone: '',
        e_mail: '',
        branch_id: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch users with role owner
            const { data: ownersData, error: ownerError } = await supabase
                .from('users')
                .select('*, branch:branch_id (*)')
                .eq('role', 'owner')
                .order('id', { ascending: false });
            
            if (ownerError) throw ownerError;
            // @ts-ignore
            setOwners(ownersData || []);

            // Fetch branches for the dropdown
            const { data: branchData, error: branchError } = await supabase
                .from('branch')
                .select('*')
                .order('branches_name');
            
            if (branchError) throw branchError;
            setBranches(branchData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOwner = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.branch_id) {
            alert('Please select a branch to assign to this owner.');
            return;
        }

        setProcessing(true);
        try {
            const { error } = await supabase
                .from('users')
                .insert([{
                    full_name: formData.full_name,
                    username: formData.username,
                    password: formData.password, // Plain text as per existing logic
                    phone: formData.phone,
                    e_mail: formData.e_mail,
                    role: 'owner',
                    is_primary_tenant: false,
                    branch_id: Number(formData.branch_id),
                    // Default placeholders for required text columns
                    sex: 'Not Specified',
                    pet: 'None',
                    identification_number: '-',
                    identification_type: 'National ID',
                    nation: 'Thai'
                }]);
            
            if (error) throw error;
            
            alert('Owner account created successfully!');
            setShowModal(false);
            setFormData({
                full_name: '',
                username: '',
                password: '',
                phone: '',
                e_mail: '',
                branch_id: ''
            });
            fetchData();
        } catch (err: any) {
            console.error('Error creating owner:', err);
            alert('Error creating owner: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manage Owners</h1>
                    <p className="text-slate-500 text-sm mt-1">Create and assign dormitory owners</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <UserCheck size={18} />
                    Add Owner
                </button>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-auto flex-1">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading owners...</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                                <tr>
                                    <th className="py-4 px-6">Owner Name</th>
                                    <th className="py-4 px-6">Assigned Branch</th>
                                    <th className="py-4 px-6">Username</th>
                                    <th className="py-4 px-6">Contact Info</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-50">
                                {owners.map((owner) => (
                                    <tr key={owner.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-slate-100 p-2 rounded-lg text-slate-600 flex items-center justify-center">
                                                    <Users size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{owner.full_name}</p>
                                                    <p className="text-xs text-slate-500">ID: {owner.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {owner.branch ? (
                                                <div className="flex items-start gap-2 max-w-xs">
                                                    <Building2 size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-slate-700 font-bold">{owner.branch.branches_name}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{owner.branch.city}, {owner.branch.region}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">No branch assigned</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-mono font-bold">
                                                {owner.username}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <Phone size={12} className="text-slate-400" />
                                                    <span className="text-slate-600 text-xs">{owner.phone || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Mail size={12} className="text-slate-400" />
                                                    <span className="text-slate-600 text-xs">{owner.e_mail || '-'}</span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {owners.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-slate-400">
                                            No owner accounts found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add Owner Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <UserCheck size={20} className="text-slate-500" />
                                Create Owner Account
                            </h2>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <form id="owner-form" onSubmit={handleCreateOwner} className="space-y-5">
                                
                                <div className="bg-slate-100 text-slate-800 p-3 rounded-xl border border-slate-200 text-sm flex gap-2">
                                    <Building2 size={16} className="mt-0.5 shrink-0" />
                                    <div>
                                        <strong>Branch Assignment is crucial.</strong>
                                        <p className="opacity-80 mt-0.5">The owner will only have access to manage the branch they are assigned to here.</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Assign to Branch</label>
                                    <select 
                                        required 
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                        value={formData.branch_id}
                                        onChange={e => setFormData({...formData, branch_id: e.target.value})}
                                    >
                                        <option value="" disabled>Select a branch...</option>
                                        {branches.map(branch => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.branches_name} ({branch.city})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <hr className="border-slate-100" />

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                                    <input 
                                        type="text" required 
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
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
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                            value={formData.username}
                                            onChange={e => setFormData({...formData, username: e.target.value})}
                                            placeholder="somsak_owner"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                                        <input 
                                            type="password" required 
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
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
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                            value={formData.phone}
                                            onChange={e => setFormData({...formData, phone: e.target.value})}
                                            placeholder="08X-XXX-XXXX"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                                        <input 
                                            type="email" required 
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                            value={formData.e_mail}
                                            onChange={e => setFormData({...formData, e_mail: e.target.value})}
                                            placeholder="owner@example.com"
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
                                form="owner-form"
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors shadow-md flex justify-center items-center"
                            >
                                {processing ? 'Creating...' : 'Create Owner'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
