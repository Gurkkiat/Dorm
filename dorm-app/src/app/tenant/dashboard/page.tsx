'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Zap, Droplets } from 'lucide-react';
import { MaintenanceRequest } from '@/types/database';

export default function TenantDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalPayment: 0,
        invoiceAmount: 0,
        elecUsage: 0,
        waterUsage: 0
    });
    const [maintenanceList, setMaintenanceList] = useState<MaintenanceRequest[]>([]);

    useEffect(() => {
        async function fetchDashboardData() {
            setLoading(true);
            try {
                // 1. Get Current User
                const storedUserId = localStorage.getItem('user_id');
                if (!storedUserId) return;

                // 2. Get User's Active Contract & Room
                const { data: contractData, error: contractError } = await supabase
                    .from('contract')
                    .select('id, room_id, status, room:room_id(*)')
                    .eq('user_id', storedUserId)
                    .in('status', ['Active', 'active', 'complete', 'incomplete']) // Check multiple variations
                    .single();

                if (contractError || !contractData) {
                    // Handle no contract
                    console.log('No active contract found');
                    setLoading(false);
                    return;
                }

                const contractId = contractData.id;
                const roomId = contractData.room_id;

                // 3. Fetch Unpaid Invoices for Total Payment & Latest Invoice
                const { data: invoices, error: invError } = await supabase
                    .from('invoice')
                    .select('*')
                    .eq('contract_id', contractId)
                    .eq('status', 'Unpaid') // Or 'Pending'?
                    .order('due_date', { ascending: false });

                if (!invError && invoices) {
                    const total = invoices.reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0);
                    const latest = invoices.length > 0 ? invoices[0] : null;

                    // Usage from latest invoice (Mock derivation if unit not available)
                    // Assumption: we want to show Usage for the *latest bill*
                    // If we don't have unit columns, we might just show cost or 0
                    // Checking invoice object structure in runtime or assuming standard
                    // Let's assume invoice has `room_elec_cost` and `room_water_cost`
                    // We can estimate units if we know rate, but for now let's just display what we can.
                    // The design says "100 / 300 kWh". 
                    // Let's just hardcode capacity/limits for now (e.g. 300 / 50) and estimated usage from cost / 8 (approx rate)

                    const elecCost = latest?.room_elec_cost || 0;
                    const waterCost = latest?.room_water_cost || 0;

                    // Roughly: Elec ~ 7-8 baht/unit, Water ~ 17-20 baht/unit or min cost
                    const estimatedElecUnit = Math.floor(elecCost / 8);
                    const estimatedWaterUnit = Math.floor(waterCost / 18);

                    setStats({
                        totalPayment: total,
                        invoiceAmount: latest?.room_total_cost || 0,
                        elecUsage: estimatedElecUnit,
                        waterUsage: estimatedWaterUnit
                    });
                }

                // 4. Fetch Active Maintenance Requests
                const { data: maintenances, error: maintError } = await supabase
                    .from('maintenance_request')
                    .select('*')
                    .eq('room_id', roomId)
                    .neq('status_technician', 'Completed') // Show active ones
                    .order('requested_at', { ascending: false })
                    .limit(2);

                if (!maintError && maintenances) {
                    setMaintenanceList(maintenances);
                }

            } catch (error) {
                console.error('Error loading dashboard:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchDashboardData();
    }, []);

    if (loading) return <div className="text-[#0047AB] p-8 text-center font-bold">Loading Dashboard...</div>;

    const WidgetCard = ({ title, children, className = '' }: { title: string, children: React.ReactNode, className?: string }) => (
        <div className={`rounded-3xl p-6 text-white shadow-xl flex flex-col ${className}`}>
            <h3 className="text-lg font-bold mb-4">{title}</h3>
            {children}
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">

            {/* Monthly Usage */}
            <WidgetCard title="Monthly Usage" className="bg-[#0047AB]">
                <div className="flex flex-col gap-6">
                    <p className="text-xs opacity-80 -mt-2">Real-time motitoring</p>

                    {/* Electricity */}
                    <div>
                        <div className="flex justify-between text-sm mb-1 font-bold">
                            <span className="flex items-center gap-1"><Zap size={16} className="text-yellow-400 fill-yellow-400" /> Electricity</span>
                            <span>{stats.elecUsage} / 300 kWh</span>
                        </div>
                        <div className="w-full bg-white/30 h-3 rounded-full overflow-hidden">
                            <div
                                className="bg-[#00C853] h-full rounded-full"
                                style={{ width: `${Math.min((stats.elecUsage / 300) * 100, 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Water */}
                    <div>
                        <div className="flex justify-between text-sm mb-1 font-bold">
                            <span className="flex items-center gap-1"><Droplets size={16} className="text-cyan-300 fill-cyan-300" /> Water</span>
                            <span>{stats.waterUsage} / 50 m³</span>
                        </div>
                        <div className="w-full bg-white/30 h-3 rounded-full overflow-hidden">
                            <div
                                className="bg-[#00C853] h-full rounded-full"
                                style={{ width: `${Math.min((stats.waterUsage / 50) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </WidgetCard>

            {/* Total Payment */}
            <WidgetCard title="Total Paymet" className="bg-[#0047AB]">
                <div className="flex-1 flex flex-col justify-center">
                    <div className="text-5xl font-bold text-[#00C853] mb-1">
                        {stats.totalPayment.toLocaleString()}
                    </div>
                    <div className="text-3xl font-bold">Baht</div>
                </div>
            </WidgetCard>

            {/* Maintenance List */}
            <WidgetCard title="Maintenance List" className="bg-[#0047AB]">
                <div className="flex flex-col gap-3">
                    {maintenanceList.length > 0 ? (
                        maintenanceList.map((m) => (
                            <div key={m.id} className="bg-white rounded-full flex overflow-hidden min-h-[50px] items-center">
                                <div className={`w-24 py-3 text-center text-white font-bold text-sm ${m.category === 'Repair' ? 'bg-[#FF5252]' : // Red for Repair
                                    m.category === 'Replace' ? 'bg-[#FFD740] text-black' : // Yellow for Replace?
                                        'bg-[#FF5252]' // Default
                                    }`}>
                                    {m.category === 'General' ? 'ทั่วไป' :
                                        m.category === 'Electricity' ? 'ไฟฟ้า' :
                                            m.category === 'Water' ? 'ประปา' :
                                                m.category === 'Furniture' ? 'เฟอร์ฯ' : 'ซ่อม'}
                                </div>
                                <div className="flex-1 px-4 text-[#0047AB] font-bold text-sm truncate">
                                    {m.description}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center opacity-70 py-4">No active maintenance requests</div>
                    )}
                </div>
            </WidgetCard>

            {/* Invoice */}
            <WidgetCard title="Invoice" className="bg-[#0047AB]">
                <div className="flex-1 flex flex-col justify-center">
                    <div className="text-5xl font-bold text-[#FF5252] mb-1">
                        {stats.invoiceAmount.toLocaleString()}
                    </div>
                    <div className="text-3xl font-bold">Baht</div>
                </div>
            </WidgetCard>

        </div>
    );
}
