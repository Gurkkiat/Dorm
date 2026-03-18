'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Globe, Database, Key, HardDrive, RefreshCw, CheckCircle2 } from 'lucide-react';

interface ServiceHealth {
    name: string;
    status: 'checking' | 'operational' | 'degraded' | 'error';
    latency: number | null;
    icon: any;
}

export default function InfrastructureHealth() {
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [services, setServices] = useState<ServiceHealth[]>([
        { name: 'Primary Database', status: 'checking', latency: null, icon: Database },
        { name: 'Authentication API', status: 'checking', latency: null, icon: Key },
        { name: 'Storage Buckets', status: 'checking', latency: null, icon: HardDrive },
    ]);

    const runDiagnostics = async () => {
        setIsRefreshing(true);
        const newServices = [...services].map(s => ({ ...s, status: 'checking' as const, latency: null }));
        setServices(newServices);

        // 1. Check Database Latency
        let startDb = performance.now();
        const { error: dbError } = await supabase.from('branch').select('id').limit(1);
        let endDb = performance.now();
        const dbLatency = Math.round(endDb - startDb);
        const dbStatus = dbError ? 'error' : (dbLatency > 800 ? 'degraded' : 'operational');

        // 2. Check Auth Latency
        let startAuth = performance.now();
        const { error: authError } = await supabase.auth.getSession();
        let endAuth = performance.now();
        const authLatency = Math.round(endAuth - startAuth);
        const authStatus = authError ? 'error' : (authLatency > 800 ? 'degraded' : 'operational');

        // 3. Check Storage Availability
        let startStorage = performance.now();
        const { error: storageError } = await supabase.storage.listBuckets();
        let endStorage = performance.now();
        const storageLatency = Math.round(endStorage - startStorage);
        // Sometimes listBuckets might be restricted by RLS to admins, if so it still proves API is reachable
        const stError = storageError && storageError.message !== 'Access denied' ? true : false;
        const storageStatus = stError ? 'error' : (storageLatency > 800 ? 'degraded' : 'operational');

        setServices([
            { name: 'Primary Database', status: dbStatus, latency: dbLatency, icon: Database },
            { name: 'Authentication API', status: authStatus, latency: authLatency, icon: Key },
            { name: 'Storage Buckets', status: storageStatus, latency: storageLatency, icon: HardDrive },
        ]);

        setLastChecked(new Date());
        setIsRefreshing(false);
    };

    useEffect(() => {
        runDiagnostics();

        // Auto refresh every 3 minutes
        const interval = setInterval(() => {
            runDiagnostics();
        }, 3 * 60 * 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const overallStatus = isRefreshing ? 'Running Diagnostics...' : (services.some(s => s.status === 'error') ? 'System Outage detected' : (services.some(s => s.status === 'degraded') ? 'Degraded Performance' : 'All Systems Operational'));

    const getStatusColor = () => {
        if (isRefreshing) return 'bg-blue-100 text-blue-700';
        if (overallStatus === 'All Systems Operational') return 'bg-emerald-100 text-emerald-700 shadow-[0_0_15px_rgba(16,185,129,0.2)] border border-emerald-200';
        if (overallStatus === 'Degraded Performance') return 'bg-amber-100 text-amber-700 border border-amber-200';
        return 'bg-red-100 text-red-700 border border-red-200 animate-pulse';
    };

    return (
        <div className="flex-1 bg-white flex flex-col relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent pointer-events-none"></div>

            <div className="p-8 border-b border-slate-100 flex justify-between items-center relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${overallStatus.includes('Operational') ? 'bg-emerald-50 text-emerald-600 shadow-inner' :
                            overallStatus.includes('Degraded') ? 'bg-amber-50 text-amber-600 shadow-inner' :
                                overallStatus.includes('Diagnostics') ? 'bg-blue-50 text-blue-600 shadow-inner' :
                                    'bg-red-50 text-red-600 shadow-inner'
                        }`}>
                        <Globe size={24} className={isRefreshing ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Infrastructure Health</h2>
                        {lastChecked ? (
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                Last checked: <span className="text-blue-500">{lastChecked.toLocaleTimeString()}</span>
                            </p>
                        ) : (
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Initializing probe...</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={runDiagnostics}
                        disabled={isRefreshing}
                        className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 p-2.5 rounded-xl transition-all disabled:opacity-50 border border-transparent hover:border-blue-100"
                        title="Run Diagnostics"
                    >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                    </button>
                    <span className={`text-[11px] px-4 py-2 rounded-full font-black uppercase tracking-widest ${getStatusColor()} flex items-center gap-2 transition-all duration-300`}>
                        {!isRefreshing && overallStatus === 'All Systems Operational' && <CheckCircle2 size={14} />}
                        {overallStatus}
                    </span>
                </div>
            </div>

            <div className="flex-1 p-8 relative z-10 flex items-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                    {services.map((service, idx) => (
                        <div key={idx} className="bg-white border text-center border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                            {service.status === 'checking' && (
                                <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center backdrop-blur-sm">
                                    <RefreshCw size={32} className="text-blue-500 animate-spin opacity-80" />
                                </div>
                            )}

                            <div className={`p-4 rounded-2xl mb-4 transition-colors duration-300 ${service.status === 'operational' ? 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white' :
                                    service.status === 'degraded' ? 'bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white' :
                                        service.status === 'checking' ? 'bg-slate-50 text-slate-400' :
                                            'bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white'
                                }`}>
                                <service.icon size={28} />
                            </div>

                            <h3 className="text-sm font-bold text-slate-700 tracking-wide mb-3">{service.name}</h3>

                            <div className="mt-auto flex flex-col items-center w-full">
                                <div className="flex items-center justify-center gap-2 mb-4 bg-slate-50 w-full py-2 rounded-xl">
                                    <div className={`w-2 h-2 rounded-full ${service.status === 'operational' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                            service.status === 'degraded' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                                                service.status === 'checking' ? 'bg-blue-400 animate-pulse' :
                                                    'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                        }`}></div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${service.status === 'operational' ? 'text-emerald-600' :
                                            service.status === 'degraded' ? 'text-amber-600' :
                                                service.status === 'checking' ? 'text-blue-500' :
                                                    'text-red-600'
                                        }`}>
                                        {service.status}
                                    </span>
                                </div>

                                <div className="text-4xl font-black tracking-tighter text-slate-800 flex items-baseline gap-1 relative">
                                    {service.status === 'error' ? (
                                        <span className="text-red-500 text-2xl">ERR</span>
                                    ) : (
                                        <>
                                            {service.latency !== null ? service.latency : '--'}
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ms</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
