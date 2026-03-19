'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Award, AlertTriangle, ShieldCheck, XCircle, X } from 'lucide-react';

interface PointScoreModalProps {
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    userName?: string;
}

export default function PointScoreModal({ userId, isOpen, onClose, userName }: PointScoreModalProps) {
    const [score, setScore] = useState<number | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !userId) return;

        async function fetchData() {
            setLoading(true);
            try {
                // Fetch Score
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('tenant_score, full_name')
                    .eq('id', userId)
                    .single();

                if (userError) throw userError;
                if (userData) {
                    setScore(userData.tenant_score ?? 100);
                }

                // Fetch Penalty History from Notifications
                const { data: notifs, error: notifError } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('type', 'penalty')
                    .order('created_at', { ascending: false });
                
                if (notifError) throw notifError;
                setHistory(notifs || []);

            } catch (err) {
                console.error('Error fetching point data:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [isOpen, userId]);

    if (!isOpen) return null;

    const currentScore = score ?? 100;

    // Determine Status Level
    let statusText = 'Excellent';
    let statusColor = 'text-green-500';
    let bgPulse = 'bg-green-500';
    let StatusIcon = ShieldCheck;

    if (currentScore < 50) {
        statusText = 'Critical';
        statusColor = 'text-red-600';
        bgPulse = 'bg-red-600';
        StatusIcon = XCircle;
    } else if (currentScore < 90) {
        statusText = 'Warning';
        statusColor = 'text-orange-500';
        bgPulse = 'bg-orange-500';
        StatusIcon = AlertTriangle;
    }

    // Dynamic progress circle
    const radius = 80;
    const stroke = 12;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (currentScore / 100) * circumference;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div 
                className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-[#0047AB] rounded-xl">
                            <Award size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Behavior Score Details</h2>
                            {userName && <p className="text-xs text-gray-500 font-medium">Tenant: {userName}</p>}
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0047AB] mb-4"></div>
                            <p className="text-gray-400 font-medium">Loading details...</p>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-8 h-full">
                            {/* Score Side */}
                            <div className="flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl border border-gray-100 relative">
                                <div className={`absolute top-0 w-full h-1.5 ${bgPulse} opacity-80 rounded-t-2xl`} />
                                <h3 className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-6">Current Standing</h3>
                                
                                <div className="relative flex items-center justify-center mb-6">
                                    <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                                        <circle stroke="#e2e8f0" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
                                        <circle
                                            stroke="currentColor"
                                            fill="transparent"
                                            strokeWidth={stroke}
                                            strokeDasharray={circumference + ' ' + circumference}
                                            style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s ease-out' }}
                                            r={normalizedRadius} cx={radius} cy={radius}
                                            className={statusColor}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center">
                                        <span className={`text-4xl font-black ${statusColor}`}>{currentScore}</span>
                                        <span className="text-gray-400 text-[10px] font-bold">/ 100</span>
                                    </div>
                                </div>

                                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border bg-white shadow-sm font-bold text-sm mb-4 ${statusColor}`}>
                                    <StatusIcon size={18} /> {statusText}
                                </div>
                            </div>

                            {/* History Side */}
                            <div className="flex flex-col h-full min-h-[300px]">
                                <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <AlertTriangle size={16} className="text-orange-500" /> Deduction History
                                </h3>
                                
                                <div className="flex-1 space-y-3 pr-2">
                                    {history.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center py-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                            <ShieldCheck size={32} className="text-green-300 mb-2" />
                                            <p className="text-xs text-gray-400 font-medium uppercase">Perfect Record</p>
                                        </div>
                                    ) : (
                                        history.map((item) => {
                                            const isExtreme = item.title.includes('Extreme') || 
                                                             item.title.includes('Severe') || 
                                                             item.description.includes('50 points');
                                            
                                            return (
                                                <div key={item.id} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:border-gray-200 transition-all">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] font-bold uppercase text-[#0047AB]">{item.title}</span>
                                                        <span className={`text-xs font-black ${isExtreme ? 'text-red-500 bg-red-50 px-1 rounded' : 'text-orange-500 bg-orange-50 px-1 rounded'}`}>
                                                            {isExtreme ? '-50' : '-10'} PT
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-gray-600 mb-1 leading-snug">{item.description}</p>
                                                    <p className="text-[9px] text-gray-400 font-mono text-right">{new Date(item.created_at).toLocaleDateString('en-GB')}</p>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                    <button 
                        onClick={onClose}
                        className="w-full py-3 bg-[#0047AB] text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]"
                    >
                        Close Details
                    </button>
                    <p className="text-[10px] text-gray-400 text-center mt-4 uppercase tracking-[0.2em] font-medium opacity-60">
                        Secure Member Information • Dorm Management System
                    </p>
                </div>
            </div>
        </div>
    );
}
