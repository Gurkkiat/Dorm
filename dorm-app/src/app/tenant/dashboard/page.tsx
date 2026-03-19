'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import {
    Zap, Droplets, Wallet, Wrench, Bell, ArrowUpRight,
    Calendar, User as UserIcon, AlertCircle, CheckCircle, Edit2, Check
} from 'lucide-react';
import { MaintenanceRequest, Invoice } from '@/types/database';
import Loading from '@/components/ui/loading';

type NotificationItem = {
    id: string; // Unique string combining type and original ID
    type: 'invoice' | 'overdue_invoice' | 'maintenance' | 'system';
    title: string;
    description: string;
    date: string;
    isRead: boolean;
    link: string;
};

export default function TenantDashboard() {
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [profilePic, setProfilePic] = useState<string | null>(null);
    const [stats, setStats] = useState({
        totalPayment: 0,
        pendingInvoices: 0,
        lastPaymentDate: '-',
        elecUsage: 0,
        waterUsage: 0,
        nextBillDate: '-'
    });
    const [maintenanceList, setMaintenanceList] = useState<MaintenanceRequest[]>([]);
    const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);

    // Notifications State
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);

    // Greeting State
    const [greetingMessage, setGreetingMessage] = useState("Here's what's happening in your dorm today.");
    const [isEditingGreeting, setIsEditingGreeting] = useState(false);
    const [tempGreeting, setTempGreeting] = useState('');

    // Usage Goals State
    const [elecGoal, setElecGoal] = useState(300);
    const [waterGoal, setWaterGoal] = useState(50);
    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [tempElecGoal, setTempElecGoal] = useState<number | ''>(300);
    const [tempWaterGoal, setTempWaterGoal] = useState<number | ''>(50);

    // Load goals & greeting from local storage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedElec = localStorage.getItem('tenant_elec_goal');
            const savedWater = localStorage.getItem('tenant_water_goal');
            if (savedElec && !isNaN(Number(savedElec))) setElecGoal(Number(savedElec));
            if (savedWater && !isNaN(Number(savedWater))) setWaterGoal(Number(savedWater));

            const savedGreeting = localStorage.getItem('tenant_greeting');
            if (savedGreeting) setGreetingMessage(savedGreeting);
        }
    }, []);

    // Time-based greeting
    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const getComputedStatus = (invoice: Invoice) => {
        let s = invoice.status?.toLowerCase() || '';
        if (s !== 'paid' && invoice.due_date && new Date(invoice.due_date) < new Date()) {
            s = 'overdue';
        }
        return s;
    };

    // Helper for Dynamic Title
    const getInvoiceTitle = (invoice: Invoice) => {
        if (!invoice.bill_date) return `Invoice #${invoice.id}`;
        try {
            const date = new Date(invoice.bill_date);
            const monthYear = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

            if (invoice.type?.toLowerCase() === 'entry_fee') {
                return `Entry Fee (${monthYear})`;
            }
            return `Rent for ${monthYear}`;
        } catch (e) {
            return `Invoice #${invoice.id}`;
        }
    };

    useEffect(() => {
        async function fetchDashboardData() {
            setLoading(true);
            try {
                const storedUserId = localStorage.getItem('user_id');
                if (!storedUserId) return;

                // 1. Get User Details
                const { data: userData } = await supabase
                    .from('users')
                    .select('full_name, profile_picture')
                    .eq('id', storedUserId)
                    .single();

                if (userData) {
                    setUserName(userData.full_name);
                    if (userData.profile_picture) setProfilePic(userData.profile_picture);
                }

                // 2. Get User's Active Contract
                const { data: contractData } = await supabase
                    .from('contract')
                    .select('id, room_id, status, move_in')
                    .eq('user_id', storedUserId)
                    .in('status', ['Active', 'active', 'complete', 'Complete', 'incomplete'])
                    .single();

                if (!contractData) {
                    setLoading(false);
                    return;
                }

                const contractId = contractData.id;
                const roomId = contractData.room_id;

                // 3. Fetch Invoices (Unpaid & Recent)
                const { data: invoices } = await supabase
                    .from('invoice')
                    .select('*')
                    .eq('contract_id', contractId)
                    .order('due_date', { ascending: false });

                // 3.5 Fetch Actual Meter Reading
                const { data: meterReading } = await supabase
                    .from('meter_reading')
                    .select('*')
                    .eq('contract_id', contractId)
                    .order('reading_date', { ascending: false })
                    .limit(1)
                    .single();

                let actualElecUsage = 0;
                let actualWaterUsage = 0;

                if (meterReading) {
                    actualElecUsage = Math.max(0, (meterReading.current_electricity || 0) - (meterReading.prev_electricity || 0));
                    actualWaterUsage = Math.max(0, (meterReading.current_water || 0) - (meterReading.prev_water || 0));
                }

                if (invoices) {
                    const unpaid = invoices.filter(inv => inv.status.toLowerCase() === 'unpaid' || inv.status.toLowerCase() === 'pending');
                    const totalDue = unpaid.reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0);

                    const lastPaid = invoices.find(inv => inv.status.toLowerCase() === 'paid');

                    let nextBillDateStr = '-';
                    if (contractData?.move_in) {
                        const today = new Date();
                        const moveInDate = new Date(contractData.move_in);
                        let billingDay = moveInDate.getDate();
                        
                        let nextBill = new Date(today.getFullYear(), today.getMonth(), billingDay);
                        
                        // Handle end of month edge cases
                        const lastDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                        if (billingDay > lastDayOfCurrentMonth) {
                            nextBill = new Date(today.getFullYear(), today.getMonth(), lastDayOfCurrentMonth);
                        }

                        // Also we subtract 1 day from new Date to see if today is perfectly billing day, usually bills come out same day, but let's just say if today >= nextBill, the next bill is next month
                        const todayWithoutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        if (nextBill <= todayWithoutTime) {
                            // Move to next month
                            nextBill.setMonth(nextBill.getMonth() + 1);
                            const lastDayOfNextMonth = new Date(nextBill.getFullYear(), nextBill.getMonth() + 1, 0).getDate();
                            if (billingDay > lastDayOfNextMonth) {
                                nextBill.setDate(lastDayOfNextMonth);
                            } else {
                                nextBill.setDate(billingDay);
                            }
                        }
                        
                        nextBillDateStr = nextBill.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    }

                    setStats({
                        totalPayment: totalDue,
                        pendingInvoices: unpaid.length,
                        lastPaymentDate: lastPaid?.paid_date ? new Date(lastPaid.paid_date).toLocaleDateString('en-GB') : '-',
                        elecUsage: Number(actualElecUsage.toFixed(2)),
                        waterUsage: Number(actualWaterUsage.toFixed(2)),
                        nextBillDate: nextBillDateStr
                    });

                    setRecentInvoices(invoices.slice(0, 3));
                }

                // 4. Fetch Active Maintenance Requests
                const { data: maintenances } = await supabase
                    .from('maintenance_request')
                    .select('*')
                    .eq('room_id', roomId)
                    // Exclude completed or canceled statuses
                    .not('status_technician', 'in', '("Completed","Done","completed","done","Cancelled","cancelled")')
                    .order('requested_at', { ascending: false })
                    .limit(5); // Fetch a few more to filter if needed

                if (maintenances) setMaintenanceList(maintenances);

                // 5. Build Notifications Array
                const newNotifications: NotificationItem[] = [];

                if (invoices) {
                    const pendingInvoicesList = invoices.filter(inv => inv.status.toLowerCase() === 'unpaid' || inv.status.toLowerCase() === 'pending');
                    pendingInvoicesList.forEach(inv => {
                        const dueDateDesc = inv.due_date ? `Due on ${new Date(inv.due_date).toLocaleDateString('en-GB')}` : 'Action required';
                        const isOverdue = inv.status?.toLowerCase() !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date();
                        const titlePrefix = isOverdue ? 'Overdue' : 'Unpaid';
                        
                        // Wait, don't show normal unpaid notification if a meeting state is active
                        if (inv.meeting_status === 'none' || !inv.meeting_status) {
                            newNotifications.push({
                                id: `inv_${inv.id}`,
                                type: isOverdue ? 'overdue_invoice' : 'invoice',
                                title: `${titlePrefix} Invoice: ${inv.room_total_cost?.toLocaleString() || 0} THB`,
                                description: dueDateDesc,
                                date: inv.bill_date || inv.due_date || new Date().toISOString(),
                                isRead: false,
                                link: `/tenant/payment/${inv.id}`
                            });
                        }
                    });

                    // Check for Meeting Action needed by Tenant
                    invoices.forEach(inv => {
                        if (inv.meeting_status === 'pending_tenant') {
                            newNotifications.push({
                                id: `inv_meeting_${inv.id}`,
                                type: 'system',
                                title: 'Manager Scheduled Meeting',
                                description: `Action Required: Please confirm the meeting date regarding your extremely late payment.`,
                                date: inv.paid_date || new Date().toISOString(),
                                isRead: false,
                                link: `/tenant/payment/${inv.id}`
                            });
                        } else if (inv.meeting_status === 'confirmed') {
                            newNotifications.push({
                                id: `inv_meeting_${inv.id}_conf`,
                                type: 'system',
                                title: 'Meeting Confirmed / Penalty Applied',
                                description: `Your meeting is confirmed. Score penalty (-50) applied.`,
                                date: new Date().toISOString(),
                                isRead: false,
                                link: `/tenant/payment/${inv.id}`
                            });
                        }
                    });
                }

                if (maintenances) {
                    maintenances.forEach(m => {
                        let statusText = m.status_technician || 'Pending';
                        if (statusText.toLowerCase() === 'in progress') statusText = 'In Progress';
                        
                        newNotifications.push({
                            id: `maint_${m.id}`,
                            type: 'maintenance',
                            title: `Maintenance Update`,
                            description: `Request #${m.request_number || m.id} is currently ${statusText}`,
                            date: m.requested_at,
                            isRead: false,
                            link: '/tenant/maintenance'
                        });
                    });
                }

                // Sort newest first
                newNotifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setNotifications(newNotifications);

            } catch (error) {
                console.error('Error loading dashboard:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchDashboardData();
    }, []);

    if (loading) return <Loading />;

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 font-sans min-h-screen pb-24">

            {/* 1. Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">
                        {getTimeGreeting()}, <span className="text-[#0047AB]">{userName.split(' ')[0]}</span> 👋
                    </h1>
                    <div className="flex items-center gap-2 mt-1 group">
                        {isEditingGreeting ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={tempGreeting}
                                    onChange={(e) => setTempGreeting(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const msg = tempGreeting.trim() || "Here's what's happening in your dorm today.";
                                            setGreetingMessage(msg);
                                            localStorage.setItem('tenant_greeting', msg);
                                            setIsEditingGreeting(false);
                                        } else if (e.key === 'Escape') {
                                            setIsEditingGreeting(false);
                                        }
                                    }}
                                    className="text-gray-500 text-sm bg-gray-100 border border-gray-200 rounded-lg px-3 py-1 focus:outline-none focus:border-[#0047AB] focus:ring-1 focus:ring-[#0047AB] w-72"
                                    placeholder="Type your greeting message..."
                                    autoFocus
                                />
                                <button
                                    onClick={() => {
                                        const msg = tempGreeting.trim() || "Here's what's happening in your dorm today.";
                                        setGreetingMessage(msg);
                                        localStorage.setItem('tenant_greeting', msg);
                                        setIsEditingGreeting(false);
                                    }}
                                    className="p-1 bg-[#0047AB] text-white rounded-md hover:bg-[#00388A] transition-colors"
                                >
                                    <Check size={14} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className="text-gray-500">{greetingMessage}</p>
                                <button
                                    onClick={() => { setTempGreeting(greetingMessage); setIsEditingGreeting(true); }}
                                    className="text-gray-300 hover:text-[#0047AB] opacity-0 group-hover:opacity-100 transition-all p-1 rounded-md hover:bg-blue-50"
                                    title="Edit greeting"
                                >
                                    <Edit2 size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3 relative">
                    <button 
                        onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                        className={`p-2.5 rounded-full border transition-all relative ${isNotificationOpen ? 'bg-blue-50 border-blue-200 text-[#0047AB]' : 'bg-white border-gray-200 text-gray-500 hover:text-[#0047AB] hover:border-[#0047AB]'}`}
                    >
                        <Bell size={20} />
                        {notifications.length > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 rounded-full border border-white text-[10px] font-bold text-white flex items-center justify-center px-1">
                                {notifications.length}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {isNotificationOpen && (
                        <>
                            <div 
                                className="fixed inset-0 z-40" 
                                onClick={() => setIsNotificationOpen(false)} 
                            />
                            <div className="absolute top-12 right-14 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="font-bold text-gray-800">Notifications</h3>
                                    {notifications.length > 0 && (
                                        <span className="text-xs font-bold text-[#0047AB] bg-blue-50 px-2 py-0.5 rounded-full">
                                            {notifications.length} New
                                        </span>
                                    )}
                                </div>
                                
                                <div className="max-h-96 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-2">
                                            <div className="p-3 bg-gray-50 rounded-full text-gray-300">
                                                <Bell size={24} />
                                            </div>
                                            <p className="text-sm">You're all caught up!</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-50">
                                            {notifications.map((notif) => (
                                                <Link 
                                                    href={notif.link} 
                                                    key={notif.id}
                                                    onClick={() => setIsNotificationOpen(false)}
                                                    className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors group"
                                                >
                                                    <div className={`p-2 rounded-xl shrink-0 ${
                                                        notif.type === 'overdue_invoice' ? 'bg-rose-50 text-rose-600' :
                                                        notif.type === 'invoice' ? 'bg-yellow-50 text-yellow-600' :
                                                        notif.type === 'maintenance' ? 'bg-orange-50 text-orange-600' :
                                                        'bg-blue-50 text-blue-600'
                                                    }`}>
                                                        {(notif.type === 'invoice' || notif.type === 'overdue_invoice') ? <Wallet size={16} /> :
                                                         notif.type === 'maintenance' ? <Wrench size={16} /> :
                                                         <Bell size={16} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-800 group-hover:text-[#0047AB] transition-colors">{notif.title}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">{notif.description}</p>
                                                        <p className="text-[10px] text-gray-400 mt-1 font-mono uppercase">
                                                            {new Date(notif.date).toLocaleDateString('en-GB')}
                                                        </p>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    <Link href="/tenant/profile">
                        {profilePic ? (
                            <img 
                                src={profilePic}
                                alt="Profile"
                                className="h-10 w-10 rounded-full object-cover shadow-sm shadow-blue-200 hover:shadow-md hover:scale-105 transition-all cursor-pointer"
                            />
                        ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#0047AB] to-[#0066FF] flex items-center justify-center text-white font-bold shadow-sm shadow-blue-200 hover:shadow-md hover:scale-105 transition-all cursor-pointer">
                                {userName.charAt(0) || 'T'}
                            </div>
                        )}
                    </Link>
                </div>
            </div>

            {/* 2. Key Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {/* Total Due */}
                <div className="bg-gradient-to-br from-[#0047AB] to-[#0066FF] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                <Wallet size={24} className="text-white" />
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                                <span className="bg-white/20 text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm uppercase tracking-wider text-blue-50 flex items-center gap-1.5 border border-white/10 shadow-sm">
                                    <Calendar size={10} /> Next Bill: {stats.nextBillDate}
                                </span>
                                {stats.pendingInvoices > 0 && (
                                    <span className="bg-rose-500/90 text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm shadow-sm uppercase tracking-wider">
                                        {stats.pendingInvoices} Pending
                                    </span>
                                )}
                            </div>
                        </div>
                        <p className="text-blue-100 text-sm font-medium mb-1">Total Payment Due</p>
                        <h2 className="text-3xl font-bold">{stats.totalPayment.toLocaleString()} <span className="text-lg font-normal opacity-80">THB</span></h2>
                    </div>
                </div>

                {/* Maintenance Status */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-orange-50 rounded-full blur-2xl group-hover:bg-orange-100 transition-colors duration-500" />
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
                                <Wrench size={24} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Active Requests</p>
                        <h2 className="text-3xl font-bold text-gray-800">{maintenanceList.length} <span className="text-lg font-normal text-gray-400">Issues</span></h2>
                    </div>
                </div>

                {/* Last Payment */}
                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-green-50 rounded-full blur-2xl group-hover:bg-green-100 transition-colors duration-500" />
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-green-100 rounded-xl text-green-600">
                                <CheckCircle size={24} />
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Last Payment</p>
                        <h2 className="text-3xl font-bold text-gray-800">{stats.lastPaymentDate}</h2>
                    </div>
                </div>
            </div>

            {/* 3. Main Content Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column (2/3) - Usage & Actions */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Usage Stats */}
                    <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-gray-800">Current Month Usage</h3>
                                {!isEditingGoal && (
                                    <button
                                        onClick={() => { setIsEditingGoal(true); setTempElecGoal(elecGoal); setTempWaterGoal(waterGoal); }}
                                        className="text-gray-400 hover:text-[#0047AB] p-1.5 rounded-full hover:bg-blue-50 transition-colors"
                                        title="Set Usage Goals"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                )}
                            </div>
                            <span className="text-xs text-[#0047AB] font-mono bg-blue-50 px-2 py-1 rounded">Actual vs Goal</span>
                        </div>

                        {isEditingGoal && (
                            <div className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
                                <div className="text-sm font-bold text-[#0047AB] mb-3">Set Monthly Limit Goals</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Electricity (kWh)</label>
                                        <input
                                            type="number" min="1"
                                            value={tempElecGoal}
                                            onChange={e => setTempElecGoal(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full text-sm font-bold text-gray-900 p-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#0047AB] bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Water (m³)</label>
                                        <input
                                            type="number" min="1"
                                            value={tempWaterGoal}
                                            onChange={e => setTempWaterGoal(e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full text-sm font-bold text-gray-900 p-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#0047AB] bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <button onClick={() => setIsEditingGoal(false)} className="text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 bg-white">Cancel</button>
                                    <button onClick={() => {
                                        const finalElec = Number(tempElecGoal) || 300;
                                        const finalWater = Number(tempWaterGoal) || 50;
                                        setElecGoal(finalElec);
                                        setWaterGoal(finalWater);
                                        localStorage.setItem('tenant_elec_goal', finalElec.toString());
                                        localStorage.setItem('tenant_water_goal', finalWater.toString());
                                        setIsEditingGoal(false);
                                    }} className="text-xs font-bold text-white bg-[#0047AB] hover:bg-[#00388A] px-3 py-1.5 rounded-lg shadow flex items-center gap-1 transition-colors">
                                        <Check size={14} /> Save Goals
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-6">
                            {/* Electricity */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <div className="flex items-center gap-2 font-bold text-gray-700">
                                        <div className="p-1.5 bg-yellow-100 rounded-lg">
                                            <Zap size={14} className="text-yellow-600 fill-yellow-600" />
                                        </div>
                                        Electricity
                                    </div>
                                    <span className="font-bold text-gray-900">
                                        <span className={stats.elecUsage > elecGoal ? 'text-red-500' : ''}>{stats.elecUsage}</span> <span className="text-gray-400 font-normal">/ {elecGoal} kWh</span>
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden relative">
                                    <div
                                        className={`${stats.elecUsage > elecGoal ? 'bg-red-500' : 'bg-yellow-400'} h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
                                        style={{ width: `${Math.min((stats.elecUsage / elecGoal) * 100, 100)}%` }}
                                    >
                                        {stats.elecUsage <= elecGoal && <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />}
                                    </div>
                                </div>
                            </div>

                            {/* Water */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <div className="flex items-center gap-2 font-bold text-gray-700">
                                        <div className="p-1.5 bg-cyan-100 rounded-lg">
                                            <Droplets size={14} className="text-cyan-500 fill-cyan-500" />
                                        </div>
                                        Water
                                    </div>
                                    <span className="font-bold text-gray-900">
                                        <span className={stats.waterUsage > waterGoal ? 'text-red-500' : ''}>{stats.waterUsage}</span> <span className="text-gray-400 font-normal">/ {waterGoal} m³</span>
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden relative">
                                    <div
                                        className={`${stats.waterUsage > waterGoal ? 'bg-red-500' : 'bg-cyan-400'} h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
                                        style={{ width: `${Math.min((stats.waterUsage / waterGoal) * 100, 100)}%` }}
                                    >
                                        {stats.waterUsage <= waterGoal && <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <Link href="/tenant/payment" className="bg-[#0047AB] text-white p-6 rounded-3xl shadow-lg flex flex-col items-center justify-center gap-3 hover:bg-[#00388A] transition-colors group">
                            <div className="p-3 bg-white/10 rounded-2xl group-hover:scale-110 transition-transform">
                                <Wallet size={28} />
                            </div>
                            <span className="font-bold">Pay Bills</span>
                        </Link>
                        <Link href="/tenant/maintenance" className="bg-white text-[#0047AB] border border-blue-100 p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-3 hover:shadow-md transition-all group">
                            <div className="p-3 bg-blue-50 rounded-2xl group-hover:scale-110 transition-transform">
                                <Wrench size={28} />
                            </div>
                            <span className="font-bold">Report Issue</span>
                        </Link>
                    </div>

                </div>

                {/* Right Column (1/3) - Recent Activity */}
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm h-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800">Recent Activity</h3>
                            <Link href="/tenant/payment" className="text-xs font-bold text-[#0047AB] hover:underline flex items-center">
                                View All <ArrowUpRight size={14} className="ml-0.5" />
                            </Link>
                        </div>

                        <div className="space-y-4">
                            {recentInvoices.length > 0 ? (
                                recentInvoices.map((inv) => {
                                    const compStatus = getComputedStatus(inv);
                                    return (
                                    <div key={inv.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl ${compStatus === 'paid' ? 'bg-green-50 text-green-600' : 
                                                compStatus === 'overdue' ? 'bg-rose-50 text-rose-600' :
                                                compStatus === 'unpaid' ? 'bg-yellow-50 text-yellow-600' : 'bg-orange-50 text-orange-600'
                                                }`}>
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800 group-hover:text-[#0047AB] transition-colors">{getInvoiceTitle(inv)}</p>
                                                <p className="text-xs text-gray-400 font-mono">INV-{inv.id.toString().padStart(6, '0')}</p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-lg uppercase ${compStatus === 'paid' ? 'bg-green-100 text-green-700' : 
                                            compStatus === 'overdue' ? 'bg-rose-100 text-rose-700' : 
                                            compStatus === 'unpaid' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            {compStatus}
                                        </span>
                                    </div>
                                )})
                            ) : (
                                <div className="text-center py-8 text-gray-400 text-sm">No recent activity</div>
                            )}

                            {maintenanceList.map((m) => (
                                <div key={m.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
                                            <Wrench size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800 group-hover:text-[#0047AB] transition-colors truncate max-w-[120px]">{m.issue_description}</p>
                                            <p className="text-xs text-gray-400">{new Date(m.requested_at).toLocaleDateString('en-GB')}</p>
                                        </div>
                                    </div>
                                    <div className="h-2 w-2 rounded-full bg-orange-400" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FileText({ size = 24, className = "" }: { size?: number, className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" x2="8" y1="13" y2="13" />
            <line x1="16" x2="8" y1="17" y2="17" />
            <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
    );
}
