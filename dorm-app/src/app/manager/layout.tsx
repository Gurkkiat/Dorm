
'use client';

import { Building2, LayoutGrid, DollarSign, Wrench, Gauge, Users, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ManagerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [username, setUsername] = useState('Manager');
    const [branchInfo, setBranchInfo] = useState<{ city: string; name: string } | null>(null);

    useEffect(() => {
        // In a real app, you might fetch this from a context or re-verify the session
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const storedName = localStorage.getItem('user_name');
        if (storedName) {
            setUsername(storedName);
            fetchBranchInfo(storedName);
        } else {
            // Fallback for dev/testing if no login
            const defaultUser = 'Somsak Rakthai'; // Manager of Branch 1
            setUsername(defaultUser);
            localStorage.setItem('user_name', defaultUser);
            fetchBranchInfo(defaultUser);
        }
    }, []);

    const fetchBranchInfo = async (name: string) => {
        try {
            const { data, error } = await supabase
                .from('branch')
                .select('branches_name, city')
                .eq('manager_name', name)
                .single();

            if (data) {
                setBranchInfo({ city: data.city, name: data.branches_name });
            }
        } catch (error) {
            console.error('Error fetching branch:', error);
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

    return (
        <div className="flex h-screen bg-gray-100 font-roboto">
            {/* Sidebar */}
            <aside className="w-64 bg-[#0047AB] text-white flex flex-col fixed inset-y-0 left-0 z-50 shadow-xl">
                <div className="p-6 flex flex-col items-center border-b border-blue-400/30">
                    <Building2 size={64} className="mb-2" />
                    {branchInfo ? (
                        <div className="text-center">
                            <h1 className="text-lg font-bold uppercase tracking-wider">{branchInfo.city}</h1>
                            <p className="text-sm font-light text-blue-200">{branchInfo.name}</p>
                        </div>
                    ) : (
                        <span className="text-xl font-bold tracking-widest">DORM</span>
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
                            <p className="text-xs text-blue-300">Manager</p>
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
