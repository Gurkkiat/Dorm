'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useManager } from '../ManagerContext';
import { Bell, Clock, Calendar, CheckCircle, Wrench, AlertCircle, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PointScoreModal from '@/components/PointScoreModal';

interface NotificationItem {
    id: string;
    type: 'meeting_draft' | 'meeting_confirm' | 'maintenance' | 'system' | 'penalty' | 'meeting';
    title: string;
    description: string;
    date: string;
    link: string;
    isRead: boolean;
    urgent: boolean;
}

export default function ManagerNotificationsPage() {
    const { selectedBranchId, branches } = useManager();
    const router = useRouter();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Popup State
    const [isPointModalOpen, setIsPointModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const currentBranchName = branches.find(b => b.id === selectedBranchId)?.branches_name || 'All Branches';

    useEffect(() => {
        async function fetchNotifications() {
            setLoading(true);
            try {
                const fetchedNotifs: NotificationItem[] = [];

                // 1. Fetch Invoices with Meeting Workflow
                let invQuery = supabase
                    .from('invoice')
                    .select('*, contract:contract_id(room:room_id(building:building_id(branch_id)))')
                    .in('meeting_status', ['pending_manager', 'pending_manager_confirm', 'pending_tenant']);

                const { data: invoices, error: invError } = await invQuery;
                if (invError) throw invError;

                if (invoices) {
                    for (const inv of invoices) {
                        const bId = (inv.contract as any)?.room?.building?.branch_id;
                        if (selectedBranchId !== 'All' && bId !== selectedBranchId) continue;

                        if (inv.meeting_status === 'pending_manager') {
                            fetchedNotifs.push({
                                id: `inv_meeting_${inv.id}`,
                                type: 'meeting_draft',
                                title: 'Meeting Required (Overdue Payment)',
                                description: `Invoice #${inv.id} was paid >7 days late. You must schedule a meeting.`,
                                date: inv.paid_date || new Date().toISOString(),
                                link: `/manager/invoices/${inv.id}/verify`,
                                isRead: false,
                                urgent: true
                            });
                        } else if (inv.meeting_status === 'pending_manager_confirm') {
                            fetchedNotifs.push({
                                id: `inv_confirm_${inv.id}`,
                                type: 'meeting_confirm',
                                title: 'Tenant Responded to Meeting Request',
                                description: `Invoice #${inv.id}: The tenant has confirmed your meeting. Please finalize it.`,
                                date: new Date().toISOString(),
                                link: `/manager/invoices/${inv.id}/verify`,
                                isRead: false,
                                urgent: true
                            });
                        }
                    }
                }

                // 2. Fetch Pending Maintenance
                let maintQuery = supabase
                    .from('maintenance_request')
                    .select('*, room:room_id(building:building_id(branch_id))')
                    .eq('status_technician', 'Pending');
                
                const { data: maintenances } = await maintQuery;
                if (maintenances) {
                    for (const m of maintenances) {
                        const bId = (m.room as any)?.building?.branch_id;
                        if (selectedBranchId !== 'All' && bId !== selectedBranchId) continue;
                        
                        fetchedNotifs.push({
                            id: `m_pending_${m.id}`,
                            type: 'maintenance',
                            title: 'New Maintenance Request',
                            description: `Request #${m.request_number || m.id}: ${m.issue_description}`,
                            date: m.requested_at,
                            link: `/manager/maintenance`,
                            isRead: false,
                            urgent: false
                        });
                    }
                }

                // 3. Fetch Persistent Notifications
                const { data: persistentNotifs, error: pError } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('is_read', false)
                    .order('created_at', { ascending: false });
                
                if (pError) throw pError;
                if (persistentNotifs) {
                    for (const pn of persistentNotifs) {
                        fetchedNotifs.push({
                            id: pn.id,
                            type: pn.type as any,
                            title: pn.title,
                            description: pn.description,
                            date: pn.created_at,
                            link: pn.link || '#',
                            isRead: pn.is_read,
                            urgent: pn.type === 'penalty' || pn.type === 'meeting'
                        });
                    }
                }
                setNotifications(fetchedNotifs);
            } catch (err) {
                console.error('Error fetching manager notifications', err);
            } finally {
                setLoading(false);
            }
        }

        fetchNotifications();
    }, [selectedBranchId, branches]);

    const markAsRead = async (id: string | number) => {
        if (typeof id === 'string' && id.length > 20) { 
            try {
                await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('id', id);
                
                setNotifications(prev => prev.filter(n => n.id !== id));
            } catch (err) {
                console.error('Error marking as read:', err);
            }
        }
    };

    const handleNotifClick = (notif: NotificationItem, e: React.MouseEvent) => {
        if (notif.link?.includes('userId=')) {
            e.preventDefault();
            const url = new URL(notif.link, window.location.origin);
            const uid = url.searchParams.get('userId');
            if (uid) {
                setSelectedUserId(uid);
                setIsPointModalOpen(true);
                markAsRead(notif.id);
            }
        } else if (notif.link && notif.link !== '#') {
            markAsRead(notif.id);
            router.push(notif.link);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0047AB]"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Bell className="text-[#0047AB]" size={36} /> Notifications
                    </h1>
                    <p className="text-gray-500 mt-2">Manage alerts and actions for {currentBranchName}</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 font-bold text-[#0047AB]">
                    {notifications.length} Unread Actions
                </div>
            </div>

            {notifications.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-sm flex flex-col items-center">
                    <div className="bg-blue-50 p-6 rounded-full text-blue-300 mb-6">
                        <CheckCircle size={64} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">You're all caught up!</h2>
                    <p className="text-gray-500">There are no pending actions or notifications for this branch.</p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="divide-y divide-gray-100">
                        {notifications.map((notif) => (
                            <div 
                                key={notif.id}
                                onClick={(e) => handleNotifClick(notif, e)}
                                className="group block cursor-pointer hover:bg-slate-50 transition-colors p-6 relative overflow-hidden"
                            >
                                {notif.urgent && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" />
                                )}
                                <div className="flex items-start gap-5">
                                    <div className={`p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-105 ${
                                        notif.type === 'meeting_draft' ? 'bg-orange-100 text-orange-600' :
                                        notif.type === 'meeting_confirm' ? 'bg-indigo-100 text-indigo-600' :
                                        notif.type === 'maintenance' ? 'bg-blue-100 text-blue-600' :
                                        notif.type === 'penalty' || notif.type === 'meeting' ? 'bg-rose-100 text-rose-600' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {notif.type === 'meeting_draft' ? <Clock size={28} /> :
                                         notif.type === 'meeting_confirm' ? <Calendar size={28} /> :
                                         notif.type === 'maintenance' ? <Wrench size={28} /> :
                                         notif.type === 'penalty' || notif.type === 'meeting' ? <AlertCircle size={28} /> :
                                         <AlertCircle size={28} />}
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className={`text-lg font-bold truncate ${notif.urgent ? 'text-gray-900' : 'text-gray-800'}`}>
                                                {notif.title}
                                            </h3>
                                            <span className="text-xs text-gray-400 font-mono whitespace-nowrap ml-4">
                                                {new Date(notif.date).toLocaleDateString('en-GB')}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 text-sm leading-relaxed pr-8">
                                            {notif.description}
                                        </p>
                                    </div>
                                    <div className="p-2 text-gray-300 group-hover:text-[#0047AB] transform translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all self-center">
                                        <ChevronRight size={24} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Score Detail Modal */}
            <PointScoreModal 
                isOpen={isPointModalOpen}
                onClose={() => setIsPointModalOpen(false)}
                userId={selectedUserId || ''}
            />
        </div>
    );
}
