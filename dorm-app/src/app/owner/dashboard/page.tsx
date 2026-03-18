'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import TopStatsCards from './components/TopStatsCards';
import DashboardFilterBar from './components/DashboardFilterBar';
import RevenueChart from './components/RevenueChart';
import OccupancyChart from './components/OccupancyChart';
import RoomStatusTable from './components/RoomStatusTable';
import PaymentTracking from './components/PaymentTracking';
import MaintenanceList from './components/MaintenanceList';
import NotificationPanel, { NotificationItem } from './components/NotificationPanel';
import OverdueTenants from './components/OverdueTenants';

export default function OwnerDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalBilled: 0,
        pendingAmount: 0,
        occupancyRate: 0,
        activeTenants: 0,
        pendingMaintenance: 0,
        totalRooms: 0,
        monthlyRevenue: [] as { month: string, amount: number }[]
    });
    
    // Filters
    const [selectedBuilding, setSelectedBuilding] = useState('All');
    const [selectedMonth, setSelectedMonth] = useState('All');
    const [selectedYear, setSelectedYear] = useState('All');
    const [buildingsList, setBuildingsList] = useState<{id: number, name_building: string}[]>([]);

    // Component Data
    const [roomsList, setRoomsList] = useState<any[]>([]);
    const [invoicesList, setInvoicesList] = useState<any[]>([]);
    const [maintenanceList, setMaintenanceList] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    useEffect(() => {
        fetchDashboardData();
    }, [selectedBuilding, selectedMonth, selectedYear]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const role = localStorage.getItem('user_role')?.toLowerCase();
            const branchId = localStorage.getItem('user_branch_id');
            
            if (role !== 'admin' && !branchId) throw new Error("No branch assigned.");

            // 0. Fetch Buildings for Dropdown
            let buildingQ = supabase.from('building').select('id, name_building');
            if (branchId) buildingQ = buildingQ.eq('branch_id', branchId);
            const { data: bldgs } = await buildingQ;
            if (bldgs) setBuildingsList(bldgs);

            // 1. Fetch Occupancy & Room Stats
            let roomQuery = supabase
                .from('room')
                .select('id, status, room_number, building!inner(branch_id, name_building)');
            if (branchId) roomQuery = roomQuery.eq('building.branch_id', branchId);
            if (selectedBuilding !== 'All') roomQuery = roomQuery.eq('building.id', Number(selectedBuilding));
            const { data: rooms } = await roomQuery;
            
            const totalRooms = rooms?.length || 0;

            // 2. Fetch Active Tenants & Calculate Occupancy Rate
            let tenantQuery = supabase
                .from('contract')
                .select('id, status, move_in, move_out, room!inner(id, building!inner(branch_id, id))');
            if (branchId) tenantQuery = tenantQuery.eq('room.building.branch_id', branchId);
            if (selectedBuilding !== 'All') tenantQuery = tenantQuery.eq('room.building.id', Number(selectedBuilding));
            const { data: tenantData } = await tenantQuery;

            const contracts = tenantData || [];
            
            // Determine the "Snapshot Date" for assessing who was living there.
            // For 'All', we use Today. For a specific year, we use End of Year (or Today if the year is the current year).
            let snapshotDate = new Date().toISOString().split('T')[0]; 
            if (selectedYear !== 'All') {
                const y = selectedYear;
                if (selectedMonth !== 'All') {
                    // Next month day 0 gets the last day of the current month
                    const nextMonth = new Date(Number(y), Number(selectedMonth), 0);
                    const mStr = String(nextMonth.getMonth() + 1).padStart(2, '0');
                    const dStr = String(nextMonth.getDate()).padStart(2, '0');
                    snapshotDate = `${y}-${mStr}-${dStr}`;
                } else {
                    snapshotDate = `${y}-12-31`;
                }
                
                // If the computed snapshot is in the future, fallback to today's date for realism.
                const today = new Date().toISOString().split('T')[0];
                if (snapshotDate > today) snapshotDate = today;
            }

            const occupiedRooms = new Set();
            contracts.forEach((c: any) => {
                const moveIn = c.move_in || '2000-01-01';
                const isActiveNow = ['Active', 'active', 'complete'].includes(c.status);
                // If active, they represent an open-ended stay in the future
                const moveOut = isActiveNow ? '2100-12-31' : (c.move_out || moveIn);
                
                // Was the contract active precisely on this snapshot date?
                if (moveIn <= snapshotDate && moveOut >= snapshotDate) {
                    occupiedRooms.add(c.room.id);
                }
            });
            
            const tenantCount = occupiedRooms.size;
            const occupancyRate = totalRooms > 0 ? Math.round((tenantCount / totalRooms) * 100) : 0;

            const mappedRooms = (rooms || []).map((r: any) => {
                let dynamicStatus = r.status;
                if (occupiedRooms.has(r.id)) {
                    dynamicStatus = 'Occupied';
                } else if (['Occupied', 'occupied'].includes(r.status)) {
                    dynamicStatus = 'Available';
                }
                return {
                    id: r.id, 
                    room_number: r.room_number,
                    status: dynamicStatus,
                    buildingName: r.building.name_building
                };
            });
            setRoomsList(mappedRooms);

            // 3. Fetch Pending Maintenance (Filter by Date)
            let maintQuery = supabase
                .from('maintenance_request')
                .select('id, issue_description, requested_at, status_technician, room!inner(room_number, building!inner(branch_id, id))')
                .order('requested_at', { ascending: false });
            if (branchId) maintQuery = maintQuery.eq('room.building.branch_id', branchId);
            if (selectedBuilding !== 'All') maintQuery = maintQuery.eq('room.building.id', Number(selectedBuilding));
            const { data: maintData } = await maintQuery;

            let filteredMaint = maintData || [];
            if (selectedYear !== 'All') {
                filteredMaint = filteredMaint.filter(req => req.requested_at && req.requested_at.startsWith(selectedYear));
            }
            if (selectedMonth !== 'All') {
                const monthPadded = '-' + selectedMonth.padStart(2, '0') + '-'; // Match '-03-' format
                filteredMaint = filteredMaint.filter(req => req.requested_at && req.requested_at.includes(monthPadded));
            }
            const maintCount = filteredMaint.filter(req => req.status_technician === 'Pending').length;
            
            const mappedMaint = filteredMaint.map((m: any) => ({
                id: m.id,
                issue_description: m.issue_description,
                status_technician: m.status_technician,
                requested_at: m.requested_at,
                room_number: m.room.room_number
            }));
            setMaintenanceList(mappedMaint);

            // 4. Fetch Revenue Data
            let invoiceQuery = supabase
                .from('invoice')
                .select('id, room_total_cost, bill_date, due_date, status, contract!inner(room!inner(room_number, building!inner(branch_id, id)), users(full_name, phone))')
                .order('bill_date', { ascending: false });
            if (branchId) invoiceQuery = invoiceQuery.eq('contract.room.building.branch_id', branchId);
            if (selectedBuilding !== 'All') invoiceQuery = invoiceQuery.eq('contract.room.building.id', Number(selectedBuilding));
            const { data: invoices } = await invoiceQuery;

            // Apply Date Filters
            let filteredInvoices = invoices || [];
            if (selectedYear !== 'All') {
                filteredInvoices = filteredInvoices.filter(inv => inv.bill_date && inv.bill_date.startsWith(selectedYear));
            }
            if (selectedMonth !== 'All') {
                const monthPadded = '-' + selectedMonth.padStart(2, '0') + '-';
                filteredInvoices = filteredInvoices.filter(inv => inv.bill_date && inv.bill_date.includes(monthPadded));
            }

            const mappedInvoices = filteredInvoices.map((i: any) => ({
                id: i.id,
                room_total_cost: i.room_total_cost,
                status: i.status || 'Paid',
                bill_date: i.bill_date,
                due_date: i.due_date,
                room_number: i.contract?.room?.room_number || '-',
                tenant_name: i.contract?.users?.full_name || 'No tenant associated',
                tenant_phone: i.contract?.users?.phone || '-'
            }));
            setInvoicesList(mappedInvoices);

            const totalBilled = filteredInvoices.reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0) || 0;
            const pendingAmount = filteredInvoices.filter(inv => inv.status?.toLowerCase() !== 'paid').reduce((sum, inv) => sum + (inv.room_total_cost || 0), 0) || 0;
            const totalRevenue = totalBilled - pendingAmount;

            // Group revenue by month based on Year Filter for Chart
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const revenueByMonthMap: Record<string, number> = {};
            
            const chartInvoices = selectedYear !== 'All' ? (invoices || []).filter(inv => inv.bill_date && inv.bill_date.startsWith(selectedYear)) : (invoices || []);
            
            chartInvoices.forEach(inv => {
                if (inv.status?.toLowerCase() === 'paid') {
                    const date = new Date(inv.bill_date);
                    const monthName = months[date.getMonth()];
                    revenueByMonthMap[monthName] = (revenueByMonthMap[monthName] || 0) + inv.room_total_cost;
                }
            });

            // Generate Chart Data
            const chartData = [];
            if (selectedYear !== 'All') {
                // Show all 12 months for the selected year
                for (let i = 0; i < 12; i++) {
                    const mName = months[i];
                    chartData.push({
                        month: mName,
                        amount: revenueByMonthMap[mName] || 0
                    });
                }
            } else {
                // Show last 6 months
                for (let i = 5; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    const mName = months[d.getMonth()];
                    chartData.push({
                        month: mName,
                        amount: revenueByMonthMap[mName] || 0
                    });
                }
            }

            setStats({
                totalRevenue,
                totalBilled,
                pendingAmount,
                occupancyRate,
                activeTenants: tenantCount,
                pendingMaintenance: maintCount,
                totalRooms,
                monthlyRevenue: chartData
            });

            // Generate Notifications
            const newNotifs: NotificationItem[] = [];
            mappedInvoices.filter((i:any) => i.status.toLowerCase() !== 'paid').forEach((inv: any) => {
                newNotifs.push({
                    id: `inv-${inv.id}`,
                    type: inv.status.toLowerCase() === 'overdue' ? 'alert' : 'warning',
                    title: `Payment ${inv.status}`,
                    message: `Room ${inv.room_number} has an unpaid invoice of ฿${inv.room_total_cost.toLocaleString()}.`,
                    date: inv.bill_date
                });
            });
            mappedMaint.filter((m:any) => m.status_technician === 'Pending').forEach((req: any) => {
                newNotifs.push({
                    id: `maint-${req.id}`,
                    type: 'alert',
                    title: `New Maintenance Request`,
                    message: `Room ${req.room_number} reported an issue: ${req.issue_description}`,
                    date: req.requested_at
                });
            });
            newNotifs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setNotifications(newNotifs);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500 font-bold tracking-widest uppercase">Initializing Layout...</div>;

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Executive Dashboard</h1>
                <p className="text-slate-500 mt-1 font-medium">Real-time building oversight and financial analytics</p>
            </div>

            {/* Global Filter Bar */}
            <DashboardFilterBar 
                selectedBuilding={selectedBuilding} setSelectedBuilding={setSelectedBuilding}
                selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
                selectedYear={selectedYear} setSelectedYear={setSelectedYear}
                buildingsList={buildingsList}
            />

            {/* Top Summaries */}
            <TopStatsCards stats={stats} />

            {/* Main Visualizations Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Left/Main Column - Financials & Operations */}
                <div className="xl:col-span-2 space-y-8 flex flex-col">
                    {/* Revenue Trends */}
                    <RevenueChart monthlyRevenue={stats.monthlyRevenue} selectedYear={selectedYear} />
                    
                    {/* Tables Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        <PaymentTracking invoices={invoicesList} />
                        <MaintenanceList requests={maintenanceList} />
                    </div>
                </div>

                {/* Right Column - Room Context & Alerts */}
                <div className="space-y-8 flex flex-col">
                    {/* Occupancy Analysis */}
                    <OccupancyChart occupancyRate={stats.occupancyRate} activeTenants={stats.activeTenants} totalRooms={stats.totalRooms} />
                    
                    {/* Critical Overdue Action Cards (Only renders if there are overdue invoices) */}
                    <OverdueTenants invoices={invoicesList} />

                    <div className="max-h-[450px] flex flex-col">
                        <NotificationPanel notifications={notifications} />
                    </div>

                    <div className="max-h-[450px] flex flex-col">
                        <RoomStatusTable rooms={roomsList} />
                    </div>
                </div>

            </div>
        </div>
    );
}
