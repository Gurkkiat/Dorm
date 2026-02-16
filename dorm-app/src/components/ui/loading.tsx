import { Loader2 } from 'lucide-react';

export default function Loading() {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-[#0047AB]" size={40} />
            <p className="text-gray-500 font-medium animate-pulse">Loading...</p>
        </div>
    );
}
