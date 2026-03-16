'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Wrench, LogOut, Home, User, Building } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function MechanicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [userName, setUserName] = useState('Mechanic');
    const [branchName, setBranchName] = useState('Unassigned Branch');

    useEffect(() => {
        const name = localStorage.getItem('user_name');
        if (name) setUserName(name);

        // Simple role check
        const role = localStorage.getItem('user_role');
        const userId = localStorage.getItem('user_id');

        if (role !== 'mechanic') {
            // router.push('/login'); // Uncomment to enforce protection
        }

        if (userId) {
            fetchUserBranch(parseInt(userId));
        }
    }, []);

    const fetchUserBranch = async (userId: number) => {
        const { data } = await supabase
            .from('users')
            .select('branch:branch_id(branches_name)')
            .eq('id', userId)
            .single();

        if (data && data.branch) {
            // @ts-ignore - Supabase join signature can be tricky
            setBranchName(data.branch.branches_name);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const isActive = (path: string) => pathname === path;

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-[#0047AB] text-white border-r border-white/10 fixed h-full z-10 hidden md:flex flex-col">
                {/* Logo Area */}
                <div className="p-8 flex flex-col items-center">
                    <div className="w-32 h-32 mb-2 relative flex items-center justify-center">
                        <img src="/dorm_logo-white.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center mt-2">
                        <h1 className="text-lg font-bold uppercase tracking-wider">MECHANIC</h1>
                        <div className="flex items-center justify-center gap-1 mt-1 text-blue-200 bg-black/10 px-2 py-0.5 rounded-full w-fit mx-auto">
                            <Building size={10} />
                            <span className="text-[10px] font-medium tracking-wide">{branchName}</span>
                        </div>
                    </div>
                </div>

                <div className="border-b border-white/20 mx-6 mb-6" />

                <nav className="flex-1 px-4 space-y-2">
                    <Link
                        href="/mechanic/maintenance"
                        className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors group ${isActive('/mechanic/maintenance')
                                ? 'bg-white/20 font-bold text-white'
                                : 'hover:bg-white/10 text-white/80'
                            }`}
                    >
                        <Wrench size={20} className={isActive('/mechanic/maintenance') ? 'text-white' : 'text-white/80'} />
                        <span>Maintenance Jobs</span>
                    </Link>
                </nav>

                <div className="p-4 bg-[#003380]">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="bg-white rounded-full p-2">
                            <User className="text-[#0047AB]" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate text-white">{userName}</p>
                            <p className="text-xs text-white/70">Technician</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full bg-[#FF4444] hover:bg-[#CC0000] text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                        <LogOut size={16} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 w-full bg-[#0047AB] text-white z-20 px-4 py-3 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                        <Wrench className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-white text-sm leading-tight">Mechanic</span>
                        <span className="text-[10px] text-white/70">{branchName}</span>
                    </div>
                </div>
                <button onClick={handleLogout} className="p-2 text-white/80 hover:text-white">
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 mt-14 md:mt-0">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
