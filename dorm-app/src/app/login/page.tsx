
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Check against "users" table
            // Note: Storing passwords in plain text is insecure.
            // This implementation assumes the database has plain text passwords as per the provided schema/instructions
            // or that we are matching against a pre-existing insecure system.
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password) // Direct comparison (Security Warning!)
                .single();

            if (error || !data) {
                throw new Error('Invalid username or password');
            }

            // 2. Successful Login
            // For a real app, you'd set a secure cookie or use Supabase Auth sessions.
            // Here we'll just store basic info in localStorage for the demo/prototype nature.
            if (typeof window !== 'undefined') {
                localStorage.setItem('user_id', data.id.toString());
                localStorage.setItem('user_role', data.role);
                localStorage.setItem('user_name', data.full_name);
                if (data.branch_id) {
                    localStorage.setItem('user_branch_id', data.branch_id.toString());
                } else {
                    localStorage.removeItem('user_branch_id');
                }
            }

            // 3. Redirect based on role
            // 3. Redirect based on role
            const role = data.role?.toLowerCase() || '';
            if (role.includes('manager') || role === 'admin') {
                router.push('/manager/dashboard');
            } else if (role === 'mechanic') {
                router.push('/mechanic/maintenance');
            } else {
                router.push('/tenant/dashboard'); // Default for tenants
            }

        } catch (err: unknown) {
            console.error('Login error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Login failed';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#0047AB] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden w-full max-w-4xl flex flex-col md:flex-row min-h-[500px]">

                {/* Left Side - Login Form */}
                <div className="w-full md:w-1/2 p-12 flex flex-col justify-center relative">

                    <h2 className="text-4xl font-bold text-[#0047AB] text-center mb-12">Login</h2>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-gray-500 text-sm mb-2 ml-1">username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="username"
                                className="w-full bg-gray-200 text-gray-700 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                required
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2 ml-1">
                                <label className="block text-gray-500 text-sm">password</label>
                                <a href="#" className="text-[#0047AB] text-sm font-bold hover:underline">forgot password ?</a>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="********"
                                className="w-full bg-gray-200 text-gray-700 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                                required
                            />
                        </div>

                        <div className="flex items-center ml-1">
                            <input
                                id="remember_me"
                                type="checkbox"
                                className="h-4 w-4 text-[#0047AB] focus:ring-[#0047AB] border-gray-300 rounded"
                            />
                            <label htmlFor="remember_me" className="ml-2 block text-sm text-[#0047AB]">
                                remember me
                            </label>
                        </div>

                        {error && (
                            <p className="text-red-500 text-sm text-center">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#0047AB] text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-800 transition duration-300 text-lg shadow-md"
                        >
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                </div>

                {/* Right Side - Branding */}
                <div className="w-full md:w-1/2 bg-[#E0E0E0] p-12 flex flex-col items-center justify-center relative">
                    <div className="relative">
                        <div className="w-46 h-46 relative flex items-center justify-center">
                            <img src="/dorm_logo_blue.png" alt="Dormitory Logo" className="w-full h-full object-contain drop-shadow-2xl" />
                        </div>
                    </div>

                    <div className="mt-2 text-center">
                        <h3 className="text-[#0047AB] text-3xl font-bold tracking-wide leading-tight">Dormitory</h3>
                        <h3 className="text-[#0047AB] text-xl font-medium tracking-wide leading-tight">Management System</h3>
                    </div>
                </div>

            </div>
        </div>
    );
}
