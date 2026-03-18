'use client';

import { ManagerProvider, useManager } from '@/app/manager/ManagerContext';
import { useEffect } from 'react';

// Sync component to update ManagerContext when localStorage (set by AdminLayout) changes
function ContextSync() {
    const { setSelectedBranchId } = useManager();
    
    useEffect(() => {
        const syncBranch = () => {
            const adminFilter = localStorage.getItem('user_branch_id'); // This is updated by AdminLayout dropdown
            if (adminFilter === null || adminFilter === 'all') {
                setSelectedBranchId('All');
            } else {
                setSelectedBranchId(Number(adminFilter));
            }
        };

        syncBranch();
        
        // Also listen for storage events if admin opens multiple tabs (optional but good)
        window.addEventListener('storage', syncBranch);
        // Custom event if needed, but AdminLayout effect will trigger re-renders of children
        return () => window.removeEventListener('storage', syncBranch);
    }, [setSelectedBranchId]);

    return null;
}

export default function AdminManagerLayout({ children }: { children: React.ReactNode }) {
    return (
        <ManagerProvider>
            <ContextSync />
            {children}
        </ManagerProvider>
    );
}
