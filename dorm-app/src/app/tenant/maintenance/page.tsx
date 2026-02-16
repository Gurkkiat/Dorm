'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Wrench, Plus, Clock, CheckCircle2, AlertCircle, X, Loader2, Upload, Terminal, ImageIcon, ChevronDown } from 'lucide-react';
import { MaintenanceRequest, Equipment } from '@/types/database';
import Image from 'next/image';
import Loading from '@/components/ui/loading';

export default function TenantMaintenancePage() {
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
    const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [description, setDescription] = useState('');
    const [type, setType] = useState('General'); // Default type
    const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchRequestsAndEquipment();
    }, []);

    const fetchRequestsAndEquipment = async () => {
        setLoading(true);
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) return;

            // 1. Get Active Contract/Room
            const { data: contract } = await supabase
                .from('contract')
                .select('room_id')
                .eq('user_id', userId)
                .in('status', ['Active', 'active', 'complete', 'Complete']) // Included 'complete' based on DB data
                .single();

            if (!contract) {
                console.warn("No active/complete contract found for user:", userId);
                setLoading(false);
                return;
            }

            const roomId = contract.room_id;

            // 2. Fetch Requests
            const { data: requestsData, error: reqError } = await supabase
                .from('maintenance_request')
                .select(`
                    *,
                    timeline:maintenance_timeline(*)
                `)
                .eq('room_id', roomId)
                .order('requested_at', { ascending: false });

            if (reqError) throw reqError;

            // Sort timeline locally
            const requests = (requestsData as any[] || []).map(req => {
                if (req.timeline) {
                    req.timeline.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                }
                return req;
            });

            setRequests(requests);

            // 3. Fetch Equipment
            const { data: equipmentData, error: eqError } = await supabase
                .from('equipment')
                .select('*')
                .eq('room_id', roomId);

            if (eqError) {
                console.error("Error fetching equipment:", eqError);
            } else {
                setEquipmentList(equipmentData || []);
            }

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert("File is too large. Max 5MB.");
                return;
            }
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (file: File): Promise<string> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `maintenance/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('maintenance-photos') // Ensure this bucket exists
                .upload(filePath, file);

            if (uploadError) {
                // Try fallback bucket if needed or just throw
                console.error("Upload error:", uploadError);
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('maintenance-photos')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            // Return empty string or handle gracefully? 
            // For now, let's just return empty string to avoid blocking request creation completely if storage fails
            alert("Failed to upload image. Request will be sent without it.");
            return "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const userId = localStorage.getItem('user_id');
            if (!userId) return;

            const { data: contract } = await supabase
                .from('contract')
                .select('room_id')
                .eq('user_id', userId)
                .in('status', ['Active', 'active', 'complete', 'Complete'])
                .single();

            if (!contract) throw new Error("No active contract found");

            let photoUrl = "";
            if (imageFile) {
                photoUrl = await uploadImage(imageFile);
            }

            // Construct Description
            let finalDescription = description;

            // Note: User requested to simplify the description and not include equipment details for now.
            // if (selectedEquipmentId) {
            //     const eq = equipmentList.find(item => item.id.toString() === selectedEquipmentId);
            //     if (eq) {
            //         finalDescription = `[Equipment: ${eq.name} (${eq.serial_number})] ${description}`;
            //     }
            // }

            const { error } = await supabase
                .from('maintenance_request')
                .insert([
                    {
                        room_id: contract.room_id,
                        request_number: `REQ-${Date.now()}`,
                        issue_description: finalDescription,
                        // type_of_repair: type, 
                        status_technician: 'Pending',
                        requested_at: new Date().toISOString(),
                        path_photos: photoUrl,
                        amount: 0 // Default
                    }
                ]);

            if (error) throw error;

            // Reset and Refresh
            setIsModalOpen(false);
            setDescription('');
            setType('General');
            setSelectedEquipmentId('');
            setImageFile(null);
            setImagePreview(null);
            fetchRequestsAndEquipment();

        } catch (error) {
            console.error('Error submitting request:', error);
            alert('Failed to submit request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'pending') return 'bg-yellow-100 text-yellow-700';
        if (s === 'repairing' || s === 'in progress') return 'bg-orange-100 text-orange-700';
        if (s === 'done' || s === 'completed') return 'bg-green-100 text-green-700';
        return 'bg-gray-100 text-gray-600';
    };



    // ... (rest of imports)

    // ... (inside component)

    if (loading) return <Loading />;

    return (
        <div className="max-w-5xl mx-auto px-6 py-8 font-sans min-h-screen pb-24">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">
                        Maintenance <span className="text-[#0047AB]">Requests</span>
                    </h1>
                    <p className="text-gray-500 mt-1">Report issues and track repair status.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-[#0047AB] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#00388A] transition-all shadow-lg hover:translate-y-[-2px]"
                >
                    <Plus size={20} />
                    Report Issue
                </button>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {requests.length > 0 ? (
                    requests.map((req) => (
                        <div key={req.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
                            {/* Top Section: Request Details */}
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="flex items-start gap-4 w-full">
                                    <div className={`p-3 rounded-xl ${getStatusColor(req.status_technician)} bg-opacity-20 shrink-0`}>
                                        <Wrench size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 text-lg mb-1 truncate">{req.issue_description}</h3>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={14} />
                                                {new Date(req.requested_at).toLocaleDateString('en-GB', {
                                                    year: 'numeric', month: 'short', day: 'numeric'
                                                })}
                                            </div>
                                            {req.path_photos && (
                                                <a href={req.path_photos} target="_blank" rel="noopener noreferrer" className="text-[#0047AB] hover:underline flex items-center gap-1.5">
                                                    <ImageIcon size={14} />
                                                    View Photo
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center shrink-0">
                                    <span className={`px-4 py-2 rounded-lg font-bold text-sm capitalize ${getStatusColor(req.status_technician)}`}>
                                        {req.status_technician}
                                    </span>
                                </div>
                            </div>

                            {/* Timeline Update Section */}
                            {req.timeline && req.timeline.length > 0 ? (
                                <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 mt-2">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-blue-100 rounded-lg text-[#0047AB]">
                                            <Wrench size={16} />
                                        </div>
                                        <h4 className="text-sm font-bold text-[#0047AB] uppercase tracking-wide">Technician Updates</h4>
                                    </div>

                                    <div className="space-y-6 relative pl-2">
                                        {/* Vertical Line */}
                                        <div className="absolute left-[19px] top-2 bottom-4 w-0.5 bg-blue-100"></div>

                                        {req.timeline.map((event) => (
                                            <div key={event.id} className="relative pl-10">
                                                {/* Dot */}
                                                <div className="absolute left-[13px] top-1.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-4 border-blue-50 z-10"></div>

                                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-1">
                                                    <span className="font-bold text-gray-800 text-sm">{event.status}</span>
                                                    <span className="text-xs text-gray-400 font-mono">
                                                        {new Date(event.created_at).toLocaleString('en-GB', {
                                                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>

                                                {event.comment && (
                                                    <div className="bg-white p-3 rounded-lg border border-gray-100 text-sm text-gray-600 shadow-sm mb-2">
                                                        {event.comment}
                                                    </div>
                                                )}

                                                {event.photo_url && (
                                                    <div className="relative h-32 w-48 rounded-lg overflow-hidden border border-gray-200 bg-white group mt-2">
                                                        <a href={event.photo_url} target="_blank" rel="noopener noreferrer">
                                                            <img
                                                                src={event.photo_url}
                                                                alt="Proof"
                                                                className="object-cover w-full h-full hover:scale-105 transition-transform cursor-pointer"
                                                            />
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                        <div className="bg-white p-4 rounded-full inline-block mb-4 shadow-sm">
                            <CheckCircle2 size={48} className="text-green-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">No Issues Reported</h3>
                        <p className="text-gray-500 mt-2">Your room is in perfect condition! 🎉</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 relative max-h-[90vh] overflow-y-auto">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">Report an Issue</h2>
                                <p className="text-gray-500">Describe the problem and we'll fix it.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Issue Type */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['General', 'Electric', 'Water', 'Furniture', 'Other'].map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setType(t)}
                                                className={`py-2 px-4 rounded-xl text-sm font-bold border transition-all ${type === t
                                                    ? 'border-[#0047AB] bg-blue-50 text-[#0047AB]'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Equipment Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Equipment (Optional)</label>
                                    <div className="relative">
                                        <select
                                            value={selectedEquipmentId}
                                            onChange={(e) => setSelectedEquipmentId(e.target.value)}
                                            className="w-full p-3 pr-10 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0047AB] transition-all text-gray-700 appearance-none cursor-pointer"
                                        >
                                            <option value="">-- Select Specific Equipment --</option>
                                            {equipmentList.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                                    <textarea
                                        required
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Describe the issue in detail..."
                                        className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0047AB] focus:bg-white transition-all resize-none h-32"
                                    />
                                </div>

                                {/* Image Upload */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Attach Photo (Optional)</label>
                                    <div
                                        className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#0047AB] hover:bg-blue-50/50 transition-all text-gray-400 hover:text-[#0047AB]"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {imagePreview ? (
                                            <div className="relative w-full h-48 rounded-lg overflow-hidden">
                                                <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                    <span className="bg-white/90 text-gray-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm">Change Photo</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload size={32} className="mb-2" />
                                                <p className="text-sm font-medium">Click to upload image</p>
                                                <p className="text-xs mt-1 text-gray-400">Max 5MB (JPG, PNG)</p>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-[#0047AB] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#00388A] disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            Submit Request
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
