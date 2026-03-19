'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Invoice, MaintenanceRequest, Contract } from '@/types/database';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useManager } from '../ManagerContext';

interface TenantRowData {
    id: number;
    room_number: string;
    gender: string;
    name: string;
    score: number;
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
    const { selectedBranchId } = useManager();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<TenantRowData[]>([]);
    const [filteredData, setFilteredData] = useState<TenantRowData[]>([]);

    // Filters
    // Branch Filter comes from Context now
    const [buildingFilter, setBuildingFilter] = useState('All');

    // Check if user is Admin to show all branches
    const [isAdmin, setIsAdmin] = useState(false);

    // Options
    const [buildingOptions, setBuildingOptions] = useState<{ id: number, name: string, elec_meter: number, water_meter: number, water_config_type: 'unit' | 'fixed', water_fixed_price: number | null }[]>([]);

    // ... existing filters ...
    const [roomFilter, setRoomFilter] = useState('All');
    const [genderFilter, setGenderFilter] = useState('All');
    const [maintFilter, setMaintFilter] = useState('All');
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    const [roomOptions, setRoomOptions] = useState<string[]>([]);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);

                // Fetch All Data (No branch restriction initially, unless we want to default to user's branch)

                // 1. Fetch Active Contracts with Room and User (Filtered by Branch)
                const { data: contracts, error: contractError } = await supabase
                    .from('contract')
                    .select('*, room:room_id!inner(room_number, building_id, rent_price, building:building_id!inner(branch_id, name_building)), user:user_id(full_name, sex, is_primary_tenant, tenant_score)')
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
                    room: {
                        room_number: string;
                        rent_price: number;
                        building_id: number;
                        building: { branch_id: number; name_building: string; }
                    };
                    user: { full_name: string; sex: string; is_primary_tenant: boolean | string; tenant_score: number | null };
                }

                const rows: TenantRowData[] = ((contracts as unknown as ContractWithDetails[]) || []).map((c) => {
                    // Find latest invoice for this contract
                    const latestInvoice = (invoices as Invoice[])?.find(inv => inv.contract_id === c.id);

                    // Find latest active maintenance for this room
                    const latestMaint = (maintenance as MaintenanceRequest[])?.find(m => m.room_id === c.room_id && m.status_technician !== 'Completed' && m.status_technician !== 'Done' && m.status_technician !== 'done');

                    // Helper to capitalize first letter
                    const maximize = (s: string | undefined) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '-';

                    // Rent visibility logic
                    // If invoice exists, use invoice rent cost. If not, show '-' (no bill yet)
                    // The user wants to see what's in the BILL.
                    const rentToShow = latestInvoice ? (latestInvoice.type === 'entry_fee' ? 0 : latestInvoice.room_rent_cost) : '-';

                    return {
                        id: c.id,
                        room_number: c.room?.room_number || 'N/A',
                        gender: c.user?.sex || '-',
                        name: c.user?.full_name || 'Unknown',
                        score: c.user?.tenant_score ?? 100,
                        move_in: c.move_in ? new Date(c.move_in).toLocaleDateString('th-TH') : '-',
                        move_out: c.move_out ? new Date(c.move_out).toLocaleDateString('th-TH') : '-',
                        maintenance_status: maximize(latestMaint?.status_technician),
                        payment_status: maximize(latestInvoice?.status),
                        deposit: latestInvoice?.room_deposit_cost || 0,
                        electricity: latestInvoice?.room_elec_cost || 0,
                        water: latestInvoice?.room_water_cost || 0,
                        rent: rentToShow,
                        repair: latestInvoice?.room_repair_cost || 0,
                        invoice_id: latestInvoice?.id || 0,
                        invoice_total: latestInvoice?.room_total_cost || 0,
                        due_date: latestInvoice?.due_date ? new Date(latestInvoice.due_date).toLocaleDateString('th-TH') : '-',

                        // Hidden data for filtering
                        branch_id: c.room?.building?.branch_id,
                        building_id: c.room?.building_id,
                        building_name: c.room?.building?.name_building
                    } as TenantRowData & { branch_id: number, building_id: number, building_name: string };
                });

                setData(rows);

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

    // Building Settings Modal State
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [selectedBuildingForSettings, setSelectedBuildingForSettings] = useState<{ id: number, name: string, elec_meter: number, water_meter: number, water_config_type: 'unit' | 'fixed', water_fixed_price: number | null } | null>(null);
    const [elecRateInput, setElecRateInput] = useState('');
    const [waterConfigTypeInput, setWaterConfigTypeInput] = useState<'unit' | 'fixed'>('unit');
    const [waterRateInput, setWaterRateInput] = useState('');
    const [waterFixedPriceInput, setWaterFixedPriceInput] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);

    // Fetch Buildings when Branch changes
    useEffect(() => {
        async function fetchBuildings() {
            let query = supabase
                .from('building')
                .select('id, name_building, elec_meter, water_meter, water_config_type, water_fixed_price')
                .order('name_building');

            if (selectedBranchId !== 'All') {
                query = query.eq('branch_id', Number(selectedBranchId));
            }

            const { data } = await query;

            if (data) {
                setBuildingOptions(data.map(b => ({
                    id: b.id,
                    name: b.name_building,
                    elec_meter: b.elec_meter,
                    water_meter: b.water_meter,
                    water_config_type: b.water_config_type as 'unit' | 'fixed' || 'unit',
                    water_fixed_price: b.water_fixed_price
                })));
            }
            setBuildingFilter('All');
        }

        fetchBuildings();
    }, [selectedBranchId]);

    // Handle Open Settings Modal
    const handleOpenSettings = () => {
        if (buildingFilter === 'All') {
            alert('Please select a specific building to configure its rates.');
            return;
        }

        const b = buildingOptions.find(opt => opt.id === Number(buildingFilter));
        if (b) {
            setSelectedBuildingForSettings(b);
            setElecRateInput(b.elec_meter?.toString() || '0');
            setWaterConfigTypeInput(b.water_config_type || 'unit');
            setWaterRateInput(b.water_meter?.toString() || '0');
            setWaterFixedPriceInput(b.water_fixed_price?.toString() || '0');
            setIsSettingsModalOpen(true);
        }
    };

    // Handle Save Settings
    const handleSaveSettings = async () => {
        if (!selectedBuildingForSettings) return;

        setSavingSettings(true);
        try {
            const updatePayload = {
                elec_meter: parseFloat(elecRateInput) || 0,
                water_config_type: waterConfigTypeInput,
                water_meter: parseFloat(waterRateInput) || 0,
                water_fixed_price: waterConfigTypeInput === 'fixed' ? (parseFloat(waterFixedPriceInput) || 0) : null
            };

            const { error } = await supabase
                .from('building')
                .update(updatePayload)
                .eq('id', selectedBuildingForSettings.id);

            if (error) throw error;

            alert('Rates updated successfully!');
            setIsSettingsModalOpen(false);

            // Update local state to reflect UI change
            setBuildingOptions(prev => prev.map(b =>
                b.id === selectedBuildingForSettings.id
                    ? { ...b, ...updatePayload, water_config_type: updatePayload.water_config_type as 'unit' | 'fixed' }
                    : b
            ));
        } catch (error) {
            console.error('Error saving building settings:', error);
            alert('Failed to save settings.');
        } finally {
            setSavingSettings(false);
        }
    };

    // Filter Logic
    useEffect(() => {
        let res = data as (TenantRowData & { branch_id: number; building_id: number; building_name: string })[];

        // Branch Filter
        if (selectedBranchId !== 'All') {
            res = res.filter(r => r.branch_id === Number(selectedBranchId));
        }

        // Building Filter
        if (buildingFilter !== 'All') {
            res = res.filter(r => r.building_id === parseInt(buildingFilter));
        }
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
    }, [data, selectedBranchId, buildingFilter, roomFilter, genderFilter, maintFilter, paymentFilter, searchTerm]);

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
                        {/* Branch Filter Removed (Now in Sidebar) */}

                        {/* Building Filter + Configure Rates Button */}
                        <div className="flex flex-col">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs ml-1">Building:</label>
                                {buildingFilter !== 'All' && (
                                    <button
                                        onClick={handleOpenSettings}
                                        className="text-[10px] text-blue-200 hover:text-white underline px-1"
                                    >
                                        Configure Rates
                                    </button>
                                )}
                            </div>
                            <select
                                className="bg-white text-black text-sm rounded px-3 py-1.5 focus:outline-none min-w-[100px]"
                                value={buildingFilter}
                                onChange={(e) => setBuildingFilter(e.target.value)}
                            >
                                <option value="All">All</option>
                                {buildingOptions.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

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
                                <th className="py-3 px-2 font-normal">Score</th>
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
                                    <td className="py-4 px-2">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${row.score >= 90 ? 'bg-green-500/20 text-green-400' : row.score >= 50 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {row.score}
                                        </span>
                                    </td>
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
                </div >

                {/* Floating Make Contract Button */}
                < div className="absolute bottom-8 left-1/2 transform -translate-x-1/2" >
                    <Link href="/contracts/create">
                        <button className="bg-[#00C853] hover:bg-[#009624] text-white font-bold py-3 px-8 rounded-full shadow-lg flex items-center gap-2 transition-transform hover:scale-105">
                            {/* Icon optional, design doesn't show one explicitly but usually good */}
                            make a contract
                        </button>
                    </Link>
                </div >

            </div >

            {/* Building Rates Settings Modal */}
            {isSettingsModalOpen && selectedBuildingForSettings && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1A365D] text-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-white/10">
                        <h2 className="text-xl font-bold mb-4">Utility Rates Settings</h2>
                        <p className="text-sm text-gray-300 mb-6">Configure rates for: <span className="font-bold text-white">{selectedBuildingForSettings.name}</span></p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm mb-1 font-medium">Electricity Rate (THB / Unit)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                                    value={elecRateInput}
                                    onChange={e => setElecRateInput(e.target.value)}
                                />
                            </div>
                            <div className="border-t border-white/20 pt-4 mt-4">
                                <label className="block text-sm mb-2 font-medium">Water Billing Method</label>
                                <div className="flex bg-blue-400 rounded-lg p-1 w-full mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setWaterConfigTypeInput('unit')}
                                        className={`flex-1 text-xs px-2 py-1.5 rounded-md transition-all ${waterConfigTypeInput === 'unit' ? 'bg-white text-[#0047AB] font-bold' : 'text-white/70 hover:text-white'}`}
                                    >
                                        Per Unit (Default)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWaterConfigTypeInput('fixed')}
                                        className={`flex-1 text-xs px-2 py-1.5 rounded-md transition-all ${waterConfigTypeInput === 'fixed' ? 'bg-white text-[#0047AB] font-bold' : 'text-white/70 hover:text-white'}`}
                                    >
                                        Fixed Monthly Price
                                    </button>
                                </div>

                                {waterConfigTypeInput === 'unit' ? (
                                    <div>
                                        <label className="block text-sm mb-1 font-medium">Water Rate (THB / Unit)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                                            value={waterRateInput}
                                            onChange={e => setWaterRateInput(e.target.value)}
                                        />
                                        <p className="text-xs text-blue-200 mt-1">Contracts can still override this.</p>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm mb-1 font-medium">Water Fixed Price (THB / Month)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                                            value={waterFixedPriceInput}
                                            onChange={e => setWaterFixedPriceInput(e.target.value)}
                                        />
                                        <p className="text-xs text-blue-200 mt-1">This price applies regardless of usage.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setIsSettingsModalOpen(false)}
                                className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveSettings}
                                disabled={savingSettings}
                                className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 transition-colors font-medium disabled:opacity-50"
                            >
                                {savingSettings ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
