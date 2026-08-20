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
    const [regenerating, setRegenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get<EmployeeAccessInfo>('/api/auth/employee-access')
            .then(setInfo)
            .catch(() => setError('Could not load employee access info.'));
    }, []);

    const handleRegenerate = async () => {
        if (revealedPassword && !window.confirm('This will sign out any employees currently logged in with the old password. Continue?')) return;
        setRegenerating(true);
        setError('');
        try {
            const { password } = await api.post<{ password: string }>('/api/auth/employee-access/regenerate');
            setRevealedPassword(password);
            setInfo(prev => (prev ? { ...prev, isSetUp: true } : prev));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to generate a password.');
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
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 mb-10">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                    <Users size={20} />
                </div>
                <div>
                    <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">Employee Access</h4>
                    <p className="text-slate-400 text-xs font-medium">One shared login every employee uses to ask DOCYRA questions</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Company Code</p>
                    <p className="font-mono text-sm font-bold text-slate-800">{info.companyCode}</p>
                </div>

                <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="flex items-center justify-center gap-2 bg-[#002e5d] text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-900 transition-all disabled:opacity-60 shrink-0"
                >
                    <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
                    {info.isSetUp ? 'Regenerate Password' : 'Generate Password'}
                </button>
            </div>

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
