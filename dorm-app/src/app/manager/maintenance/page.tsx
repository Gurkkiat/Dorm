'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MaintenanceRequest, MaintenanceTimeline } from '@/types/database'; // Ensure this type exists or use Partial/any
import { useManager } from '../ManagerContext';
import { Search, Wrench, CheckCircle2, Clock, Hammer, AlertCircle } from 'lucide-react';
import Loading from '@/components/ui/loading';

// Extend the type if necessary for joins
interface MaintenanceWithDetails extends MaintenanceRequest {
    type_of_repair?: string;
    timeline?: MaintenanceTimeline[];
    room?: {
        room_number: string;
        floor: number;
        building?: {
            branch_id: number;
            name_building: string;
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
    const [buildingFilter, setBuildingFilter] = useState('All');

    // Stats
    const [stats, setStats] = useState({ active: 0, completed: 0 });

    // Modal State
    const [selectedRequest, setSelectedRequest] = useState<MaintenanceWithDetails | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

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

        // Building Filter
        if (buildingFilter !== 'All') {
            res = res.filter(item => item.room?.building?.name_building === buildingFilter);
        }

        setFilteredData(res);
    }, [data, searchTerm, statusFilter, buildingFilter]);

    async function fetchMaintenanceRequests() {
        setLoading(true);
        try {
            let query = supabase
                .from('maintenance_request')
                .select('*, timeline:maintenance_timeline(*), room:room_id(room_number, floor, building:building_id(branch_id, name_building))')
                .order('requested_at', { ascending: false });

            // Apply Branch Filter
            if (selectedBranchId !== 'All') {
                // Note: Supabase nested filtering slightly tricky, easier to filter in memory or use !inner join
                // Using !inner forces the join to exist, effectively filtering by branch
                query = supabase
                    .from('maintenance_request')
                    .select('*, timeline:maintenance_timeline(*), room:room_id!inner(room_number, floor, building:building_id!inner(branch_id, name_building))')
                    .eq('room.building.branch_id', selectedBranchId)
                    .order('requested_at', { ascending: false });
            }

            const { data, error } = await query;

            if (error) throw error;
            const requests = (data as unknown as MaintenanceWithDetails[]) || [];

            // Sort timeline
            requests.forEach(r => {
                if (r.timeline) {
                    r.timeline.sort((a: MaintenanceTimeline, b: MaintenanceTimeline) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                }
            });

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

    // Clean data for modal
    const modalType = selectedRequest?.issue_type || 'General';
    const modalEquipment = selectedRequest?.equipment_name || '-';
    const modalText = selectedRequest?.issue_description || '';

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
                            <option value="In Progress">In Progress</option>
                            <option value="Waiting for Parts">Waiting for Parts</option>
                            <option value="Completed">Completed</option>
                        </select>

                        {/* Building Filter */}
                        <select
                            className="bg-gray-100 text-gray-700 text-sm rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={buildingFilter}
                            onChange={(e) => setBuildingFilter(e.target.value)}
                        >
                            <option value="All">All Buildings</option>
                            {Array.from(new Set(data.map(d => d.room?.building?.name_building).filter(Boolean))).sort().map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
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
                                <th className="py-4 px-4 rounded-l-lg w-[20%]">Room / Type</th>
                                <th className="py-4 px-4 text-center w-[30%]">Description</th>
                                <th className="py-4 px-4 text-center w-[15%]">Requested</th>
                                <th className="py-4 px-4 text-center w-[15%]">Status</th>
                                <th className="py-4 px-4 rounded-r-lg text-center w-[10%]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-50">
                            {filteredData.map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                                <Wrench size={18} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">Room {row.room?.room_number || '-'}</p>
                                                <div className="flex gap-1 mt-0.5">
                                                    <span className="text-[10px] font-bold text-[#0047AB] uppercase px-1 bg-blue-50 rounded border border-blue-100">{row.issue_type || 'General'}</span>
                                                    {row.equipment_name && <span className="text-[10px] font-bold text-gray-500 uppercase px-1 bg-gray-50 rounded border border-gray-100 truncate max-w-[80px]">{row.equipment_name}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        <p className="text-gray-700 max-w-xs truncate mx-auto" title={row.issue_description}>
                                            {row.issue_description}
                                        </p>
                                    </td>
                                    <td className="py-4 px-4 text-center text-gray-500">
                                        {new Date(row.requested_at).toLocaleDateString()}
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex justify-center">
                                            {getStatusBadge(row.status_technician)}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-center">
                                        <button
                                            onClick={() => {
                                                setSelectedRequest(row);
                                                setIsDetailModalOpen(true);
                                            }}
                                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            View
                                        </button>
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

            {/* Read-Only Modal */}
            {isDetailModalOpen && selectedRequest && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Job Details</h2>
                                <p className="text-gray-500 text-sm">Timeline and Progress</p>
                            </div>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                            >
                                <AlertCircle className="w-5 h-5 opacity-0 absolute pointer-events-none" /> {/* Hidden icon trick just for import matching width */}
                                <span className="text-xl leading-none">&times;</span>
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Request Info */}
                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Issue Description</h3>
                                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">{modalType}</span>
                                </div>
                                <p className="text-gray-900 text-lg font-medium leading-relaxed">{modalText}</p>

                                <div className="mt-4 flex flex-wrap gap-3">
                                    <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-gray-200 flex-1">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <Wrench className="w-5 h-5 text-[#0047AB]" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Room</p>
                                            <p className="text-sm font-medium text-gray-900">Room {selectedRequest.room?.room_number}</p>
                                        </div>
                                    </div>
                                    
                                    {modalEquipment !== '-' && (
                                        <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-gray-200 flex-1">
                                            <div className="p-2 bg-purple-50 rounded-lg">
                                                <Hammer className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase font-bold">Equipment</p>
                                                <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]" title={modalEquipment}>{modalEquipment}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-sm text-gray-600 w-fit">
                                    <Clock className="w-4 h-4 text-[#0047AB]" />
                                    {new Date(selectedRequest.requested_at).toLocaleString()}
                                </div>

                                {selectedRequest.path_photos && (
                                    <div className="mt-4">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Attached Photo</p>
                                        <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-gray-200">
                                            <a href={selectedRequest.path_photos} target="_blank" rel="noreferrer">
                                                <img src={selectedRequest.path_photos} alt="Issue" className="object-cover w-full h-full hover:scale-105 transition-transform cursor-pointer" />
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Timeline History */}
                            <div className="mb-6">
                                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Clock size={16} /> Timeline History
                                </h4>
                                <div className="space-y-4">
                                    {selectedRequest.timeline && selectedRequest.timeline.length > 0 ? (
                                        selectedRequest.timeline.map((event: MaintenanceTimeline) => (
                                            <div key={event.id} className="relative pl-6 border-l-2 border-gray-100 last:border-0 pb-4">
                                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-100 border-2 border-white"></div>
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-bold text-[#0047AB] uppercase">{event.status}</span>
                                                    <span className="text-[10px] text-gray-400">
                                                        {new Date(event.created_at).toLocaleString('en-GB')}
                                                    </span>
                                                </div>
                                                {event.comment && <p className="text-sm text-gray-600 mb-2">{event.comment}</p>}
                                                {event.photo_url && (
                                                    <div className="relative h-24 w-32 rounded-lg overflow-hidden border border-gray-100">
                                                        <a href={event.photo_url} target="_blank" rel="noopener noreferrer">
                                                            <img src={event.photo_url} alt="Proof" className="object-cover w-full h-full" />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-gray-400 text-sm italic">No updates yet</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
