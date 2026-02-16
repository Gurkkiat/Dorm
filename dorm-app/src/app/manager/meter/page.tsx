'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useManager } from '../ManagerContext';
import { Search, Gauge, Droplets, Zap, Calendar } from 'lucide-react';

interface MeterReading {
    id: number;
    contract_id: number;
    reading_date: string;
    prev_water: number;
    current_water: number;
    prev_electricity: number;
    current_electricity: number;
    contract?: {
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

    // Utility Rates (Display Only)
    const WATER_RATE = 20;
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
                .select('*, contract:contract_id ( room:room_id ( room_number, building:building_id ( branch_id ) ) )')
                .order('reading_date', { ascending: false });

            // Apply Branch Filter
            if (selectedBranchId !== 'All') {
                // Using !inner to filter by nested relation
                query = supabase
                    .from('meter_reading')
                    .select('*, contract:contract_id!inner ( room:room_id!inner ( room_number, building:building_id!inner ( branch_id ) ) )')
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Total Readings Card (Blue Theme) */}
                <div className="bg-gradient-to-br from-[#0047AB] to-[#003380] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden h-48 flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4">
                        <Gauge size={120} />
                    </div>

                    <div className="flex justify-between items-start z-10">
                        <div>
                            <p className="text-blue-200 text-sm font-medium">Total Readings</p>
                            <h2 className="text-4xl font-bold mt-2">{data.length}</h2>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                            <Calendar size={20} />
                        </div>
                    </div>
                    <div className="z-10">
                        <p className="text-xs text-blue-200 mt-4">Recorded Entries</p>
                    </div>
                </div>

                {/* Rates Widget */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-48">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-700">Current Rates</h3>
                        <span className="bg-blue-100 text-blue-600 py-1 px-3 rounded-full text-xs font-bold">Standard</span>
                    </div>

                    <div className="flex-1 flex gap-8 items-center justify-center">
                        <div className="text-center">
                            <div className="bg-cyan-100 p-3 rounded-full text-cyan-600 mx-auto w-12 h-12 flex items-center justify-center mb-2">
                                <Droplets size={24} />
                            </div>
                            <p className="text-2xl font-bold text-gray-800">{WATER_RATE}</p>
                            <p className="text-gray-400 text-xs">THB / Unit</p>
                        </div>
                        <div className="w-px h-16 bg-gray-200"></div>
                        <div className="text-center">
                            <div className="bg-yellow-100 p-3 rounded-full text-yellow-600 mx-auto w-12 h-12 flex items-center justify-center mb-2">
                                <Zap size={24} />
                            </div>
                            <p className="text-2xl font-bold text-gray-800">{ELEC_RATE}</p>
                            <p className="text-gray-400 text-xs">THB / Unit</p>
                        </div>
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
                            {filteredData.map((row) => (
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
                                                <p className="font-medium text-gray-600">{row.prev_water.toLocaleString()}</p>
                                            </div>
                                            <div className="text-gray-300">→</div>
                                            <div>
                                                <p className="text-xs text-cyan-500 uppercase font-bold">Curr</p>
                                                <p className="font-bold text-gray-800">{row.current_water.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400 uppercase">Prev</p>
                                                <p className="font-medium text-gray-600">{row.prev_electricity.toLocaleString()}</p>
                                            </div>
                                            <div className="text-gray-300">→</div>
                                            <div>
                                                <p className="text-xs text-yellow-500 uppercase font-bold">Curr</p>
                                                <p className="font-bold text-gray-800">{row.current_electricity.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
