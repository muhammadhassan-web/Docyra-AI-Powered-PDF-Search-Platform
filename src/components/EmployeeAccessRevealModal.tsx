import { useState } from 'react';
import { KeyRound, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/useAuth';

const EmployeeAccessRevealModal = () => {
    const { employeeAccessReveal, clearEmployeeAccessReveal } = useAuth();
    const [copied, setCopied] = useState(false);

    if (!employeeAccessReveal) return null;

    const { companyCode, password } = employeeAccessReveal;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(`Company code: ${companyCode}\nPassword: ${password}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access can fail (permissions/insecure context) — the
            // values are already shown on screen, so this is a nice-to-have.
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-2 duration-300">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                    <KeyRound size={28} />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800 mb-1 text-center">Employee Access Created</h2>
                <p className="text-sm text-slate-500 mb-6 text-center">
                    Share this with your employees so they can log in and ask DOCYRA questions instead of emailing HR/IT.
                    You can change this password anytime from Admin Portal → Employee Access.
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 space-y-3">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Company Code</p>
                        <p className="font-mono text-sm font-bold text-slate-800">{companyCode}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Password</p>
                        <p className="font-mono text-sm font-bold text-slate-800 break-all">{password}</p>
                    </div>
                </div>

                <button
                    onClick={handleCopy}
                    className="w-full mb-3 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 p-3 rounded-2xl font-bold text-sm transition-all"
                >
                    {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy Company Code & Password'}
                </button>

                <button
                    onClick={clearEmployeeAccessReveal}
                    className="w-full bg-[#002e5d] text-white p-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-900 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                >
                    I've Saved This — Continue
                </button>
            </div>
        </div>
    );
};

export default EmployeeAccessRevealModal;
