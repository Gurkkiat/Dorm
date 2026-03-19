'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Bell, AlertCircle, Info, CheckCircle, ChevronRight, Inbox } from 'lucide-react';
import Link from 'next/link';
import PointScoreModal from '@/components/PointScoreModal';

interface NotificationItem {
    id: string;
    type: 'penalty' | 'meeting' | 'payment' | 'system' | 'maintenance';
    title: string;
    description: string;
    created_at: string;
    is_read: boolean;
    link: string | null;
}

export default function TenantNotificationsPage() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Popup State
    const [isPointModalOpen, setIsPointModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    useEffect(() => {
        const fetchNotifications = async () => {
            setLoading(true);
            try {
                const userId = localStorage.getItem('user_id');
                if (!userId) return;

                const { data, error } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                if (data) setNotifications(data);
            } catch (err) {
                console.error('Error fetching notifications:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);
            
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    };

    const handleViewDetails = (notif: NotificationItem, e: React.MouseEvent) => {
        if (notif.type === 'penalty' && notif.link?.includes('userId=')) {
            e.preventDefault();
            const url = new URL(notif.link, window.location.origin);
            const uid = url.searchParams.get('userId');
            if (uid) {
                setSelectedUserId(uid);
                setIsPointModalOpen(true);
                markAsRead(notif.id);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0047AB]"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-[#0047AB] flex items-center gap-3">
                        <Bell size={32} /> Notifications
                    </h1>
                    <p className="text-gray-500 mt-1">Stay updated with your account activity</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 font-bold text-[#0047AB]">
                    {notifications.filter(n => !n.is_read).length} Unread
                </div>
            </div>

            {notifications.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-sm flex flex-col items-center">
                    <div className="bg-slate-50 p-6 rounded-full text-slate-300 mb-6 font-light">
                        <Inbox size={64} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">No notifications yet</h2>
                    <p className="text-gray-500">We'll notify you here about payments, penalties, and more.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {notifications.map((notif) => (
                        <div 
                            key={notif.id}
                            className={`group relative bg-white rounded-2xl border transition-all duration-300 ${
                                notif.is_read ? 'border-gray-100 opacity-75' : 'border-blue-100 shadow-md ring-1 ring-blue-50'
                            }`}
                        >
                            {!notif.is_read && (
                                <div className="absolute left-0 top-4 bottom-4 w-1 bg-blue-500 rounded-r-full" />
                            )}
                            
                            <div className="p-6 flex items-start gap-5">
                                <div className={`p-4 rounded-xl shrink-0 ${
                                    notif.type === 'penalty' ? 'bg-rose-100 text-rose-600' :
                                    notif.type === 'payment' ? 'bg-emerald-100 text-emerald-600' :
                                    notif.type === 'meeting' ? 'bg-orange-100 text-orange-600' :
                                    'bg-blue-100 text-blue-600'
                                }`}>
                                    {notif.type === 'penalty' ? <AlertCircle size={24} /> :
                                     notif.type === 'payment' ? <CheckCircle size={24} /> :
                                     <Info size={24} />}
                                </div>
                                
                                <div className="flex-1 min-w-0 pt-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className={`text-lg font-bold truncate ${notif.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                                            {notif.title}
                                        </h3>
                                        <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                                            {new Date(notif.created_at).toLocaleDateString('en-GB')}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                                        {notif.description}
                                    </p>
                                    
                                    <div className="flex items-center gap-4">
                                        {notif.link && (
                                            <Link 
                                                href={notif.link}
                                                className="text-sm font-bold text-[#0047AB] hover:underline flex items-center gap-1"
                                                onClick={(e) => handleViewDetails(notif, e)}
                                            >
                                                View Details <ChevronRight size={14} />
                                            </Link>
                                        )}
                                        {!notif.is_read && (
                                            <button 
                                                onClick={() => markAsRead(notif.id)}
                                                className="text-xs font-medium text-gray-400 hover:text-gray-600"
                                            >
                                                Mark as read
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
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
