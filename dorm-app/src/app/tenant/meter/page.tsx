'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Gauge, Droplets, Zap, ChevronRight, Loader2 } from 'lucide-react';
import Loading from '@/components/ui/loading';

interface MeterReading {
    id: number;
    contract_id: number;
    reading_date: string;
    prev_water: number;
    current_water: number;
    prev_electricity: number;
    current_electricity: number;
}

export default function TenantMeterPage() {
    const [loading, setLoading] = useState(true);
    const [readings, setReadings] = useState<MeterReading[]>([]);

    useEffect(() => {
        fetchReadings();
    }, []);

    const fetchReadings = async () => {
        setLoading(true);
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) return;

            // 1. Get Active Contract
            const { data: contract } = await supabase
                .from('contract')
                .select('id')
                .eq('user_id', userId)
                .in('status', ['Active', 'active'])
                .single();

            if (!contract) {
                setLoading(false);
                return;
            }

            // 2. Fetch Meter Readings
            const { data, error } = await supabase
                .from('meter_reading')
                .select('*')
                .eq('contract_id', contract.id)
                .order('reading_date', { ascending: false });

            if (error) throw error;
            setReadings(data || []);

        } catch (error) {
            console.error('Error fetching readings:', error);
        } finally {
            setLoading(false);
        }
    };



    // ... (inside component)

    if (loading) return <Loading />;

    return (
        <div className="max-w-5xl mx-auto px-6 py-8 font-sans min-h-screen pb-24">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">
                        Meter <span className="text-[#0047AB]">Readings</span>
                    </h1>
                    <p className="text-gray-500 mt-1">Track your electricity and water consumption.</p>
                </div>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {readings.length > 0 ? (
                    readings.map((reading) => (
                        <div key={reading.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">

                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

                                {/* Date Section */}
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-[#0047AB]">
                                        <Gauge size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg">
                                            {new Date(reading.reading_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                        </h3>
                                        <p className="text-sm text-gray-500">Recorded on {new Date(reading.reading_date).toLocaleDateString('en-GB')}</p>
                                    </div>
                                </div>

                                {/* Usage Stats */}
                                <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto">

                                    {/* Electricity */}
                                    <div className="flex items-center gap-3 flex-1 bg-yellow-50 p-3 rounded-xl">
                                        <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
                                            <Zap size={20} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-yellow-700 font-bold uppercase">Electricity {reading.current_electricity - reading.prev_electricity} Units</p>
                                            <div className="flex items-center text-sm font-medium text-gray-600">
                                                <span>{reading.prev_electricity}</span>
                                                <ChevronRight size={14} className="mx-1" />
                                                <span className="text-gray-900 font-bold">{reading.current_electricity}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Water */}
                                    <div className="flex items-center gap-3 flex-1 bg-cyan-50 p-3 rounded-xl">
                                        <div className="p-2 bg-cyan-100 rounded-lg text-cyan-600">
                                            <Droplets size={20} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-cyan-700 font-bold uppercase">Water {reading.current_water - reading.prev_water} Units</p>
                                            <div className="flex items-center text-sm font-medium text-gray-600">
                                                <span>{reading.prev_water}</span>
                                                <ChevronRight size={14} className="mx-1" />
                                                <span className="text-gray-900 font-bold">{reading.current_water}</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                        <div className="bg-white p-4 rounded-full inline-block mb-4 shadow-sm">
                            <Gauge size={48} className="text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">No Readings Found</h3>
                        <p className="text-gray-500 mt-2">Meter readings will appear here once recorded.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
