
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Invoice, MaintenanceRequest, Contract } from '@/types/database';
import { Wrench, DollarSign, Settings } from 'lucide-react'; // Placeholder icons

// Extended Types for Joins
interface MaintenanceWithDetails extends MaintenanceRequest {
    room?: { room_number: string };
}

interface InvoiceWithDetails extends Invoice {
    room_total_cost: number;
    contract?: {
        room?: { room_number: string };
    };
}

interface ContractWithDetails extends Contract {
    room?: { room_number: string };
    user?: { full_name: string; sex: string };
}

export default function DashboardPage() {
    const [maintenanceList, setMaintenanceList] = useState<MaintenanceWithDetails[]>([]);
    const [paymentList, setPaymentList] = useState<InvoiceWithDetails[]>([]);
    const [tenantList, setTenantList] = useState<ContractWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);

                // Fetch Maintenance
                const { data: maintData } = await supabase
                    .from('maintenance_request')
                    .select('*, room:room_id(room_number)')
                    .order('requested_at', { ascending: false })
                    .limit(10);

                // Fetch Payments (Invoices)
                const { data: payData } = await supabase
                    .from('invoice')
                    .select('*, contract:contract_id(room:room_id(room_number))')
                    .order('due_date', { ascending: true }) // Show urgent ones first
                    .limit(10);

                // Fetch Tenants (Active Contracts)
                const { data: tenantData } = await supabase
                    .from('contract')
                    .select('*, room:room_id(room_number), user:user_id(full_name, sex)')
                    .eq('status', 'Active')
                    .limit(10);

                setMaintenanceList((maintData as unknown as MaintenanceWithDetails[]) || []);
                setPaymentList((payData as unknown as InvoiceWithDetails[]) || []);
                setTenantList((tenantData as unknown as ContractWithDetails[]) || []);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    // Helper for Maintenance Badge Color
    const getMaintBadge = (status: string) => {
        switch (status) {
            case 'Pending': return 'bg-yellow-400 text-yellow-900';
            case 'In Progress': return 'bg-orange-400 text-white';
            case 'Completed': return 'bg-green-500 text-white';
            default: return 'bg-gray-200 text-gray-800';
        }
    };

    // Helper for Payment Badge Color
    const getPaymentBadge = (status: string) => {
        switch (status) {
            case 'Unpaid': return 'bg-yellow-400 text-yellow-900'; // "รอชำระ" in design looks yellow
            case 'Overdue': return 'bg-red-500 text-white'; // "ค้างชำระ"
            case 'Pending': return 'bg-orange-500 text-white'; // "รอยืนยัน" (Wait for manager)
            case 'Paid': return 'bg-green-500 text-white'; // "จ่ายสำเร็จ"
            default: return 'bg-gray-200 text-gray-800';
        }
    };

    // Helper for Tenant Sex Badge Color (Green for Male in design? Let's check)
    // Design shows "ผู้ชาย" (Male) as Green, let's assume specific color coding
    const getSexBadge = (sex: string) => {
        if (sex === 'Male' || sex === 'ชาย') return 'bg-green-500 text-white';
        if (sex === 'Female' || sex === 'หญิง') return 'bg-pink-500 text-white';
        return 'bg-gray-500 text-white';
    };

    if (loading) return <div className="p-8 text-center">Loading Dashboard...</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">

            {/* 1. Maintenance List */}
            <div className="bg-[#0047AB] rounded-2xl p-4 text-white relative overflow-hidden flex flex-col shadow-lg">
                {/* Watermark Icon */}
                <Wrench className="absolute -bottom-10 -right-10 text-white/10 w-64 h-64 opacity-10" />

                <h2 className="text-xl font-bold text-center mb-4 z-10">Maintenance List</h2>

                {/* Filter Mockup */}
                <div className="flex justify-center mb-4 z-10">
                    <span className="mr-2 text-sm self-center">สถานะ :</span>
                    <select className="bg-white text-black text-sm rounded px-2 py-1 outline-none">
                        <option>ทั้งหมด</option>
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 z-10 pr-2">
                    {maintenanceList.length === 0 ? <p className="text-center text-sm opacity-70">No requests.</p> : null}
                    {maintenanceList.map((item) => (
                        <div key={item.id} className="bg-white text-black rounded-full px-4 py-2 flex items-center justify-between text-sm shadow-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold w-20 text-center truncate ${getMaintBadge(item.status_technician || 'Pending')}`}>
                                {item.status_technician || 'Pending'}
                            </span>
                            <span className="flex-1 mx-2 truncate font-medium">{item.issue_description}</span>
                            <span className="font-bold text-[#0047AB]">{item.room?.room_number}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Payment List */}
            <div className="bg-[#0047AB] rounded-2xl p-4 text-white relative overflow-hidden flex flex-col shadow-lg">
                <DollarSign className="absolute -bottom-10 -right-10 text-white/10 w-64 h-64 opacity-10" />

                <h2 className="text-xl font-bold text-center mb-4 z-10">Payment List</h2>

                {/* Filter Mockup */}
                <div className="flex justify-center mb-4 z-10">
                    <span className="mr-2 text-sm self-center">สถานะ :</span>
                    <select className="bg-white text-black text-sm rounded px-2 py-1 outline-none">
                        <option>ทั้งหมด</option>
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 z-10 pr-2">
                    {paymentList.length === 0 ? <p className="text-center text-sm opacity-70">No payments.</p> : null}
                    {paymentList.map((item) => (
                        <div key={item.id} className="bg-white text-black rounded-full px-4 py-2 flex items-center justify-between text-sm shadow-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold w-20 text-center truncate ${getPaymentBadge(item.status)}`}>
                                {item.status}
                            </span>
                            <span className="flex-1 mx-2 truncate font-medium text-center">{item.room_total_cost.toLocaleString()}</span>
                            <span className="font-bold text-[#0047AB]">{item.contract?.room?.room_number}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. Tenant List */}
            <div className="bg-[#0047AB] rounded-2xl p-4 text-white relative overflow-hidden flex flex-col shadow-lg">
                <Settings className="absolute -bottom-10 -right-10 text-white/10 w-64 h-64 opacity-10" />

                <h2 className="text-xl font-bold text-center mb-4 z-10">Tenant List</h2>

                {/* Filter Mockup */}
                <div className="flex justify-center mb-4 z-10">
                    <span className="mr-2 text-sm self-center">เพศผู้เช่า :</span>
                    <div className="bg-white text-black text-xs rounded-full flex overflow-hidden">
                        <button className="px-3 py-1 bg-gray-600 text-white">ทั้งหมด</button>
                        <button className="px-3 py-1 hover:bg-gray-100">ชาย</button>
                        <button className="px-3 py-1 hover:bg-gray-100">หญิง</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 z-10 pr-2">
                    {tenantList.length === 0 ? <p className="text-center text-sm opacity-70">No active tenants.</p> : null}
                    {tenantList.map((item) => (
                        <div key={item.id} className="bg-white text-black rounded-full px-4 py-2 flex items-center justify-between text-sm shadow-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold w-16 text-center truncate ${getSexBadge(item.user?.sex || '')}`}>
                                {item.user?.sex || 'N/A'}
                            </span>
                            <span className="flex-1 mx-2 truncate font-bold text-sm">{item.user?.full_name}</span>
                            <span className="font-bold text-[#0047AB]">{item.room?.room_number}</span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
