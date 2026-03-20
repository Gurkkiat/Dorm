'use client';

import { Building2, LayoutGrid, Users, User, LogOut, UserCog, DollarSign, Wrench, Gauge, Building, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ProfileModal from '@/components/ProfileModal';
import { supabase } from '@/lib/supabaseClient';

interface Branch {
    id: number;
    branches_name: string;
    city: string;
}

const NAV_SECTIONS = [
    {
        label: 'Admin',
        color: 'text-slate-400',
        items: [
            { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutGrid },
            { name: 'Manage Branches', href: '/admin/branches', icon: Building2 },
            { name: 'Manage Owners', href: '/admin/owners', icon: Users },
            { name: 'All Users', href: '/admin/users', icon: UserCog },
        ],
    },
    {
        label: 'Owner Tools',
        color: 'text-indigo-400',
        items: [
            { name: 'Dashboard', href: '/admin/owner/dashboard', icon: LayoutGrid },
            { name: 'Buildings & Rooms', href: '/admin/owner/buildings', icon: Building },
            { name: 'Manage Managers', href: '/admin/owner/managers', icon: Users },
        ],
    },
    {
        label: 'Manager Tools',
        color: 'text-blue-400',
        items: [
            { name: 'Dashboard', href: '/admin/manager/dashboard', icon: LayoutGrid },
            { name: 'Payments', href: '/admin/manager/payments', icon: DollarSign },
            { name: 'Maintenance', href: '/admin/manager/maintenance', icon: Wrench },
            { name: 'Meter Reading', href: '/admin/manager/meter', icon: Gauge },
            { name: 'Tenants', href: '/admin/manager/tenants', icon: Users },
        ],
    },
];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [username, setUsername] = useState('Admin');
    const [userRole, setUserRole] = useState('admin');
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [showProfile, setShowProfile] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const storedName = localStorage.getItem('user_name');
        const storedRole = localStorage.getItem('user_role');

        if (storedRole) {
            setUserRole(storedRole);
            if (storedRole.toLowerCase() !== 'admin') {
                router.push('/login');
            }
        } else {
            router.push('/login');
        }

        if (storedName) setUsername(storedName);

        // Load profile picture
        const uid = localStorage.getItem('user_id');
        if (uid) {
            supabase.from('users').select('profile_picture').eq('id', uid).single().then(({ data }) => {
                if (data?.profile_picture) setProfilePicture(data.profile_picture);
            });
        }

        // Fetch branches for selector
        supabase.from('branch').select('id, branches_name, city').order('branches_name').then(({ data }) => {
            setBranches(data || []);
        });
    }, [router]);

    // Persist selected branch to localStorage immediately when it changes
    // Child components rely on this being up-to-date before they remount via the 'key' prop on main
    const updateBranchScope = (val: string) => {
        setSelectedBranchId(val);
        if (val === 'all') {
            localStorage.removeItem('admin_branch_filter');
            localStorage.removeItem('user_branch_id');
        } else {
            localStorage.setItem('admin_branch_filter', val);
            localStorage.setItem('user_branch_id', val);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        router.push('/login');
    };

    const toggleSection = (label: string) => {
        setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
    };

    return (
        <div className="flex h-screen bg-gray-100 font-roboto">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col fixed inset-y-0 left-0 z-50 shadow-xl">
                {/* Logo */}
                <div className="p-5 flex flex-col items-center border-b border-slate-700/60">
                    <div className="w-20 h-20 mb-2">
                        <img src="/dorm_logo-white.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-sm font-bold uppercase tracking-widest text-slate-300">Admin</h1>
                </div>

                {/* Branch Selector */}
                <div className="px-5 py-5 border-b border-slate-700/60 bg-slate-900/40 relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        Branch Scope
                    </p>
                    <div className="relative group">
                        <select
                            value={selectedBranchId}
                            onChange={e => updateBranchScope(e.target.value)}
                            className="w-full appearance-none bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 hover:border-blue-500/50 text-[13px] font-bold text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all cursor-pointer shadow-inner pr-10"
                        >
                            <option value="all">All Branches Overview</option>
                            {branches.map(b => (
                                <option key={b.id} value={String(b.id)} className="bg-slate-800 text-white p-2">
                                    {b.branches_name} {b.city ? `(${b.city})` : ''}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 group-hover:text-blue-400 transition-colors">
                            <ChevronDown size={14} strokeWidth={3} />
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {NAV_SECTIONS.map(section => {
                        const isCollapsed = collapsedSections[section.label];
                        return (
                            <div key={section.label} className="mb-2">
                                <button
                                    onClick={() => toggleSection(section.label)}
                                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-slate-800/50 transition-colors"
                                >
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${section.color}`}>
                                        {section.label}
                                    </span>
                                    {isCollapsed
                                        ? <ChevronRight size={12} className="text-slate-600" />
                                        : <ChevronDown size={12} className="text-slate-600" />
                                    }
                                </button>

                                {!isCollapsed && section.items.map((item) => {
                                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex items-center px-3 py-2.5 rounded-lg transition-colors text-sm ${isActive
                                                ? 'bg-slate-700 text-white font-bold'
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                                }`}
                                        >
                                            <item.icon size={17} className="mr-3 shrink-0" />
                                            <span>{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        );
                    })}
                </nav>

                {/* User Profile & Logout */}
                <div className="p-4 bg-slate-950">
                    <button
                        onClick={() => setShowProfile(true)}
                        className="flex items-center mb-4 w-full hover:bg-slate-800 rounded-xl p-2 transition-colors group"
                    >
                        <div className="bg-slate-700 p-0.5 rounded-full text-white shrink-0 overflow-hidden w-9 h-9 flex items-center justify-center">
                            {profilePicture ? (
                                <img src={profilePicture} alt="Profile" className="w-full h-full object-cover rounded-full" />
                            ) : (
                                <User size={20} />
                            )}
                        </div>
                        <div className="ml-3 overflow-hidden text-left flex-1">
                            <p className="text-sm font-bold truncate">{username}</p>
                            <p className="text-xs text-slate-400 uppercase">{userRole}</p>
                        </div>
                        <UserCog size={14} className="text-slate-500 group-hover:text-slate-300 shrink-0" />
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
            <main key={selectedBranchId} className="flex-1 ml-64 p-8 overflow-y-auto">
                {children}
            </main>

            {/* Profile Modal */}
            {showProfile && (
                <ProfileModal
                    accentColor="slate"
                    onClose={() => setShowProfile(false)}
                />
            )}
        </div>
    );
}
