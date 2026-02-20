'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import {
    Zap, Droplets, Wallet, Wrench, Bell, ArrowUpRight,
    Calendar, User as UserIcon, AlertCircle, CheckCircle
} from 'lucide-react';
import { MaintenanceRequest, Invoice } from '@/types/database';
import Loading from '@/components/ui/loading';

export default function TenantDashboard() {
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [stats, setStats] = useState({
        totalPayment: 0,
        pendingInvoices: 0,
        lastPaymentDate: '-',
        elecUsage: 0,
        waterUsage: 0
    });
    const [maintenanceList, setMaintenanceList] = useState<MaintenanceRequest[]>([]);
    const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);

    // Helper for Dynamic Title
    const getInvoiceTitle = (invoice: Invoice) => {
        if (!invoice.bill_date) return `Invoice #${invoice.id}`;
        try {
            const date = new Date(invoice.bill_date);
            const monthYear = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

            if (invoice.type?.toLowerCase() === 'entry_fee') {
                return `Entry Fee (${monthYear})`;
            }
            return `Rent for ${monthYear}`;
        } catch (e) {
            return `Invoice #${invoice.id}`;
        }
    };

    useEffect(() => {
        async function fetchDashboardData() {
            setLoading(true);
            try {
                const storedUserId = localStorage.getItem('user_id');
                if (!storedUserId) return;

                // 1. Get User Details
                const { data: userData } = await supabase
                    .from('users')
                    .select('full_name')
                    .eq('id', storedUserId)
                    .single();

                if (userData) setUserName(userData.full_name);

                // 2. Get User's Active Contract
                const { data: contractData } = await supabase
                    .from('contract')
                    .select('id, room_id, status')
                    .eq('user_id', storedUserId)
                    .in('status', ['Active', 'active', 'complete', 'Complete', 'incomplete'])
                    .single();

                if (!contractData) {
                    setLoading(false);
                    return;
                }

                const contractId = contractData.id;
                const roomId = contractData.room_id;

                // 3. Fetch Invoices (Unpaid & Recent)
                const { data: invoices } = await supabase
                    .from('invoice')
                    .select('*')
                    .eq('contract_id', contractId)
                    .order('due_date', { ascending: false });

                if (invoices) {
                    const unpaid = invoices.filter(inv => inv.status.toLowerCase() === 'unpaid' || inv.status.toLowerCase() === 'pending');
                    const totalDue = unpaid.reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0);

                    const latestInvoice = invoices[0];
                    const lastPaid = invoices.find(inv => inv.status.toLowerCase() === 'paid');

                    // Estimate usage from latest invoice costs (Mock logic as before)
                    // Approx rates: Elec ~8, Water ~18
                    const eCost = latestInvoice?.room_elec_cost || 0;
                    const wCost = latestInvoice?.room_water_cost || 0;

                    setStats({
                        totalPayment: totalDue,
                        pendingInvoices: unpaid.length,
                        lastPaymentDate: lastPaid?.paid_date ? new Date(lastPaid.paid_date).toLocaleDateString('en-GB') : '-',
                        elecUsage: Math.floor(eCost / 8),
                        waterUsage: Math.floor(wCost / 18)
                    });

                    setRecentInvoices(invoices.slice(0, 3));
                }

                // 4. Fetch Active Maintenance Requests
                const { data: maintenances } = await supabase
                    .from('maintenance_request')
                    .select('*')
                    .eq('room_id', roomId)
                    // Exclude completed or canceled statuses
                    .not('status_technician', 'in', '("Completed","Done","completed","done","Cancelled","cancelled")')
                    .order('requested_at', { ascending: false })
                    .limit(5); // Fetch a few more to filter if needed

                if (maintenances) setMaintenanceList(maintenances);

            } catch (error) {
                console.error('Error loading dashboard:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchDashboardData();
    }, []);

    if (loading) return <Loading />;

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 font-sans min-h-screen pb-24">

            {/* 1. Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">
                        Welcome back, <span className="text-[#0047AB]">{userName.split(' ')[0]}</span> 👋
                    </h1>
                    <p className="text-gray-500 mt-1">Here's what's happening in your dorm today.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-2.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-[#0047AB] hover:border-[#0047AB] transition-all relative">
                        <Bell size={20} />
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                    </button>
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#0047AB] to-[#0066FF] flex items-center justify-center text-white font-bold shadow-md shadow-blue-200">
                        {userName.charAt(0)}
                    </div>
                </div>
            </div>

            {/* 2. Key Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {/* Total Due */}
                <div className="bg-gradient-to-br from-[#0047AB] to-[#0066FF] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                <Wallet size={24} className="text-white" />
                            </div>
                            <span className="bg-white/20 text-xs font-bold px-2 py-1 rounded-lg backdrop-blur-sm">
                                {stats.pendingInvoices} Pending
                            </span>
                        </div>
                        <p className="text-blue-100 text-sm font-medium mb-1">Total Payment Due</p>
                        <h2 className="text-3xl font-bold">{stats.totalPayment.toLocaleString()} <span className="text-lg font-normal opacity-80">THB</span></h2>
                    </div>
                </div>

                {/* Maintenance Status */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-orange-50 rounded-full blur-2xl group-hover:bg-orange-100 transition-colors duration-500" />
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
                                <Wrench size={24} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Active Requests</p>
                        <h2 className="text-3xl font-bold text-gray-800">{maintenanceList.length} <span className="text-lg font-normal text-gray-400">Issues</span></h2>
                    </div>
                </div>

                {/* Last Payment */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-green-50 rounded-full blur-2xl group-hover:bg-green-100 transition-colors duration-500" />
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-green-100 rounded-xl text-green-600">
                                <CheckCircle size={24} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Last Payment</p>
                        <h2 className="text-3xl font-bold text-gray-800">{stats.lastPaymentDate}</h2>
                    </div>
                </div>
            </div>

            {/* 3. Main Content Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column (2/3) - Usage & Actions */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Usage Stats */}
                    <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">Current Month Usage</h3>
                            <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded">Estimated</span>
                        </div>

                        <div className="space-y-6">
                            {/* Electricity */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <div className="flex items-center gap-2 font-bold text-gray-700">
                                        <div className="p-1.5 bg-yellow-100 rounded-lg">
                                            <Zap size={14} className="text-yellow-600 fill-yellow-600" />
                                        </div>
                                        Electricity
                                    </div>
                                    <span className="font-bold text-gray-900">{stats.elecUsage} <span className="text-gray-400 font-normal">/ 300 kWh</span></span>
                                </div>
                                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden relative">
                                    <div
                                        className="bg-yellow-400 h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                                        style={{ width: `${Math.min((stats.elecUsage / 300) * 100, 100)}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                                    </div>
                                </div>
                            </div>

                            {/* Water */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <div className="flex items-center gap-2 font-bold text-gray-700">
                                        <div className="p-1.5 bg-cyan-100 rounded-lg">
                                            <Droplets size={14} className="text-cyan-500 fill-cyan-500" />
                                        </div>
                                        Water
                                    </div>
                                    <span className="font-bold text-gray-900">{stats.waterUsage} <span className="text-gray-400 font-normal">/ 50 m³</span></span>
                                </div>
                                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden">
                                    <div
                                        className="bg-cyan-400 h-full rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${Math.min((stats.waterUsage / 50) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <Link href="/tenant/payment" className="bg-[#0047AB] text-white p-6 rounded-3xl shadow-lg flex flex-col items-center justify-center gap-3 hover:bg-[#00388A] transition-colors group">
                            <div className="p-3 bg-white/10 rounded-2xl group-hover:scale-110 transition-transform">
                                <Wallet size={28} />
                            </div>
                            <span className="font-bold">Pay Bills</span>
                        </Link>
                        <Link href="/tenant/maintenance" className="bg-white text-[#0047AB] border border-blue-100 p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-3 hover:shadow-md transition-all group">
                            <div className="p-3 bg-blue-50 rounded-2xl group-hover:scale-110 transition-transform">
                                <Wrench size={28} />
                            </div>
                            <span className="font-bold">Report Issue</span>
                        </Link>
                    </div>

                </div>

                {/* Right Column (1/3) - Recent Activity */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm h-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800">Recent Activity</h3>
                            <Link href="/tenant/payment" className="text-xs font-bold text-[#0047AB] hover:underline flex items-center">
                                View All <ArrowUpRight size={14} className="ml-0.5" />
                            </Link>
                        </div>

                        <div className="space-y-4">
                            {recentInvoices.length > 0 ? (
                                recentInvoices.map((inv) => (
                                    <div key={inv.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl ${inv.status.toLowerCase() === 'paid' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                                }`}>
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800 group-hover:text-[#0047AB] transition-colors">{getInvoiceTitle(inv)}</p>
                                                <p className="text-xs text-gray-400 font-mono">INV-{inv.id.toString().padStart(6, '0')}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${inv.status.toLowerCase() === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {inv.status.charAt(0).toUpperCase() + inv.status.slice(1).toLowerCase()}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-400 text-sm">No recent activity</div>
                            )}

                            {maintenanceList.map((m) => (
                                <div key={m.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
                                            <Wrench size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800 group-hover:text-[#0047AB] transition-colors truncate max-w-[120px]">{m.issue_description}</p>
                                            <p className="text-xs text-gray-400">{new Date(m.requested_at).toLocaleDateString('en-GB')}</p>
                                        </div>
                                    </div>
                                    <div className="h-2 w-2 rounded-full bg-orange-400" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FileText({ size = 24, className = "" }: { size?: number, className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" x2="8" y1="13" y2="13" />
            <line x1="16" x2="8" y1="17" y2="17" />
            <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
    );
}
