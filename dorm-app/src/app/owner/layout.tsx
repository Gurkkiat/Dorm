'use client';

import { Building, LayoutGrid, Users, User, LogOut, UserCog } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ProfileModal from '@/components/ProfileModal';
import { supabase } from '@/lib/supabaseClient';

export default function OwnerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [username, setUsername] = useState('Owner');
    const [userRole, setUserRole] = useState('owner');
    const [branchName, setBranchName] = useState('My Branch');
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [showProfile, setShowProfile] = useState(false);

    useEffect(() => {
        const storedName = localStorage.getItem('user_name');
        const storedRole = localStorage.getItem('user_role');

        if (storedRole) {
            setUserRole(storedRole);
            const lowerRole = storedRole.toLowerCase();
            if (lowerRole !== 'owner' && lowerRole !== 'admin') {
                router.push('/login');
            }
        } else {
            router.push('/login');
        }

        if (storedName) {
            setUsername(storedName);
        }

        // Load profile picture
        const uid = localStorage.getItem('user_id');
        if (uid) {
            supabase.from('users').select('profile_picture').eq('id', uid).single().then(({ data }) => {
                if (data?.profile_picture) setProfilePicture(data.profile_picture);
            });
        }

        // Load branch name
        const branchId = localStorage.getItem('user_branch_id');
        if (branchId) {
            supabase.from('branch').select('branches_name').eq('id', branchId).single().then(({ data }) => {
                if (data?.branches_name) setBranchName(data.branches_name);
            });
        } else if (storedRole?.toLowerCase() === 'admin') {
            setBranchName('All Branches');
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const navItems = [
        { name: 'Dashboard', href: '/owner/dashboard', icon: LayoutGrid },
        { name: 'Manage Buildings', href: '/owner/buildings', icon: Building },
        { name: 'Manage Managers', href: '/owner/managers', icon: Users },
    ];

    return (
        <div className="flex h-screen bg-gray-50 font-roboto">
            {/* Sidebar */}
            <aside className="w-64 bg-indigo-900 text-white flex flex-col fixed inset-y-0 left-0 z-50 shadow-xl">
                <div className="p-6 flex flex-col items-center border-b border-indigo-800">
                    <div className="w-32 h-32 mb-2 relative">
                        <img src="/dorm_logo-white.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>

                    <div className="mt-2 text-center">
                        <h1 className="text-lg font-bold uppercase tracking-wider text-indigo-200">Owner</h1>
                        <p className="text-sm text-indigo-300 mt-1">{branchName}</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center px-4 py-3 rounded-lg transition-colors duration-200 ${isActive
                                    ? 'bg-indigo-700 font-bold'
                                    : 'hover:bg-indigo-800 text-indigo-200'
                                    }`}
                            >
                                <item.icon size={20} className="mr-3" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile & Logout */}
                <div className="p-4 bg-indigo-950">
                    <button
                        onClick={() => setShowProfile(true)}
                        className="flex items-center mb-4 w-full hover:bg-indigo-800 rounded-xl p-2 transition-colors group"
                    >
                        <div className="bg-indigo-700 p-0.5 rounded-full text-white shrink-0 overflow-hidden w-9 h-9 flex items-center justify-center">
                            {profilePicture ? (
                                <img src={profilePicture} alt="Profile" className="w-full h-full object-cover rounded-full" />
                            ) : (
                                <User size={20} />
                            )}
                        </div>
                        <div className="ml-3 overflow-hidden text-left flex-1">
                            <p className="text-sm font-bold truncate">{username}</p>
                            <p className="text-xs text-indigo-300 uppercase">{userRole}</p>
                        </div>
                        <UserCog size={14} className="text-indigo-400 group-hover:text-indigo-200 shrink-0" />
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center bg-[#FF5A5F] hover:bg-[#ff4146] text-white py-2 rounded transition-colors duration-200 font-bold text-sm"
                    >
                        <LogOut size={16} className="mr-2" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8 overflow-y-auto">
                {children}
            </main>

            {/* Profile Modal */}
            {showProfile && (
                <ProfileModal
                    accentColor="indigo"
                    onClose={() => setShowProfile(false)}
                />
            )}
        </div>
    );
}
