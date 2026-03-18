'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Building2, Users, DollarSign, Activity, Globe, Shield } from 'lucide-react';
import InfrastructureHealth from './components/InfrastructureHealth';

export default function AdminDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalBranches: 0,
        totalOwners: 0,
        totalManagers: 0,
        systemRevenue: 0,
        totalRooms: 0
    });

    useEffect(() => {
        fetchAdminStats();
    }, []);

    const fetchAdminStats = async () => {
        setLoading(true);
        try {
            // 1. Total Branches
            const { count: branchCount } = await supabase
                .from('branch')
                .select('id', { count: 'exact', head: true });

            // 2. Users count by role
            const { data: userData } = await supabase
                .from('users')
                .select('role');
            
            const ownerCount = userData?.filter(u => u.role?.toLowerCase() === 'owner').length || 0;
            const managerCount = userData?.filter(u => u.role?.toLowerCase() === 'manager').length || 0;

            // 3. System Revenue (Total Billed - Pending Amount across all branches)
            const { data: invoices } = await supabase
                .from('invoice')
                .select('room_total_cost, status');
            
            const totalBilled = invoices?.reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0) || 0;
            const pendingAmount = invoices?.filter(inv => inv.status?.toLowerCase() !== 'paid').reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0) || 0;
            const systemRevenue = totalBilled - pendingAmount;

            // 4. Total Rooms
            const { count: roomCount } = await supabase
                .from('room')
                .select('id', { count: 'exact', head: true });

            setStats({
                totalBranches: branchCount || 0,
                totalOwners: ownerCount,
                totalManagers: managerCount,
                systemRevenue,
                totalRooms: roomCount || 0
            });

        } catch (error) {
            console.error('Error fetching admin stats:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 flex flex-col">
            {/* Hero Header */}
            <div className="shrink-0 bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10">
                    <h1 className="text-4xl font-black mb-2">System Administration</h1>
                    <p className="text-slate-400 max-w-lg">Global infrastructure overview and organizational health monitoring.</p>
                </div>
                
                <div className="flex gap-10 mt-12 relative z-10">
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Global Revenue</p>
                        <h2 className="text-3xl font-black text-white">฿{stats.systemRevenue.toLocaleString()}</h2>
                    </div>
                    <div className="w-px h-12 bg-slate-800"></div>
                    <div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Total Assets</p>
                        <h2 className="text-3xl font-black text-white">{stats.totalBranches} <span className="text-sm font-medium text-slate-500">Branches</span></h2>
                    </div>
                </div>
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-blue-500 transition-colors">
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Branches</p>
                        <h3 className="text-xl font-bold text-slate-800">{stats.totalBranches}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-slate-800 transition-colors">
                    <div className="bg-slate-100 text-slate-600 p-3 rounded-xl group-hover:bg-slate-800 group-hover:text-white transition-colors">
                        <Shield size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Owners</p>
                        <h3 className="text-xl font-bold text-slate-800">{stats.totalOwners}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-indigo-500 transition-colors">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Managers</p>
                        <h3 className="text-xl font-bold text-slate-800">{stats.totalManagers}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 group hover:border-emerald-500 transition-colors">
                    <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Total Rooms</p>
                        <h3 className="text-xl font-bold text-slate-800">{stats.totalRooms}</h3>
                    </div>
                </div>
            </div>

            {/* System Status Dynamic Health Check */}
            <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                <InfrastructureHealth />
            </div>
        </div>
    );
}
