'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useManager } from '../ManagerContext';
import { Search, Gauge, Droplets, Zap, Calendar, TrendingUp, DollarSign } from 'lucide-react';

interface MeterReading {
    id: number;
    contract_id: number;
    reading_date: string;
    prev_water: number;
    current_water: number;
    prev_electricity: number;
    current_electricity: number;
    contract?: {
        water_config_type?: 'unit' | 'fixed';
        water_fixed_price?: number;
        user?: {
            full_name: string;
        };
        room?: {
            room_number: string;
            building?: {
                branch_id: number;
                name_building: string;
            }
        }
    }
}

export default function ManagerMeterPage() {
    const { selectedBranchId } = useManager();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MeterReading[]>([]);
    const [filteredData, setFilteredData] = useState<MeterReading[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<string>('All');
    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [sortBy, setSortBy] = useState<string>('room-asc');

    // Rates
    const WATER_RATE = 18; // Standardized to 18
    const ELEC_RATE = 5;

    useEffect(() => {
        fetchMeterReadings();
    }, [selectedBranchId]);

    useEffect(() => {
        let res = data;

        // Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            res = res.filter(item =>
                item.contract?.room?.room_number.toLowerCase().includes(lower)
            );
        }
        // Filter by Month
        if (selectedMonth !== 'All') {
            res = res.filter(item => new Date(item.reading_date).getMonth().toString() === selectedMonth);
        }

        // Filter by Year
        if (selectedYear !== 'All') {
            res = res.filter(item => new Date(item.reading_date).getFullYear().toString() === selectedYear);
        }

        // Sort
        res = [...res].sort((a, b) => {
            const roomA = a.contract?.room?.room_number || '';
            const roomB = b.contract?.room?.room_number || '';
            const waterA = Math.max(0, a.current_water - a.prev_water);
            const waterB = Math.max(0, b.current_water - b.prev_water);
            const elecA = Math.max(0, a.current_electricity - a.prev_electricity);
            const elecB = Math.max(0, b.current_electricity - b.prev_electricity);

            switch (sortBy) {
                case 'room-asc': return roomA.localeCompare(roomB, undefined, { numeric: true });
                case 'room-desc': return roomB.localeCompare(roomA, undefined, { numeric: true });
                case 'water-high': return waterB - waterA;
                case 'water-low': return waterA - waterB;
                case 'elec-high': return elecB - elecA;
                case 'elec-low': return elecA - elecB;
                default: return 0;
            }
        });

        setFilteredData(res);
    }, [data, searchTerm, selectedMonth, selectedYear, sortBy]);

    // Derived Years
    const availableYears = Array.from(new Set(data.map(d => new Date(d.reading_date).getFullYear().toString()))).sort((a,b) => b.localeCompare(a));
    const months = [
        { value: 'All', label: 'All Months' },
        { value: '0', label: 'January' },
        { value: '1', label: 'February' },
        { value: '2', label: 'March' },
        { value: '3', label: 'April' },
        { value: '4', label: 'May' },
        { value: '5', label: 'June' },
        { value: '6', label: 'July' },
        { value: '7', label: 'August' },
        { value: '8', label: 'September' },
        { value: '9', label: 'October' },
        { value: '10', label: 'November' },
        { value: '11', label: 'December' },
    ];

    async function fetchMeterReadings() {
        setLoading(true);
        try {
            let query = supabase
                .from('meter_reading')
                .select('*, contract:contract_id ( water_config_type, water_fixed_price, user:user_id ( full_name ), room:room_id ( room_number, building:building_id ( branch_id, name_building ) ) )')
                .order('reading_date', { ascending: false });

            // Apply Branch Filter
            if (selectedBranchId !== 'All') {
                // Using !inner to filter by nested relation
                query = supabase
                    .from('meter_reading')
                    .select('*, contract:contract_id!inner ( water_config_type, water_fixed_price, user:user_id ( full_name ), room:room_id!inner ( room_number, building:building_id!inner ( branch_id, name_building ) ) )')
                    .eq('contract.room.building.branch_id', selectedBranchId)
                    .order('reading_date', { ascending: false });
            }

            const { data, error } = await query;

            if (error) throw error;
            const readings = (data as unknown as MeterReading[]) || [];
            setData(readings);
            setFilteredData(readings);
        } catch (error) {
            console.error('Error fetching meter readings:', error);
        } finally {
            setLoading(false);
        }
    }

    // Calculations
    const calculateElecCost = (reading: MeterReading) => {
        return (reading.current_electricity - reading.prev_electricity) * ELEC_RATE;
    };

    const calculateWaterCost = (reading: MeterReading) => {
        if (reading.contract?.water_config_type === 'fixed') {
            return reading.contract.water_fixed_price || 100;
        }
        return (reading.current_water - reading.prev_water) * WATER_RATE;
    };

    const totalElecRevenue = filteredData.reduce((sum, r) => sum + calculateElecCost(r), 0);
    const totalWaterRevenue = filteredData.reduce((sum, r) => sum + calculateWaterCost(r), 0);
    const totalRevenue = totalElecRevenue + totalWaterRevenue;

    const totalElecUsage = filteredData.reduce((sum, r) => sum + Math.max(0, r.current_electricity - r.prev_electricity), 0);
    const totalWaterUsage = filteredData.reduce((sum, r) => sum + Math.max(0, r.current_water - r.prev_water), 0);

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;

    const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="h-full flex flex-col p-6 bg-gray-50/50 gap-6 overflow-y-auto">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Meter Readings</h1>
                    <p className="text-gray-500 text-sm mt-1">{currentDate}</p>
                </div>
            </div>

            {/* Widgets Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Total Revenue Card */}
                <div className="bg-gradient-to-br from-[#0047AB] to-[#003380] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden h-40 flex flex-col justify-center items-center text-center">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4">
                        <DollarSign size={100} />
                    </div>
                    <div className="z-10">
                        <p className="text-blue-200 text-lg font-medium">Total Estimated Revenue</p>
                        <h2 className="text-4xl font-bold mt-2">฿ {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                    </div>
                </div>

                {/* Electricity Summary */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 text-yellow-50">
                        <Zap size={100} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
                                <Zap size={18} />
                            </div>
                            <span className="font-bold text-gray-700">Electricity</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">฿ {totalElecRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        <div className="flex flex-col gap-1 mt-2 md:flex-row md:items-center">
                            <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-100 flex items-center gap-1">
                                <Zap size={12} />
                                {totalElecUsage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Units
                            </span>
                        </div>
                    </div>
                </div>

                {/* Water Summary */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 text-cyan-50">
                        <Droplets size={100} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-cyan-100 rounded-lg text-cyan-600">
                                <Droplets size={18} />
                            </div>
                            <span className="font-bold text-gray-700">Water</span>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">฿ {totalWaterRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                        <div className="flex flex-col gap-1 mt-2 md:flex-row md:items-center">
                            <span className="bg-cyan-50 text-cyan-700 px-2 py-1 rounded text-xs font-bold border border-cyan-100 flex items-center gap-1">
                                <Droplets size={12} />
                                {totalWaterUsage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Units
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Readings List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-lg text-gray-800">Recent Readings</h3>

                    <div className="flex flex-wrap gap-3 items-center">
                        {/* Month Filter */}
                        <select
                            className="bg-gray-100 text-gray-700 text-sm rounded-xl px-4 py-2 border-r-8 border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                            {months.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>

                        {/* Year Filter */}
                        <select
                            className="bg-gray-100 text-gray-700 text-sm rounded-xl px-4 py-2 border-r-8 border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                        >
                            <option value="All">All Years</option>
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>

                        {/* Sort */}
                        <select
                            className="bg-gray-100 text-gray-700 text-sm rounded-xl px-4 py-2 border-r-8 border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="room-asc">Room (A-Z)</option>
                            <option value="room-desc">Room (Z-A)</option>
                            <option value="water-high">Water Usage (High-Low)</option>
                            <option value="water-low">Water Usage (Low-High)</option>
                            <option value="elec-high">Electricity (High-Low)</option>
                            <option value="elec-low">Electricity (Low-High)</option>
                        </select>

                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search Room"
                                className="bg-gray-100 text-gray-700 text-sm rounded-xl px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        </div>
                    </div>
                </div>

                <div className="overflow-auto flex-1 p-4">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="py-4 px-4 rounded-l-lg">Room / Building</th>
                                <th className="py-4 px-4">Water Usage</th>
                                <th className="py-4 px-4">Electricity Usage</th>
                                <th className="py-4 px-4 rounded-r-lg text-right">Total Cost</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-50">
                            {filteredData.map((row) => {
                                const waterUsage = Math.max(0, row.current_water - row.prev_water);
                                const elecUsage = Math.max(0, row.current_electricity - row.prev_electricity);
                                const waterCost = calculateWaterCost(row);
                                const elecCost = calculateElecCost(row);

                                return (
                                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 p-2 rounded-lg text-blue-600 font-bold w-10 h-10 flex items-center justify-center">
                                                    {row.contract?.room?.room_number || '-'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800">{(row.contract as any)?.user?.full_name || 'Room ' + (row.contract?.room?.room_number || '-')}</p>
                                                    <p className="text-xs text-gray-500">{row.contract?.room?.building?.name_building || '-'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        {/* Water Column */}
                                        <td className="py-4 px-4">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-3 text-sm">
                                                    <div className="text-gray-500">
                                                        <span className="text-xs uppercase mr-1">Prev:</span>
                                                        <span className="font-medium">{row.prev_water.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="text-gray-300">→</div>
                                                    <div className="text-cyan-700">
                                                        <span className="text-xs uppercase font-bold mr-1">Curr:</span>
                                                        <span className="font-bold">{row.current_water.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded text-xs font-bold border border-cyan-100 flex items-center gap-1">
                                                        <Droplets size={10} /> +{waterUsage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Units
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-700">
                                                        = ฿ {waterCost.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Electricity Column */}
                                        <td className="py-4 px-4">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-3 text-sm">
                                                    <div className="text-gray-500">
                                                        <span className="text-xs uppercase mr-1">Prev:</span>
                                                        <span className="font-medium">{row.prev_electricity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="text-gray-300">→</div>
                                                    <div className="text-yellow-700">
                                                        <span className="text-xs uppercase font-bold mr-1">Curr:</span>
                                                        <span className="font-bold">{row.current_electricity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold border border-yellow-100 flex items-center gap-1">
                                                        <Zap size={10} /> +{elecUsage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Units
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-700">
                                                        = ฿ {elecCost.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Total Cost Column */}
                                        <td className="py-4 px-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <p className="text-lg font-black text-slate-800">
                                                    {(waterCost + elecCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">THB Total</p>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-12 text-center text-gray-400">
                                        No meter readings found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
}
