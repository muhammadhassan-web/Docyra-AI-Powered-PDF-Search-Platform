import { ShieldCheck, FileText, Database, Lock, LogOut, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import type { Policy } from '../types';

interface SidebarProps {
    onToggleAdmin: () => void;
    isAdmin: boolean;
    documents: Policy[];
}

const Sidebar = ({ onToggleAdmin, isAdmin, documents }: SidebarProps) => {
    const { user, logout } = useAuth();

    return (
        /* Removed h-screen and replaced with h-full for better mobile compatibility */
        <aside className="w-full md:w-72 h-full bg-[#002e5d] text-white flex flex-col border-r border-blue-900 shadow-2xl overflow-hidden">

            {/* 1. Branding Header: Fixed height */}
            <div className="p-6 flex items-center gap-3 border-b border-blue-800 bg-blue-950/30 shrink-0">
                <ShieldCheck className="text-blue-400" size={28} />
                <div>
                    <h1 className="font-bold text-lg leading-tight tracking-tight">DOCYRA</h1>
                    <p className="text-[10px] text-blue-300 uppercase tracking-[0.2em] font-black">Enterprise Vault</p>
                </div>
            </div>

            {/* 2. Navigation Section: Scrollable, takes remaining middle space */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                <div>
                    <p className="px-3 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Database size={12} /> Knowledge Base
                    </p>

                    <ul className="space-y-1.5">
                        {documents.length === 0 ? (
                            <li className="px-3 py-4 text-xs text-blue-300/50 italic text-center border border-dashed border-blue-800 rounded-lg">
                                No assets indexed...
                            </li>
                        ) : (
                            documents.map((doc) => (
                                <li
                                    key={doc._id}
                                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-800/50 cursor-pointer transition-all border border-transparent hover:border-blue-700/50"
                                >
                                    <div className={`p-1.5 rounded-lg transition-colors ${
                                        doc.department === 'IT' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                                    } group-hover:bg-white group-hover:text-[#002e5d]`}>
                                        <FileText size={16} />
                                    </div>

                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-semibold text-slate-200 group-hover:text-white truncate">
                                            {doc.name}
                                        </span>
                                        <span className={`text-[9px] font-black uppercase tracking-tighter ${
                                            doc.department === 'IT' ? 'text-purple-400' : 'text-blue-400'
                                        }`}>
                                            {doc.department} Vault
                                        </span>
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </nav>

            {/* 3. Footer: user info, view toggle, sign out — pinned to bottom */}
            <div className="shrink-0 border-t border-blue-800 bg-blue-950/50">
                <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">
                            {user?.isEmployeeAccount ? 'Employee Access' : user?.email}
                        </p>
                        <p className="text-[9px] text-blue-300 uppercase tracking-widest font-black">
                            {user?.isEmployeeAccount ? user?.organization.name : user?.role}
                        </p>
                    </div>
                    <button
                        onClick={logout}
                        title="Sign out"
                        className="p-2 text-blue-300 hover:text-white hover:bg-red-900/40 rounded-lg transition-colors shrink-0"
                    >
                        <LogOut size={16} />
                    </button>
                </div>

                {!user?.isEmployeeAccount && (
                    <button
                        onClick={onToggleAdmin}
                        className="p-5 pt-3 transition-all text-left w-full group active:scale-[0.98] hover:bg-blue-900/60"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-lg transition-transform bg-blue-600 text-white">
                                <ArrowLeftRight size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-bold tracking-tight truncate">
                                    {isAdmin ? 'Back to Chat' : 'Admin Portal'}
                                </p>
                                <p className="text-[10px] text-blue-300 font-medium flex items-center gap-1 opacity-80">
                                    <Lock size={10} /> {isAdmin ? 'Employee Mode' : 'Vault Management'}
                                </p>
                            </div>
                        </div>
                    </button>
                )}

                {/* Visual buffer for mobile home indicator bars */}
                <div className="h-[env(safe-area-inset-bottom)] bg-blue-950/80 md:hidden"></div>
            </div>
        </aside>
    );
};

export default Sidebar;
