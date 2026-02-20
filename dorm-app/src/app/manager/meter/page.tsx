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
        room?: {
            room_number: string;
            building?: {
                branch_id: number;
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

        setFilteredData(res);
    }, [data, searchTerm]);

    async function fetchMeterReadings() {
        setLoading(true);
        try {
            let query = supabase
                .from('meter_reading')
                .select('*, contract:contract_id ( water_config_type, water_fixed_price, room:room_id ( room_number, building:building_id ( branch_id ) ) )')
                .order('reading_date', { ascending: false });

            // Apply Branch Filter
            if (selectedBranchId !== 'All') {
                // Using !inner to filter by nested relation
                query = supabase
                    .from('meter_reading')
                    .select('*, contract:contract_id!inner ( water_config_type, water_fixed_price, room:room_id!inner ( room_number, building:building_id!inner ( branch_id ) ) )')
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
                <div className="bg-gradient-to-br from-[#0047AB] to-[#003380] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden h-40 flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4">
                        <DollarSign size={100} />
                    </div>
                    <div>
                        <p className="text-blue-200 text-sm font-medium">Total Estimated Revenue</p>
                        <h2 className="text-3xl font-bold mt-1">฿ {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                    </div>
                    <div className="z-10 flex gap-2 mt-2">
                        <span className="bg-white/20 px-2 py-1 rounded text-xs flex items-center gap-1">
                            <Zap size={10} className="text-yellow-300" />
                            {totalElecRevenue.toLocaleString()}
                        </span>
                        <span className="bg-white/20 px-2 py-1 rounded text-xs flex items-center gap-1">
                            <Droplets size={10} className="text-cyan-300" />
                            {totalWaterRevenue.toLocaleString()}
                        </span>
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
                        <p className="text-xs text-gray-400 mt-1">based on {ELEC_RATE} THB/Unit</p>
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
                        <p className="text-xs text-gray-400 mt-1">Unit & Fixed Rates</p>
                    </div>
                </div>
            </div>

            {/* Readings List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-lg text-gray-800">Recent Readings</h3>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search Room"
                            className="bg-gray-100 text-gray-700 text-sm rounded-full px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    </div>
                </div>

                <div className="overflow-auto flex-1 p-4">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="py-4 px-4 rounded-l-lg">Room / Date</th>
                                <th className="py-4 px-4">Water Usage</th>
                                <th className="py-4 px-4 rounded-r-lg">Electricity Usage</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-50">
                            {filteredData.map((row) => {
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
                                                    <p className="font-bold text-gray-800">Room {row.contract?.room?.room_number || '-'}</p>
                                                    <p className="text-xs text-gray-500">{new Date(row.reading_date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-400 uppercase">Prev</p>
                                                    <p className="font-medium text-gray-600">{row.prev_water.toLocaleString(undefined, { minimumFractionDigits: 3 })}</p>
                                                </div>
                                                <div className="text-gray-300">→</div>
                                                <div>
                                                    <p className="text-xs text-cyan-500 uppercase font-bold">Curr</p>
                                                    <p className="font-bold text-gray-800">{row.current_water.toLocaleString(undefined, { minimumFractionDigits: 4 })}</p>
                                                    <p className="text-xs text-cyan-600 font-bold mt-1">฿ {waterCost.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-400 uppercase">Prev</p>
                                                    <p className="font-medium text-gray-600">{row.prev_electricity.toLocaleString(undefined, { minimumFractionDigits: 3 })}</p>
                                                </div>
                                                <div className="text-gray-300">→</div>
                                                <div>
                                                    <p className="text-xs text-yellow-500 uppercase font-bold">Curr</p>
                                                    <p className="font-bold text-gray-800">{row.current_electricity.toLocaleString(undefined, { minimumFractionDigits: 3 })}</p>
                                                    <p className="text-xs text-yellow-600 font-bold mt-1">฿ {elecCost.toLocaleString()}</p>
                                                </div>
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
