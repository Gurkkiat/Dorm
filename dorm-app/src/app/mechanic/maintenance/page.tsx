'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MaintenanceRequest } from '@/types/database'; // Ensure types are updated
import {
    Wrench, CheckCircle2, Clock,
    AlertCircle, Search, Filter,
    MapPin, Calendar, Camera, Upload, X, Loader2, ChevronDown, Plus, Trash2
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
            branch_id?: number;
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
    const [myBranchId, setMyBranchId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'available' | 'my-jobs' | 'history'>('available');

    // Modal State
    const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequestWithDetails | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Update State
    const [updateComment, setUpdateComment] = useState('');
    const [updateStatus, setUpdateStatus] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    
    // Parts Request State
    const [parts, setParts] = useState<{name: string, price: string}[]>([]);

    useEffect(() => {
        const userId = localStorage.getItem('user_id');
        if (userId) {
            setMyUserId(parseInt(userId));
            fetchRequests(parseInt(userId));
        } else {
            setLoading(false);
        }
    }, []);

    const fetchRequests = async (userId: number = myUserId as number) => {
        if (!userId) return;
        
        setLoading(true);

        // 1. Fetch user's branch_id
        let userBranchId: number | null = null;
        const { data: userData } = await supabase
            .from('users')
            .select('branch_id')
            .eq('id', userId)
            .single();

        if (userData && userData.branch_id) {
            userBranchId = userData.branch_id;
            setMyBranchId(userData.branch_id);
        }

        // 2. Fetch all requests with nested relations
        const { data, error } = await supabase
            .from('maintenance_request')
            .select(`
                *,
                room:room_id (
                    room_number,
                    floor,
                    building:building_id (
                        name_building,
                        branch_id,
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
            // Filter out requests that don't match the mechanic's branch (if mechanic has a branch assigned)
            const filteredRequests = userBranchId 
                ? (data as unknown as MaintenanceRequestWithDetails[]).filter(req => req.room?.building?.branch_id === userBranchId)
                : (data as unknown as MaintenanceRequestWithDetails[]);

            filteredRequests.forEach(r => {
                if (r.timeline) {
                    r.timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                }
            });
            setRequests(filteredRequests);
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

        // 3. Insert Parts if "Waiting for Parts" and parts exist
        if (updateStatus === 'Waiting for Parts' && parts.length > 0) {
            const partsPayload = parts.map(p => ({
                maintenance_id: id,
                part_name: p.name,
                price: parseFloat(p.price) || 0,
                status: 'pending'
            }));
            
            const { error: partsError } = await supabase.from('maintenance_parts').insert(partsPayload);
            if (partsError) {
                console.error('Failed to insert parts', partsError);
                alert('Failed to request parts, but status updated.');
            }
        }

        fetchRequests();
        setIsDetailModalOpen(false);
        setUpdateComment('');
        setUpdateStatus('');
        setProofFile(null);
        setParts([]);
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

        const parts = [];
        if (building?.name_building) parts.push(building.name_building);
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

                            <div className="flex flex-wrap gap-2 mb-3">
                                {req.issue_type && (
                                    <span className="px-2 py-0.5 bg-blue-50 text-[#0047AB] text-[10px] font-bold uppercase rounded-md border border-blue-100 italic">
                                        {req.issue_type}
                                    </span>
                                )}
                                {req.equipment_name && (
                                    <span className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[10px] font-bold uppercase rounded-md border border-gray-100 italic">
                                        {req.equipment_name}
                                    </span>
                                )}
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
                    <div className="bg-white rounded-[32px] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
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
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Issue Description</h3>
                                    <div className="flex gap-2">
                                        {selectedRequest.issue_type && (
                                            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-full border border-blue-200 uppercase">{selectedRequest.issue_type}</span>
                                        )}
                                        {selectedRequest.equipment_name && (
                                            <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-1 rounded-full border border-purple-200 uppercase">{selectedRequest.equipment_name}</span>
                                        )}
                                    </div>
                                </div>
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

                                        {updateStatus === 'Waiting for Parts' && (
                                            <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="block text-sm font-bold text-[#0047AB]">Requested Parts List</label>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setParts([...parts, { name: '', price: '' }])}
                                                        className="text-xs font-bold text-white bg-[#0047AB] px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm"
                                                    >
                                                        <Plus size={14} /> Add Part
                                                    </button>
                                                </div>
                                                
                                                {parts.length === 0 ? (
                                                    <p className="text-xs text-slate-500 italic text-center py-2">No parts added yet. Click "Add Part" to request items.</p>
                                                ) : (
                                                    <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                                                        {parts.map((part, index) => (
                                                            <div key={index} className="flex items-start gap-2 bg-white px-3 py-3 rounded-lg border border-slate-200 shadow-sm relative group">
                                                                <div className="flex-1 space-y-2">
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder="Part Name (e.g. Light Bulb)" 
                                                                        value={part.name}
                                                                        onChange={(e) => {
                                                                            const newParts = [...parts];
                                                                            newParts[index].name = e.target.value;
                                                                            setParts(newParts);
                                                                        }}
                                                                        className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0047AB] font-medium text-slate-800"
                                                                        required
                                                                    />
                                                                    <div className="relative">
                                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">฿</span>
                                                                        <input 
                                                                            type="number" 
                                                                            placeholder="Price" 
                                                                            value={part.price}
                                                                            min="0"
                                                                            step="0.01"
                                                                            onChange={(e) => {
                                                                                const newParts = [...parts];
                                                                                newParts[index].price = e.target.value;
                                                                                setParts(newParts);
                                                                            }}
                                                                            className="w-full text-sm pl-8 pr-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0047AB] font-bold text-[#0047AB]"
                                                                            required
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newParts = parts.filter((_, i) => i !== index);
                                                                        setParts(newParts);
                                                                    }}
                                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors mt-1"
                                                                    title="Remove Part"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

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
