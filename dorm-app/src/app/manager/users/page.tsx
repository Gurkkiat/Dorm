'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, User, Building2, Wrench, Shield, Trash2, Search, X, Loader2 } from 'lucide-react';

interface UserData {
    id: number;
    username: string;
    full_name: string;
    role: string;
    branch_id: number | null;
    branch?: { branches_name: string };
    created_at?: string;
}

interface Branch {
    id: number;
    branches_name: string;
}

export default function UserManagementPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'Manager', // Default
        branch_id: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Users
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select(`
                    *,
                    branch:branch_id ( branches_name )
                `)
                .order('id', { ascending: false });

            if (userError) throw userError;
            setUsers(userData || []);

            // Fetch Branches
            const { data: branchData, error: branchError } = await supabase
                .from('branch')
                .select('id, branches_name')
                .order('id');

            if (branchError) throw branchError;
            setBranches(branchData || []);

        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Failed to load data.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Validation
            if (!formData.username || !formData.password || !formData.full_name) {
                alert('Please fill in all required fields.');
                return;
            }

            const payload = {
                username: formData.username,
                password: formData.password, // Storing plain text as per existing system (Not secure for production)
                full_name: formData.full_name,
                role: formData.role,
                branch_id: formData.role === 'Manager' && formData.branch_id ? Number(formData.branch_id) : null
            };

            const { error } = await supabase
                .from('users')
                .insert([payload]);

            if (error) throw error;

            alert('User created successfully!');
            setShowModal(false);
            setFormData({
                username: '',
                password: '',
                full_name: '',
                role: 'Manager',
                branch_id: ''
            });
            fetchData(); // Refresh list

        } catch (error: any) {
            console.error('Error creating user:', error);
            alert('Failed to create user: ' + (error.message || 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setUsers(users.filter(u => u.id !== id));
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user.');
        }
    };

    const getRoleIcon = (role: string) => {
        const r = role.toLowerCase();
        if (r === 'admin') return <Shield size={18} className="text-red-500" />;
        if (r === 'manager') return <Building2 size={18} className="text-blue-500" />;
        if (r === 'mechanic') return <Wrench size={18} className="text-orange-500" />;
        return <User size={18} className="text-gray-500" />;
    };

    const getRoleBadgeColor = (role: string) => {
        const r = role.toLowerCase();
        if (r === 'admin') return 'bg-red-100 text-red-700 border-red-200';
        if (r === 'manager') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (r === 'mechanic') return 'bg-orange-100 text-orange-700 border-orange-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
                    <p className="text-gray-500 mt-1">Manage system access for Managers and Mechanics.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-[#0047AB] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-[#00388A] transition-all hover:-translate-y-0.5"
                >
                    <Plus size={20} />
                    Add New User
                </button>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <Search size={20} className="text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by username or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
                />
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="py-4 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                                <th className="py-4 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="py-4 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Branch</th>
                                <th className="py-4 px-6 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-gray-400">
                                        <Loader2 size={32} className="animate-spin mx-auto mb-2" />
                                        Loading users...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-gray-400">
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-sm">
                                                    {user.full_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800">{user.full_name}</div>
                                                    <div className="text-xs text-gray-400">@{user.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getRoleBadgeColor(user.role)}`}>
                                                {getRoleIcon(user.role)}
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            {user.branch ? (
                                                <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                                                    <Building2 size={16} className="text-gray-400" />
                                                    {user.branch.branches_name}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Global / Not Assigned</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            {user.role.toLowerCase() !== 'admin' && ( // Prevent deleting other admins for safety
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Delete User"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create User Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
                        <div className="bg-[#0047AB] p-6 text-white flex justify-between items-center">
                            <h2 className="text-xl font-bold">Create New User</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                    placeholder="e.g. manager_bk1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                    placeholder="e.g. Somchai Jai-dee"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                                <input
                                    type="text" // Visible for admin creation convenience, or change to password
                                    required
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                    placeholder="Enter password"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                    >
                                        <option value="Manager">Manager</option>
                                        <option value="Mechanic">Mechanic</option>
                                    </select>
                                </div>

                                {formData.role === 'Manager' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Assign Branch</label>
                                        <select
                                            value={formData.branch_id}
                                            onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                        >
                                            <option value="">-- None --</option>
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.branches_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-[#0047AB] text-white py-3 rounded-xl font-bold shadow-lg hover:bg-[#00388A] disabled:opacity-70 transition-all flex items-center justify-center gap-2"
                                >
                                    {submitting ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
                                    Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
