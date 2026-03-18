import { Filter } from 'lucide-react';

interface FilterBarProps {
    selectedBuilding: string;
    setSelectedBuilding: (v: string) => void;
    selectedMonth: string;
    setSelectedMonth: (v: string) => void;
    selectedYear: string;
    setSelectedYear: (v: string) => void;
    buildingsList: { id: number; name_building: string }[];
}

export default function DashboardFilterBar({
    selectedBuilding, setSelectedBuilding,
    selectedMonth, setSelectedMonth,
    selectedYear, setSelectedYear,
    buildingsList
}: FilterBarProps) {
    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-slate-500 font-bold mr-2">
                <Filter size={18} />
                <span>Filters:</span>
            </div>
            
            <select 
                value={selectedBuilding} 
                onChange={e => setSelectedBuilding(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
            >
                <option value="All">All Buildings</option>
                {buildingsList.map(b => (
                    <option key={b.id} value={b.id.toString()}>{b.name_building}</option>
                ))}
            </select>

            <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
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
                className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
            >
                <option value="All">All Years (Revenue)</option>
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
            </select>
        </div>
    );
}
