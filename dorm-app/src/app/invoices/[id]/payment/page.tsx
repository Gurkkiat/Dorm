
'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Invoice } from '@/types/database';
import { useRouter } from 'next/navigation';

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
        async function fetchInvoice() {
            try {
                const { data, error } = await supabase
                    .from('invoice')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setInvoice(data);
            } catch (error) {
                console.error('Error fetching invoice:', error);
                alert('Error fetching invoice.');
            } finally {
                setLoading(false);
            }
        }

        fetchInvoice();
    }, [id]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            alert('Please select a payment slip image.');
            return;
        }

        setUploading(true);

        try {
            // NOTE: In a real app, you would upload the file to Supabase Storage here.
            // const { data: uploadData, error: uploadError } = await supabase.storage
            //   .from('payment-slips')
            //   .upload(`public/${params.id}_${Date.now()}.jpg`, file);

            // if (uploadError) throw uploadError;

            // Mocking the file path for now since storage might not be set up
            const mockFilePath = `/uploads/slip_${id}_${Date.now()}.jpg`;

            const { error: updateError } = await supabase
                .from('invoice')
                .update({
                    payment_slip: mockFilePath,
                    status: 'Pending',
                    payment_method: 'Transfer', // Assuming transfer for now
                    paid_date: new Date().toISOString(), // User claims they paid now
                })
                .eq('id', id);

            if (updateError) throw updateError;

            alert('Payment slip uploaded successfully! Waiting for manager approval.');
            router.push('/invoices');
        } catch (error) {
            console.error('Error submitting payment:', error);
            alert('Error submitting payment. Please check console.');
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!invoice) return <div className="p-8">Invoice not found.</div>;

    return (
        <div className="max-w-xl mx-auto p-8">
            <h1 className="text-2xl font-bold mb-6">Payment for Invoice #{invoice.id}</h1>

            <div className="bg-white shadow p-6 rounded-md mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-500">Amount Due</p>
                        <p className="text-xl font-semibold text-gray-900">{invoice.room_total_cost} THB</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Due Date</p>
                        <p className="text-gray-900">{new Date(invoice.due_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Type</p>
                        <p className="text-gray-900">{invoice.type}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload Payment Slip</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100"
                    />
                </div>

                <button
                    type="submit"
                    disabled={uploading}
                    className="w-full bg-indigo-600 text-white p-3 rounded hover:bg-indigo-700 transition font-medium"
                >
                    {uploading ? 'Uploading...' : 'Confirm Payment'}
                </button>
            </form>
        </div>
    );
}
