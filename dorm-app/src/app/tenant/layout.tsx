'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Wallet, Wrench, Gauge, Award, User, Building2, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function TenantLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [userName, setUserName] = useState('Tenant');
    const [profilePic, setProfilePic] = useState<string | null>(null);
    const [branchInfo, setBranchInfo] = useState<{ city: string; name: string } | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const fetchUserData = async () => {
            const storedName = localStorage.getItem('user_name');
            const storedUserId = localStorage.getItem('user_id');

            if (storedName) {
                setUserName(storedName);
            }

            if (storedUserId) {
                // Fetch Branch Info via Contract
                try {
                    const { data } = await supabase
                        .from('contract')
                        .select('room:room_id(building:building_id(branch:branch_id(branches_name, city)))')
                        .eq('user_id', storedUserId)
                        .in('status', ['Active', 'active', 'complete', 'incomplete'])
                        .order('id', { ascending: false }) // Get latest
                        .limit(1)
                        .single();

                    if (data?.room) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const roomFunc = data.room as any;
                        if (roomFunc.building?.branch) {
                            setBranchInfo({
                                city: roomFunc.building.branch.city,
                                name: roomFunc.building.branch.branches_name
                            });
                        }
                    }

                    // Fetch Profile Picture
                    const { data: userData } = await supabase
                        .from('users')
                        .select('profile_picture')
                        .eq('id', storedUserId)
                        .single();
                    
                    if (userData?.profile_picture) {
                        setProfilePic(userData.profile_picture);
                    }

                    // Fetch Unread Notifications
                    const { count } = await supabase
                        .from('notifications')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', storedUserId)
                        .eq('is_read', false);
                    
                    setUnreadCount(count || 0);

                } catch (err) {
                    console.error('Error fetching tenant data:', err);
                }
            }
        };

        fetchUserData();
    }, []);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const navItems = [
        { name: 'Dashboard', href: '/tenant/dashboard', icon: LayoutDashboard },
        { name: 'Notifications', href: '/tenant/notifications', icon: Bell, badge: unreadCount },
        { name: 'Payment', href: '/tenant/payment', icon: Wallet },
        { name: 'Maintenance', href: '/tenant/maintenance', icon: Wrench },
        { name: 'Meter', href: '/tenant/meter', icon: Gauge },
        { name: 'Point', href: '/tenant/point', icon: Award },
    ];

    const isActive = (path: string) => pathname === path;

    return (
        <div className="flex min-h-screen bg-white md:bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-[#0047AB] text-white flex flex-col fixed h-full z-10 transition-transform duration-300">
                {/* Logo Area */}
                <div className="p-8 flex flex-col items-center">
                    <div className="w-32 h-32 mb-2 relative flex items-center justify-center">
                        <img src="/dorm_logo-white.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    {branchInfo ? (
                        <div className="text-center mt-2">
                            <h1 className="text-lg font-bold uppercase tracking-wider">{branchInfo.city}</h1>
                            <p className="text-xs font-light text-blue-200">{branchInfo.name}</p>
                        </div>
                    ) : (
                        <div className="text-center mt-2">
                            <span className="text-xl font-bold tracking-widest">DORM</span>
                        </div>
                    )}
                </div>

                <div className="border-b border-white/20 mx-6 mb-6" />

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <Link key={item.name} href={item.href}>
                            <div
                                className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${isActive(item.href)
                                    ? 'bg-white/20 font-bold'
                                    : 'hover:bg-white/10 text-white/80'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <item.icon size={20} />
                                    <span>{item.name}</span>
                                </div>
                                {item.badge !== undefined && item.badge > 0 && (
                                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-lg animate-pulse">
                                        {item.badge}
                                    </span>
                                )}
                            </div>
                        </Link>
                    ))}
                </nav>

                {/* User Profile & Logout */}
                <div className="p-4 bg-[#003380]">
                    <div className="flex items-center gap-3 mb-4 px-2 hover:bg-white/10 p-2 rounded-lg cursor-pointer transition-colors" onClick={() => router.push('/tenant/profile')}>
                        {profilePic ? (
                            <img src={profilePic} alt="Profile" className="w-10 h-10 rounded-full object-cover border-2 border-white/20" />
                        ) : (
                            <div className="bg-white rounded-full p-2">
                                <User className="text-[#0047AB]" size={20} />
                            </div>
                        )}
                        <div className="overflow-hidden flex-1">
                            <p className="font-bold truncate text-sm">{userName}</p>
                            <p className="text-xs text-white/70">Tenant</p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full bg-[#FF4444] hover:bg-[#CC0000] text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                        <span>Logout</span>
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
