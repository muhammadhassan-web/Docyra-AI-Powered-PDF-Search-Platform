import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import AdminPanel from './components/AdminPanel';
import CompanySettings from './components/CompanySettings';
import AuthScreen from './components/AuthScreen';
import LandingPage from './components/LandingPage';
import EmployeeAccessRevealModal from './components/EmployeeAccessRevealModal';
import { useAuth } from './context/useAuth';
import { api } from './api/client';
import type { Policy } from './types';
import { Menu, X, Cloud, ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react';

type PublicScreen = 'landing' | 'login' | 'register';

function App() {
    const { user, isLoading } = useAuth();
    const [publicScreen, setPublicScreen] = useState<PublicScreen>('landing');

    const [view, setView] = useState<'chat' | 'admin' | 'settings'>(() => {
        const stored = localStorage.getItem('docyra_current_view');
        return stored === 'admin' || stored === 'settings' ? stored : 'chat';
    });

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [vaultError, setVaultError] = useState<string | null>(null);

    const canManageVault = user?.role === 'owner' || user?.role === 'admin';

    const fetchVaultData = async () => {
        setIsSyncing(true);
        try {
            const data = await api.get<Policy[]>('/api/policies');
            setPolicies(data);
            setVaultError(null);
        } catch (err) {
            console.error('Could not load vault data.', err);
            setVaultError('Could not load your document vault. Check your connection and try again.');
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (user) fetchVaultData();
    }, [user]);

    useEffect(() => {
        localStorage.setItem('docyra_current_view', view);
    }, [view]);

    useEffect(() => {
        // A stale 'admin' view from a previous (owner/admin) session on this
        // browser would otherwise strand a member/employee account on the
        // "Access Required" screen — they have no toggle button to get back
        // to chat since it's hidden for accounts that can't manage the vault.
        if (user && !canManageVault && (view === 'admin' || view === 'settings')) {
            setView('chat');
        }
    }, [user, canManageVault, view]);

    const handleToggleView = () => {
        setIsMobileMenuOpen(false);
        setView(view === 'admin' || view === 'settings' ? 'chat' : 'admin');
    };

    const handleOpenSettings = () => {
        setIsMobileMenuOpen(false);
        setView('settings');
    };

    if (isLoading) {
        return <div className="h-[100dvh] w-full flex items-center justify-center bg-slate-50 text-slate-400 font-bold text-sm">Loading...</div>;
    }

    if (!user) {
        if (publicScreen === 'landing') {
            return (
                <LandingPage
                    onLogin={() => setPublicScreen('login')}
                    onGetStarted={() => setPublicScreen('register')}
                />
            );
        }
        return (
            <AuthScreen
                initialMode={publicScreen === 'register' ? 'register' : 'login'}
                onBack={() => setPublicScreen('landing')}
            />
        );
    }

    return (
        <div className="flex h-[100dvh] w-full bg-slate-50 overflow-hidden fixed inset-0 font-sans">
            <EmployeeAccessRevealModal />

            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            <div className={`
                fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0 w-72 h-full
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <Sidebar
                    onToggleAdmin={handleToggleView}
                    onOpenSettings={handleOpenSettings}
                    isAdmin={view === 'admin'}
                    isSettings={view === 'settings'}
                    documents={policies}
                />
            </div>

            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

                <header className="h-16 border-b bg-white flex items-center px-4 md:px-8 shadow-sm justify-between shrink-0 z-30">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 -ml-2 text-slate-600 md:hidden hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>

                        <div className="flex flex-col">
                            <h2 className="text-slate-800 font-bold italic text-xs md:text-sm tracking-tight">{user.organization.name.toUpperCase()}</h2>
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.15em] flex items-center gap-1">
                                {isSyncing && <Cloud size={10} className="animate-pulse" />}
                                {view === 'admin' ? 'Vault Management' : view === 'settings' ? 'Company Settings' : `${user.organization.name} Agent`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-blue-500' : 'bg-green-500'} ${isSyncing ? 'animate-pulse' : ''}`}></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:block">
                            {isSyncing ? 'Syncing...' : 'Connected'}
                        </span>
                    </div>
                </header>

                {vaultError && (
                    <div className="bg-red-50 border-b border-red-100 text-red-700 text-xs font-bold px-4 md:px-8 py-2.5 flex items-center justify-between gap-3 shrink-0">
                        <span className="flex items-center gap-2"><AlertTriangle size={14} /> {vaultError}</span>
                        <button
                            onClick={fetchVaultData}
                            className="flex items-center gap-1 text-red-700 hover:text-red-900 underline underline-offset-2 shrink-0"
                        >
                            <RefreshCw size={12} /> Retry
                        </button>
                    </div>
                )}

                <div className="flex-1 relative overflow-hidden bg-slate-50">
                    {view === 'chat' && (
                        <div className="absolute inset-0 animate-in fade-in duration-300">
                            <ChatWindow policies={policies} organizationName={user.organization.name} />
                        </div>
                    )}

                    {view === 'admin' && !canManageVault && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-4 animate-in fade-in duration-300">
                            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm text-center animate-in zoom-in-95 duration-300">
                                <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                                    <ShieldAlert size={28} />
                                </div>
                                <h2 className="text-lg font-extrabold text-slate-800 mb-1">Admin Access Required</h2>
                                <p className="text-slate-400 text-sm">Your account doesn't have permission to manage the vault. Contact your workspace owner.</p>
                            </div>
                        </div>
                    )}

                    {view === 'admin' && canManageVault && (
                        <div className="absolute inset-0 overflow-y-auto animate-in fade-in duration-300">
                             <AdminPanel
                                policies={policies}
                                setPolicies={setPolicies}
                                onRefresh={fetchVaultData}
                             />
                        </div>
                    )}

                    {view === 'settings' && canManageVault && (
                        <div className="absolute inset-0 overflow-y-auto animate-in fade-in duration-300">
                            <CompanySettings />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
