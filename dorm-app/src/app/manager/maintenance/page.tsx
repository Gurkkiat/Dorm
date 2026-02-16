'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MaintenanceRequest } from '@/types/database'; // Ensure this type exists or use Partial/any
import { useManager } from '../ManagerContext';
import { Search, Wrench, CheckCircle2, Clock, Hammer, AlertCircle } from 'lucide-react';
import Loading from '@/components/ui/loading';

// Extend the type if necessary for joins
interface MaintenanceWithDetails extends MaintenanceRequest {
    type_of_repair?: string;
    room?: {
        room_number: string;
        building?: {
            branch_id: number;
        }
    }
}

export default function ManagerMaintenancePage() {
    const { selectedBranchId } = useManager();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MaintenanceWithDetails[]>([]);
    const [filteredData, setFilteredData] = useState<MaintenanceWithDetails[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    // Stats
    const [stats, setStats] = useState({ active: 0, completed: 0 });

    useEffect(() => {
        fetchMaintenanceRequests();
    }, [selectedBranchId]);

    useEffect(() => {
        let res = data;

        // Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            res = res.filter(item =>
                item.room?.room_number.toLowerCase().includes(lower) ||
                item.issue_description.toLowerCase().includes(lower)
            );
        }

        // Status Filter
        if (statusFilter !== 'All') {
            res = res.filter(item => item.status_technician?.toLowerCase() === statusFilter.toLowerCase());
        }

        setFilteredData(res);
    }, [data, searchTerm, statusFilter]);

    async function fetchMaintenanceRequests() {
        setLoading(true);
        try {
            let query = supabase
                .from('maintenance_request')
                .select('*, room:room_id(room_number, building:building_id(branch_id))')
                .order('requested_at', { ascending: false });

            // Apply Branch Filter
            if (selectedBranchId !== 'All') {
                // Note: Supabase nested filtering slightly tricky, easier to filter in memory or use !inner join
                // Using !inner forces the join to exist, effectively filtering by branch
                query = supabase
                    .from('maintenance_request')
                    .select('*, room:room_id!inner(room_number, building:building_id!inner(branch_id))')
                    .eq('room.building.branch_id', selectedBranchId)
                    .order('requested_at', { ascending: false });
            }

            const { data, error } = await query;

            if (error) throw error;
            const requests = (data as unknown as MaintenanceWithDetails[]) || [];
            setData(requests);
            setFilteredData(requests);

            // Calculate Stats
            const active = requests.filter(r => r.status_technician !== 'Done' && r.status_technician !== 'Completed').length;
            const completed = requests.filter(r => r.status_technician === 'Done' || r.status_technician === 'Completed').length;
            setStats({ active, completed });

        } catch (error) {
            console.error('Error fetching maintenance requests:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleUpdateStatus = async (id: number, newStatus: string) => {
        try {
            const updates: any = { status_technician: newStatus };
            if (newStatus === 'Done' || newStatus === 'Completed') {
                updates.completed_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('maintenance_request')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            // Optimistic Update
            setData(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));

        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;

    const currentDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // Helper for Status Badge
    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'pending') return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><Clock size={12} /> Pending</span>;
        if (s === 'repairing' || s === 'in progress') return <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><Hammer size={12} /> Repairing</span>;
        if (s === 'done' || s === 'completed') return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle2 size={12} /> Done</span>;
        return <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">{status}</span>;
    };

    return (
        <div className="h-full flex flex-col p-6 bg-gray-50/50 gap-6 overflow-y-auto">

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Maintenance Dashboard</h1>
                    <p className="text-gray-500 text-sm mt-1">{currentDate}</p>
                </div>
            </div>

            {/* Widgets Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Active Requests Card (Blue Theme) */}
                <div className="bg-gradient-to-br from-[#0047AB] to-[#003380] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden h-48 flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4">
                        <Wrench size={120} />
                    </div>

                    <div className="flex justify-between items-start z-10">
                        <div>
                            <p className="text-blue-200 text-sm font-medium">Active Requests</p>
                            <h2 className="text-4xl font-bold mt-2">{stats.active}</h2>
                        </div>
                        <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                            <AlertCircle size={20} />
                        </div>
                    </div>
                    <div className="z-10">
                        <p className="text-xs text-blue-200 mt-4">Requires Attention</p>
                    </div>
                </div>

                {/* Completed Stats */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-48">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-700">Completed Jobs</h3>
                        <span className="bg-green-100 text-green-600 py-1 px-3 rounded-full text-xs font-bold">Total</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-green-600">{stats.completed}</div>
                            <p className="text-gray-400 text-sm">Requests Resolved</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Requests List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-lg text-gray-800">Request List</h3>

                    <div className="flex gap-4">
                        {/* Status Filter */}
                        <select
                            className="bg-gray-100 text-gray-700 text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="Repairing">Repairing</option>
                            <option value="Done">Done</option>
                        </select>

                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search Room/Desc"
                                className="bg-gray-100 text-gray-700 text-sm rounded-full px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        </div>
                    </div>
                </div>

                <div className="overflow-auto flex-1 p-4">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="py-4 px-4 rounded-l-lg">Room / Type</th>
                                <th className="py-4 px-4">Description</th>
                                <th className="py-4 px-4">Requested</th>
                                <th className="py-4 px-4">Status</th>
                                <th className="py-4 px-4 rounded-r-lg">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-50">
                            {filteredData.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-50 p-2 rounded-lg text-blue-600 font-bold w-10 h-10 flex items-center justify-center">
                                                {row.room?.room_number || '-'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">{row.type_of_repair || 'General'}</p>
                                                <p className="text-xs text-gray-500">Maintenance</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <p className="text-gray-700 max-w-xs truncate" title={row.issue_description}>
                                            {row.issue_description}
                                        </p>
                                    </td>
                                    <td className="py-4 px-4 text-gray-500">
                                        {new Date(row.requested_at).toLocaleDateString()}
                                    </td>
                                    <td className="py-4 px-4">
                                        {getStatusBadge(row.status_technician)}
                                    </td>
                                    <td className="py-4 px-4">
                                        <select
                                            className="bg-white border border-gray-200 text-gray-700 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer hover:bg-gray-50"
                                            value={row.status_technician}
                                            onChange={(e) => handleUpdateStatus(row.id, e.target.value)}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Repairing">Repairing</option>
                                            <option value="Done">Done</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-gray-400">
                                        No maintenance requests found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
