'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MaintenanceRequest } from '@/types/database'; // Ensure types are updated
import {
    Wrench, CheckCircle2, Clock,
    AlertCircle, Search, Filter,
    MapPin, Calendar, Camera, Upload, X, Loader2, ChevronDown
} from 'lucide-react';
import Image from 'next/image';
import Loading from '@/components/ui/loading';

// Extended Interface for Join
interface MaintenanceRequestWithDetails extends MaintenanceRequest {
    room?: {
        room_number: string;
        floor: number;
        building?: {
            name_building: string;
            branch?: {
                branches_name: string;
            }
        }
    }
}

export default function MechanicMaintenancePage() {
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<MaintenanceRequestWithDetails[]>([]);
    const [myUserId, setMyUserId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'available' | 'my-jobs' | 'history'>('available');

    // Modal State
    const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequestWithDetails | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Update State
    const [updateComment, setUpdateComment] = useState('');
    const [updateStatus, setUpdateStatus] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const userId = localStorage.getItem('user_id');
        if (userId) setMyUserId(parseInt(userId));
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        // Fetch with nested joins: room -> building -> branch, AND timeline
        const { data, error } = await supabase
            .from('maintenance_request')
            .select(`
                *,
                room:room_id (
                    room_number,
                    floor,
                    building:building_id (
                        name_building,
                        branch:branch_id (
                            branches_name
                        )
                    )
                ),
                timeline:maintenance_timeline(*)
            `)
            .order('requested_at', { ascending: false });

        if (error) {
            console.error('Error fetching requests:', error);
        } else {
            // Sort timeline for each request locally if needed, though usually easier to order in query if possible
            // Supabase nested order is tricky, so sorting in JS:
            const requests = (data as unknown as MaintenanceRequestWithDetails[]) || [];
            requests.forEach(r => {
                if (r.timeline) {
                    r.timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                }
            });
            setRequests(requests);
        }
        setLoading(false);
    };

    const handleAcceptJob = async (id: number) => {
        if (!myUserId) return;

        // Update request status
        const { error: updateError } = await supabase
            .from('maintenance_request')
            .update({
                technician_id: myUserId,
                status_technician: 'In Progress'
            })
            .eq('id', id);

        if (updateError) {
            alert('Failed to accept job');
            return;
        }

        // Insert initial timeline entry
        await supabase
            .from('maintenance_timeline')
            .insert({
                request_id: id,
                technician_id: myUserId,
                status: 'In Progress',
                comment: 'Job accepted by technician',
            });

        fetchRequests();
        setIsDetailModalOpen(false);
    };

    const handleUpdateJob = async (id: number) => {
        setUploading(true);
        let photoPath = null;

        if (proofFile) {
            const fileName = `proof_${Date.now()}_${proofFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('maintenance-photos')
                .upload(fileName, proofFile);

            if (uploadError) {
                alert('Image upload failed');
                setUploading(false);
                return;
            }

            const { data: publicUrlData } = supabase.storage
                .from('maintenance-photos')
                .getPublicUrl(fileName);

            photoPath = publicUrlData.publicUrl;
        }

        // 1. Insert into Timeline
        const { error: timelineError } = await supabase
            .from('maintenance_timeline')
            .insert({
                request_id: id,
                technician_id: myUserId,
                status: updateStatus,
                comment: updateComment,
                photo_url: photoPath
            });

        if (timelineError) {
            console.error('Timeline error:', timelineError);
            alert(`Failed to add update: ${timelineError.message}`);
            setUploading(false);
            return;
        }

        // 2. Update Main Request Status (Current State)
        // Also update legacy fields for backward compatibility if needed, or just status
        // Keeping legacy fields updated for now to be safe, but main source of truth is timeline + status
        const { error: updateError } = await supabase
            .from('maintenance_request')
            .update({
                status_technician: updateStatus,
                technician_comment: updateComment, // Optional: Keep syncing mostly for easy "latest" access
                technician_photo: photoPath // Optional
            })
            .eq('id', id);

        if (updateError) {
            console.error('Failed to update request status', updateError);
        }

        fetchRequests();
        setIsDetailModalOpen(false);
        setUpdateComment('');
        setUpdateStatus('');
        setProofFile(null);
        setUploading(false);
    };

    // --- Filtering Logic ---
    const availableJobs = requests.filter(r =>
        (r.status_technician === 'Pending' || r.status_technician === 'pending') && !r.technician_id
    );

    const myJobs = requests.filter(r =>
        (r.technician_id === myUserId) &&
        (r.status_technician !== 'Done' && r.status_technician !== 'Completed' && r.status_technician !== 'Cancelled')
    );

    const historyJobs = requests.filter(r =>
        (r.technician_id === myUserId) &&
        (r.status_technician === 'Done' || r.status_technician === 'Completed')
    );

    const currentList = activeTab === 'available' ? availableJobs
        : activeTab === 'my-jobs' ? myJobs
            : historyJobs;

    // Helper to format location
    const getLocationString = (req: MaintenanceRequestWithDetails) => {
        const room = req.room;
        const building = room?.building;
        const branch = building?.branch;

        const parts = [];
        if (branch?.branches_name) parts.push(branch.branches_name);
        if (building?.name_building) parts.push(building.name_building);
        if (room?.floor) parts.push(`Fl. ${room.floor}`);
        if (room?.room_number) parts.push(`Room ${room.room_number}`);

        return parts.join(' • ') || `Room ID: ${req.room_id}`;
    };

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-[#0047AB]">Maintenance Jobs</h1>
                    <p className="text-gray-500 mt-2">Manage and update maintenance requests</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('available')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'available'
                        ? 'bg-white text-[#0047AB] shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Available ({availableJobs.length})
                </button>
                <button
                    onClick={() => setActiveTab('my-jobs')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'my-jobs'
                        ? 'bg-white text-[#0047AB] shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    My Active Jobs ({myJobs.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'history'
                        ? 'bg-white text-[#0047AB] shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    History ({historyJobs.length})
                </button>
            </div>


            {/* List */}
            {loading ? (
                <Loading />
            ) : currentList.length === 0 ? (
                <div className="bg-white rounded-[24px] p-12 text-center shadow-sm border border-gray-100">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Wrench className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">No jobs found</h3>
                    <p className="text-gray-500">There are no maintenance requests in this category.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {currentList.map(req => (
                        <div key={req.id} className="bg-white p-6 rounded-[24px] shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${req.status_technician === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                    req.status_technician === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                        'bg-emerald-100 text-emerald-700'
                                    }`}>
                                    {req.status_technician === 'Pending' ? <Clock className="w-3 h-3" /> :
                                        req.status_technician === 'In Progress' ? <Wrench className="w-3 h-3" /> :
                                            <CheckCircle2 className="w-3 h-3" />}
                                    {req.status_technician}
                                </span>
                                <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                                    {new Date(req.requested_at).toLocaleDateString()}
                                </span>
                            </div>

                            <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-2">{req.issue_description}</h3>

                            <div className="mt-auto space-y-4">
                                <div className="flex flex-col gap-1 text-sm text-gray-500 bg-gray-50 p-3 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-[#0047AB] shrink-0" />
                                        <span className="font-medium text-gray-900">{getLocationString(req)}</span>
                                    </div>
                                    {/* Fallback specific details if needed separately, but combined string is good */}
                                </div>

                                <button
                                    onClick={() => {
                                        setSelectedRequest(req);
                                        setUpdateStatus(req.status_technician); // Default to current
                                        setUpdateComment(req.technician_comment || '');
                                        setIsDetailModalOpen(true);
                                    }}
                                    className="w-full py-3 bg-[#0047AB] hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-200"
                                >
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {isDetailModalOpen && selectedRequest && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Job Details</h2>
                                <p className="text-gray-500 text-sm">Update status and report progress</p>
                            </div>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Request Info */}
                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Issue Description</h3>
                                <p className="text-gray-900 text-lg font-medium leading-relaxed">{selectedRequest.issue_description}</p>

                                <div className="mt-4 flex flex-col gap-3">
                                    <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-gray-200">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <MapPin className="w-5 h-5 text-[#0047AB]" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Location</p>
                                            <p className="text-sm font-medium text-gray-900">{getLocationString(selectedRequest)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-sm text-gray-600 w-fit">
                                        <Calendar className="w-4 h-4 text-[#0047AB]" />
                                        {new Date(selectedRequest.requested_at).toLocaleString()}
                                    </div>
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
                                        selectedRequest.timeline.map((event) => (
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

                            {/* Actions (Only if not done) */}
                            {activeTab === 'available' ? (
                                <button
                                    onClick={() => handleAcceptJob(selectedRequest.id)}
                                    className="w-full py-4 bg-[#0047AB] hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-200 transition-all transform hover:-translate-y-1"
                                >
                                    Accept This Job
                                </button>
                            ) : (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Update Progress</h3>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                            <div className="relative">
                                                <select
                                                    value={updateStatus}
                                                    onChange={(e) => setUpdateStatus(e.target.value)}
                                                    className="w-full p-4 pl-12 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 focus:ring-2 focus:ring-[#0047AB] focus:bg-white appearance-none transition-all cursor-pointer font-medium"
                                                >
                                                    <option value="In Progress">In Progress</option>
                                                    <option value="Waiting for Parts">Waiting for Parts</option>
                                                    <option value="Completed">Completed</option>
                                                </select>
                                                <Wrench className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Technician Report</label>
                                            <textarea
                                                value={updateComment}
                                                onChange={(e) => setUpdateComment(e.target.value)}
                                                className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB] focus:bg-white transition-all h-32 resize-none"
                                                placeholder="Describe the repair details..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Proof of Work (Optional)</label>
                                            <div className="flex items-center justify-center w-full">
                                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                        {proofFile ? (
                                                            <div className="flex items-center gap-2 text-green-600">
                                                                <CheckCircle2 className="w-6 h-6" />
                                                                <p className="text-sm font-medium">{proofFile.name}</p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                                                <p className="text-sm text-gray-500"><span className="font-semibold">Click to upload</span> proof photo</p>
                                                            </>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*"
                                                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleUpdateJob(selectedRequest.id)}
                                        disabled={uploading}
                                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Update'
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
