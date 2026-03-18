'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Building, Plus, MapPin, DoorOpen, PawPrint } from 'lucide-react';
import { Building as BuildingType, Room } from '@/types/database';

export default function ManageBuildingsPage() {
    const [buildings, setBuildings] = useState<(BuildingType & { rooms: Room[] })[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modals
    const [showBuildingModal, setShowBuildingModal] = useState(false);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);

    // Helpers for Room Color Styling
    const getRoomCardStyle = (status: string) => {
        switch (status.toLowerCase()) {
            case 'available':
            case 'vacant':
                return 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400 hover:shadow-emerald-100';
            case 'occupied':
                return 'border-blue-200 bg-blue-50/50 hover:border-blue-400 hover:shadow-blue-100';
            case 'assign':
            case 'maintenance':
                return 'border-amber-200 bg-amber-50/50 hover:border-amber-400 hover:shadow-amber-100';
            default:
                return 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-slate-100';
        }
    };

    const getRoomIconColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'available':
            case 'vacant': return 'text-emerald-400 group-hover:text-emerald-600';
            case 'occupied': return 'text-blue-400 group-hover:text-blue-600';
            case 'assign':
            case 'maintenance': return 'text-amber-400 group-hover:text-amber-600';
            default: return 'text-indigo-400 group-hover:text-indigo-600';
        }
    };

    const getRoomBadgeStyle = (status: string) => {
        switch (status.toLowerCase()) {
            case 'available':
            case 'vacant': return 'bg-emerald-100 text-emerald-700';
            case 'occupied': return 'bg-blue-100 text-blue-700';
            case 'assign':
            case 'maintenance': return 'bg-amber-100 text-amber-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    // Form Data
    const [buildingForm, setBuildingForm] = useState({
        name_building: '',
        total_floor: 1,
        address: '',
        elec_meter: 0,
        water_meter: 0
    });

    const [roomForm, setRoomForm] = useState({
        room_number: '',
        floor: 1,
        pet_status: false,
        rent_price: 5000,
        water_unit: 0,
        elec_unit: 0,
        status: 'Available'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const role = localStorage.getItem('user_role')?.toLowerCase();
            const branchId = localStorage.getItem('user_branch_id');

            let query = supabase.from('building').select('*, rooms:room(*)').order('id');

            // Admin with a branch selected
            if (role === 'admin' && branchId) {
                query = query.eq('branch_id', branchId);
            } else if (role === 'admin') {
                // Admin with "All Branches" — no filter, fetch all
            } else {
                // Owner — must have a branch
                if (!branchId) throw new Error("No branch assigned.");
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;
            if (error) throw error;
            // @ts-ignore
            setBuildings(data || []);
        } catch (error) {
            console.error('Error fetching buildings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBuilding = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            const branchId = localStorage.getItem('user_branch_id');
            if (!branchId) {
                alert('No branch selected. Please select a branch from the "Branch Scope" selector in the sidebar first.');
                return;
            }

            const { error } = await supabase
                .from('building')
                .insert([{ ...buildingForm, branch_id: Number(branchId) }]);

            if (error) throw error;

            alert('Building created successfully!');
            setShowBuildingModal(false);
            setBuildingForm({ name_building: '', total_floor: 1, address: '', elec_meter: 0, water_meter: 0 });
            fetchData();
        } catch (err: any) {
            console.error('Error creating building:', err);
            alert('Error creating building: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBuildingId) return;

        setProcessing(true);
        try {
            const { error } = await supabase
                .from('room')
                .insert([{ ...roomForm, building_id: selectedBuildingId, current_residents: 0 }]);
            
            if (error) throw error;
            
            alert('Room created successfully!');
            setShowRoomModal(false);
            setRoomForm({ room_number: '', floor: 1, pet_status: false, rent_price: 5000, water_unit: 0, elec_unit: 0, status: 'Available' });
            fetchData();
        } catch (err: any) {
            console.error('Error creating room:', err);
            alert('Error creating room: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Buildings & Rooms</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage infrastructure and room configurations</p>
                </div>
                <button
                    onClick={() => setShowBuildingModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Building size={18} />
                    Add Building
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto space-y-6">
                {loading ? (
                    <div className="p-8 text-center text-slate-500 bg-white rounded-2xl shadow-sm border border-slate-200">Loading buildings...</div>
                ) : buildings.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 bg-white rounded-2xl shadow-sm border border-slate-200">
                        No buildings found. Click "Add Building" to get started.
                    </div>
                ) : (
                    buildings.map(building => (
                        <div key={building.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="bg-indigo-100 text-indigo-700 p-3 rounded-xl">
                                        <Building size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">{building.name_building}</h2>
                                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                                            <span className="flex items-center gap-1"><MapPin size={14}/> {building.address || 'No address provided'}</span>
                                            <span className="text-slate-300">|</span>
                                            <span>{building.total_floor} Floors</span>
                                            <span className="text-slate-300">|</span>
                                            <span>{building.rooms?.length || 0} Rooms</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedBuildingId(building.id);
                                        setShowRoomModal(true);
                                    }}
                                    className="bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                                >
                                    <Plus size={16} /> Add Room
                                </button>
                            </div>
                            
                            {/* Rooms Grid */}
                            <div className="p-6">
                                {building.rooms && building.rooms.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {/* Sort rooms by floor then number */}
                                        {building.rooms.sort((a,b) => a.floor - b.floor || a.room_number.localeCompare(b.room_number)).map(room => (
                                            <div key={room.id} className={`border rounded-xl p-4 flex flex-col items-center justify-center text-center relative transition-all hover:shadow-md cursor-pointer group ${getRoomCardStyle(room.status)}`}>
                                                {room.pet_status && (
                                                    <div className="absolute top-2 right-2 text-amber-600 bg-white/80 backdrop-blur-sm p-1 rounded-full shadow-sm" title="Pet Friendly">
                                                        <PawPrint size={14} />
                                                    </div>
                                                )}
                                                <DoorOpen size={24} className={`mb-2 transition-colors ${getRoomIconColor(room.status)}`} />
                                                <h3 className="font-bold text-lg text-slate-800">{room.room_number}</h3>
                                                <p className="text-xs text-slate-500 font-medium tracking-wide">Floor {room.floor}</p>
                                                <div className={`mt-3 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm ${getRoomBadgeStyle(room.status)}`}>
                                                    {room.status}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-slate-400 py-4 italic">No rooms added to this building yet.</p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Building Modal */}
            {showBuildingModal && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Building size={20} className="text-indigo-600" />
                                Add New Building
                            </h2>
                        </div>
                        <div className="p-6">
                            <form id="building-form" onSubmit={handleCreateBuilding} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Building Name</label>
                                    <input 
                                        type="text" required 
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2"
                                        value={buildingForm.name_building}
                                        onChange={e => setBuildingForm({...buildingForm, name_building: e.target.value})}
                                        placeholder="e.g. Building A"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Total Floors</label>
                                    <input 
                                        type="number" required min="1"
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2"
                                        value={buildingForm.total_floor}
                                        onChange={e => setBuildingForm({...buildingForm, total_floor: Number(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Address</label>
                                    <textarea 
                                        required rows={2}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 resize-none"
                                        value={buildingForm.address}
                                        onChange={e => setBuildingForm({...buildingForm, address: e.target.value})}
                                    />
                                </div>
                            </form>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50">
                            <button
                                onClick={() => setShowBuildingModal(false)}
                                className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit" form="building-form" disabled={processing}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                            >
                                {processing ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Room Modal */}
            {showRoomModal && selectedBuildingId && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <DoorOpen size={20} className="text-indigo-600" />
                                Add New Room
                            </h2>
                        </div>
                        <div className="p-6">
                            <form id="room-form" onSubmit={handleCreateRoom} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Room Number</label>
                                        <input 
                                            type="text" required 
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2"
                                            value={roomForm.room_number}
                                            onChange={e => setRoomForm({...roomForm, room_number: e.target.value})}
                                            placeholder="e.g. 101"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Floor</label>
                                        <input 
                                            type="number" required min="1"
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2"
                                            value={roomForm.floor}
                                            onChange={e => setRoomForm({...roomForm, floor: Number(e.target.value)})}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Rent Price (฿)</label>
                                        <input 
                                            type="number" required min="0" step="100"
                                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2"
                                            value={roomForm.rent_price}
                                            onChange={e => setRoomForm({...roomForm, rent_price: Number(e.target.value)})}
                                        />
                                    </div>
                                    <div className="flex flex-col justify-end">
                                        <label className="flex items-center gap-3 cursor-pointer p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 text-indigo-600 rounded"
                                                checked={roomForm.pet_status}
                                                onChange={e => setRoomForm({...roomForm, pet_status: e.target.checked})}
                                            />
                                            <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                                <PawPrint size={14} className="text-amber-500"/>
                                                Pet Friendly
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50">
                            <button
                                onClick={() => setShowRoomModal(false)}
                                className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit" form="room-form" disabled={processing}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                            >
                                {processing ? 'Creating...' : 'Create Room'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
