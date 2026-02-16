'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Room } from '@/types/database';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export default function CreateContractPage() {
    const router = useRouter();
    // State for Branch/Building Selection
    const [branches, setBranches] = useState<{ id: number; branches_name: string; city: string }[]>([]);
    const [buildings, setBuildings] = useState<{ id: number; name_building: string }[]>([]);

    // Selected IDs
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');
    const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');

    // General UI States
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [contractNumberDisplay, setContractNumberDisplay] = useState('Select Branch...');

    // Room Data State
    const [rooms, setRooms] = useState<(Room & { residentCount: number })[]>([]);
    const [roomType, setRoomType] = useState<'vacant' | 'occupied'>('vacant');

    // Form Data State
    const [formData, setFormData] = useState({
        full_name: '',
        gender: 'male',
        phone: '',
        email: '',
        pet: 'none',
        residents: '1',
        identification_number: '',
        identification_type: 'THAI_ID' as 'THAI_ID' | 'PASSPORT',
        nation: 'Thai',
        room_id: '',
        move_in: '',
        durations: '12',
        move_out: '',
        username: '',
        password: '',
        is_primary_tenant: 'TRUE',
    });

    // Form Aux States
    const [petOption, setPetOption] = useState<'none' | 'dog' | 'cat' | 'other'>('none');
    const [petOtherText, setPetOtherText] = useState('');
    const [countryCode, setCountryCode] = useState('+66');
    const [moveOutRange, setMoveOutRange] = useState({ min: '', max: '' });
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        async function fetchInitialData() {
            try {
                // 1. Fetch All Branches
                const { data: branchData, error: branchError } = await supabase
                    .from('branch')
                    .select('id, city, branches_name')
                    .order('id');

                if (branchError) throw branchError;
                setBranches(branchData || []);

                // Set default branch if manager has one (Optional, but good UX)
                const storedName = localStorage.getItem('user_name') || 'Somsak Rakthai';
                const managerBranch = branchData?.find(b => b.branches_name.includes(storedName) || b.id === 387); // Hack for Admin User = 387 or logic
                // Actually, let's just default to the first one or let user pick.
                // Or better: try to find the one assigned to current user
                const { data: userBranch } = await supabase
                    .from('branch')
                    .select('id')
                    .eq('manager_name', storedName)
                    .single();

                if (userBranch) {
                    setSelectedBranchId(userBranch.id.toString());
                } else if (branchData && branchData.length > 0) {
                    setSelectedBranchId(branchData[0].id.toString());
                }

                // ... keep existing resident counting logic if needed, but it depends on rooms which depend on building
                // So we postpone fetching rooms until building is selected.

            } catch (error) {
                console.error('Error fetching initial data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchInitialData();
    }, []);

    // Fetch Buildings when Branch Changes
    useEffect(() => {
        async function fetchBuildings() {
            if (!selectedBranchId) {
                setBuildings([]);
                return;
            }

            const { data, error } = await supabase
                .from('building')
                .select('id, name_building')
                .eq('branch_id', parseInt(selectedBranchId))
                .order('name_building');

            if (!error) {
                setBuildings(data || []);
                // Reset building and rooms
                setSelectedBuildingId('');
                setRooms([]);
            }
        }

        fetchBuildings();
    }, [selectedBranchId]);

    // Fetch Rooms when Building Changes
    useEffect(() => {
        async function fetchRooms() {
            if (!selectedBuildingId) {
                setRooms([]);
                return;
            }

            try {
                // Fetch Rooms
                const { data: roomsData, error: roomsError } = await supabase
                    .from('room')
                    .select('*, building:building_id!inner(branch_id)')
                    .eq('building_id', parseInt(selectedBuildingId))
                    .order('room_number');

                if (roomsError) throw roomsError;

                // Fetch Active Contracts for Occupancy
                // We optimize by filtering contracts for these rooms only
                const roomIds = roomsData.map(r => r.id);
                if (roomIds.length === 0) {
                    setRooms([]);
                    return;
                }

                const { data: activeContracts, error: contractsError } = await supabase
                    .from('contract')
                    .select('room_id, user:user_id!inner(is_primary_tenant)')
                    .in('room_id', roomIds)
                    .in('status', ['Active', 'active', 'complete', 'incomplete']);

                if (contractsError) throw contractsError;

                // Calculate occupancy
                const occupancyMap = new Map<number, number>();
                activeContracts?.forEach(c => {
                    occupancyMap.set(c.room_id, (occupancyMap.get(c.room_id) || 0) + 1);
                });

                const roomsWithCount = roomsData.map(r => ({
                    ...r,
                    residentCount: occupancyMap.get(r.id) || 0
                }));

                setRooms(roomsWithCount as (Room & { residentCount: number })[]);

            } catch (error) {
                console.error("Error fetching rooms:", error);
            }
        }

        fetchRooms();
    }, [selectedBuildingId]);

    // Update Contract Number Display
    useEffect(() => {
        const branch = branches.find(b => b.id.toString() === selectedBranchId);
        if (branch) {
            setContractNumberDisplay(`${branch.city}_${branch.branches_name}_Waiting...`);
        } else {
            setContractNumberDisplay('Select Branch...');
        }
    }, [selectedBranchId, branches]);

    // Handle room type change effects
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            room_id: '', // Reset room selection
            is_primary_tenant: roomType === 'occupied' ? 'FALSE' : 'TRUE' // Auto-set primary tenant logic
        }));
    }, [roomType]);

    // Update formData.pet when options change
    useEffect(() => {
        if (petOption === 'none') {
            setFormData(prev => ({ ...prev, pet: 'none' }));
        } else if (petOption === 'other') {
            setFormData(prev => ({ ...prev, pet: petOtherText }));
        } else {
            setFormData(prev => ({ ...prev, pet: petOption }));
        }
    }, [petOption, petOtherText]);


    const calculateMoveOutRange = (moveInDateStr: string, durationMonthsStr: string) => {
        if (!moveInDateStr || !durationMonthsStr) return;

        const moveIn = new Date(moveInDateStr);
        const durations = parseInt(durationMonthsStr);

        // Calculate Expected Move Out Date (Move In + Duration)
        const expectedDate = new Date(moveIn);
        expectedDate.setMonth(expectedDate.getMonth() + durations);

        // Calculate Min and Max (+/- 7 days)
        const minDate = new Date(expectedDate);
        minDate.setDate(minDate.getDate() - 7);

        const maxDate = new Date(expectedDate);
        maxDate.setDate(maxDate.getDate() + 7);

        setMoveOutRange({
            min: minDate.toISOString().split('T')[0],
            max: maxDate.toISOString().split('T')[0]
        });

        // Set default move_out to expected date
        return expectedDate.toISOString().split('T')[0];
    };

    const formatPhoneNumber = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
        if (match) {
            return [match[1], match[2], match[3]].filter(x => x).join('-');
        }
        return value;
    };

    const formatThaiID = (value: string) => {
        const cleaned = value.replace(/\D/g, '');
        // X-XXXX-XXXXX-XX-X (1-4-5-2-1)
        // 1 2345 67890 12 3
        let formatted = '';
        if (cleaned.length > 0) formatted += cleaned.substring(0, 1);
        if (cleaned.length > 1) formatted += '-' + cleaned.substring(1, 5);
        if (cleaned.length > 5) formatted += '-' + cleaned.substring(5, 10);
        if (cleaned.length > 10) formatted += '-' + cleaned.substring(10, 12);
        if (cleaned.length > 12) formatted += '-' + cleaned.substring(12, 13);
        return formatted;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // Fullname Validation: Allow English only OR Thai only
        if (name === 'full_name') {
            // Check if input contains mixed scripts (excluding spaces)
            const isEnglish = /^[a-zA-Z\s]*$/.test(value);
            const isThai = /^[ก-๙\s]*$/.test(value);

            if (!isEnglish && !isThai && value !== '') {
                return; // Ignore invalid input
            }
        }

        // Phone Validation (Numbers only for the typing part, we handle dash in UI but raw value here?)
        if (name === 'phone') {
            const raw = value.replace(/\D/g, '');
            if (raw.length > 10) return; // Max 10 digits for standard mobile
            const formatted = formatPhoneNumber(raw);
            setFormData(prev => ({ ...prev, phone: formatted }));
            return;
        }

        // Username Validation (English, digits, underscore)
        if (name === 'username') {
            if (!/^[a-zA-Z0-9_]*$/.test(value)) return;
        }

        // Password Validation (No Thai)
        if (name === 'password') {
            if (/[\u0E00-\u0E7F]/.test(value)) return;
        }

        // Identification Number
        if (name === 'identification_number') {
            if (formData.identification_type === 'THAI_ID') {
                const raw = value.replace(/\D/g, '');
                if (raw.length > 13) return;
                const formatted = formatThaiID(raw);
                setFormData(prev => ({ ...prev, identification_number: formatted }));
                return;
            } else if (formData.identification_type === 'PASSPORT') {
                // Max 9 chars limit
                if (value.length > 9) return;
                // Allow alphanumeric only
                if (!/^[a-zA-Z0-9]*$/.test(value)) return;
            }
        }

        setFormData(prev => {
            const updated = { ...prev, [name]: value };

            // Auto-calculate move_out logic
            if (name === 'move_in' || name === 'durations') {
                const mIn = name === 'move_in' ? value : prev.move_in;
                const dur = name === 'durations' ? value : prev.durations;

                if (mIn && dur) {
                    const defaultMoveOut = calculateMoveOutRange(mIn, dur);
                    if (defaultMoveOut) updated.move_out = defaultMoveOut;
                }
            }

            // Check if room selection is valid regarding primary tenant
            if (name === 'room_id') {
                const rId = parseInt(value);
                const room = rooms.find(r => r.id === rId);

                if (roomType === 'vacant') {
                    if (room && room.residentCount > 0) {
                        alert('Selected room is not vacant.');
                        updated.room_id = '';
                    }
                } else if (roomType === 'occupied') {
                    if (room && room.residentCount >= 2) {
                        alert('Room is full (Max 2 residents).');
                        updated.room_id = '';
                    }
                }
            }

            return updated;
        });
    };

    const handleClear = () => {
        setFormData({
            full_name: '',
            gender: 'male',
            phone: '',
            email: '',
            pet: 'none',
            residents: '1',
            identification_number: '',
            identification_type: 'THAI_ID',
            nation: 'Thai',
            room_id: '',
            move_in: '',
            durations: '12',
            move_out: '',
            username: '',
            password: '',
            is_primary_tenant: 'TRUE',
        });
        setPetOption('none');
        setPetOtherText('');
        setCountryCode('+66');
        setMoveOutRange({ min: '', max: '' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Final Validations

        // Password Length
        if (formData.password.length < 8) {
            alert('Password must be at least 8 characters long.');
            return;
        }

        // Passport Pattern check
        if (formData.identification_type === 'PASSPORT') {
            // 2 letters + 7 numbers
            if (!/^[a-zA-Z]{2}\d{1,7}$/.test(formData.identification_number)) {
                alert('Passport format invalid. Must start with 2 letters followed by numbers (max 9 chars total).');
                return;
            }
        }

        // Thai ID Length
        if (formData.identification_type === 'THAI_ID') {
            const raw = formData.identification_number.replace(/-/g, '');
            if (raw.length !== 13) {
                alert('Thai ID must be 13 digits.');
                return;
            }
        }

        setSubmitting(true);

        const rId = parseInt(formData.room_id);
        const room = rooms.find(r => r.id === rId);

        // Double check room capacity based on type
        if (roomType === 'vacant') {
            if (room && room.residentCount > 0) {
                alert('Selected room is not vacant.');
                setSubmitting(false);
                return;
            }
        } else {
            if (room && room.residentCount >= 2) {
                alert('Room is full (Max 2 residents).');
                setSubmitting(false);
                return;
            }
        }

        try {
            // Combine Country code + Phone
            const finalPhone = `(${countryCode}) ${formData.phone}`;

            // 1. Create User
            const { data: userData, error: userError } = await supabase
                .from('users')
                .insert([{
                    full_name: formData.full_name,
                    sex: formData.gender,
                    phone: finalPhone,
                    e_mail: formData.email,
                    pet: formData.pet, // this is updated by effect
                    identification_number: formData.identification_number,
                    identification_type: formData.identification_type,
                    nation: formData.nation,
                    username: formData.username,
                    password: formData.password,
                    is_primary_tenant: formData.is_primary_tenant === 'TRUE',
                    role: 'tenant',
                }])
                .select()
                .single();

            if (userError) throw userError;

            // 2. Get Room details
            const selectedRoom = rooms.find(r => r.id === parseInt(formData.room_id));

            // 3. Create Contract (Status 'incomplete' initially, signed_at null)
            const { data: contractData, error: contractError } = await supabase
                .from('contract')
                .insert([{
                    user_id: userData.id,
                    room_id: parseInt(formData.room_id),
                    contract_number: 'PENDING',
                    move_in: formData.move_in,
                    move_out: formData.move_out,
                    durations: parseInt(formData.durations),
                    residents: parseInt(formData.residents),
                    status: 'incomplete',
                    signed_at: null,
                }])
                .select()
                .single();

            if (contractError) throw contractError;

            // 3.1 Update Contract Number using ACTUAL ID
            // Find selected branch info
            const currentBranch = branches.find(b => b.id.toString() === selectedBranchId);

            if (currentBranch && contractData) {
                const newContractNumber = `${currentBranch.city}_${currentBranch.branches_name}_${contractData.id}`;
                await supabase
                    .from('contract')
                    .update({ contract_number: newContractNumber })
                    .eq('id', contractData.id);
            }

            // 4. Update Room status and Recalculate Residents from DB (Self-Correcting)
            const { data: activeRoomContracts, error: countError } = await supabase
                .from('contract')
                .select('residents')
                .eq('room_id', parseInt(formData.room_id))
                .in('status', ['Active', 'active', 'complete', 'incomplete']);

            if (countError) throw countError;

            // Count number of contracts instead of summing 'residents' field (1 contract = 1 person)
            const totalResidents = activeRoomContracts?.length || 0;

            await supabase
                .from('room')
                .update({
                    status: totalResidents > 0 ? 'assign' : 'vacant', // Update status based on count
                    current_residents: totalResidents
                })
                .eq('id', parseInt(formData.room_id));

            // 5. Create Invoice (Entry Fee) - ONLY if Primary Tenant
            if (contractData && formData.is_primary_tenant === 'TRUE') {
                const billDate = new Date();
                const dueDate = new Date(billDate);
                dueDate.setDate(dueDate.getDate() + 7);

                await supabase
                    .from('invoice')
                    .insert([{
                        contract_id: contractData.id,
                        room_deposit_cost: 5000,
                        room_rent_cost: 0, // Rent is 0 (Post-paid: Collect at end of month)
                        room_water_cost: 0,
                        room_elec_cost: 0,
                        room_repair_cost: 0,
                        room_total_cost: 5000, // Total = Deposit
                        status: 'pending',
                        type: 'entry_fee',
                        bill_date: billDate.toISOString(),
                        due_date: dueDate.toISOString(),
                        paid_date: null
                    }]);
            }

            alert('Contract created successfully!');
            router.push('/manager/tenants');
        } catch (error) {
            console.error('Error creating contract:', error);
            alert('Error creating contract: ' + (error as Error).message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-white">Loading...</div>;

    const inputClass = "bg-white text-black text-sm rounded-lg px-4 py-2.5 border-2 border-blue-300 focus:outline-none focus:border-blue-500 w-full";
    const labelClass = "block text-white text-xs mb-1 ml-1";
    const selectClass = "bg-white text-black text-sm rounded-lg px-4 py-2.5 border-2 border-blue-300 focus:outline-none focus:border-blue-500 w-full appearance-none";

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-[#0047AB] w-full max-w-6xl rounded-3xl shadow-2xl p-8 text-white relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute right-0 top-0 w-64 h-64 opacity-10 pointer-events-none select-none">
                    <div className="text-[200px] font-bold text-white/20">📋</div>
                </div>

                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-4xl font-bold">Contract</h1>
                    <p className="text-sm opacity-80">Contract Number : {contractNumberDisplay}</p>
                </div>

                <div className="border-b border-white/30 mb-6" />

                <form onSubmit={handleSubmit}>
                    {/* Row 1: Full name, Gender, Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Full name (Thai or English only)</label>
                            <input
                                type="text"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="ex. Somsak Rakthai"
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Gender</label>
                            <select name="gender" value={formData.gender} onChange={handleChange} className={selectClass}>
                                <option value="male">male</option>
                                <option value="female">female</option>
                                <option value="LGBTQ+">LGBTQ+</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Phone</label>
                            <div className="flex gap-2">
                                <select
                                    className={`${selectClass} w-20 px-1 text-center`}
                                    value={countryCode}
                                    onChange={(e) => setCountryCode(e.target.value)}
                                >
                                    <option value="+66">🇹🇭 +66</option>
                                    <option value="+1">🇺🇸 +1</option>
                                    <option value="+44">🇬🇧 +44</option>
                                    <option value="+81">🇯🇵 +81</option>
                                    <option value="+86">🇨🇳 +86</option>
                                </select>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className={inputClass}
                                    placeholder="XXX-XXX-XXXX"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Email, Pet, Residents */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>E-mail</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="example@email.com"
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Pet</label>
                            <div className="flex gap-2">
                                <select
                                    value={petOption}
                                    onChange={(e) => setPetOption(e.target.value as 'none' | 'dog' | 'cat' | 'other')}
                                    className={selectClass}
                                >
                                    <option value="none">None</option>
                                    <option value="dog">Dog</option>
                                    <option value="cat">Cat</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            {petOption === 'other' && (
                                <input
                                    type="text"
                                    value={petOtherText}
                                    onChange={(e) => setPetOtherText(e.target.value)}
                                    className={`${inputClass} mt-2`}
                                    placeholder="Specify pet..."
                                    required
                                />
                            )}
                        </div>
                        <div>
                            <label className={labelClass}>Residents</label>
                            <select
                                name="residents"
                                value={formData.residents}
                                onChange={handleChange}
                                className={selectClass}
                            >
                                <option value="1">1 Person</option>
                                <option value="2">2 People</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 3: Identification Number, Identification Type, Nation */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Identification Number</label>
                            <input
                                type="text"
                                name="identification_number"
                                value={formData.identification_number}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder={formData.identification_type === 'THAI_ID' ? "X-XXXX-XXXXX-XX-X" : "Passport Number"}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Identification Type</label>
                            <select name="identification_type" value={formData.identification_type} onChange={handleChange} className={selectClass}>
                                <option value="THAI_ID">THAI_ID</option>
                                <option value="PASSPORT">PASSPORT</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Nation</label>
                            <input
                                type="text"
                                name="nation"
                                value={formData.nation}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="Thailand"
                            />
                        </div>
                    </div>

                    {/* Row 4: Room, Move in, Durations, Move out */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="flex flex-col">
                            <div className="flex justify-between items-center mb-1">
                                <label className={labelClass}>Select Branch & Building</label>
                            </div>

                            {/* Branch Selection */}
                            <select
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                                className={`${selectClass} mb-2`}
                            >
                                <option value="">Select Branch</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.branches_name} ({b.city})
                                    </option>
                                ))}
                            </select>

                            {/* Building Selection */}
                            <select
                                value={selectedBuildingId}
                                onChange={(e) => setSelectedBuildingId(e.target.value)}
                                className={`${selectClass} mb-2`}
                                disabled={!selectedBranchId}
                            >
                                <option value="">Select Building</option>
                                {buildings.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.name_building}
                                    </option>
                                ))}
                            </select>

                            <div className="flex justify-between items-center mb-1">
                                <label className={labelClass}>Room</label>
                                {/* Room Type Toggle */}
                                <div className="flex bg-blue-400 rounded-lg p-0.5 pointer-events-auto z-10">
                                    <button
                                        type="button"
                                        onClick={() => setRoomType('vacant')}
                                        className={`text-[10px] px-2 py-0.5 rounded-md transition-all ${roomType === 'vacant' ? 'bg-white text-[#0047AB] font-bold' : 'text-white/70'}`}
                                    >
                                        Vacant
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRoomType('occupied')}
                                        className={`text-[10px] px-2 py-0.5 rounded-md transition-all ${roomType === 'occupied' ? 'bg-white text-[#0047AB] font-bold' : 'text-white/70'}`}
                                    >
                                        Occupied
                                    </button>
                                </div>
                            </div>
                            <select name="room_id" value={formData.room_id} onChange={handleChange} className={selectClass} required disabled={!selectedBuildingId}>
                                <option value="">Select Room</option>
                                {rooms
                                    .filter(room => {
                                        // Pet Filter
                                        const hasPet = formData.pet && formData.pet.toLowerCase() !== 'none' && formData.pet.trim() !== '';
                                        if (hasPet && !room.pet_status) return false;

                                        if (roomType === 'vacant') {
                                            return room.status === 'vacant' || room.residentCount === 0;
                                        } else {
                                            return room.residentCount > 0 && room.residentCount < 2;
                                        }
                                    })
                                    .map(room => (
                                        <option key={room.id} value={room.id}>
                                            {room.room_number} ({room.residentCount}/2)
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Move in</label>
                            <input
                                type="date"
                                name="move_in"
                                value={formData.move_in}
                                onChange={handleChange}
                                className={inputClass}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Durations</label>
                            <input
                                type="number"
                                name="durations"
                                value={formData.durations}
                                onChange={handleChange}
                                className={inputClass}
                                min="1"
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Move out</label>
                            <input
                                type="date"
                                name="move_out"
                                value={formData.move_out}
                                onChange={handleChange}
                                className={inputClass}
                                min={moveOutRange.min}
                                max={moveOutRange.max}
                                required
                            />
                            <p className="text-[10px] text-white/70 mt-1">
                                * สามารถออกได้ก่อนหรือหลัง 7 วันจากวันที่นับตามจริง
                            </p>
                        </div>
                    </div>

                    {/* Row 4: Username, Password, Is primary tenant */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div>
                            <label className={labelClass}>Username (English only)</label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder=""
                                required
                            />
                        </div>
                        <div className="relative">
                            <label className={labelClass}>Password (Min 8 chars, No Thai)</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={`${inputClass} pr-10`}
                                    placeholder=""
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    onMouseDown={() => setShowPassword(true)}
                                    onMouseUp={() => setShowPassword(false)}
                                    onTouchStart={() => setShowPassword(true)} // Mobile support
                                    onTouchEnd={() => setShowPassword(false)}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Is primary tenant</label>
                            <select
                                name="is_primary_tenant"
                                value={formData.is_primary_tenant}
                                onChange={handleChange}
                                className={`${selectClass} ${roomType === 'occupied' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : ''}`}
                                disabled={roomType === 'occupied'}
                            >
                                <option value="TRUE">TRUE</option>
                                <option value="FALSE">FALSE</option>
                            </select>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-center gap-4">
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`px-10 py-3 rounded-full font-bold text-lg transition-all ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white shadow-lg`}
                        >
                            {submitting ? 'Creating...' : 'Confirm'}
                        </button>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="px-10 py-3 rounded-full font-bold text-lg bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all"
                        >
                            Clear
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
