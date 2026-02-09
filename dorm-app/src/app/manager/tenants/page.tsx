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
    payment_status: string; // [NEW]
    deposit: number;
    electricity: number;
    water: number;
    rent: number;
    repair: number;
    invoice_id: number; // [NEW]
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
    const [paymentFilter, setPaymentFilter] = useState('All'); // [NEW]
    const [searchTerm, setSearchTerm] = useState('');

    // Dropdown Options (Computed from data)
    const [roomOptions, setRoomOptions] = useState<string[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);

                // 1. Fetch Active Contracts with Room and User
                const { data: contracts, error: contractError } = await supabase
                    .from('contract')
                    .select('*, room:room_id(room_number), user:user_id(full_name, sex)')
                    .order('id', { ascending: true });

                if (contractError) throw contractError;

                // 2. Fetch Latest Invoices
                const { data: invoices } = await supabase
                    .from('invoice')
                    .select('*')
                    .order('id', { ascending: false });

                // 3. Fetch Latest Maintenance
                const { data: maintenance } = await supabase
                    .from('maintenance_request')
                    .select('*')
                    .order('requested_at', { ascending: false });

                // Extended type for Join
                interface ContractWithDetails extends Contract {
                    room: { room_number: string };
                    user: { full_name: string; sex: string };
                }

                const rows: TenantRowData[] = ((contracts as unknown as ContractWithDetails[]) || []).map((c) => {
                    // Find latest invoice for this contract
                    const latestInvoice = (invoices as Invoice[])?.find(inv => inv.contract_id === c.id);

                    // Find latest active maintenance for this room
                    const latestMaint = (maintenance as MaintenanceRequest[])?.find(m => m.room_id === c.room_id && m.status_technician !== 'Completed');

                    return {
                        id: c.id,
                        room_number: c.room?.room_number || 'N/A',
                        gender: c.user?.sex === 'Male' || c.user?.sex === 'ชาย' ? 'M' : (c.user?.sex === 'Female' || c.user?.sex === 'หญิง' ? 'F' : '-'),
                        name: c.user?.full_name || 'Unknown',
                        move_in: c.move_in ? new Date(c.move_in).toLocaleDateString('th-TH') : '-',
                        move_out: c.move_out ? new Date(c.move_out).toLocaleDateString('th-TH') : '-',
                        maintenance_status: latestMaint?.status_technician || '-',
                        payment_status: latestInvoice?.status || '-', // [NEW]
                        deposit: latestInvoice?.room_deposit_cost || 0,
                        electricity: latestInvoice?.room_elec_cost || 0,
                        water: latestInvoice?.room_water_cost || 0,
                        rent: c.rent_price || 0,
                        repair: latestInvoice?.room_repair_cost || 0,
                        invoice_id: latestInvoice?.id || 0, // [NEW]
                        invoice_total: latestInvoice?.room_total_cost || 0,
                        due_date: latestInvoice?.due_date ? new Date(latestInvoice.due_date).toLocaleDateString('th-TH') : '-',
                    };
                });

                setData(rows);
                console.log('Tenant Data Debug:', rows); // [DEBUG]
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
        if (genderFilter !== 'All') {
            res = res.filter(r => {
                if (genderFilter === 'Male') return r.gender === 'M';
                if (genderFilter === 'Female') return r.gender === 'F';
                return true;
            });
        }
        if (maintFilter !== 'All') {
            if (maintFilter === '-') {
                res = res.filter(r => r.maintenance_status === '-' || !r.maintenance_status);
            } else {
                res = res.filter(r => r.maintenance_status === maintFilter);
            }
        }
        // [NEW] Payment Filter Logic
        if (paymentFilter !== 'All') {
            if (paymentFilter === '-') {
                res = res.filter(r => r.payment_status === '-' || !r.payment_status);
            } else {
                res = res.filter(r => r.payment_status === paymentFilter);
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
        if (status.includes('เปลี่ยน') || status === 'Pending') return 'text-yellow-400';
        if (status.includes('กำลัง') || status === 'In Progress') return 'text-orange-400';
        if (status.includes('สำเร็จ') || status === 'Completed') return 'text-green-400';
        return 'text-gray-400';
    };

    // Helper for Due Date Color based on Payment Status
    const getDueDateColor = (status: string) => {
        const s = status.toLowerCase();
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
                                <option value="In Progress">In Progress</option>
                            </select>
                        </div>

                        {/* [NEW] Payment Filter */}
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
                                    <td className="py-4 px-2">{row.rent.toLocaleString()}</td>
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
