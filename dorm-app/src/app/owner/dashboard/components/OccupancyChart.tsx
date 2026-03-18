import { Calendar } from 'lucide-react';

interface OccupancyChartProps {
    occupancyRate: number;
    activeTenants: number;
    totalRooms: number;
}

export default function OccupancyChart({ occupancyRate, activeTenants, totalRooms }: OccupancyChartProps) {
    return (
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
                            strokeDashoffset={(2 * Math.PI * 90) * (1 - occupancyRate / 100)}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black text-slate-800">{occupancyRate}%</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Occupied</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 gap-8 mt-10 w-full px-6">
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="text-sm font-bold text-slate-700">{activeTenants}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter text-center">Tenant Active</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                            <span className="text-sm font-bold text-slate-700">{Math.max(0, totalRooms - activeTenants)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter text-center">Available Rooms</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
