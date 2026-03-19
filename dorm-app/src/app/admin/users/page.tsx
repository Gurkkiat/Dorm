'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, User, Building2, Wrench, Shield, Trash2, Search, X, Loader2, UserCog, UserPlus, Crown } from 'lucide-react';

interface UserData {
    id: number;
    username: string;
    full_name: string;
    role: string;
    branch_id: number | null;
    branch?: { branches_name: string };
    e_mail?: string;
    phone?: string;
    profile_picture?: string | null;
}

interface Branch {
    id: number;
    branches_name: string;
}

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
    admin:    { label: 'Admin',    icon: Shield,   badge: 'bg-red-100 text-red-700 border-red-200' },
    owner:    { label: 'Owner',    icon: Crown,    badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    manager:  { label: 'Manager', icon: Building2, badge: 'bg-blue-100 text-blue-700 border-blue-200' },
    mechanic: { label: 'Mechanic',icon: Wrench,   badge: 'bg-orange-100 text-orange-700 border-orange-200' },
    tenant:   { label: 'Tenant',  icon: User,     badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function getRoleConfig(role: string) {
    return ROLE_CONFIG[role?.toLowerCase()] || { label: role, icon: User, badge: 'bg-slate-100 text-slate-700 border-slate-200' };
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('All');
    const [tenantBranchMap, setTenantBranchMap] = useState<Record<number, string>>({});

    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        full_name: '',
        role: 'manager',
        branch_id: ''
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: userData } = await supabase
                .from('users')
                .select('id, username, full_name, role, branch_id, e_mail, phone, profile_picture, branch:branch_id(branches_name)')
                .order('id', { ascending: false });

            const { data: branchData } = await supabase
                .from('branch')
                .select('id, branches_name')
                .order('id');

            setUsers((userData as unknown as UserData[]) || []);
            setBranches(branchData || []);

            // For tenants without branch_id, look up branch via contract → room → building → branch
            const tenants = ((userData as unknown as UserData[]) || []).filter(u => u.role?.toLowerCase() === 'tenant' && !u.branch_id);
            if (tenants.length > 0) {
                const tenantIds = tenants.map(t => t.id);
                const { data: contracts } = await supabase
                    .from('contract')
                    .select('user_id, room:room_id(building:building_id(branch:branch_id(branches_name)))')
                    .in('user_id', tenantIds)
                    .in('status', ['active', 'Active', 'complete', 'Complete']);
                
                const map: Record<number, string> = {};
                (contracts || []).forEach((c: any) => {
                    const branchName = c.room?.building?.branch?.branches_name;
                    if (branchName && c.user_id) {
                        map[c.user_id] = branchName;
                    }
                });
                setTenantBranchMap(map);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                username: formData.username,
                password: formData.password,
                full_name: formData.full_name,
                role: formData.role,
                branch_id: formData.branch_id ? Number(formData.branch_id) : null,
                sex: 'Not Specified',
                pet: 'None',
                identification_number: '-',
                identification_type: 'National ID',
                nation: 'Thai',
                is_primary_tenant: false
            };

            const { error } = await supabase.from('users').insert([payload]);
            if (error) throw error;

            alert('User created successfully!');
            setShowModal(false);
            setFormData({ username: '', password: '', full_name: '', role: 'manager', branch_id: '' });
            fetchData();
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteUser = async (user: UserData) => {
        if (!confirm(`Delete user "${user.full_name}" (@${user.username}) AND ALL THEIR HISTORY? This cannot be undone.`)) return;
        
        try {
            // 1. Get their contracts
            const { data: contracts } = await supabase.from('contract').select('id').eq('user_id', user.id);
            const contractIds = contracts?.map(c => c.id) || [];
            
            if (contractIds.length > 0) {
                // 2. Get invoices to delete income records first (income references invoice)
                const { data: invoices } = await supabase.from('invoice').select('id').in('contract_id', contractIds);
                const invoiceIds = invoices?.map(i => i.id) || [];
                
                if (invoiceIds.length > 0) {
                    // Delete income records that reference these invoices
                    const { error: incErr } = await supabase.from('income').delete().in('invoice_id', invoiceIds);
                    if (incErr) console.warn('income delete:', incErr.message);
                }
                
                // 3. Delete invoices
                const { error: invErr } = await supabase.from('invoice').delete().in('contract_id', contractIds);
                if (invErr) throw new Error(`Failed to delete invoices: ${invErr.message}`);
                
                // 4. Delete meter readings
                const { error: mErr } = await supabase.from('meter_reading').delete().in('contract_id', contractIds);
                if (mErr) console.warn('meter_reading delete:', mErr.message);
                
                // 5. Delete log_monthly_room
                const { error: lErr } = await supabase.from('log_monthly_room').delete().in('contract_id', contractIds);
                if (lErr) console.warn('log_monthly_room delete:', lErr.message);
                
                // 6. Delete contracts
                const { error: cErr } = await supabase.from('contract').delete().in('id', contractIds);
                if (cErr) throw new Error(`Failed to delete contracts: ${cErr.message}`);
            }
            
            // 7. For mechanics, unlink them from maintenance requests
            if (user.role?.toLowerCase() === 'mechanic') {
                await supabase.from('maintenance_request').update({ technician_id: null }).eq('technician_id', user.id);
                await supabase.from('maintenance_timeline').update({ technician_id: null }).eq('technician_id', user.id);
            }
            
            // 8. Finally, delete the user
            const { error } = await supabase.from('users').delete().eq('id', user.id);
            if (error) throw new Error(`Failed to delete user: ${error.message}`);
            
            setUsers(prev => prev.filter(u => u.id !== user.id));
            alert('User and all associated history have been completely deleted.');
        } catch (err: any) {
            console.error('Delete error:', err);
            alert(`Failed to delete user: ${err.message || 'Unknown error. Check console for details.'}`);
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'All' || u.role?.toLowerCase() === filterRole.toLowerCase();
        return matchesSearch && matchesRole;
    });

    const roleCounts = Object.keys(ROLE_CONFIG).reduce((acc, role) => {
        acc[role] = users.filter(u => u.role?.toLowerCase() === role).length;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage all system users across every role</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <UserPlus size={18} />
                    Add User
                </button>
            </div>

            {/* Role Stat Chips */}
            <div className="flex flex-wrap gap-3">
                {(['All', ...Object.keys(ROLE_CONFIG)] as string[]).map(role => {
                    const count = role === 'All' ? users.length : (roleCounts[role] || 0);
                    const isActive = filterRole === role;
                    const cfg = role === 'All' ? null : getRoleConfig(role);
                    return (
                        <button
                            key={role}
                            onClick={() => setFilterRole(role)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                                isActive ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                            }`}
                        >
                            {cfg && <cfg.icon size={14} />}
                            {role === 'All' ? 'All' : (cfg?.label || role)}
                            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl border border-slate-200 flex items-center gap-3 px-4 py-2.5 shadow-sm">
                <Search size={18} className="text-slate-400 shrink-0" />
                <input
                    type="text"
                    placeholder="Search by name or username..."
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

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100 sticky top-0">
                            <tr>
                                <th className="py-4 px-6">User</th>
                                <th className="py-4 px-6">Role</th>
                                <th className="py-4 px-6">Branch</th>
                                <th className="py-4 px-6">Contact</th>
                                <th className="py-4 px-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {loading ? (
                                <tr><td colSpan={5} className="py-12 text-center text-slate-400">
                                    <Loader2 size={28} className="animate-spin mx-auto mb-2 text-slate-300" />
                                    Loading users...
                                </td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="py-12 text-center text-slate-400">No users found.</td></tr>
                            ) : (
                                filteredUsers.map(user => {
                                    const cfg = getRoleConfig(user.role);
                                    const RoleIcon = cfg.icon;
                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50/70 transition-colors group">
                                            <td className="py-3.5 px-6">
                                                <div className="flex items-center gap-3">
                                                    {user.profile_picture ? (
                                                        <img src={user.profile_picture} alt={user.full_name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                                                    ) : (
                                                        <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center font-black text-sm shrink-0">
                                                            {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-800">{user.full_name}</p>
                                                        <p className="text-xs text-slate-400 font-mono">@{user.username}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-6">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.badge}`}>
                                                    <RoleIcon size={12} />
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-6">
                                                {user.branch ? (
                                                    <span className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                                                        <Building2 size={13} className="text-slate-400" />
                                                        {(user.branch as any).branches_name}
                                                    </span>
                                                ) : tenantBranchMap[user.id] ? (
                                                    <span className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                                                        <Building2 size={13} className="text-slate-400" />
                                                        {tenantBranchMap[user.id]}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-300 italic">—</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-6 text-xs text-slate-400">
                                                {user.e_mail || user.phone || <span className="italic">—</span>}
                                            </td>
                                            <td className="py-3.5 px-6 text-right">
                                                {user.role?.toLowerCase() !== 'admin' && (
                                                    <button
                                                        onClick={() => handleDeleteUser(user)}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400 bg-slate-50/50">
                    Showing {filteredUsers.length} of {users.length} users
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-900">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <UserCog size={20} className="text-slate-400" />
                                Create System User
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                                <input
                                    type="text" required
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                    placeholder="e.g. Somchai Jaidee"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                                    <input
                                        type="text" required
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                        placeholder="username"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                                    <input
                                        type="text" required
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                        placeholder="password"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                    >
                                        <option value="owner">Owner</option>
                                        <option value="manager">Manager</option>
                                        <option value="mechanic">Mechanic</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Branch</label>
                                    <select
                                        value={formData.branch_id}
                                        onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
                                    >
                                        <option value="">— Global —</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.branches_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors shadow-md flex justify-center items-center gap-2"
                                >
                                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
