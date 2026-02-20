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
    const [liveElectricity, setLiveElectricity] = useState<number>(0);
    const [contractConfig, setContractConfig] = useState<any>(null);

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
                .select('id, water_config_type, water_fixed_price')
                .eq('user_id', userId)
                .in('status', ['Active', 'active', 'complete', 'Complete'])
                .single();

            if (!contract) {
                setLoading(false);
                return;
            }

            setContractConfig({
                water_config_type: contract.water_config_type,
                water_fixed_price: contract.water_fixed_price
            });

            // 2. Fetch Initial Meter Readings
            const { data, error } = await supabase
                .from('meter_reading')
                .select('*')
                .eq('contract_id', contract.id)
                .order('reading_date', { ascending: false });

            if (error) throw error;
            setReadings(data || []);

            // Set initial live reading
            if (data && data.length > 0) {
                setLiveElectricity(data[0].current_electricity);
            }

            // 3. Set up Realtime Subscription
            const channel = supabase
                .channel('meter-updates')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'meter_reading',
                        filter: `contract_id=eq.${contract.id}`
                    },
                    (payload) => {
                        const newReading = payload.new as MeterReading;
                        console.log('Realtime update:', newReading);

                        // Update live value instantly
                        setLiveElectricity(newReading.current_electricity);

                        // Update list if needed (optional, but good for consistency)
                        setReadings((prev) => prev.map(r => r.id === newReading.id ? newReading : r));
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };

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
                    readings.map((reading, index) => (
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
                                    <div className="flex items-center gap-3 flex-1 bg-yellow-50 p-3 rounded-xl relative overflow-hidden">
                                        {/* Live Indicator Background Animation */}
                                        <div className="absolute top-0 right-0 p-1">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                            </span>
                                        </div>

                                        <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
                                            <Zap size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-xs text-yellow-700 font-bold uppercase">Electricity</p>
                                                <span className="bg-green-100 text-green-700 text-[9px] px-1.5 py-0.5 rounded font-bold animate-pulse">LIVE</span>
                                            </div>

                                            <div className="flex flex-col">
                                                {/* Live Value */}
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg font-bold text-gray-900 font-mono tracking-tight">
                                                        {index === 0 ? liveElectricity.toFixed(3) : reading.current_electricity.toFixed(3)}
                                                    </span>
                                                    <span className="text-xs text-gray-500 font-medium">kWh</span>
                                                </div>

                                                {/* Cost Calculation */}
                                                {index === 0 && (
                                                    <div className="mt-1 bg-white/50 px-2 py-1 rounded border border-yellow-200/50">
                                                        <p className="text-[10px] text-yellow-800 font-medium">Est. Cost</p>
                                                        <p className="text-sm font-bold text-yellow-900 leading-tight">
                                                            {((liveElectricity - reading.prev_electricity) * 5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Previous Value Context */}
                                                <div className="flex items-center text-[10px] text-gray-400 mt-0.5">
                                                    <span>Prev: {reading.prev_electricity.toFixed(3)}</span>
                                                    {index === 0 && (
                                                        <span className="ml-2 text-yellow-600 font-bold">
                                                            (+{(liveElectricity - reading.prev_electricity).toFixed(3)})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Water */}
                                    <div className="flex items-center gap-3 flex-1 bg-cyan-50 p-3 rounded-xl">
                                        <div className="p-2 bg-cyan-100 rounded-lg text-cyan-600">
                                            <Droplets size={20} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-cyan-700 font-bold uppercase">Water</p>

                                            <div className="flex flex-col">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg font-bold text-gray-900 font-mono tracking-tight">
                                                        {reading.current_water.toFixed(4)}
                                                    </span>
                                                    <span className="text-xs text-gray-500 font-medium">Units</span>
                                                </div>

                                                {/* Cost Calculation */}
                                                <div className="mt-1 bg-white/50 px-2 py-1 rounded border border-cyan-200/50">
                                                    <p className="text-[10px] text-cyan-800 font-medium">
                                                        {contractConfig?.water_config_type === 'fixed' ? 'Fixed Rate' : 'Est. Cost'}
                                                    </p>
                                                    <p className="text-sm font-bold text-cyan-900 leading-tight">
                                                        {contractConfig?.water_config_type === 'fixed'
                                                            ? `${contractConfig.water_fixed_price || 100} ฿`
                                                            : `${((reading.current_water - reading.prev_water) * 18).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿`
                                                        }
                                                    </p>
                                                </div>

                                                <div className="flex items-center text-sm font-medium text-gray-600 mt-1">
                                                    <span>{reading.prev_water.toFixed(3)}</span>
                                                    <ChevronRight size={14} className="mx-1" />
                                                    <span className="text-gray-900 font-bold">{reading.current_water.toFixed(3)}</span>
                                                </div>
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
