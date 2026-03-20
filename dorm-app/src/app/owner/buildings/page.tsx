'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Building, Plus, MapPin, DoorOpen, PawPrint, Trash2 } from 'lucide-react';
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
        status: 'Vacant'
    });

    // Bulk Mode Form
    const [createMode, setCreateMode] = useState<'single' | 'bulk'>('single');
    const [bulkForm, setBulkForm] = useState({
        start_floor: 1,
        end_floor: 1,
        rooms_per_floor: 10,
        rent_price: 5000,
        pet_status: false
    });

    // Edit Room Modal Form & State
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [showEditRoomModal, setShowEditRoomModal] = useState(false);
    const [currentTenant, setCurrentTenant] = useState<any>(null);
    const [editRoomForm, setEditRoomForm] = useState({
        rent_price: 5000,
        pet_status: false
    });

    // Filters
    const [filterBuilding, setFilterBuilding] = useState('All');
    const [filterFloor, setFilterFloor] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');

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
            setRoomForm({ room_number: '', floor: 1, pet_status: false, rent_price: 5000, water_unit: 0, elec_unit: 0, status: 'Vacant' });
            fetchData();
        } catch (err: any) {
            console.error('Error creating room:', err);
            alert('Error creating room: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleCreateBulkRooms = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBuildingId) return;

        setProcessing(true);
        try {
            const targetBuilding = buildings.find(b => b.id === selectedBuildingId);
            if (!targetBuilding) throw new Error("Building not found.");

            const existingRoomNumbers = new Set((targetBuilding.rooms || []).map(r => r.room_number));
            const newRooms = [];

            for (let f = bulkForm.start_floor; f <= bulkForm.end_floor; f++) {
                for (let r = 1; r <= bulkForm.rooms_per_floor; r++) {
                    const roomNum = `${f}${String(r).padStart(2, '0')}`;
                    if (!existingRoomNumbers.has(roomNum)) {
                        newRooms.push({
                            building_id: selectedBuildingId,
                            room_number: roomNum,
                            floor: f,
                            rent_price: bulkForm.rent_price,
                            pet_status: bulkForm.pet_status,
                            water_unit: 0,
                            elec_unit: 0,
                            status: 'Vacant',
                            current_residents: 0
                        });
                    }
                }
            }

            if (newRooms.length === 0) {
                alert('No new rooms to generate. All numbered rooms may already exist in this range.');
                return;
            }

            const { error } = await supabase.from('room').insert(newRooms);
            if (error) throw error;
            
            alert(`Successfully generated ${newRooms.length} rooms!`);
            setShowRoomModal(true); // Keep it open for user verification? No, let's close it
            setShowRoomModal(false);
            setBulkForm({ start_floor: 1, end_floor: 1, rooms_per_floor: 10, rent_price: 5000, pet_status: false });
            fetchData();
        } catch (err: any) {
            console.error('Error in bulk creation:', err);
            alert('Error generating rooms: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const fetchRoomDetails = async (room: Room) => {
        setSelectedRoom(room);
        setEditRoomForm({
            rent_price: room.rent_price,
            pet_status: room.pet_status
        });
        setCurrentTenant(null);
        setShowEditRoomModal(true);

        if (['Occupied', 'occupied'].includes(room.status)) {
            try {
                const { data, error } = await supabase
                    .from('contract')
                    .select('*, users (full_name, phone, profile_picture)')
                    .eq('room_id', room.id)
                    .in('status', ['Active', 'active', 'complete'])
                    .single();
                
                if (error && error.code !== 'PGRST116') {
                    console.error('Error fetching tenant:', error);
                } else if (data) {
                    setCurrentTenant(data);
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleUpdateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRoom) return;
        setProcessing(true);
        try {
            const { error } = await supabase
                .from('room')
                .update({ 
                    rent_price: editRoomForm.rent_price, 
                    pet_status: editRoomForm.pet_status 
                })
                .eq('id', selectedRoom.id);
            
            if (error) throw error;
            alert('Room details updated successfully!');
            setShowEditRoomModal(false);
            fetchData();
        } catch (err: any) {
            console.error('Error updating room:', err);
            alert('Error updating room: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteRoom = async () => {
        if (!selectedRoom) return;
        
        // Prevent deletion of occupied rooms visually, but double check in logic
        if (['Occupied', 'occupied', 'Assign', 'assign'].includes(selectedRoom.status)) {
            alert('Cannot delete this room because it is currently assigned or occupied.');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete Room ${selectedRoom.room_number}?\n\nThis action cannot be undone.`)) {
            return;
        }

        setProcessing(true);
        try {
            const { error } = await supabase
                .from('room')
                .delete()
                .eq('id', selectedRoom.id);
            
            if (error) {
                // Handle PostgreSQL foreign key violation (usually 23503)
                if (error.code === '23503') {
                    throw new Error('This room cannot be deleted because it has history (like past contracts, invoices, or maintenance records) tied to it. Try changing its status to Maintenance instead if it is out of service.');
                }
                throw error;
            }

            alert('Room deleted successfully!');
            setShowEditRoomModal(false);
            fetchData();
        } catch (err: any) {
            console.error('Error deleting room:', err);
            alert('Error deleting room: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    // Combined filter logic for rendering
    const filteredBuildings = buildings
        .filter(b => filterBuilding === 'All' || String(b.id) === filterBuilding)
        .map(b => ({
            ...b,
            rooms: (b.rooms || []).filter(r => {
                const statusMatch = filterStatus === 'All' || r.status?.toLowerCase() === filterStatus.toLowerCase();
                const floorMatch = filterFloor === 'All' || String(r.floor) === filterFloor;
                return statusMatch && floorMatch;
            })
        }))
        .filter(b => b.rooms.length > 0 || (filterStatus === 'All' && filterFloor === 'All')); // Only show empty buildings if no specific room filters are set

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

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Building:</span>
                    <select 
                        value={filterBuilding}
                        onChange={e => setFilterBuilding(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="All">All Buildings</option>
                        {buildings.map(b => (
                            <option key={b.id} value={b.id}>{b.name_building}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Floor:</span>
                    <select 
                        value={filterFloor}
                        onChange={e => setFilterFloor(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="All">All Floors</option>
                        {/* Get unique floors from all buildings or selected building */}
                        {Array.from(new Set(
                            (filterBuilding === 'All' 
                                ? buildings.flatMap(b => b.rooms?.map(r => r.floor) || [])
                                : buildings.find(b => String(b.id) === filterBuilding)?.rooms?.map(r => r.floor) || []
                            ).filter(f => f !== undefined)
                        )).sort((a,b) => a-b).map(f => (
                            <option key={f} value={f}>Floor {f}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
                    <select 
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="All">All Status</option>
                        <option value="Vacant">Vacant</option>
                        <option value="Occupied">Occupied</option>
                        <option value="Assign">Assign</option>
                    </select>
                </div>

                {(filterBuilding !== 'All' || filterFloor !== 'All' || filterStatus !== 'All') && (
                    <button 
                        onClick={() => { setFilterBuilding('All'); setFilterFloor('All'); setFilterStatus('All'); }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        Reset Filters
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto space-y-6">
                {loading ? (
                    <div className="p-8 text-center text-slate-500 bg-white rounded-2xl shadow-sm border border-slate-200">Loading buildings...</div>
                ) : filteredBuildings.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 bg-white rounded-2xl shadow-sm border border-slate-200">
                        {buildings.length === 0 ? 'No buildings found. Click "Add Building" to get started.' : 'No rooms match your filters.'}
                    </div>
                ) : (
                    filteredBuildings.map(building => (
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
                                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                                {(building.rooms || []).filter(r => r.status?.toLowerCase() === 'occupied').length} Occupied
                                            </span>
                                            <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                                {(building.rooms || []).filter(r => r.status?.toLowerCase() === 'assign').length} Assign
                                            </span>
                                            <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                                {(building.rooms || []).filter(r => r.status?.toLowerCase() === 'vacant').length} Vacant
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedBuildingId(building.id);
                                        setBulkForm(prev => ({ ...prev, end_floor: building.total_floor || 1 }));
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
                                            <div 
                                                key={room.id} 
                                                onClick={() => fetchRoomDetails(room)}
                                                className={`border rounded-xl p-4 flex flex-col items-center justify-center text-center relative transition-all hover:shadow-md cursor-pointer group ${getRoomCardStyle(room.status)}`}
                                            >
                                                {room.pet_status && (
                                                    <div className="absolute top-2 right-2 text-amber-600 bg-white/80 backdrop-blur-sm p-1 rounded-full shadow-sm" title="Pet Friendly">
                                                        <PawPrint size={14} />
                                                    </div>
                                                )}
                                                <DoorOpen size={24} className={`mb-2 transition-colors ${getRoomIconColor(room.status)}`} />
                                                <h3 className="font-bold text-lg text-slate-800">{room.room_number}</h3>
                                                <p className="text-xs text-slate-500 font-medium tracking-wide">Floor {room.floor}</p>
                                                <div className={`mt-3 text-[10px] font-black px-2.5 py-1 rounded-full tracking-wider shadow-sm capitalize ${getRoomBadgeStyle(room.status)}`}>
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
                                        onChange={e => setBuildingForm({...buildingForm, total_floor: e.target.value === '' ? '' as unknown as number : Number(e.target.value)})}
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
            {/* code is unchanged, we just append to the end of the file container */}
            {showRoomModal && selectedBuildingId && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <DoorOpen size={20} className="text-indigo-600" />
                                {createMode === 'single' ? 'Add New Room' : 'Bulk Generate Rooms'}
                            </h2>
                        </div>
                        
                        {/* TABS */}
                        <div className="flex border-b border-slate-200 bg-slate-50/50">
                            <button 
                                onClick={() => setCreateMode('single')}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${createMode === 'single' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Single Room
                            </button>
                            <button 
                                onClick={() => setCreateMode('bulk')}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${createMode === 'bulk' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                Bulk Generate
                            </button>
                        </div>

                        <div className="p-6">
                            {createMode === 'single' ? (
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
                                                onChange={e => setRoomForm({...roomForm, floor: e.target.value === '' ? '' as unknown as number : Number(e.target.value)})}
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
                                                onChange={e => setRoomForm({...roomForm, rent_price: e.target.value === '' ? '' as unknown as number : Number(e.target.value)})}
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
                            ) : (
                                <form id="bulk-room-form" onSubmit={handleCreateBulkRooms} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">From Floor</label>
                                            <input 
                                                type="number" required min="1" 
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2"
                                                value={bulkForm.start_floor}
                                                onChange={e => setBulkForm({...bulkForm, start_floor: e.target.value === '' ? '' as unknown as number : Number(e.target.value)})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">To Floor</label>
                                            <input 
                                                type="number" required min="1"
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2"
                                                value={bulkForm.end_floor}
                                                onChange={e => setBulkForm({...bulkForm, end_floor: e.target.value === '' ? '' as unknown as number : Number(e.target.value)})}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Rooms per Floor</label>
                                            <input 
                                                type="number" required min="1"
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2"
                                                value={bulkForm.rooms_per_floor}
                                                onChange={e => setBulkForm({...bulkForm, rooms_per_floor: e.target.value === '' ? '' as unknown as number : Number(e.target.value)})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Rent Price (฿)</label>
                                            <input 
                                                type="number" required min="0" step="100"
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2"
                                                value={bulkForm.rent_price}
                                                onChange={e => setBulkForm({...bulkForm, rent_price: e.target.value === '' ? '' as unknown as number : Number(e.target.value)})}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-end mt-2">
                                        <label className="flex items-center gap-3 cursor-pointer p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 text-indigo-600 rounded"
                                                checked={bulkForm.pet_status}
                                                onChange={e => setBulkForm({...bulkForm, pet_status: e.target.checked})}
                                            />
                                            <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                                <PawPrint size={14} className="text-amber-500"/>
                                                Pet Friendly (All generated)
                                            </span>
                                        </label>
                                    </div>
                                </form>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50">
                            <button
                                onClick={() => setShowRoomModal(false)}
                                className="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit" form={createMode === 'single' ? "room-form" : "bulk-room-form"} disabled={processing}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                            >
                                {processing ? 'Processing...' : (createMode === 'single' ? 'Create Single' : 'Generate All')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Room Details Modal */}
            {showEditRoomModal && selectedRoom && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <DoorOpen size={20} className="text-indigo-600" />
                                Room {selectedRoom.room_number}
                            </h2>
                            <div className={`text-[10px] font-black px-2.5 py-1 rounded-full tracking-wider shadow-sm capitalize ${getRoomBadgeStyle(selectedRoom.status)}`}>
                                {selectedRoom.status}
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Information Section */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Tenant Information</h3>
                                {['Occupied', 'occupied'].includes(selectedRoom.status) ? (
                                    currentTenant ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden border border-indigo-200 shadow-sm shrink-0">
                                                    {currentTenant.users?.profile_picture ? (
                                                        <img 
                                                            src={currentTenant.users.profile_picture} 
                                                            alt={currentTenant.users.full_name || 'Tenant'} 
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                // Fallback if image fails to load
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                            }}
                                                        />
                                                    ) : null}
                                                    <span className={`text-indigo-700 font-bold ${currentTenant.users?.profile_picture ? 'hidden' : ''}`}>
                                                        {(currentTenant.users?.full_name?.[0] || '?')}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 text-sm leading-tight">{currentTenant.users?.full_name || 'Unknown User'}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{currentTenant.users?.phone || 'No phone number'}</p>
                                                </div>
                                            </div>
                                            <div className="pt-2 mt-2 border-t border-slate-200 text-xs text-slate-500">
                                                <span className="font-bold text-slate-700">Contract:</span> {currentTenant.move_in || '-'} to {currentTenant.move_out || 'Active'}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center space-x-2 py-2">
                                            <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin"></div>
                                            <p className="text-xs font-bold text-slate-500">Loading details...</p>
                                        </div>
                                    )
                                ) : (
                                    <p className="text-sm font-medium text-slate-500 italic text-center py-2">Room is currently {selectedRoom.status.toLowerCase()}.</p>
                                )}
                            </div>

                            {/* Edit Form */}
                            <form id="edit-room-form" onSubmit={handleUpdateRoom} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Base Rent Price (฿)</label>
                                    <input 
                                        type="number" required min="0" step="100"
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-3 py-2 font-medium"
                                        value={editRoomForm.rent_price}
                                        onChange={e => setEditRoomForm({...editRoomForm, rent_price: e.target.value === '' ? '' as unknown as number : Number(e.target.value)})}
                                    />
                                    <p className="text-[10px] text-slate-400 font-medium italic mt-1.5">* Modifying rent only affects future contracts</p>
                                </div>
                                <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <PawPrint size={16} className={editRoomForm.pet_status ? "text-amber-500" : "text-slate-400"}/>
                                        Pet Friendly
                                    </span>
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                                        checked={editRoomForm.pet_status}
                                        onChange={e => setEditRoomForm({...editRoomForm, pet_status: e.target.checked})}
                                    />
                                </label>
                            </form>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-stretch bg-slate-50 gap-3">
                            <button
                                type="button"
                                onClick={handleDeleteRoom}
                                disabled={processing || ['Occupied', 'occupied', 'Assign', 'assign'].includes(selectedRoom.status)}
                                className={`px-4 py-2.5 rounded-xl font-bold flex items-center justify-center transition-all min-w-[48px] ${['Occupied', 'occupied', 'Assign', 'assign'].includes(selectedRoom.status) ? 'bg-slate-100 text-slate-400 cursor-not-allowed hidden' : 'bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border border-red-200 hover:border-red-500 shadow-sm'}`}
                                title={['Occupied', 'occupied', 'Assign', 'assign'].includes(selectedRoom.status) ? "Cannot delete an occupied room" : "Delete Room"}
                            >
                                <Trash2 size={18} />
                            </button>
                            <div className="flex gap-3 flex-1">
                                <button
                                    type="button"
                                    onClick={() => setShowEditRoomModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors shadow-sm"
                                >
                                    Close
                                </button>
                                <button
                                    type="submit" form="edit-room-form" disabled={processing}
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                    {processing ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
