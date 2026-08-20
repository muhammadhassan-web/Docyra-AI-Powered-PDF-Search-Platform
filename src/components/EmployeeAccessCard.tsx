import { useEffect, useState } from 'react';
import { Users, RefreshCw, Copy, Check } from 'lucide-react';
import { api, ApiError } from '../api/client';

interface EmployeeAccessInfo {
    companyCode: string;
    isSetUp: boolean;
}

const EmployeeAccessCard = () => {
    const [info, setInfo] = useState<EmployeeAccessInfo | null>(null);
    const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [useCode, setUseCode] = useState(false);
    const [code, setCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [requestingCode, setRequestingCode] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get<EmployeeAccessInfo>('/api/auth/employee-access')
            .then(setInfo)
            .catch(() => setError('Could not load employee access info.'));
    }, []);

    const resetForm = () => {
        setShowForm(false);
        setCurrentPassword('');
        setNewPassword('');
        setUseCode(false);
        setCode('');
        setCodeSent(false);
    };

    const handleRequestCode = async () => {
        setRequestingCode(true);
        setError('');
        try {
            await api.post('/api/auth/employee-access/request-reset-code');
            setUseCode(true);
            setCodeSent(true);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to send a verification code.');
        } finally {
            setRequestingCode(false);
        }
    };

    const handleRegenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegenerating(true);
        setError('');
        try {
            const { password } = await api.post<{ password: string }>('/api/auth/employee-access/regenerate', {
                password: newPassword,
                ...(useCode ? { code } : info?.isSetUp ? { currentPassword } : {}),
            });
            setRevealedPassword(password);
            setInfo(prev => (prev ? { ...prev, isSetUp: true } : prev));
            resetForm();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to set the password.');
        } finally {
            setRegenerating(false);
        }
    };

    const handleCopy = async () => {
        if (!info || !revealedPassword) return;
        try {
            await navigator.clipboard.writeText(`Company code: ${info.companyCode}\nPassword: ${revealedPassword}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // best-effort — values are already on screen
        }
    };

    if (!info) return null;

    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                    <Users size={20} />
                </div>
                <div>
                    <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">Employee Password Change</h4>
                    <p className="text-slate-400 text-xs font-medium">One shared login every employee uses to ask DOCYRA questions</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Company Code</p>
                    <p className="font-mono text-sm font-bold text-slate-800">{info.companyCode}</p>
                </div>

                <button
                    onClick={() => (showForm ? resetForm() : setShowForm(true))}
                    className="flex items-center justify-center gap-2 bg-[#002e5d] text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-900 transition-all shrink-0"
                >
                    <RefreshCw size={14} />
                    {info.isSetUp ? 'Change Password' : 'Set Password'}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleRegenerate} className="mt-4 space-y-3">
                    {info.isSetUp && (
                        useCode ? (
                            <input
                                type="text"
                                placeholder="6-digit code from your email"
                                aria-label="Verification code"
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                maxLength={6}
                                autoFocus
                                required
                            />
                        ) : (
                            <input
                                type="password"
                                placeholder="Current shared password"
                                aria-label="Current shared password"
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                autoFocus
                                required
                            />
                        )
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            placeholder="New shared password"
                            aria-label="New shared password"
                            className="flex-1 p-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            minLength={6}
                            required
                        />
                        <button
                            type="submit"
                            disabled={regenerating}
                            className="bg-[#002e5d] text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-900 transition-all disabled:opacity-60 shrink-0"
                        >
                            {regenerating ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                    {info.isSetUp && !useCode && (
                        <button
                            type="button"
                            onClick={handleRequestCode}
                            disabled={requestingCode}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-60"
                        >
                            {requestingCode ? 'Sending code...' : "Don't know the current password? Email me a code"}
                        </button>
                    )}
                    {codeSent && useCode && (
                        <p className="text-[11px] font-bold text-green-600">A verification code was sent to your registered email.</p>
                    )}
                </form>
            )}

            {error && <p className="text-red-600 text-xs font-bold mt-3">{error}</p>}

            {revealedPassword && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                        New password — shown only once, share it now
                    </p>
                    <p className="font-mono text-sm font-bold text-slate-800 mb-3 break-all">{revealedPassword}</p>
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-bold text-xs transition-all border border-slate-200"
                    >
                        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy Company Code & Password'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default EmployeeAccessCard;
