'use client';

import { Building2, LayoutGrid, DollarSign, Wrench, Gauge, Users, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ManagerProvider, useManager } from './ManagerContext';

function ManagerLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const { selectedBranchId, setSelectedBranchId, setBranches, branches } = useManager();
    const pathname = usePathname();
    const router = useRouter();
    const [username, setUsername] = useState('Manager'); // [RESTORED]
    const [userRole, setUserRole] = useState('Manager'); // [NEW] - Default to Manager
    const [isManagerLocked, setIsManagerLocked] = useState(false);

    useEffect(() => {
        // In a real app, you might fetch this from a context or re-verify the session
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const storedName = localStorage.getItem('user_name');

        // [NEW] Check lock status on mount
        const storedRole = localStorage.getItem('user_role');
        const storedBranchId = localStorage.getItem('user_branch_id');

        if (storedRole) {
            setUserRole(storedRole);
        }

        if (storedRole && storedRole.toLowerCase() === 'manager' && storedBranchId) {
            setIsManagerLocked(true);
        }

        if (storedName) {
            setUsername(storedName);
            fetchBranches(storedName);
        } else {
            // Fallback for dev/testing if no login
            const defaultUser = 'Somsak Rakthai'; // Manager of Branch 1
            setUsername(defaultUser);
            localStorage.setItem('user_name', defaultUser);
            fetchBranches(defaultUser);
        }
    }, []);

    const fetchBranches = async (name: string) => {
        try {
            const { data, error } = await supabase
                .from('branch')
                .select('*')
                .order('id');

            if (error) throw error;

            if (data) {
                setBranches(data);

                // Check stored role and branch_id
                const storedRole = localStorage.getItem('user_role');
                const storedBranchId = localStorage.getItem('user_branch_id');

                if (storedRole && storedRole.toLowerCase() === 'manager' && storedBranchId) {
                    // Force selection to assigned branch
                    setSelectedBranchId(Number(storedBranchId));
                } else if (storedRole === 'Admin' || storedRole === 'admin') {
                    // Admin defaults to All
                    setSelectedBranchId('All');
                } else {
                    // No specific branch assigned (or fallback)
                    // Attempt to auto-select the manager's branch if name matches, else All
                    const userBranch = data.find(b => b.manager_name === name);
                    if (userBranch) {
                        setSelectedBranchId(userBranch.id);
                    } else {
                        setSelectedBranchId('All');
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const navItems = [
        { name: 'Dashboard', href: '/manager/dashboard', icon: LayoutGrid },
        { name: 'Payment', href: '/manager/payments', icon: DollarSign },
        { name: 'Maintenance', href: '/manager/maintenance', icon: Wrench },
        { name: 'Meter', href: '/manager/meter', icon: Gauge },
        { name: 'Manage Tenant', href: '/manager/tenants', icon: Users },
    ];

    if (userRole === 'admin' || userRole === 'Admin') {
        navItems.push({ name: 'Manage Users', href: '/manager/users', icon: User });
    }

    const currentBranch = branches.find(b => b.id === selectedBranchId);

    return (
        <div className="flex h-screen bg-gray-100 font-roboto">
            {/* Sidebar */}
            <aside className="w-64 bg-[#0047AB] text-white flex flex-col fixed inset-y-0 left-0 z-50 shadow-xl">
                <div className="p-6 flex flex-col items-center border-b border-blue-400/30">
                    <Building2 size={64} className="mb-2" />

                    {/* Branch Selector */}
                    <div className="w-full mt-4">
                        <label className="text-xs text-blue-200 uppercase font-bold tracking-wider mb-1 block text-center">Select Branch</label>
                        <select
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(e.target.value === 'All' ? 'All' : Number(e.target.value))}
                            disabled={isManagerLocked}
                            className={`w-full bg-[#003380] text-white text-sm rounded p-2 focus:outline-none border border-blue-500 text-center appearance-none transition-colors ${isManagerLocked
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer hover:bg-[#002a6b]'
                                }`}
                            style={{ textAlignLast: 'center' }}
                        >
                            <option value="All">All Branches</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.branches_name}</option>
                            ))}
                        </select>
                    </div>

                    {currentBranch && (
                        <div className="mt-2 text-center">
                            <h1 className="text-lg font-bold uppercase tracking-wider">{currentBranch.city}</h1>
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-200 ${isActive
                                    ? 'bg-blue-600 font-bold'
                                    : 'hover:bg-blue-700/50 text-blue-100'
                                    }`}
                            >
                                <item.icon size={20} className="mr-3" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile & Logout */}
                <div className="p-4 bg-[#003380]">
                    <div className="flex items-center mb-4">
                        <div className="bg-white p-1 rounded-full text-[#0047AB]">
                            <User size={24} />
                        </div>
                        <div className="ml-3 overflow-hidden">
                            <p className="text-sm font-bold truncate">{username}</p>
                            <p className="text-xs text-blue-300">{userRole}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center bg-[#FF5A5F] hover:bg-[#ff4146] text-white py-2 rounded transition-colors duration-200 font-bold"
                    >
                        <LogOut size={18} className="mr-2" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

export default function ManagerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ManagerProvider>
            <ManagerLayoutContent>{children}</ManagerLayoutContent>
        </ManagerProvider>
    );
}
