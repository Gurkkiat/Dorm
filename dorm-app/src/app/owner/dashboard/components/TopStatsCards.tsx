import { DollarSign, Home, Users, Wrench, Activity } from 'lucide-react';

interface StatsProps {
    totalRevenue: number; // This is Income (Collected)
    totalBilled: number;
    pendingAmount: number;
    totalExpenses: number;
    netProfit: number;
    occupancyRate: number;
    activeTenants: number;
    pendingMaintenance: number;
}

export default function TopStatsCards({ stats }: { stats: StatsProps }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Net Profit - Large Hero Card */}
            <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-8 rounded-3xl shadow-lg border border-slate-700/50 flex flex-col justify-between text-white relative overflow-hidden group">
                {/* Decorative glow effect */}
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500 opacity-10 rounded-full blur-3xl pointer-events-none group-hover:opacity-20 transition-opacity duration-500"></div>
                <div className="absolute -left-10 bottom-0 w-40 h-40 bg-blue-400 opacity-5 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="relative z-10 flex items-start justify-between mb-8">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <DollarSign size={16} className="text-emerald-400" /> Net Profit Overview (กำไรสุทธิ)
                        </p>
                        <h3 className={`text-5xl md:text-6xl font-black tracking-tighter drop-shadow-md ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <span className="font-medium text-4xl mr-1">฿</span>
                            {stats.netProfit.toLocaleString()}
                        </h3>
                    </div>
                    <div className="bg-white/5 backdrop-blur-md border border-white/10 text-white p-4 rounded-2xl shadow-sm hidden sm:block">
                        <Activity size={32} className="opacity-90 text-emerald-400" />
                    </div>
                </div>

                <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-white/5 pt-6 mt-4">
                    <div className="flex flex-col">
                        <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-1">Total Income</span>
                        <span className="font-bold text-xl text-emerald-100 italic">฿{stats.totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-1">Total Expenses</span>
                        <span className="font-bold text-xl text-rose-300 italic">฿{stats.totalExpenses.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col text-right sm:text-left">
                        <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-1">Pending Invoices</span>
                        <span className="font-bold text-xl text-amber-300 italic">฿{stats.pendingAmount.toLocaleString()}</span>
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
