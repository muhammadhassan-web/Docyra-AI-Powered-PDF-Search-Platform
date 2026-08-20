import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Users, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { api, ApiError } from '../api/client';
import { useHoverLift } from '../hooks/useHoverLift';
import type { CompanySize } from '../types';

const COMPANY_SIZES: CompanySize[] = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

interface AuthScreenProps {
    initialAudience?: 'admin' | 'employee';
    initialMode?: 'login' | 'register';
    onBack?: () => void;
}

const AuthScreen = ({ initialAudience = 'admin', initialMode = 'login', onBack }: AuthScreenProps) => {
    const { login, register, employeeLogin } = useAuth();
    const submitRef = useHoverLift<HTMLButtonElement>();
    const [audience, setAudience] = useState<'admin' | 'employee'>(initialAudience);
    const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);

    // Forgot password
    const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotCode, setForgotCode] = useState('');
    const [forgotNewPassword, setForgotNewPassword] = useState('');
    const [forgotMessage, setForgotMessage] = useState('');

    // Admin register
    const [organizationName, setOrganizationName] = useState('');
    const [organizationAddress, setOrganizationAddress] = useState('');
    const [industry, setIndustry] = useState('');
    const [companySize, setCompanySize] = useState<CompanySize | ''>('');
    const [adminName, setAdminName] = useState('');
    const [employeePassword, setEmployeePassword] = useState('');

    // Shared
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Employee login
    const [companyCode, setCompanyCode] = useState('');

    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            if (forgotStep === 'request') {
                await api.post('/api/auth/forgot-password', { email: forgotEmail });
                setForgotMessage('If that email is registered, a 6-digit code has been sent to it.');
                setForgotStep('reset');
            } else {
                await api.post('/api/auth/reset-password', { email: forgotEmail, code: forgotCode, newPassword: forgotNewPassword });
                setForgotMessage('');
                setMode('login');
                setForgotStep('request');
                setForgotCode('');
                setForgotNewPassword('');
                setEmail(forgotEmail);
                setPassword('');
                setError('');
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            if (audience === 'employee') {
                await employeeLogin(companyCode.trim(), password);
            } else if (mode === 'login') {
                await login(email, password);
            } else if (mode === 'register') {
                await register({
                    organizationName,
                    organizationAddress,
                    industry: industry || undefined,
                    companySize: companySize || undefined,
                    adminName,
                    email,
                    password,
                    employeePassword,
                });
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const isAdminRegister = audience === 'admin' && mode === 'register';

    return (
        <div className="h-[100dvh] w-full flex items-center justify-center bg-slate-100 p-4">
            <form
                onSubmit={mode === 'forgot' ? handleForgotSubmit : handleSubmit}
                className={`relative bg-white p-6 md:p-8 rounded-3xl shadow-2xl border border-slate-200 w-full animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-500 ${isAdminRegister ? 'max-w-md' : 'max-w-sm'}`}
            >
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="absolute top-5 left-5 md:top-6 md:left-6 flex items-center gap-1 text-slate-400 hover:text-blue-600 text-[11px] font-black uppercase tracking-widest transition-colors"
                    >
                        <ArrowLeft size={14} /> Home
                    </button>
                )}
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 transition-transform duration-300">
                    {audience === 'employee' ? <Users size={28} /> : <ShieldCheck size={28} />}
                </div>
                <h2 className="text-xl font-extrabold text-slate-800 mb-1 text-center">
                    {audience === 'employee' ? 'Employee Access' : mode === 'forgot' ? 'Reset Password' : mode === 'login' ? 'Sign In' : 'Register Your Company'}
                </h2>
                <p className="text-[11px] text-slate-400 mb-6 font-bold uppercase tracking-wider text-center">
                    DOCYRA Enterprise Vault
                </p>

                {mode !== 'forgot' && (
                    <div className="flex bg-slate-100 p-1 rounded-2xl mb-5">
                        <button
                            type="button"
                            onClick={() => { setAudience('admin'); setError(''); }}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${audience === 'admin' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                        >
                            HR / IT Admin
                        </button>
                        <button
                            type="button"
                            onClick={() => { setAudience('employee'); setError(''); }}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${audience === 'employee' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                        >
                            Employee
                        </button>
                    </div>
                )}

                {mode === 'forgot' ? (
                    forgotStep === 'request' ? (
                        <>
                            <label className="block mb-4">
                                <span className="sr-only">Work Email</span>
                                <input
                                    type="email"
                                    placeholder="Work Email"
                                    aria-label="Work Email"
                                    className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </label>
                            <p className="text-[11px] text-slate-400 mb-4 text-center">
                                We'll email a 6-digit code to your registered address.
                            </p>
                        </>
                    ) : (
                        <div className="space-y-3 mb-4">
                            {forgotMessage && (
                                <p className="text-[11px] text-green-600 font-bold text-center bg-green-50 border border-green-100 rounded-xl p-3">
                                    {forgotMessage}
                                </p>
                            )}
                            <label className="block">
                                <span className="sr-only">6-digit code</span>
                                <input
                                    type="text"
                                    placeholder="6-digit code"
                                    aria-label="6-digit code"
                                    className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                    value={forgotCode}
                                    onChange={(e) => setForgotCode(e.target.value)}
                                    maxLength={6}
                                    autoFocus
                                    required
                                />
                            </label>
                            <label className="block">
                                <span className="sr-only">New Password</span>
                                <input
                                    type="password"
                                    placeholder="New Password"
                                    aria-label="New Password"
                                    className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                    value={forgotNewPassword}
                                    onChange={(e) => setForgotNewPassword(e.target.value)}
                                    minLength={10}
                                    required
                                />
                            </label>
                            <p className="text-[10px] text-slate-400 -mt-1">At least 10 characters, with a letter and a number.</p>
                        </div>
                    )
                ) : audience === 'employee' ? (
                    <>
                        <label className="block mb-3">
                            <span className="sr-only">Company Code</span>
                            <input
                                type="text"
                                placeholder="Company Code"
                                aria-label="Company Code"
                                className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                value={companyCode}
                                onChange={(e) => setCompanyCode(e.target.value)}
                                autoFocus
                                required
                            />
                        </label>
                        <label className="block mb-4">
                            <span className="sr-only">Password</span>
                            <input
                                type="password"
                                placeholder="Password"
                                aria-label="Password"
                                className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </label>
                        <p className="text-[11px] text-slate-400 mb-4 text-center">
                            Ask your HR or IT team for your Company Code and password.
                        </p>
                    </>
                ) : mode === 'register' ? (
                    <div className="space-y-3 mb-4">
                        <label className="block">
                            <span className="sr-only">Company Name</span>
                            <input
                                type="text"
                                placeholder="Company Name"
                                aria-label="Company Name"
                                className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                value={organizationName}
                                onChange={(e) => setOrganizationName(e.target.value)}
                                autoFocus
                                required
                            />
                        </label>

                        <label className="block">
                            <span className="sr-only">Company Address</span>
                            <input
                                type="text"
                                placeholder="Company Address"
                                aria-label="Company Address"
                                className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                value={organizationAddress}
                                onChange={(e) => setOrganizationAddress(e.target.value)}
                                required
                            />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="sr-only">Industry (optional)</span>
                                <input
                                    type="text"
                                    placeholder="Industry (optional)"
                                    aria-label="Industry"
                                    className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value)}
                                />
                            </label>
                            <label className="block">
                                <span className="sr-only">Company Size (optional)</span>
                                <select
                                    aria-label="Company Size"
                                    className="w-full h-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-white text-slate-700"
                                    value={companySize}
                                    onChange={(e) => setCompanySize(e.target.value as CompanySize | '')}
                                >
                                    <option value="">Size (optional)</option>
                                    {COMPANY_SIZES.map((size) => (
                                        <option key={size} value={size}>{size} employees</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className="block">
                            <span className="sr-only">Your Full Name</span>
                            <input
                                type="text"
                                placeholder="Your Full Name (Admin)"
                                aria-label="Your Full Name"
                                className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                value={adminName}
                                onChange={(e) => setAdminName(e.target.value)}
                                required
                            />
                        </label>

                        <label className="block">
                            <span className="sr-only">Work Email</span>
                            <input
                                type="email"
                                placeholder="Work Email"
                                aria-label="Work Email"
                                className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </label>

                        <label className="block">
                            <span className="sr-only">Password</span>
                            <input
                                type="password"
                                placeholder="Password"
                                aria-label="Password"
                                className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={10}
                                required
                            />
                        </label>
                        <p className="text-[10px] text-slate-400 -mt-1">At least 10 characters, with a letter and a number.</p>

                        <label className="block">
                            <span className="sr-only">Employee Access Password</span>
                            <input
                                type="text"
                                placeholder="Employee Access Password"
                                aria-label="Employee Access Password"
                                className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                value={employeePassword}
                                onChange={(e) => setEmployeePassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </label>
                        <p className="text-[10px] text-slate-400 -mt-1">
                            One shared password every employee will use to sign in — choose something simple you can tell your team. At least 6 characters.
                        </p>
                    </div>
                ) : (
                    <>
                        <label className="block mb-3">
                            <span className="sr-only">Email</span>
                            <input
                                type="email"
                                placeholder="Email"
                                aria-label="Email"
                                className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoFocus
                                required
                            />
                        </label>

                        <label className="block mb-2">
                            <span className="sr-only">Password</span>
                            <input
                                type="password"
                                placeholder="Password"
                                aria-label="Password"
                                className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => { setMode('forgot'); setForgotEmail(email); setForgotStep('request'); setForgotMessage(''); setError(''); }}
                            className="block mb-4 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            Forgot password?
                        </button>
                    </>
                )}

                {error && (
                    <div className="flex items-center gap-2 justify-center text-red-600 text-[11px] mb-4 font-black bg-red-50 p-3 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-1 duration-300">
                        <ShieldAlert size={14} /> {error}
                    </div>
                )}

                <button
                    ref={submitRef}
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#002e5d] text-white p-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-900 shadow-lg shadow-blue-900/20 transition-colors duration-300 active:scale-95 disabled:opacity-60"
                >
                    {submitting
                        ? 'Please wait...'
                        : mode === 'forgot'
                            ? (forgotStep === 'request' ? 'Send Reset Code' : 'Reset Password')
                            : audience === 'employee' ? 'Sign In' : mode === 'login' ? 'Sign In' : 'Register Company'}
                </button>

                {audience === 'admin' && mode === 'forgot' && (
                    <button
                        type="button"
                        onClick={() => { setMode('login'); setForgotStep('request'); setError(''); }}
                        className="mt-6 w-full text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors"
                    >
                        Back to sign in
                    </button>
                )}

                {audience === 'admin' && mode !== 'forgot' && (
                    <button
                        type="button"
                        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                        className="mt-6 w-full text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors"
                    >
                        {mode === 'login' ? "New company? Register here" : 'Already have an account? Sign in'}
                    </button>
                )}
            </form>
        </div>
    );
};

export default AuthScreen;
