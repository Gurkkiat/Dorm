'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Camera, Save, Loader2, User } from 'lucide-react';

interface ProfileModalProps {
    onClose: () => void;
    accentColor?: 'slate' | 'indigo' | 'blue'; // portal theme
}

const ACCENT = {
    slate:  { ring: 'ring-slate-500', btn: 'bg-slate-800 hover:bg-slate-700', badge: 'bg-slate-700' },
    indigo: { ring: 'ring-indigo-500', btn: 'bg-indigo-600 hover:bg-indigo-700', badge: 'bg-indigo-700' },
    blue:   { ring: 'ring-blue-500',   btn: 'bg-blue-600 hover:bg-blue-700',   badge: 'bg-blue-600' },
};

export default function ProfileModal({ onClose, accentColor = 'blue' }: ProfileModalProps) {
    const accent = ACCENT[accentColor];
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [form, setForm] = useState({
        full_name: '',
        phone: '',
        e_mail: '',
        profile_picture: '' as string | null,
    });

    const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;

    useEffect(() => {
        if (!userId) return;
        fetchProfile();
    }, [userId]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('full_name, phone, e_mail, profile_picture')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setForm({
                full_name: data.full_name || '',
                phone: data.phone || '',
                e_mail: data.e_mail || '',
                profile_picture: data.profile_picture || null,
            });
            if (data.profile_picture) setPreviewUrl(data.profile_picture);
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        // Local preview
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);

        setUploading(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `profiles/${userId}_${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(path, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(path);

            setForm(prev => ({ ...prev, profile_picture: urlData.publicUrl }));
        } catch (err: any) {
            console.error('Upload error:', err);
            alert('Photo upload failed: ' + err.message + '\n\nMake sure a "profile-pictures" storage bucket exists in Supabase.');
            setPreviewUrl(form.profile_picture);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    full_name: form.full_name,
                    phone: form.phone,
                    e_mail: form.e_mail,
                    profile_picture: form.profile_picture,
                })
                .eq('id', userId);

            if (error) throw error;

            // Update localStorage display name
            localStorage.setItem('user_name', form.full_name);
            alert('Profile updated successfully!');
            onClose();
            window.location.reload(); // Refresh to update sidebar name
        } catch (err: any) {
            console.error('Save error:', err);
            alert('Failed to save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <User size={20} className="text-slate-500" />
                        My Profile
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={32} className="animate-spin text-slate-300" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="p-6 space-y-5">
                        {/* Avatar Upload */}
                        <div className="flex flex-col items-center gap-3">
                            <div className="relative group">
                                <div className={`w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg ring-4 ${accent.ring}`}>
                                    {previewUrl ? (
                                        <img
                                            src={previewUrl}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className={`w-full h-full ${accent.badge} flex items-center justify-center text-white text-3xl font-black`}>
                                            {form.full_name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="absolute -bottom-1 -right-1 bg-slate-800 text-white p-2 rounded-full shadow-md hover:bg-slate-700 transition-colors disabled:opacity-60"
                                >
                                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                                </button>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <p className="text-xs text-slate-400">Click the camera icon to change your photo</p>
                        </div>

                        {/* Fields */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                            <input
                                type="text" required
                                value={form.full_name}
                                onChange={e => setForm({ ...form, full_name: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Phone</label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={e => setForm({ ...form, phone: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-sm"
                                placeholder="08X-XXX-XXXX"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={form.e_mail}
                                onChange={e => setForm({ ...form, e_mail: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 text-sm"
                                placeholder="email@example.com"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving || uploading}
                                className={`flex-1 px-4 py-2 ${accent.btn} text-white rounded-xl font-bold transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-60`}
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Save Changes
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
