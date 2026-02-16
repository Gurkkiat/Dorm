'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Invoice, MaintenanceRequest, Contract } from '@/types/database';
import { Wrench, DollarSign, Settings } from 'lucide-react';
import { useManager } from '../ManagerContext';

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
    const { selectedBranchId } = useManager();
    const [maintenanceList, setMaintenanceList] = useState<MaintenanceWithDetails[]>([]);
    const [paymentList, setPaymentList] = useState<InvoiceWithDetails[]>([]);
    const [tenantList, setTenantList] = useState<ContractWithDetails[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterMaint, setFilterMaint] = useState('All');
    const [filterPayment, setFilterPayment] = useState('All');
    const [filterGender, setFilterGender] = useState('All');

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);

                // 2. Fetch Maintenance (Filtered by Branch)
                let maintQuery = supabase
                    .from('maintenance_request')
                    .select('*, room:room_id!inner(room_number, building:building_id!inner(branch_id))')
                    .order('requested_at', { ascending: false });

                if (selectedBranchId !== 'All') {
                    maintQuery = maintQuery.eq('room.building.branch_id', selectedBranchId);
                }

                const { data: maintData } = await maintQuery;

                // 3. Fetch Payments (Filtered by Branch)
                let payQuery = supabase
                    .from('invoice')
                    .select('*, contract:contract_id!inner(room:room_id!inner(room_number, building:building_id!inner(branch_id)))')
                    .order('bill_date', { ascending: false });

                if (selectedBranchId !== 'All') {
                    payQuery = payQuery.eq('contract.room.building.branch_id', selectedBranchId);
                }

                const { data: payData } = await payQuery;

                // 4. Fetch Tenants (Filtered by Branch)
                let tenantQuery = supabase
                    .from('contract')
                    .select('*, room:room_id!inner(room_number, building:building_id!inner(branch_id)), user:user_id(full_name, sex)')
                    .in('status', ['Active', 'active']);

                if (selectedBranchId !== 'All') {
                    tenantQuery = tenantQuery.eq('room.building.branch_id', selectedBranchId);
                }

                const { data: tenantData } = await tenantQuery;

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
    }, [selectedBranchId]);

    // Helper for Maintenance Badge Color
    const getMaintBadge = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'repairing') return 'bg-orange-500 text-white';
        if (s === 'done' || s === 'completed') return 'bg-green-500 text-white';
        if (s === 'pending') return 'bg-yellow-400 text-yellow-900';
        return 'bg-gray-200 text-gray-800';
    };

    // Helper for Payment Badge Color
    const getPaymentBadge = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'paid') return 'bg-green-500 text-white';
        if (s === 'unpaid') return 'bg-yellow-400 text-yellow-900';
        if (s === 'pending') return 'bg-white text-black border border-gray-200 shadow-sm';
        if (s === 'overdue') return 'bg-red-500 text-white';
        return 'bg-gray-200 text-gray-800';
    };

    // Helper for Tenant Sex Badge Color
    const getSexBadge = (sex: string) => {
        const s = sex?.toLowerCase() || '';
        if (s === 'male' || s === 'ชาย') return 'bg-blue-500 text-white'; // Blue per new request
        if (s === 'female' || s === 'หญิง') return 'bg-pink-500 text-white';
        if (s === 'lgbtq+') return 'bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-white'; // Rainbow-ish
        return 'bg-gray-500 text-white';
    };

    // Filter Logic - Case Insensitive Mapping
    const filteredMaintenance = maintenanceList.filter(item => {
        if (filterMaint === 'All') return true;
        const s = item.status_technician?.toLowerCase() || '';
        return s === filterMaint.toLowerCase();
    });

    const filteredPayment = paymentList.filter(item => {
        if (filterPayment === 'All') return true;
        const s = item.status?.toLowerCase() || '';
        return s === filterPayment.toLowerCase();
    });

    const filteredTenant = tenantList.filter(item => {
        if (filterGender === 'All') return true;
        const s = item.user?.sex?.toLowerCase() || '';
        const f = filterGender.toLowerCase();

        if (f === 'male') return s === 'male' || s === 'ชาย';
        if (f === 'female') return s === 'female' || s === 'หญิง';
        if (f === 'lgbtq+' || f === 'lgbtq') return s === 'lgbtq+';

        return s === f;
    });

    if (loading) return <div className="p-8 text-center">Loading Dashboard...</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full font-roboto">

            {/* 1. Maintenance List */}
            <div className="bg-[#0047AB] rounded-2xl p-4 text-white relative overflow-hidden flex flex-col shadow-lg">
                {/* Watermark Icon */}
                <Wrench className="absolute -bottom-10 -right-10 text-white/10 w-64 h-64 opacity-10" />

                <h2 className="text-xl font-bold text-center mb-4 z-10">Maintenance List</h2>

                {/* Filter */}
                <div className="flex justify-center mb-4 z-10 items-center">
                    <span className="mr-2 text-sm">Status :</span>
                    <select
                        value={filterMaint}
                        onChange={(e) => setFilterMaint(e.target.value)}
                        className="bg-white text-black text-sm rounded-lg px-3 py-1 outline-none border-none shadow-sm cursor-pointer"
                    >
                        <option value="All">All</option>
                        <option value="Repairing">Repairing</option>
                        <option value="Done">Done</option>
                        <option value="Pending">Pending</option>
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 z-10 pr-2 custom-scrollbar">
                    {filteredMaintenance.length === 0 ? <p className="text-center text-sm opacity-70 mt-4">No requests found.</p> : null}
                    {filteredMaintenance.map((item) => (
                        <div key={item.id} className="bg-white text-black rounded-full px-4 py-2 flex items-center justify-between text-sm shadow-sm hover:shadow-md transition-shadow">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold w-20 text-center truncate ${getMaintBadge(item.status_technician || 'Pending')}`}>
                                {['Done', 'Completed', 'done', 'completed'].includes(item.status_technician || '') ? 'Complete' : (item.status_technician || 'Pending')}
                            </span>
                            <span className="flex-1 mx-2 truncate font-medium">{item.issue_description}</span>
                            <span className="font-bold text-[#0047AB] whitespace-nowrap">{item.room?.room_number}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Payment List */}
            <div className="bg-[#0047AB] rounded-2xl p-4 text-white relative overflow-hidden flex flex-col shadow-lg">
                <DollarSign className="absolute -bottom-10 -right-10 text-white/10 w-64 h-64 opacity-10" />

                <h2 className="text-xl font-bold text-center mb-4 z-10">Payment List</h2>

                {/* Filter */}
                <div className="flex justify-center mb-4 z-10 items-center">
                    <span className="mr-2 text-sm">Status :</span>
                    <select
                        value={filterPayment}
                        onChange={(e) => setFilterPayment(e.target.value)}
                        className="bg-white text-black text-sm rounded-lg px-3 py-1 outline-none border-none shadow-sm cursor-pointer"
                    >
                        <option value="All">All</option>
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Pending">Pending</option>
                        <option value="Overdue">Overdue</option>
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 z-10 pr-2 custom-scrollbar">
                    {filteredPayment.length === 0 ? <p className="text-center text-sm opacity-70 mt-4">No payments found.</p> : null}
                    {filteredPayment.map((item) => (
                        <div key={item.id} className="bg-white text-black rounded-full px-4 py-2 flex items-center justify-between text-sm shadow-sm hover:shadow-md transition-shadow">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold w-20 text-center truncate border ${getPaymentBadge(item.status)}`}>
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()}
                            </span>
                            <span className="flex-1 mx-2 truncate font-medium text-center">{item.room_total_cost.toLocaleString()}</span>
                            <span className="font-bold text-[#0047AB] whitespace-nowrap">{item.contract?.room?.room_number}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. Tenant List (Occupied) */}
            <div className="bg-[#0047AB] rounded-2xl p-4 text-white relative overflow-hidden flex flex-col shadow-lg">
                <Settings className="absolute -bottom-10 -right-10 text-white/10 w-64 h-64 opacity-10" />

                <h2 className="text-xl font-bold text-center mb-4 z-10">Tenant List (Occupied)</h2>

                {/* Gender Filter Bar */}
                <div className="flex justify-center mb-4 z-10">
                    <div className="bg-white p-1 rounded-full flex space-x-1 shadow-sm">
                        <button
                            onClick={() => setFilterGender('All')}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filterGender === 'All' ? 'bg-gray-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterGender('Male')}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filterGender === 'Male' ? 'bg-blue-500 text-white' : 'text-blue-500 hover:bg-blue-50'
                                }`}
                        >
                            Male
                        </button>
                        <button
                            onClick={() => setFilterGender('Female')}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filterGender === 'Female' ? 'bg-pink-500 text-white' : 'text-pink-500 hover:bg-pink-50'
                                }`}
                        >
                            Female
                        </button>
                        <button
                            onClick={() => setFilterGender('LGBTQ+')}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filterGender === 'LGBTQ+'
                                ? 'bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-white'
                                : 'text-purple-500 hover:bg-purple-50'
                                }`}
                        >
                            LGBTQ+
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 z-10 pr-2 custom-scrollbar">
                    {filteredTenant.length === 0 ? <p className="text-center text-sm opacity-70 mt-4">No active tenants found.</p> : null}
                    {filteredTenant.map((item) => (
                        <div key={item.id} className="bg-white text-black rounded-full px-4 py-2 flex items-center justify-between text-sm shadow-sm hover:shadow-md transition-shadow">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold w-16 text-center truncate ${getSexBadge(item.user?.sex || '')}`}>
                                {item.user?.sex || 'N/A'}
                            </span>
                            <span className="flex-1 mx-2 truncate font-bold text-sm">{item.user?.full_name}</span>
                            <span className="font-bold text-[#0047AB] whitespace-nowrap">{item.room?.room_number}</span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
