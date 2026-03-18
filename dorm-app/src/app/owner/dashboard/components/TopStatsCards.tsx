import { DollarSign, Home, Users, Wrench } from 'lucide-react';

interface StatsProps {
    totalRevenue: number;
    totalBilled: number;
    pendingAmount: number;
    occupancyRate: number;
    activeTenants: number;
    pendingMaintenance: number;
}

export default function TopStatsCards({ stats }: { stats: StatsProps }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Total Revenue - Large Hero Card */}
            <div className="lg:col-span-2 bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-8 rounded-3xl shadow-lg border border-indigo-500/30 flex flex-col justify-between text-white relative overflow-hidden group">
                {/* Decorative glow effect */}
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500 opacity-20 rounded-full blur-3xl pointer-events-none group-hover:opacity-30 transition-opacity duration-500"></div>
                <div className="absolute -left-10 bottom-0 w-40 h-40 bg-blue-400 opacity-10 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="relative z-10 flex items-start justify-between mb-8">
                    <div>
                        <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <DollarSign size={16} className="text-indigo-300" /> Total Balance Overview
                        </p>
                        <h3 className="text-5xl md:text-6xl font-black tracking-tighter drop-shadow-md">
                            <span className="text-indigo-300 font-medium text-4xl mr-1">฿</span>
                            {stats.totalRevenue.toLocaleString()}
                        </h3>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/10 text-white p-4 rounded-2xl shadow-sm hidden sm:block">
                        <DollarSign size={32} className="opacity-90" />
                    </div>
                </div>

                <div className="relative z-10 flex justify-between items-end border-t border-indigo-400/20 pt-5 mt-4">
                    <div className="flex flex-col">
                        <span className="text-indigo-300 uppercase tracking-widest text-[10px] font-bold mb-1">Total Billed</span>
                        <span className="font-bold text-xl md:text-2xl text-slate-100">฿{stats.totalBilled.toLocaleString()}</span>
                    </div>
                    <span className="text-indigo-400/30 text-4xl font-light px-2 hidden sm:block">-</span>
                    <div className="flex flex-col text-right">
                        <span className="text-indigo-300 uppercase tracking-widest text-[10px] font-bold mb-1">Pending Amount</span>
                        <span className="font-bold text-amber-300 text-xl md:text-2xl drop-shadow-sm">฿{stats.pendingAmount.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Other Stats - Smaller side cards */}
            <div className="lg:col-span-1 flex flex-col justify-between gap-4">
                <div className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all flex-1">
                    <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                        <Home size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Occupancy Rate</p>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{stats.occupancyRate}%</h3>
                    </div>
                </div>

                <div className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-indigo-200 hover:shadow-md transition-all flex-1">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
                        <Users size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Active Tenants</p>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{stats.activeTenants}</h3>
                    </div>
                </div>

                <div className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-amber-200 hover:shadow-md transition-all flex-1">
                    <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
                        <Wrench size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pending Repairs</p>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{stats.pendingMaintenance}</h3>
                    </div>
                </div>
            </div>
        </div>
    );
}
