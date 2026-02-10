'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Invoice, MaintenanceRequest, Contract } from '@/types/database';
import { Search } from 'lucide-react';
import Link from 'next/link';

interface TenantRowData {
    id: number;
    room_number: string;
    gender: string;
    name: string;
    move_in: string;
    move_out: string;
    maintenance_status: string;
    payment_status: string;
    deposit: number;
    electricity: number;
    water: number;
    rent: number | string; // Changed to allow '-'
    repair: number;
    invoice_id: number;
    invoice_total: number;
    due_date: string;
}

export default function ManageTenantsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<TenantRowData[]>([]);
    const [filteredData, setFilteredData] = useState<TenantRowData[]>([]);

    // Filters
    const [roomFilter, setRoomFilter] = useState('All');
    const [genderFilter, setGenderFilter] = useState('All');
    const [maintFilter, setMaintFilter] = useState('All');
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    // Dropdown Options (Computed from data)
    const [roomOptions, setRoomOptions] = useState<string[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);

                // 0. Get current manager's branch
                const storedName = localStorage.getItem('user_name') || 'Somsak Rakthai';
                const { data: branchData, error: branchError } = await supabase
                    .from('branch')
                    .select('id')
                    .eq('manager_name', storedName)
                    .single();

                if (branchError || !branchData) {
                    console.error('Branch not found for manager:', storedName);
                    setLoading(false);
                    return;
                }

                const branchId = branchData.id;

                // 1. Fetch Active Contracts with Room and User (Filtered by Branch)
                const { data: contracts, error: contractError } = await supabase
                    .from('contract')
                    .select('*, room:room_id!inner(room_number, rent_price, building:building_id!inner(branch_id)), user:user_id(full_name, sex, is_primary_tenant)')
                    .eq('room.building.branch_id', branchId)
                    .order('id', { ascending: true });

                if (contractError) throw contractError;

                // 2. Fetch Latest Invoices (Filtered by Branch)
                const { data: invoices } = await supabase
                    .from('invoice')
                    .select('*, contract:contract_id!inner(room:room_id!inner(building:building_id!inner(branch_id)))')
                    .eq('contract.room.building.branch_id', branchId)
                    .order('id', { ascending: false });

                // 3. Fetch Latest Maintenance (Filtered by Branch)
                const { data: maintenance } = await supabase
                    .from('maintenance_request')
                    .select('*, room:room_id!inner(building:building_id!inner(branch_id))')
                    .eq('room.building.branch_id', branchId)
                    .order('requested_at', { ascending: false });

                // Extended type for Join
                interface ContractWithDetails extends Contract {
                    room: { room_number: string; rent_price: number };
                    user: { full_name: string; sex: string; is_primary_tenant: boolean | string };
                }

                const rows: TenantRowData[] = ((contracts as unknown as ContractWithDetails[]) || []).map((c) => {
                    // Find latest invoice for this contract
                    const latestInvoice = (invoices as Invoice[])?.find(inv => inv.contract_id === c.id);

                    // Find latest active maintenance for this room
                    const latestMaint = (maintenance as MaintenanceRequest[])?.find(m => m.room_id === c.room_id && m.status_technician !== 'Completed' && m.status_technician !== 'Done' && m.status_technician !== 'done');

                    // Helper to capitalize first letter
                    const maximize = (s: string | undefined) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '-';

                    // Rent visibility logic: Only show if status is 'complete' AND is primary tenant
                    const isPrimary = c.user?.is_primary_tenant === true || c.user?.is_primary_tenant === 'TRUE' || c.user?.is_primary_tenant === 'true';
                    const showRent = c.status === 'complete' && isPrimary;

                    return {
                        id: c.id,
                        room_number: c.room?.room_number || 'N/A',
                        gender: c.user?.sex || '-',
                        name: c.user?.full_name || 'Unknown',
                        move_in: c.move_in ? new Date(c.move_in).toLocaleDateString('th-TH') : '-',
                        move_out: c.move_out ? new Date(c.move_out).toLocaleDateString('th-TH') : '-',
                        maintenance_status: maximize(latestMaint?.status_technician),
                        payment_status: maximize(latestInvoice?.status),
                        deposit: latestInvoice?.room_deposit_cost || 0,
                        electricity: latestInvoice?.room_elec_cost || 0,
                        water: latestInvoice?.room_water_cost || 0,
                        rent: showRent ? (c.room?.rent_price || 0) : '-', // Hide if not complete
                        repair: latestInvoice?.room_repair_cost || 0,
                        invoice_id: latestInvoice?.id || 0,
                        invoice_total: latestInvoice?.room_total_cost || 0,
                        due_date: latestInvoice?.due_date ? new Date(latestInvoice.due_date).toLocaleDateString('th-TH') : '-',
                    };
                });

                setData(rows);
                console.log('Tenant Data Debug:', rows);
                setFilteredData(rows);

                // Extract unique room numbers for filter
                const rooms = Array.from(new Set(rows.map(r => r.room_number))).sort();
                setRoomOptions(rooms);

            } catch (error) {
                console.error('Error fetching tenant table data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    // Filter Logic
    useEffect(() => {
        let res = data;

        if (roomFilter !== 'All') {
            res = res.filter(r => r.room_number === roomFilter);
        }

        // Case-Insensitive Gender Filter
        if (genderFilter !== 'All') {
            const filter = genderFilter.toLowerCase();
            res = res.filter(r => {
                const g = r.gender?.toLowerCase() || '';
                if (filter === 'male') return g === 'male' || g === 'ชาย';
                if (filter === 'female') return g === 'female' || g === 'หญิง';
                if (filter === 'lgbtq+') return g === 'lgbtq+' || g === 'lgbtq';
                return g.includes(filter);
            });
        }

        // Case-Insensitive Maintenance Filter
        if (maintFilter !== 'All') {
            if (maintFilter === '-') {
                res = res.filter(r => r.maintenance_status === '-' || !r.maintenance_status);
            } else {
                res = res.filter(r => r.maintenance_status?.toLowerCase() === maintFilter.toLowerCase());
            }
        }

        // Case-Insensitive Payment Filter
        if (paymentFilter !== 'All') {
            if (paymentFilter === '-') {
                res = res.filter(r => r.payment_status === '-' || !r.payment_status);
            } else {
                res = res.filter(r => r.payment_status?.toLowerCase() === paymentFilter.toLowerCase());
            }
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            res = res.filter(r =>
                r.name.toLowerCase().includes(lower) ||
                r.room_number.includes(lower)
            );
        }

        setFilteredData(res);
    }, [data, roomFilter, genderFilter, maintFilter, paymentFilter, searchTerm]);

    // Helper for Maintenance Color
    const getMaintColor = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'pending') return 'text-yellow-400';
        if (s === 'repairing' || s === 'in progress') return 'text-orange-400';
        if (s === 'done' || s === 'completed') return 'text-green-400';
        return 'text-gray-400';
    };

    // Helper for Due Date Color based on Payment Status
    const getDueDateColor = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'paid') return 'text-green-400';
        if (s === 'unpaid') return 'text-yellow-400';
        if (s === 'overdue') return 'text-red-500';
        if (s === 'pending') return 'text-white';
        return 'text-white'; // Default
    };

    if (loading) return <div className="p-8 text-center text-white">Loading Tenants...</div>;

    return (
        <div className="h-full flex flex-col p-4 relative">
            <div className="bg-[#0047AB] rounded-3xl p-8 text-white flex flex-col shadow-xl flex-1 min-h-[600px]">

                {/* Header & Filters */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <h1 className="text-3xl font-bold">Manage Tenant</h1>

                    <div className="flex flex-wrap gap-4 items-end">
                        {/* Room Filter */}
                        <div className="flex flex-col">
                            <label className="text-xs mb-1 ml-1">Room:</label>
                            <select
                                className="bg-white text-black text-sm rounded px-3 py-1.5 focus:outline-none min-w-[80px]"
                                value={roomFilter}
                                onChange={(e) => setRoomFilter(e.target.value)}
                            >
                                <option value="All">All</option>
                                {roomOptions.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        {/* Gender Filter */}
                        <div className="flex flex-col">
                            <label className="text-xs mb-1 ml-1">Gender :</label>
                            <select
                                className="bg-white text-black text-sm rounded px-3 py-1.5 focus:outline-none min-w-[80px]"
                                value={genderFilter}
                                onChange={(e) => setGenderFilter(e.target.value)}
                            >
                                <option value="All">All</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="LGBTQ+">LGBTQ+</option>
                            </select>
                        </div>

                        {/* Maintenance Filter */}
                        <div className="flex flex-col">
                            <label className="text-xs mb-1 ml-1">Maintenance status</label>
                            <select
                                className="bg-white text-black text-sm rounded px-3 py-1.5 focus:outline-none min-w-[120px]"
                                value={maintFilter}
                                onChange={(e) => setMaintFilter(e.target.value)}
                            >
                                <option value="All">All</option>
                                <option value="-">None (-)</option>
                                <option value="Pending">Pending</option>
                                <option value="Repairing">Repairing</option>
                                <option value="Done">Done</option>
                            </select>
                        </div>

                        {/* Payment Filter */}
                        <div className="flex flex-col">
                            <label className="text-xs mb-1 ml-1">Payment status</label>
                            <select
                                className="bg-white text-black text-sm rounded px-3 py-1.5 focus:outline-none min-w-[120px]"
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                            >
                                <option value="All">All</option>
                                <option value="-">None (-)</option>
                                <option value="Paid">Paid</option>
                                <option value="Unpaid">Unpaid</option>
                                <option value="Pending">Pending</option>
                                <option value="Overdue">Overdue</option>
                            </select>
                        </div>

                        {/* Search */}
                        <div className="flex flex-col">
                            <label className="text-xs mb-1 ml-1">Search :</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search"
                                    className="bg-white text-black text-sm rounded px-3 py-1.5 pl-8 focus:outline-none w-40"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <Search className="absolute left-2 top-1.5 text-gray-500" size={14} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                        <thead>
                            <tr className="border-b border-white/30 text-sm font-medium">
                                <th className="py-3 px-2 font-normal">Room</th>
                                <th className="py-3 px-2 font-normal">Gender</th>
                                <th className="py-3 px-2 font-normal text-left pl-4">Name</th>
                                <th className="py-3 px-2 font-normal">Move in</th>
                                <th className="py-3 px-2 font-normal">Move out</th>
                                <th className="py-3 px-2 font-normal">Maintenance</th>
                                <th className="py-3 px-2 font-normal">Deposit</th>
                                <th className="py-3 px-2 font-normal">Electricity</th>
                                <th className="py-3 px-2 font-normal">Water</th>
                                <th className="py-3 px-2 font-normal">Rent</th>
                                <th className="py-3 px-2 font-normal">Repair</th>
                                <th className="py-3 px-2 font-normal">Invoice</th>
                                <th className="py-3 px-2 font-normal">Due Date</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {filteredData.map((row) => (
                                <tr key={row.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-2">{row.room_number}</td>
                                    <td className="py-4 px-2">{row.gender}</td>
                                    <td className="py-4 px-2 text-left pl-4">{row.name}</td>
                                    <td className="py-4 px-2 text-gray-200 text-xs">{row.move_in}</td>
                                    <td className="py-4 px-2 text-gray-200 text-xs">{row.move_out}</td>
                                    <td className={`py-4 px-2 font-bold ${getMaintColor(row.maintenance_status)}`}>
                                        {row.maintenance_status}
                                    </td>
                                    <td className="py-4 px-2">{row.deposit === 0 ? '-' : row.deposit.toLocaleString()}</td>
                                    <td className="py-4 px-2">{row.electricity === 0 ? '-' : row.electricity.toLocaleString()}</td>
                                    <td className="py-4 px-2">{row.water === 0 ? '-' : row.water.toLocaleString()}</td>
                                    <td className="py-4 px-2">{typeof row.rent === 'number' ? row.rent.toLocaleString() : row.rent}</td>
                                    <td className="py-4 px-2">{row.repair === 0 ? '-' : row.repair.toLocaleString()}</td>
                                    <td className="py-4 px-2 font-bold">{row.invoice_total === 0 ? '-' : row.invoice_total.toLocaleString()}</td>
                                    <td className={`py-4 px-2 font-bold ${getDueDateColor(row.payment_status)}`}>
                                        {row.payment_status?.toLowerCase() === 'pending' ? (
                                            <Link href={`/manager/invoices/${row.invoice_id}/verify`} className="hover:underline cursor-pointer block w-full h-full">
                                                {row.due_date}
                                            </Link>
                                        ) : (
                                            row.due_date
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={13} className="py-8 text-center opacity-50">No tenants data found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Show More */}
                <div className="mt-6 text-center text-xs font-bold tracking-widest cursor-pointer hover:opacity-80">
                    SHOW MORE
                </div>

                {/* Floating Make Contract Button */}
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                    <Link href="/contracts/create">
                        <button className="bg-[#00C853] hover:bg-[#009624] text-white font-bold py-3 px-8 rounded-full shadow-lg flex items-center gap-2 transition-transform hover:scale-105">
                            {/* Icon optional, design doesn't show one explicitly but usually good */}
                            make a contract
                        </button>
                    </Link>
                </div>

            </div>
        </div>
    );
}
