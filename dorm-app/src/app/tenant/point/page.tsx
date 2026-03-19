'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Award, AlertTriangle, ShieldCheck, XCircle } from 'lucide-react';

export default function TenantPointPage() {
    const [score, setScore] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchScore() {
            setLoading(true);
            try {
                const userId = localStorage.getItem('user_id');
                if (!userId) return;

                const { data, error } = await supabase
                    .from('users')
                    .select('tenant_score')
                    .eq('id', userId)
                    .single();

                if (error) throw error;
                if (data) {
                    setScore(data.tenant_score ?? 100);
                }
            } catch (err) {
                console.error('Error fetching tenant score:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchScore();
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
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold text-[#0047AB] mb-6 flex items-center gap-3">
                <Award size={32} /> My Behavior Points
            </h1>

            <div className="grid md:grid-cols-2 gap-8">
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

                    <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full border shadow-sm ${statusColor} bg-white font-bold text-lg`}>
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
        </div>
    );
}
