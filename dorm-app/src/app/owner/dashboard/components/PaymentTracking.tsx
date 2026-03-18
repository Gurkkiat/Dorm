import { CreditCard, AlertCircle } from 'lucide-react';

interface PaymentTrackingProps {
    invoices: {
        id: number;
        room_total_cost: number;
        status: string;
        bill_date: string;
        room_number: string;
    }[];
}

export default function PaymentTracking({ invoices }: PaymentTrackingProps) {
    const unpaidInvoices = invoices.filter(inv => inv.status.toLowerCase() !== 'paid');
    const displayInvoices = unpaidInvoices.slice(0, 5);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <CreditCard size={18} className="text-rose-500" />
                    Waiting for Payment
                </h3>
                <span className="text-xs font-bold bg-rose-50 text-rose-600 px-2 py-1 rounded-lg">
                    {unpaidInvoices.length} Waiting
                </span>
            </div>
            
            <div className="flex flex-col gap-3">
                {displayInvoices.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 hover:border-rose-200 hover:bg-rose-50/30 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                <AlertCircle size={14} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-700">Room {inv.room_number}</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{new Date(inv.bill_date).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-black text-slate-800">฿{inv.room_total_cost.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">{inv.status}</span>
                        </div>
                    </div>
                ))}

                {displayInvoices.length === 0 && (
                    <div className="text-center py-6 text-slate-400 italic">
                        All clear! No pending payments.
                    </div>
                )}
            </div>
        </div>
    );
}
