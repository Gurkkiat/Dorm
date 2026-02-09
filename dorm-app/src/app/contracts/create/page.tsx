
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { User, Room } from '@/types/database';
import { useRouter } from 'next/navigation';

export default function CreateContractPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [formData, setFormData] = useState({
        user_id: '',
        room_id: '',
        contract_number: '',
        move_in: '',
        move_out: '',
        durations: 12,
        residents: 1,
        rent_price: 0,
    });

    useEffect(() => {
        async function fetchData() {
            try {
                const { data: usersData, error: usersError } = await supabase
                    .from('users')
                    .select('*');

                const { data: roomsData, error: roomsError } = await supabase
                    .from('room')
                    .select('*')
                    .eq('status', 'Available'); // Assuming 'Available' is the status for empty rooms

                if (usersError) throw usersError;
                if (roomsError) throw roomsError;

                setUsers(usersData || []);
                setRooms(roomsData || []);
            } catch (error) {
                console.error('Error fetching data:', error);
                alert('Error fetching data. Please check console.');
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase
                .from('contract')
                .insert([
                    {
                        ...formData,
                        user_id: parseInt(formData.user_id),
                        room_id: parseInt(formData.room_id),
                        status: 'Active',
                        signed_at: new Date().toISOString(),
                    },
                ])
                .select();

            if (error) throw error;

            alert('Contract created successfully!');
            router.push('/'); // Redirect to dashboard or contracts list
        } catch (error) {
            console.error('Error creating contract:', error);
            alert('Error creating contract. Please check console.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto p-8">
            <h1 className="text-2xl font-bold mb-6">Create New Contract</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Contract Number */}
                <div>
                    <label className="block text-sm font-medium mb-1">Contract Number</label>
                    <input
                        type="text"
                        name="contract_number"
                        required
                        className="w-full p-2 border rounded"
                        placeholder="e.g. CNT-2023-001"
                        onChange={handleChange}
                    />
                </div>

                {/* User Selection */}
                <div>
                    <label className="block text-sm font-medium mb-1">Tenant (User)</label>
                    <select
                        name="user_id"
                        required
                        className="w-full p-2 border rounded"
                        onChange={handleChange}
                        defaultValue=""
                    >
                        <option value="" disabled>Select a user</option>
                        {users.map(user => (
                            <option key={user.id} value={user.id}>
                                {user.full_name} ({user.identification_number})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Room Selection */}
                <div>
                    <label className="block text-sm font-medium mb-1">Room</label>
                    <select
                        name="room_id"
                        required
                        className="w-full p-2 border rounded"
                        onChange={handleChange}
                        defaultValue=""
                    >
                        <option value="" disabled>Select a room</option>
                        {rooms.map(room => (
                            <option key={room.id} value={room.id}>
                                {room.room_number} (Floor {room.floor}) - {room.rent_price} THB
                            </option>
                        ))}
                    </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Move In Date</label>
                        <input
                            type="date"
                            name="move_in"
                            required
                            className="w-full p-2 border rounded"
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Move Out Date</label>
                        <input
                            type="date"
                            name="move_out"
                            required
                            className="w-full p-2 border rounded"
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {/* Duration & Residents */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Duration (Months)</label>
                        <input
                            type="number"
                            name="durations"
                            required
                            min="1"
                            className="w-full p-2 border rounded"
                            value={formData.durations}
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Residents</label>
                        <input
                            type="number"
                            name="residents"
                            required
                            min="1"
                            className="w-full p-2 border rounded"
                            value={formData.residents}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {/* Rent Price */}
                <div>
                    <label className="block text-sm font-medium mb-1">Rent Price (THB)</label>
                    <input
                        type="number"
                        name="rent_price"
                        required
                        min="0"
                        className="w-full p-2 border rounded"
                        value={formData.rent_price}
                        onChange={handleChange}
                    />
                </div>

                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
                    disabled={loading}
                >
                    {loading ? 'Creating...' : 'Create Contract'}
                </button>
            </form>
        </div>
    );
}
