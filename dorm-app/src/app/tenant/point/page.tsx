'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Award, AlertTriangle, ShieldCheck, XCircle } from 'lucide-react';

export default function TenantPointPage() {
    const [score, setScore] = useState<number | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const userId = localStorage.getItem('user_id');
                if (!userId) return;

                // Fetch Score
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('tenant_score')
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
                console.error('Error fetching tenant point data:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0047AB]"></div>
            </div>
        );
    }

    const currentScore = score ?? 100;

    // Determine Status Level
    let statusText = 'Excellent';
    let statusColor = 'text-green-500';
    let bgPulse = 'bg-green-500';
    let StatusIcon = ShieldCheck;
    let message = 'Keep up the great work! Your timely payments maintain your excellent standing.';

    if (currentScore < 50) {
        statusText = 'Critical';
        statusColor = 'text-red-600';
        bgPulse = 'bg-red-600';
        StatusIcon = XCircle;
        message = 'Your score is very low due to payment infractions. Please contact the manager immediately.';
    } else if (currentScore < 90) {
        statusText = 'Warning';
        statusColor = 'text-orange-500';
        bgPulse = 'bg-orange-500';
        StatusIcon = AlertTriangle;
        message = 'You have recently paid late. Please ensure future invoices are paid on time.';
    }

    // Dynamic progress circle
    const radius = 120;
    const stroke = 24;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (currentScore / 100) * circumference;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-[#0047AB] flex items-center gap-3">
                    <Award size={32} /> My Behavior Points
                </h1>
                <button 
                    onClick={() => setIsHistoryOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all font-bold text-sm shadow-sm"
                >
                    <AlertTriangle size={18} className="text-orange-500" /> View History
                </button>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-10">
                {/* Score Section */}
                <div className="bg-white rounded-3xl p-10 shadow-lg border border-gray-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    {/* Decorative background */}
                    <div className={`absolute top-0 w-full h-2 ${bgPulse} opacity-80`} />
                    
                    <h2 className="text-gray-500 font-medium uppercase tracking-widest mb-8">Current Score</h2>

                    <div className="relative flex items-center justify-center mb-8 transform transition-transform duration-700 hover:scale-105">
                        <svg
                            height={radius * 2}
                            width={radius * 2}
                            className="transform -rotate-90"
                        >
                            <circle
                                stroke="#f3f4f6"
                                fill="transparent"
                                strokeWidth={stroke}
                                r={normalizedRadius}
                                cx={radius}
                                cy={radius}
                            />
                            <circle
                                stroke="currentColor"
                                fill="transparent"
                                strokeWidth={stroke}
                                strokeDasharray={circumference + ' ' + circumference}
                                style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s ease-in-out' }}
                                r={normalizedRadius}
                                cx={radius}
                                cy={radius}
                                className={statusColor}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center">
                            <span className={`text-6xl font-black ${statusColor} drop-shadow-sm`}>{currentScore}</span>
                            <span className="text-gray-400 font-bold mt-1 text-sm">/ 100</span>
                        </div>
                    </div>

                    <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full border shadow-sm ${statusColor} bg-white font-bold text-lg text-center`}>
                        <StatusIcon size={24} /> {statusText}
                    </div>
                    
                    <p className="mt-6 text-gray-600 font-medium max-w-sm">
                        {message}
                    </p>
                </div>

                {/* Rules Info Section */}
                <div className="bg-gradient-to-br from-[#0047AB] to-[#003380] rounded-3xl p-8 shadow-xl text-white">
                    <h2 className="text-2xl font-bold mb-6 border-b border-white/20 pb-4">How Points Work</h2>
                    
                    <p className="text-blue-100 font-light mb-6 leading-relaxed">
                        Every tenant starts with 100 behavior points. Points reflect your punctuality and adherence to dormitory rules. Deductions happen automatically when invoices become overdue.
                    </p>

                    <div className="space-y-4">
                        <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors">
                            <div className="flex items-start gap-4">
                                <span className="bg-orange-500 text-white font-black px-3 py-1 rounded shadow-md shrink-0">
                                    -10 pt
                                </span>
                                <div>
                                    <h3 className="font-bold text-lg mb-1">Late Payment (1-7 Days)</h3>
                                    <p className="text-sm text-blue-100">Deducted when a bill is paid slightly past its due date.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-sm border border-red-500/30 hover:bg-red-500/20 transition-colors">
                            <div className="flex items-start gap-4">
                                <span className="bg-red-500 text-white font-black px-3 py-1 rounded shadow-md shrink-0">
                                    -50 pt
                                </span>
                                <div>
                                    <h3 className="font-bold text-lg mb-1">Extreme Late (&gt;7 Days)</h3>
                                    <p className="text-sm text-blue-100">Deducted when a payment is extremely late. Requires a mandatory meeting with the manager.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 text-center text-xs text-blue-300 font-bold uppercase tracking-widest">
                        Stay at 100 for a perfect record
                    </div>
                </div>
            </div>

            {/* History Modal */}
            {isHistoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div 
                        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <AlertTriangle className="text-orange-500" /> Deduction History
                            </h2>
                            <button 
                                onClick={() => setIsHistoryOpen(false)}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {history.length === 0 ? (
                                <div className="text-center py-12">
                                    <ShieldCheck size={48} className="mx-auto text-green-300 mb-4" />
                                    <p className="text-gray-500 font-medium">No point deductions found.</p>
                                    <p className="text-gray-400 text-sm">You have a perfect record!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {history.map((item) => (
                                        <div key={item.id} className="flex flex-col p-4 rounded-2xl bg-gray-50 transition-all border border-gray-100">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-bold text-gray-900 text-sm">{item.title}</h3>
                                                <span className={`font-black px-2 py-0.5 rounded text-xs ${item.title.includes('Extreme') ? 'text-red-500 bg-red-50 border border-red-100' : 'text-orange-500 bg-orange-50 border border-orange-100'}`}>
                                                    {item.title.includes('Extreme') ? '-50' : '-10'} PT
                                                </span>
                                            </div>
                                            <p className="text-gray-600 text-xs mb-2 leading-relaxed">{item.description}</p>
                                            <span className="text-[10px] text-gray-400 font-mono mt-auto">{new Date(item.created_at).toLocaleString('en-GB')}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 text-center">
                            <button 
                                onClick={() => setIsHistoryOpen(false)}
                                className="w-full py-3 bg-[#0047AB] text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
