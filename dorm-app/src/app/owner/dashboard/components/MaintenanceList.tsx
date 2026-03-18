import { Wrench } from 'lucide-react';

interface MaintenanceListProps {
    requests: {
        id: number;
        issue_description: string;
        status_technician: string;
        requested_at: string;
        room_number: string;
    }[];
}

export default function MaintenanceList({ requests }: MaintenanceListProps) {
    const pendingReqs = requests.filter(r => r.status_technician === 'Pending');
    const displayReqs = pendingReqs.slice(0, 5);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Wrench size={18} className="text-amber-500" />
                    Maintenance Queue
                </h3>
                <span className="text-xs font-bold bg-amber-50 text-amber-600 px-2 py-1 rounded-lg">
                    {pendingReqs.length} Active
                </span>
            </div>
            
            <div className="flex flex-col gap-3">
                {displayReqs.map(req => (
                    <div key={req.id} className="flex flex-col p-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Room {req.room_number}</span>
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-full">{req.status_technician}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-700 line-clamp-2">{req.issue_description}</p>
                        <p className="text-[10px] text-slate-400 mt-2 text-right">{new Date(req.requested_at).toLocaleDateString()}</p>
                    </div>
                ))}
                
                {displayReqs.length === 0 && (
                    <div className="text-center py-6 text-slate-400 italic">
                        No pending maintenance requests!
                    </div>
                )}
            </div>
        </div>
    );
}
