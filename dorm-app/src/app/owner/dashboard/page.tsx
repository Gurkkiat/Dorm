'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { TrendingUp, Users, Home, Wrench, DollarSign, Calendar, Filter } from 'lucide-react';

export default function OwnerDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalBilled: 0,
        pendingAmount: 0,
        occupancyRate: 0,
        activeTenants: 0,
        pendingMaintenance: 0,
        totalRooms: 0,
        monthlyRevenue: [] as { month: string, amount: number }[]
    });
    const [selectedBuilding, setSelectedBuilding] = useState('All');
    const [selectedMonth, setSelectedMonth] = useState('All');
    const [selectedYear, setSelectedYear] = useState('All');
    const [buildingsList, setBuildingsList] = useState<{id: number, name_building: string}[]>([]);

    useEffect(() => {
        fetchDashboardData();
    }, [selectedBuilding, selectedMonth, selectedYear]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const role = localStorage.getItem('user_role')?.toLowerCase();
            const branchId = localStorage.getItem('user_branch_id');
            
            if (role !== 'admin' && !branchId) throw new Error("No branch assigned.");

            // 0. Fetch Buildings for Dropdown
            let buildingQ = supabase.from('building').select('id, name_building');
            if (branchId) buildingQ = buildingQ.eq('branch_id', branchId);
            const { data: bldgs } = await buildingQ;
            if (bldgs) setBuildingsList(bldgs);

            // 1. Fetch Occupancy & Room Stats
            let roomQuery = supabase
                .from('room')
                .select('id, building!inner(branch_id)');
            if (branchId) roomQuery = roomQuery.eq('building.branch_id', branchId);
            if (selectedBuilding !== 'All') roomQuery = roomQuery.eq('building.id', Number(selectedBuilding));
            const { data: rooms } = await roomQuery;
            const totalRooms = rooms?.length || 0;

            // 2. Fetch Active Tenants (Filter by Date overlap)
            let tenantQuery = supabase
                .from('contract')
                .select('id, status, move_in, move_out, room!inner(building!inner(branch_id, id))');
            if (branchId) tenantQuery = tenantQuery.eq('room.building.branch_id', branchId);
            if (selectedBuilding !== 'All') tenantQuery = tenantQuery.eq('room.building.id', Number(selectedBuilding));
            const { data: tenantData } = await tenantQuery;

            let tenantCount = 0;
            const contracts = tenantData || [];
            if (selectedYear === 'All' && selectedMonth === 'All') {
                tenantCount = contracts.filter(c => ['Active', 'active', 'complete'].includes(c.status)).length;
            } else {
                const y = selectedYear !== 'All' ? selectedYear : new Date().getFullYear().toString();
                const mPadded = selectedMonth !== 'All' ? '-' + selectedMonth.padStart(2, '0') + '-' : '';
                
                tenantCount = contracts.filter(c => {
                    const isActiveNow = ['Active', 'active', 'complete'].includes(c.status);
                    if (isActiveNow) {
                        if (!c.move_in) return true;
                        const periodEnd = mPadded ? `${y}${mPadded}31` : `${y}-12-31`;
                        return c.move_in <= periodEnd;
                    } else {
                        if (!c.move_in || !c.move_out) return false;
                        const periodStart = mPadded ? `${y}${mPadded}01` : `${y}-01-01`;
                        const periodEnd = mPadded ? `${y}${mPadded}31` : `${y}-12-31`;
                        return c.move_in <= periodEnd && c.move_out >= periodStart;
                    }
                }).length;
            }
            const occupancyRate = totalRooms > 0 ? Math.round((tenantCount / totalRooms) * 100) : 0;

            // 3. Fetch Pending Maintenance (Filter by Date)
            let maintQuery = supabase
                .from('maintenance_request')
                .select('id, requested_at, status_technician, room!inner(building!inner(branch_id, id))');
            if (branchId) maintQuery = maintQuery.eq('room.building.branch_id', branchId);
            if (selectedBuilding !== 'All') maintQuery = maintQuery.eq('room.building.id', Number(selectedBuilding));
            const { data: maintData } = await maintQuery;

            let filteredMaint = maintData || [];
            if (selectedYear !== 'All') {
                filteredMaint = filteredMaint.filter(req => req.requested_at && req.requested_at.startsWith(selectedYear));
            }
            if (selectedMonth !== 'All') {
                const monthPadded = '-' + selectedMonth.padStart(2, '0') + '-'; // Match '-03-' format
                filteredMaint = filteredMaint.filter(req => req.requested_at && req.requested_at.includes(monthPadded));
            }
            const maintCount = filteredMaint.filter(req => req.status_technician === 'Pending').length;

            // 4. Fetch Revenue Data
            let invoiceQuery = supabase
                .from('invoice')
                .select('room_total_cost, bill_date, status, contract!inner(room!inner(building!inner(branch_id, id)))');
            if (branchId) invoiceQuery = invoiceQuery.eq('contract.room.building.branch_id', branchId);
            if (selectedBuilding !== 'All') invoiceQuery = invoiceQuery.eq('contract.room.building.id', Number(selectedBuilding));
            const { data: invoices } = await invoiceQuery;

            // Apply Date Filters ONLY to Total Revenue (Charts remain last 6 months)
            let filteredInvoices = invoices || [];
            if (selectedYear !== 'All') {
                filteredInvoices = filteredInvoices.filter(inv => inv.bill_date && inv.bill_date.startsWith(selectedYear));
            }
            if (selectedMonth !== 'All') {
                const monthPadded = '-' + selectedMonth.padStart(2, '0') + '-'; // Match '-03-' format
                filteredInvoices = filteredInvoices.filter(inv => inv.bill_date && inv.bill_date.includes(monthPadded));
            }

            const totalBilled = filteredInvoices.reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0) || 0;
            const pendingAmount = filteredInvoices.filter(inv => inv.status?.toLowerCase() !== 'paid').reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0) || 0;
            const totalRevenue = totalBilled - pendingAmount;

            // Group revenue by month based on Year Filter for Chart
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const revenueByMonthMap: Record<string, number> = {};
            
            const chartInvoices = selectedYear !== 'All' ? (invoices || []).filter(inv => inv.bill_date && inv.bill_date.startsWith(selectedYear)) : (invoices || []);
            
            chartInvoices.forEach(inv => {
                if (inv.status?.toLowerCase() === 'paid') {
                    const date = new Date(inv.bill_date);
                    const monthName = months[date.getMonth()];
                    revenueByMonthMap[monthName] = (revenueByMonthMap[monthName] || 0) + inv.room_total_cost;
                }
            });

            // Generate Chart Data
            const chartData = [];
            if (selectedYear !== 'All') {
                // Show all 12 months for the selected year
                for (let i = 0; i < 12; i++) {
                    const mName = months[i];
                    chartData.push({
                        month: mName,
                        amount: revenueByMonthMap[mName] || 0
                    });
                }
            } else {
                // Show last 6 months
                for (let i = 5; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    const mName = months[d.getMonth()];
                    chartData.push({
                        month: mName,
                        amount: revenueByMonthMap[mName] || 0
                    });
                }
            }

            setStats({
                totalRevenue,
                totalBilled,
                pendingAmount,
                occupancyRate,
                activeTenants: tenantCount,
                pendingMaintenance: maintCount,
                totalRooms,
                monthlyRevenue: chartData
            });

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading Dashboard Statistics...</div>;

    const maxMonthlyRevenue = Math.max(...stats.monthlyRevenue.map(m => m.amount), 1000);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Branch Performance Overview</h1>
                <p className="text-slate-500 mt-1">Real-time data and growth analysis</p>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-slate-500 font-bold mr-2">
                    <Filter size={18} />
                    <span>Filters:</span>
                </div>
                
                <select 
                    value={selectedBuilding} 
                    onChange={e => setSelectedBuilding(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="All">All Buildings</option>
                    {buildingsList.map(b => (
                        <option key={b.id} value={b.id.toString()}>{b.name_building}</option>
                    ))}
                </select>

                <select 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="All">All Months (Revenue)</option>
                    <option value="1">January</option>
                    <option value="2">February</option>
                    <option value="3">March</option>
                    <option value="4">April</option>
                    <option value="5">May</option>
                    <option value="6">June</option>
                    <option value="7">July</option>
                    <option value="8">August</option>
                    <option value="9">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                </select>

                <select 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="All">All Years (Revenue)</option>
                    <option value="2023">2023</option>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                </select>
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</p>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">฿{stats.totalRevenue.toLocaleString()}</h3>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-slate-50 pt-3">
                        <div className="flex flex-col">
                            <span className="text-slate-400">Total Billed</span>
                            <span className="font-bold text-slate-600">฿{stats.totalBilled.toLocaleString()}</span>
                        </div>
                        <span className="text-slate-300">-</span>
                        <div className="flex flex-col text-right">
                            <span className="text-slate-400">Pending Amount</span>
                            <span className="font-bold text-amber-500">฿{stats.pendingAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                        <Home size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Occupancy Rate</p>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stats.occupancyRate}%</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Tenants</p>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stats.activeTenants}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                        <Wrench size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Repairs</p>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stats.pendingMaintenance}</h3>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Revenue Bar Chart (Custom CSS) */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex justify-between items-center mb-10">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp size={20} className="text-indigo-600" />
                            Revenue Trends
                        </h2>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">
                            {selectedYear !== 'All' ? `Year: ${selectedYear}` : 'Last 6 Months'}
                        </span>
                    </div>
                    
                    <div className="flex-1 flex items-end justify-between gap-4 h-64 px-4 pb-8 border-b border-slate-100">
                        {stats.monthlyRevenue.map((data, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                {/* Tooltip */}
                                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-900 text-white text-[10px] py-1 px-2 rounded font-bold pointer-events-none whitespace-nowrap z-10">
                                    ฿{data.amount.toLocaleString()}
                                </div>
                                
                                <div 
                                    style={{ height: `${(data.amount / maxMonthlyRevenue) * 100}%` }}
                                    className="w-full max-w-[40px] bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 group-hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] group-hover:scale-x-105 origin-bottom"
                                ></div>
                                <span className="absolute -bottom-8 text-xs font-bold text-slate-500">{data.month}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-12 flex justify-between text-xs text-slate-400 font-medium italic">
                        <p>Showing growth based on paid invoices per month.</p>
                        <p>Max: ฿{maxMonthlyRevenue.toLocaleString()}</p>
                    </div>
                </div>

                {/* Occupancy Ring (Custom SVG) */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center">
                    <div className="w-full flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Calendar size={20} className="text-blue-600" />
                            Occupancy Analysis
                        </h2>
                    </div>

                    <div className="flex flex-col items-center justify-center flex-1 relative">
                        {/* Ring Chart CSS/SVG */}
                        <div className="relative w-56 h-56 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90">
                                <circle 
                                    cx="112" cy="112" r="90" 
                                    fill="none" stroke="#f1f5f9" strokeWidth="24"
                                />
                                <circle 
                                    cx="112" cy="112" r="90" 
                                    fill="none" stroke="#3b82f6" strokeWidth="24"
                                    strokeDasharray={2 * Math.PI * 90}
                                    strokeDashoffset={(2 * Math.PI * 90) * (1 - stats.occupancyRate / 100)}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-black text-slate-800">{stats.occupancyRate}%</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Occupied</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="grid grid-cols-2 gap-8 mt-10 w-full px-6">
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                    <span className="text-sm font-bold text-slate-700">{stats.activeTenants}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Tenant Active</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                                    <span className="text-sm font-bold text-slate-700">{stats.totalRooms - stats.activeTenants}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Available Rooms</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Row (Optional Placeholder) */}
            <div className="bg-indigo-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="max-w-xl">
                        <h2 className="text-3xl font-black mb-4">Branch Performance Insights</h2>
                        <p className="text-indigo-200 leading-relaxed">
                            Your current occupancy is at <span className="text-white font-bold">{stats.occupancyRate}%</span>. 
                            To maximize revenue, consider targeting the remaining <span className="text-white font-bold">{stats.totalRooms - stats.activeTenants}</span> available rooms. 
                            Monthly revenue is showing a <span className="text-emerald-400 font-bold">positive trend</span> based on historical data.
                        </p>
                    </div>
                    <button onClick={() => fetchDashboardData()} className="bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black hover:bg-indigo-50 transition-all shadow-xl hover:-translate-y-1 active:translate-y-0">
                        Refresh Report
                    </button>
                </div>
            </div>
        </div>
    );
}
