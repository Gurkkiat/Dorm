'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { User as UserIcon, Mail, Phone, Home, CreditCard, Heart, Edit2, Save, X, Camera } from 'lucide-react';
import Loading from '@/components/ui/loading';

interface UserProfile {
    id: number;
    full_name: string;
    phone: string;
    e_mail: string;
    sex: string;
    pet: string;
    identification_number: string;
    profile_picture: string | null;
}

export default function TenantProfile() {
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const storedUserId = localStorage.getItem('user_id');
            if (!storedUserId) {
                alert('No user logged in.');
                return;
            }

            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, phone, e_mail, sex, pet, identification_number, profile_picture')
                .eq('id', storedUserId)
                .single();

            if (error) throw error;

            setProfile(data);
            setEditForm(data);
        } catch (error: any) {
            console.error('Error fetching profile:', error);
            alert('Could not load profile data.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!profile) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    full_name: editForm.full_name,
                    phone: editForm.phone,
                    e_mail: editForm.e_mail,
                    sex: editForm.sex,
                    pet: editForm.pet,
                    identification_number: editForm.identification_number,
                })
                .eq('id', profile.id);

            if (error) throw error;

            // Update local storage if name changed
            if (editForm.full_name) {
                localStorage.setItem('user_name', editForm.full_name);
            }

            setProfile(editForm as UserProfile);
            setIsEditing(false);
            alert('Profile updated successfully!');
            // Reload page to reflect name change in sidebar if needed
            window.location.reload();
        } catch (error: any) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile) return;

        setUploadingImage(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${profile.id}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const profilePicUrl = publicUrlData.publicUrl;

            // Update local state and DB immediately for the avatar
            setEditForm(prev => ({ ...prev, profile_picture: profilePicUrl }));
            setProfile(prev => prev ? { ...prev, profile_picture: profilePicUrl } : null);

            await supabase
                .from('users')
                .update({ profile_picture: profilePicUrl })
                .eq('id', profile.id);

        } catch (error: any) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image.');
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (loading) return <Loading />;
    if (!profile) return <div className="p-8 text-center text-gray-500">Profile data not found.</div>;

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 font-sans pb-24">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
                    <p className="text-gray-500 mt-1">Manage your personal information</p>
                </div>
                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="bg-[#0047AB] hover:bg-[#00388A] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Edit2 size={18} /> Edit Profile
                    </button>
                ) : (
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setIsEditing(false); setEditForm(profile); }}
                            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
                            disabled={saving}
                        >
                            <X size={18} /> Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
                            disabled={saving}
                        >
                            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">

                {/* Avatar Section */}
                <div className="flex items-center gap-6 mb-10 pb-8 border-b border-gray-100">
                    <div className="relative group">
                        {editForm.profile_picture || profile.profile_picture ? (
                            <img 
                                src={editForm.profile_picture || profile.profile_picture || ''} 
                                alt="Profile" 
                                className="h-24 w-24 rounded-full object-cover shadow-lg shadow-blue-200 shrink-0"
                            />
                        ) : (
                            <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-[#0047AB] to-[#0066FF] flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-200 shrink-0">
                                {profile.full_name.charAt(0) || 'T'}
                            </div>
                        )}
                        {isEditing && (
                            <>
                                <div 
                                    className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploadingImage ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Camera className="text-white" size={24} />
                                    )}
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleImageUpload} 
                                    accept="image/*" 
                                    className="hidden" 
                                />
                            </>
                        )}
                    </div>
                    <div>
                        {isEditing ? (
                            <input
                                type="text"
                                name="full_name"
                                value={editForm.full_name || ''}
                                onChange={handleChange}
                                className="text-2xl font-bold text-gray-900 border-b-2 border-[#0047AB] focus:outline-none bg-blue-50/50 px-2 py-1 rounded-t w-full max-w-md"
                                placeholder="Full Name"
                            />
                        ) : (
                            <h2 className="text-2xl font-bold text-gray-800">{profile.full_name}</h2>
                        )}
                        <p className="text-gray-500 font-medium">Tenant ID: #{profile.id}</p>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* Contact Info */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Phone className="text-[#0047AB]" size={20} /> Contact Details
                        </h3>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Phone Number</label>
                            {isEditing ? (
                                <input
                                    type="tel"
                                    name="phone"
                                    value={editForm.phone || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#0047AB] focus:ring-1 focus:ring-[#0047AB] transition-all bg-gray-50"
                                />
                            ) : (
                                <p className="text-gray-800 font-medium text-lg">{profile.phone || '-'}</p>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Email Address</label>
                            {isEditing ? (
                                <input
                                    type="email"
                                    name="e_mail"
                                    value={editForm.e_mail || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#0047AB] focus:ring-1 focus:ring-[#0047AB] transition-all bg-gray-50"
                                />
                            ) : (
                                <p className="text-gray-800 font-medium text-lg">{profile.e_mail || '-'}</p>
                            )}
                        </div>
                    </div>

                    {/* Personal Info */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <UserIcon className="text-[#0047AB]" size={20} /> Personal Information
                        </h3>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Identification Number</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    name="identification_number"
                                    value={editForm.identification_number || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#0047AB] focus:ring-1 focus:ring-[#0047AB] transition-all bg-gray-50"
                                />
                            ) : (
                                <p className="text-gray-800 font-medium text-lg">{profile.identification_number || '-'}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Gender</label>
                                {isEditing ? (
                                    <select
                                        name="sex"
                                        value={editForm.sex || ''}
                                        onChange={handleChange}
                                        className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#0047AB] focus:ring-1 focus:ring-[#0047AB] transition-all bg-gray-50 appearance-none"
                                    >
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                ) : (
                                    <p className="text-gray-800 font-medium text-lg">{profile.sex || '-'}</p>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                                    Pet Status <Heart size={12} className="text-red-400" />
                                </label>
                                {isEditing ? (
                                    <select
                                        name="pet"
                                        value={editForm.pet || ''}
                                        onChange={handleChange}
                                        className="w-full p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#0047AB] focus:ring-1 focus:ring-[#0047AB] transition-all bg-gray-50 appearance-none"
                                    >
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                ) : (
                                    <p className="text-gray-800 font-medium text-lg">
                                        {profile.pet === 'Yes' ? (
                                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-md text-sm border border-green-200">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="text-gray-500">None</span>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
