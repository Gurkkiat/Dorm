import { Bell, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export type NotificationType = 'alert' | 'warning' | 'info' | 'success';

export interface NotificationItem {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    date: string;
}

export default function NotificationPanel({ notifications }: { notifications: NotificationItem[] }) {
    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'alert': return <AlertTriangle size={16} className="text-rose-500" />;
            case 'warning': return <AlertTriangle size={16} className="text-amber-500" />;
            case 'success': return <CheckCircle2 size={16} className="text-emerald-500" />;
            case 'info':
            default: return <Info size={16} className="text-blue-500" />;
        }
    };

    const getBgColor = (type: NotificationType) => {
        switch (type) {
            case 'alert': return 'bg-rose-50 border-rose-100';
            case 'warning': return 'bg-amber-50 border-amber-100';
            case 'success': return 'bg-emerald-50 border-emerald-100';
            case 'info':
            default: return 'bg-blue-50 border-blue-100';
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Bell size={18} className="text-indigo-600" />
                    System Notifications
                </h3>
            </div>
            
            <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {notifications.map(notif => (
                    <div key={notif.id} className={`p-4 rounded-xl border ${getBgColor(notif.type)} flex gap-3 pb-4`}>
                        <div className="mt-0.5">{getIcon(notif.type)}</div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-slate-800">{notif.title}</h4>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">{new Date(notif.date).toLocaleDateString()}</p>
                        </div>
                    </div>
                ))}

                {notifications.length === 0 && (
                    <div className="text-center py-8 text-slate-400 italic">
                        No new notifications!
                    </div>
                )}
            </div>
        </div>
    );
}
