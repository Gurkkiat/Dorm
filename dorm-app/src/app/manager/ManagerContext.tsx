'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface Branch {
    id: number;
    branches_name: string;
    manager_name: string;
    city: string;
}

interface ManagerContextType {
    selectedBranchId: number | 'All';
    setSelectedBranchId: (id: number | 'All') => void;
    branches: Branch[];
    setBranches: (branches: Branch[]) => void;
    loadingBranch: boolean;
    setLoadingBranch: (loading: boolean) => void;
}

const ManagerContext = createContext<ManagerContextType | undefined>(undefined);

export function ManagerProvider({ children }: { children: ReactNode }) {
    const [selectedBranchId, setSelectedBranchId] = useState<number | 'All'>('All');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loadingBranch, setLoadingBranch] = useState(true);

    return (
        <ManagerContext.Provider value={{ selectedBranchId, setSelectedBranchId, branches, setBranches, loadingBranch, setLoadingBranch }}>
            {children}
        </ManagerContext.Provider>
    );
}

export function useManager() {
    const context = useContext(ManagerContext);
    if (!context) {
        throw new Error('useManager must be used within a ManagerProvider');
    }
    return context;
}
