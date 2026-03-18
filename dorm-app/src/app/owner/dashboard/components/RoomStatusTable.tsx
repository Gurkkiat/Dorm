import { DoorOpen } from 'lucide-react';

interface RoomStatusTableProps {
    rooms: { 
        id: number; 
        room_number: string; 
        status: string;
        buildingName: string;
    }[];
}

export default function RoomStatusTable({ rooms }: RoomStatusTableProps) {
    const displayRooms = [...rooms].sort((a, b) => a.room_number.localeCompare(b.room_number));

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <DoorOpen size={18} className="text-indigo-600" />
                    Room Status Database
                </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[200px]">
                <table className="w-full text-left text-sm relative">
                    <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 shadow-sm">
                        <tr className="border-b border-slate-100 text-slate-400">
                            <th className="pb-3 pt-2 font-medium bg-transparent">Room</th>
                            <th className="pb-3 pt-2 font-medium bg-transparent">Building</th>
                            <th className="pb-3 pt-2 font-medium text-right bg-transparent">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRooms.map((room) => (
                            <tr key={room.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group">
                                <td className="py-3 font-bold text-slate-700 transition-colors">{room.room_number}</td>
                                <td className="py-3 text-slate-500">{room.buildingName}</td>
                                <td className="py-3 text-right">
                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                        room.status.toLowerCase() === 'available' || room.status.toLowerCase() === 'vacant' ? 'bg-emerald-100 text-emerald-700' : 
                                        room.status.toLowerCase() === 'occupied' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {room.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {displayRooms.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-center py-6 text-slate-400 italic">No rooms to display.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
