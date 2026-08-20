import { useEffect, useState } from 'react';
import { Building2, KeyRound, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/useAuth';
import type { CompanySize } from '../types';

const COMPANY_SIZES: CompanySize[] = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

interface OrganizationDetails {
    name: string;
    address: string;
    industry: string;
    size: CompanySize | '';
    companyCode: string;
}

const StatusBanner = ({ status }: { status: { text: string; type: 'success' | 'error' } | null }) => {
    if (!status) return null;
    return (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold mb-4 ${
            status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
        }`}>
            {status.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {status.text}
        </div>
    );
};

const CompanySettings = () => {
    const { refreshUser } = useAuth();
    const [org, setOrg] = useState<OrganizationDetails | null>(null);
    const [orgStatus, setOrgStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [savingOrg, setSavingOrg] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordStatus, setPasswordStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [savingPassword, setSavingPassword] = useState(false);

    useEffect(() => {
        api.get<OrganizationDetails>('/api/organization').then(setOrg).catch(() => {
            setOrgStatus({ text: 'Could not load company details.', type: 'error' });
        });
    }, []);

    const handleOrgSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!org) return;
        setSavingOrg(true);
        setOrgStatus(null);
        try {
            const updated = await api.patch<OrganizationDetails>('/api/organization', {
                name: org.name,
                address: org.address,
                industry: org.industry || undefined,
                size: org.size || undefined,
            });
            setOrg(updated);
            await refreshUser();
            setOrgStatus({ text: 'Company details updated.', type: 'success' });
        } catch (err) {
            setOrgStatus({ text: err instanceof ApiError ? err.message : 'Failed to save changes.', type: 'error' });
        } finally {
            setSavingOrg(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingPassword(true);
        setPasswordStatus(null);
        try {
            await api.post('/api/auth/change-password', { currentPassword, newPassword });
            setCurrentPassword('');
            setNewPassword('');
            setPasswordStatus({ text: 'Your password has been updated.', type: 'success' });
        } catch (err) {
            setPasswordStatus({ text: err instanceof ApiError ? err.message : 'Failed to update password.', type: 'error' });
        } finally {
            setSavingPassword(false);
        }
    };

    if (!org) {
        return (
            <div className="flex-1 p-4 md:p-8 bg-[#f8fafc] flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" size={28} />
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 md:p-8 bg-[#f8fafc] overflow-y-auto">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Company Settings</h2>
                    <p className="text-slate-500 text-sm font-medium">Manage your company's details and your account's password.</p>
                </div>

                {/* Company details */}
                <form onSubmit={handleOrgSubmit} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                            <Building2 size={20} />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">Company Details</h4>
                            <p className="text-slate-400 text-xs font-medium">Company code {org.companyCode} — assigned at registration, can't be changed</p>
                        </div>
                    </div>

                    <StatusBanner status={orgStatus} />

                    <div className="space-y-3">
                        <label className="block">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Company Name</span>
                            <input
                                type="text"
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                value={org.name}
                                onChange={(e) => setOrg({ ...org, name: e.target.value })}
                                required
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Company Address</span>
                            <input
                                type="text"
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                value={org.address}
                                onChange={(e) => setOrg({ ...org, address: e.target.value })}
                                required
                            />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Industry</span>
                                <input
                                    type="text"
                                    placeholder="Optional"
                                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                    value={org.industry}
                                    onChange={(e) => setOrg({ ...org, industry: e.target.value })}
                                />
                            </label>
                            <label className="block">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Company Size</span>
                                <select
                                    className="w-full h-full p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm bg-white"
                                    value={org.size}
                                    onChange={(e) => setOrg({ ...org, size: e.target.value as CompanySize | '' })}
                                >
                                    <option value="">Optional</option>
                                    {COMPANY_SIZES.map((size) => (
                                        <option key={size} value={size}>{size} employees</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={savingOrg}
                        className="mt-5 bg-[#002e5d] text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-900 transition-all disabled:opacity-60"
                    >
                        {savingOrg ? 'Saving...' : 'Save Company Details'}
                    </button>
                </form>

                {/* Admin password */}
                <form onSubmit={handlePasswordSubmit} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                            <KeyRound size={20} />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">Your Password</h4>
                            <p className="text-slate-400 text-xs font-medium">Requires your current password. Forgot it? Sign out and use "Forgot password" on the login screen.</p>
                        </div>
                    </div>

                    <StatusBanner status={passwordStatus} />

                    <div className="space-y-3">
                        <label className="block">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Current Password</span>
                            <input
                                type="password"
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">New Password</span>
                            <input
                                type="password"
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={10}
                                required
                            />
                            <span className="text-[10px] text-slate-400 mt-1 block">At least 10 characters, with a letter and a number.</span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={savingPassword}
                        className="mt-5 bg-[#002e5d] text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-900 transition-all disabled:opacity-60"
                    >
                        {savingPassword ? 'Saving...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CompanySettings;
