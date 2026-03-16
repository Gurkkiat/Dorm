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

            // Deduplicate by Month-Year (keeping the latest)
            const uniqueReadings = [];
            const seenMonths = new Set();

            for (const reading of (data || [])) {
                const date = new Date(reading.reading_date);
                const monthYear = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

                if (!seenMonths.has(monthYear)) {
                    seenMonths.add(monthYear);
                    uniqueReadings.push(reading);
                }
            }

            setReadings(uniqueReadings);

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
                                <div className="flex flex-col sm:flex-row gap-6 w-full md:w-3/4">

                                    {/* Electricity */}
                                    <div className="flex-[4] bg-yellow-50 p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                                        {/* Header Row */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
                                                    <Zap size={18} />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm text-yellow-800 font-bold uppercase tracking-wider">Electricity</p>
                                                    {index === 0 && (
                                                        <span className="bg-green-100 text-green-700 text-[9px] px-1.5 py-0.5 rounded font-bold animate-pulse">LIVE</span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Live Indicator Background Animation */}
                                            {index === 0 && (
                                                <span className="relative flex h-2.5 w-2.5 mr-1">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Main Values */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <p className="text-xs text-yellow-700 mb-1">Current Reading</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-bold text-gray-900 font-mono tracking-tight">
                                                        {index === 0 ? liveElectricity.toFixed(2) : reading.current_electricity.toFixed(2)}
                                                    </span>
                                                    <span className="text-xs text-gray-500 font-medium">kWh</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-yellow-700 mb-1">Previous</p>
                                                <span className="text-sm font-medium text-gray-600 font-mono">{reading.prev_electricity.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Cost & Usage Calculation (Footer) */}
                                        <div className="bg-white/60 p-3 rounded-xl border border-yellow-200/50 flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] text-yellow-800 font-bold uppercase mb-0.5">Usage</p>
                                                <p className="text-sm font-bold text-yellow-900">
                                                    {((index === 0 ? liveElectricity : reading.current_electricity) - reading.prev_electricity).toFixed(2)} <span className="text-[10px] font-normal">units</span>
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                {index === 0 ? (
                                                    <>
                                                        <p className="text-[10px] text-yellow-800 font-bold uppercase mb-0.5">Est. Cost (Live)</p>
                                                        <p className="text-lg font-bold text-yellow-900">
                                                            {((liveElectricity - reading.prev_electricity) * 5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-normal">THB</span>
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-[10px] text-yellow-800 font-bold uppercase mb-0.5">Cost</p>
                                                        <p className="text-lg font-bold text-gray-800">
                                                            {((reading.current_electricity - reading.prev_electricity) * 5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-normal">THB</span>
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Water */}
                                    <div className="flex-[3] bg-cyan-50 p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                                        {/* Header Row */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 bg-cyan-100 rounded-lg text-cyan-600">
                                                    <Droplets size={18} />
                                                </div>
                                                <p className="text-sm text-cyan-800 font-bold uppercase tracking-wider">Water</p>
                                            </div>
                                        </div>

                                        {/* Main Values */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <p className="text-xs text-cyan-700 mb-1">Current Reading</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-bold text-gray-900 font-mono tracking-tight">
                                                        {reading.current_water.toFixed(2)}
                                                    </span>
                                                    <span className="text-xs text-gray-500 font-medium">m³</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-cyan-700 mb-1">Previous</p>
                                                <span className="text-sm font-medium text-gray-600 font-mono">{reading.prev_water.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Cost & Usage Calculation (Footer) */}
                                        <div className="bg-white/60 p-3 rounded-xl border border-cyan-200/50 flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] text-cyan-800 font-bold uppercase mb-0.5">Usage</p>
                                                <p className="text-sm font-bold text-cyan-900">
                                                    {(reading.current_water - reading.prev_water).toFixed(2)} <span className="text-[10px] font-normal">units</span>
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-cyan-800 font-bold uppercase mb-0.5">
                                                    {contractConfig?.water_config_type === 'fixed' ? 'Fixed Rate' : 'Est. Cost'}
                                                </p>
                                                <p className="text-lg font-bold text-gray-800">
                                                    {contractConfig?.water_config_type === 'fixed'
                                                        ? `${(contractConfig.water_fixed_price || 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                        : `${((reading.current_water - reading.prev_water) * 18).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    } <span className="text-[10px] font-normal">THB</span>
                                                </p>
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
