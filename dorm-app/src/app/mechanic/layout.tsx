'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Wrench, LogOut, Home, User } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function MechanicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [userName, setUserName] = useState('Mechanic');

    useEffect(() => {
        const name = localStorage.getItem('user_name');
        if (name) setUserName(name);

        // Simple role check
        const role = localStorage.getItem('user_role');
        if (role !== 'mechanic') {
            // router.push('/login'); // Uncomment to enforce protection
        }
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const isActive = (path: string) => pathname === path;

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-[#0047AB] text-white border-r border-white/10 fixed h-full z-10 hidden md:flex flex-col">
                <div className="p-8 flex flex-col items-center">
                    <div className="bg-white/10 p-3 rounded-xl mb-2">
                        <Wrench size={48} className="text-white" />
                    </div>
                    <div className="text-center mt-2">
                        <h1 className="text-lg font-bold uppercase tracking-wider">MECHANIC</h1>
                        <p className="text-xs font-light text-blue-200">PORTAL</p>
                    </div>
                </div>

                <div className="border-b border-white/20 mx-6 mb-6" />

                <nav className="flex-1 px-4 space-y-2">
                    <div className="px-4 py-2 mb-2 text-xs font-bold text-blue-200 uppercase tracking-wider">
                        Menu
                    </div>
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
                    <span className="font-bold text-white">Mechanic</span>
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
