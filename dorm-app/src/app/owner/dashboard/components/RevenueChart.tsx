import { TrendingUp } from 'lucide-react';

interface RevenueChartProps {
    monthlyRevenue: { month: string; amount: number }[];
    selectedYear: string;
}

export default function RevenueChart({ monthlyRevenue, selectedYear }: RevenueChartProps) {
    const maxMonthlyRevenue = Math.max(...monthlyRevenue.map(m => m.amount), 1000);

    return (
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
                {monthlyRevenue.map((data, idx) => (
                    <div key={idx} className="flex-1 flex flex-col justify-end items-center group relative h-full">
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
    );
}
