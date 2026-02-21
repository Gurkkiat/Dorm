'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Invoice, MaintenanceRequest, Contract } from '@/types/database';
import { Wrench, DollarSign, Settings, Search, SlidersHorizontal, X, Building, Calendar, ArrowRight } from 'lucide-react';
import { useManager } from '../ManagerContext';
import { useRouter } from 'next/navigation';

// Extended Types for Joins
interface MaintenanceWithDetails extends MaintenanceRequest {
    room?: { room_number: string };
}

interface InvoiceWithDetails extends Invoice {
    room_total_cost: number;
    contract?: {
        room?: {
            room_number: string;
            building?: {
                id: number;
                name_building: string;
                branch_id: number;
                branch?: { branches_name: string };
            };
        };
        user?: { full_name: string };
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
    const [searchTerm, setSearchTerm] = useState('');
    const [overdueDays, setOverdueDays] = useState<number | ''>('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [sortBy, setSortBy] = useState('newest');
    const [selectedPayment, setSelectedPayment] = useState<InvoiceWithDetails | null>(null);
    const router = useRouter();

    // New Filters
    const [filterBuilding, setFilterBuilding] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [minAmount, setMinAmount] = useState<number | ''>('');
    const [maxAmount, setMaxAmount] = useState<number | ''>('');
    const [expiringDays, setExpiringDays] = useState<number | ''>('');
    const [buildings, setBuildings] = useState<{ id: number, name_building: string }[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);

                // 2. Fetch Maintenance
                let maintQuery = supabase
                    .from('maintenance_request')
                    .select('*, room:room_id!inner(room_number, building:building_id!inner(id, branch_id))')
                    .order('requested_at', { ascending: false });

                if (selectedBranchId !== 'All') {
                    maintQuery = maintQuery.eq('room.building.branch_id', selectedBranchId);
                }

                const { data: maintData } = await maintQuery;

                // 3. Fetch Payments
                let payQuery = supabase
                    .from('invoice')
                    .select('*, contract:contract_id!inner(user:user_id(full_name), room:room_id!inner(room_number, building:building_id!inner(id, name_building, branch_id, branch:branch_id(branches_name))))')
                    .order('bill_date', { ascending: false });

                if (selectedBranchId !== 'All') {
                    payQuery = payQuery.eq('contract.room.building.branch_id', selectedBranchId);
                }

                const { data: payData } = await payQuery;

                // 4. Fetch Tenants
                let tenantQuery = supabase
                    .from('contract')
                    .select('*, room:room_id!inner(room_number, building:building_id!inner(id, branch_id)), user:user_id(full_name, sex)')
                    .in('status', ['Active', 'active', 'complete']);

                if (selectedBranchId !== 'All') {
                    tenantQuery = tenantQuery.eq('room.building.branch_id', selectedBranchId);
                }

                const { data: tenantData } = await tenantQuery;

                setMaintenanceList((maintData as unknown as MaintenanceWithDetails[]) || []);
                setPaymentList((payData as unknown as InvoiceWithDetails[]) || []);
                setTenantList((tenantData as unknown as ContractWithDetails[]) || []);

                // 5. Fetch Buildings for Filter Dropdown
                let buildingQuery = supabase
                    .from('building')
                    .select('id, name_building');

                if (selectedBranchId !== 'All') {
                    buildingQuery = buildingQuery.eq('branch_id', selectedBranchId);
                }

                const { data: bData } = await buildingQuery;
                setBuildings(bData || []);

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
    // Filter Logic - Case Insensitive Mapping
    const filteredMaintenance = maintenanceList.filter(item => {
        // 1. Status Filter
        if (filterMaint !== 'All') {
            const s = item.status_technician?.toLowerCase() || '';
            if (s !== filterMaint.toLowerCase()) return false;
        }

        // 2. Building Filter
        if (filterBuilding !== 'All') {
            // @ts-ignore
            const bId = item.room?.building?.id;
            if (bId && String(bId) !== String(filterBuilding)) return false;
        }

        // 3. Date Range Filter
        if (startDate) {
            const d = new Date(item.requested_at).getTime();
            const start = new Date(startDate).getTime();
            if (d < start) return false;
        }
        if (endDate) {
            const d = new Date(item.requested_at).getTime();
            // Set end date to end of day
            const e = new Date(endDate); e.setHours(23, 59, 59, 999);
            if (d > e.getTime()) return false;
        }

        // 4. Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            const room = item.room?.room_number.toLowerCase() || '';
            const desc = item.issue_description?.toLowerCase() || '';
            return room.includes(lower) || desc.includes(lower);
        }

        return true;
    }).sort((a, b) => {
        if (sortBy === 'room') {
            return (a.room?.room_number || '').localeCompare(b.room?.room_number || '');
        }
        const dateA = new Date(a.requested_at || 0).getTime();
        const dateB = new Date(b.requested_at || 0).getTime();
        return sortBy === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    const filteredPayment = paymentList.filter(item => {
        // 1. Status Filter
        if (filterPayment !== 'All') {
            const s = item.status?.toLowerCase() || '';
            if (s !== filterPayment.toLowerCase()) return false;
        }

        // Building Filter
        if (filterBuilding !== 'All') {
            // @ts-ignore
            const bId = item.contract?.room?.building?.id;
            if (bId && String(bId) !== String(filterBuilding)) return false;
        }

        // 2. Date Range Filter (Bill Date)
        if (startDate) {
            const d = new Date(item.bill_date).getTime();
            const start = new Date(startDate).getTime();
            if (d < start) return false;
        }
        if (endDate) {
            const d = new Date(item.bill_date).getTime();
            const end = new Date(endDate); end.setHours(23, 59, 59, 999);
            if (d > end.getTime()) return false;
        }

        // 3. Amount Range Filter
        if (minAmount !== '' && item.room_total_cost < Number(minAmount)) return false;
        if (maxAmount !== '' && item.room_total_cost > Number(maxAmount)) return false;

        // 4. Overdue Days Filter
        if (overdueDays !== '' && Number(overdueDays) > 0) {
            const dueDate = item.due_date ? new Date(item.due_date) : null;
            if (!dueDate) return false;

            const now = new Date();
            const diffTime = now.getTime() - dueDate.getTime(); // Positive if overdue
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const isPastDue = now > dueDate;
            const isUnpaid = item.status !== 'Paid' && item.status !== 'paid';

            if (!isPastDue || !isUnpaid || diffDays <= Number(overdueDays)) return false;
        }

        // 5. Search Filter (Room or Name)
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            const room = item.contract?.room?.room_number.toLowerCase() || '';
            const name = item.contract?.user?.full_name.toLowerCase() || '';
            return room.includes(lower) || name.includes(lower);
        }

        return true;
    }).sort((a, b) => {
        if (sortBy === 'room') {
            return (a.contract?.room?.room_number || '').localeCompare(b.contract?.room?.room_number || '');
        }
        const dateA = new Date(a.bill_date || 0).getTime();
        const dateB = new Date(b.bill_date || 0).getTime();
        return sortBy === 'oldest' ? dateA - dateB : dateB - dateA;
    });

    const filteredTenant = tenantList.filter(item => {
        // Building Filter
        if (filterBuilding !== 'All') {
            // @ts-ignore
            const bId = item.room?.building?.id;
            if (bId && String(bId) !== String(filterBuilding)) return false;
        }

        // 1. Gender Filter
        if (filterGender === 'All') { } // NOOP
        else {
            const s = item.user?.sex?.toLowerCase() || '';
            const f = filterGender.toLowerCase();

            if (f !== 'all' && s !== f && !((f === 'male' && s === 'ชาย') || (f === 'female' && s === 'หญิง'))) {
                if (f === 'lgbtq+' || f === 'lgbtq') {
                    if (s !== 'lgbtq+') return false;
                } else {
                    return false;
                }
            }
        }

        // 2. Expiry Days Filter (Contracts ending soon)
        if (expiringDays !== '' && Number(expiringDays) > 0) {
            if (!item.move_out) return false;
            const moveOut = new Date(item.move_out);
            const now = new Date();
            const diffTime = moveOut.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Show only if expires naturally within X days (positive diff)
            if (diffDays < 0 || diffDays > Number(expiringDays)) return false;
        }

        // 3. Search Filter (Room or Name)
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            const room = item.room?.room_number.toLowerCase() || '';
            const name = item.user?.full_name.toLowerCase() || '';
            return room.includes(lower) || name.includes(lower);
        }

        return true;
    }).sort((a, b) => {
        if (sortBy === 'room') {
            return (a.room?.room_number || '').localeCompare(b.room?.room_number || '');
        }
        // Contracts typically sorted by ID or Start Date. Using created_at or ID if available, else 0
        // fallback to ID for 'newest'
        return sortBy === 'oldest' ? a.id - b.id : b.id - a.id;
    });

    if (loading) return <div className="p-8 text-center">Loading Dashboard...</div>;

    return (
        <div className="flex flex-col h-full font-roboto gap-6 relative">

            {/* Header with Filter Button */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm z-10">
                <h1 className="text-2xl font-bold text-[#0047AB]">Dashboard Overview</h1>

                <button
                    onClick={() => setIsFilterOpen(true)}
                    className="flex items-center gap-2 bg-[#0047AB] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-[#003380] transition-colors"
                >
                    <SlidersHorizontal size={18} />
                    <span>Filter & Sort</span>
                </button>
            </div>

            {/* Filter Modal */}
            {isFilterOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-[#0047AB] p-6 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                            <h2 className="text-xl font-bold z-10">Filter & Sort Options</h2>
                            <button
                                onClick={() => setIsFilterOpen(false)}
                                className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors z-10"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6">

                            {/* Search Input */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Search Keyword</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Name, Room Number..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 text-black font-medium rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0047AB] focus:bg-white transition-all"
                                    />
                                    <Search className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                </div>
                            </div>

                            {/* Sort By */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Sort By</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['newest', 'oldest', 'room'].map((option) => (
                                        <button
                                            key={option}
                                            onClick={() => setSortBy(option)}
                                            className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${sortBy === option
                                                ? 'bg-[#0047AB] text-white border-[#0047AB] shadow-md'
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            {option === 'newest' ? 'Newest' : option === 'oldest' ? 'Oldest' : 'Room No.'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Building Filter */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Building</label>
                                <div className="relative">
                                    <select
                                        value={filterBuilding}
                                        onChange={(e) => setFilterBuilding(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 text-black font-medium rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0047AB] appearance-none"
                                    >
                                        <option value="All">All Buildings</option>
                                        {buildings.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name_building}</option>
                                        ))}
                                    </select>
                                    <Building className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                                </div>
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 text-black rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0047AB]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 text-black rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#0047AB]"
                                    />
                                </div>
                            </div>

                            {/* Amount & Expiry (Grid) */}
                            <div className="space-y-4 pt-4 border-t border-gray-100">
                                {/* Amount Range (Payment Only) */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block ml-1">Amount Range (Payment)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number" placeholder="Min"
                                            value={minAmount} onChange={(e) => setMinAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-1/2 px-3 py-2 bg-white text-black border border-gray-200 rounded-lg text-sm"
                                        />
                                        <input
                                            type="number" placeholder="Max"
                                            value={maxAmount} onChange={(e) => setMaxAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-1/2 px-3 py-2 bg-white text-black border border-gray-200 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Special Filters */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Overdue */}
                                    <div>
                                        <label className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2 block">Overdue &gt; (Days)</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={overdueDays}
                                            onChange={(e) => setOverdueDays(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-red-600 font-bold"
                                        />
                                    </div>

                                    {/* Expiry */}
                                    <div>
                                        <label className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-2 block">Expires in &lt; (Days)</label>
                                        <input
                                            type="number"
                                            placeholder="30"
                                            value={expiringDays}
                                            onChange={(e) => setExpiringDays(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full px-3 py-2 bg-orange-50 border border-orange-100 rounded-lg text-orange-600 font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setIsFilterOpen(false)}
                                className="bg-[#0047AB] text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-[#003380] transition-transform hover:scale-105"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full overflow-hidden z-10">

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
                            <div
                                key={item.id}
                                onClick={() => setSelectedPayment(item)}
                                className="bg-white text-black rounded-full px-4 py-2 flex items-center justify-between text-sm shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5"
                            >
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

            {/* Payment Details Modal */}
            {selectedPayment && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-[#0047AB] p-6 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                            <div>
                                <h2 className="text-xl font-bold z-10 relative">Invoice Details</h2>
                                <p className="text-blue-200 text-sm z-10 relative truncate max-w-[250px]">
                                    {selectedPayment.contract?.user?.full_name}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedPayment(null)}
                                className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors z-10"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Room</p>
                                    <p className="text-xl font-bold text-[#0047AB] flex items-center gap-2">
                                        <Building size={20} />
                                        {selectedPayment.contract?.room?.building?.branch?.branches_name} - {selectedPayment.contract?.room?.building?.name_building} - {selectedPayment.contract?.room?.room_number}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500 font-medium">Status</p>
                                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold border ${getPaymentBadge(selectedPayment.status)}`}>
                                        {selectedPayment.status.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <div className="py-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-600 flex items-center gap-2">
                                        <Calendar size={16} className="text-gray-400" /> Bill Date:
                                    </span>
                                    <span className="font-medium text-gray-800">
                                        {new Date(selectedPayment.bill_date).toLocaleDateString('en-GB')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600 flex items-center gap-2">
                                        <Calendar size={16} className="text-gray-400" /> Due Date:
                                    </span>
                                    <span className={`font-bold ${selectedPayment.status !== 'Paid' && selectedPayment.due_date && new Date(selectedPayment.due_date) < new Date() ? 'text-red-500' : 'text-gray-800'}`}>
                                        {selectedPayment.due_date ? new Date(selectedPayment.due_date).toLocaleDateString('en-GB') : '-'}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center mt-4">
                                <span className="text-gray-700 font-medium">Total Amount</span>
                                <span className="text-2xl font-bold text-[#0047AB]">฿{selectedPayment.room_total_cost.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setSelectedPayment(null)}
                                className="flex-1 bg-white text-gray-700 px-4 py-2.5 rounded-xl font-bold border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedPayment(null);
                                    router.push(`/manager/invoices/${selectedPayment.id}/verify`);
                                }}
                                className="flex-1 bg-[#0047AB] text-white px-4 py-2.5 rounded-xl font-bold shadow-md hover:bg-[#003380] transition-colors flex items-center justify-center gap-2"
                            >
                                <span>Take Action</span>
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
