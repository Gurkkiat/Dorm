import { AlertTriangle, PhoneCall } from 'lucide-react';

interface OverdueTenantsProps {
    invoices: {
        id: number;
        room_total_cost: number;
        status: string;
        bill_date: string;
        due_date?: string;
        room_number: string;
        tenant_name?: string;
        tenant_phone?: string;
    }[];
}

export default function OverdueTenants({ invoices }: OverdueTenantsProps) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // End of today / start of tomorrow for precise cutoff

    const overdueInvoices = invoices.filter(inv => {
        const isUnpaid = inv.status.toLowerCase() !== 'paid';
        if (!isUnpaid) return false;
        
        if (inv.status.toLowerCase() === 'overdue') return true;
        
        // Dynamically compute if pending but past due date
        if (inv.due_date) {
            const dueDate = new Date(inv.due_date);
            dueDate.setHours(0, 0, 0, 0);
            return today > dueDate;
        }
        
        // Fallback: Just show all unpaid if due_date is missing, because Owner wants to see them
        return true;
    });

    if (overdueInvoices.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <div className="flex justify-between items-center mb-5 shrink-0">
                <h3 className="font-bold text-red-800 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600" />
                    Overdue Tenants Action
                </h3>
                <span className="text-[10px] font-black bg-red-600 text-white px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    {overdueInvoices.length} Overdue
                </span>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[350px] flex flex-col gap-3">
                {overdueInvoices.map(inv => (
                    <div key={inv.id} className="shrink-0 bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col gap-3 relative overflow-hidden group hover:border-red-300 transition-colors">
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-red-500"></div>
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-black text-slate-800 text-lg">Room {inv.room_number}</h4>
                                <p className="text-sm font-bold text-slate-600 mt-0.5">{inv.tenant_name}</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-xl font-black text-red-600">฿{inv.room_total_cost.toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : new Date(inv.bill_date).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="bg-slate-50 mt-1 rounded-lg p-2.5 flex items-center justify-between border border-slate-100">
                            <div className="flex items-center gap-2 text-slate-600 text-sm">
                                <PhoneCall size={14} className="text-slate-400" />
                                <span className="font-medium">{inv.tenant_phone}</span>
                            </div>
                            <a 
                                href={`tel:${inv.tenant_phone}`}
                                className="text-[10px] font-bold text-red-600 hover:text-white uppercase tracking-widest transition-colors py-1.5 px-3 border border-red-200 hover:border-transparent rounded-lg bg-white hover:bg-red-500 shadow-sm"
                            >
                                Contact
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
