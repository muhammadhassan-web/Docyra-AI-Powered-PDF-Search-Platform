import { ShieldCheck, Mail, Zap, Lock, Upload, MessageSquare, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useHoverLift } from '../hooks/useHoverLift';

interface LandingPageProps {
    onLogin: () => void;
    onGetStarted: () => void;
}

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => {
    const ref = useHoverLift<HTMLDivElement>();
    return (
        <div ref={ref} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-default">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                {icon}
            </div>
            <h3 className="font-bold text-slate-800 mb-1.5">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
    );
};

const Step = ({ number, title, description }: { number: string; title: string; description: string }) => (
    <div className="flex gap-4">
        <div className="w-9 h-9 shrink-0 rounded-full bg-[#002e5d] text-white flex items-center justify-center font-black text-sm">
            {number}
        </div>
        <div>
            <h4 className="font-bold text-slate-800 mb-1">{title}</h4>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
        </div>
    </div>
);

const LandingPage = ({ onLogin, onGetStarted }: LandingPageProps) => {
    return (
        <div className="h-[100dvh] w-full bg-slate-50 overflow-y-auto">
            {/* Nav */}
            <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="text-blue-600" size={22} />
                        <span className="font-black text-slate-800 tracking-tight">DOCYRA</span>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <button
                            onClick={onLogin}
                            className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors"
                        >
                            Log In
                        </button>
                        <button
                            onClick={onGetStarted}
                            className="px-4 py-2 bg-[#002e5d] text-white rounded-xl text-sm font-bold hover:bg-blue-900 transition-colors shadow-sm active:scale-95"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-16 text-center animate-in fade-in slide-in-from-bottom-2 duration-700">
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold mb-6">
                    <Zap size={14} /> AI-powered policy assistant for companies
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-5">
                    Stop emailing HR and IT.<br className="hidden md:block" /> Just ask.
                </h1>
                <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto mb-8 leading-relaxed">
                    Employees ask the same policy questions again and again — vacation days, laptop requests, expense rules.
                    DOCYRA turns your company&apos;s own documents into an AI assistant that answers instantly,
                    grounded in what you actually wrote, with the source cited every time.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                        onClick={onGetStarted}
                        className="flex items-center gap-2 px-7 py-3.5 bg-[#002e5d] text-white rounded-2xl font-black text-sm uppercase tracking-wide hover:bg-blue-900 transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                    >
                        Register Your Company <ArrowRight size={16} />
                    </button>
                    <button
                        onClick={onLogin}
                        className="px-7 py-3.5 bg-white text-slate-700 rounded-2xl font-black text-sm uppercase tracking-wide border border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-all active:scale-95"
                    >
                        Sign In
                    </button>
                </div>
            </section>

            {/* Problem / Solution */}
            <section className="max-w-5xl mx-auto px-4 md:px-8 py-12">
                <div className="grid md:grid-cols-2 gap-8 items-start">
                    <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 text-red-500 mb-3">
                            <Mail size={18} />
                            <span className="text-xs font-black uppercase tracking-widest">The Problem</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-3">HR and IT answer the same questions, over and over</h2>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            New hires need answers fast, but the people who have them are busy. The result: a flood of
                            near-identical emails and Slack messages, hours of interrupted work, and employees left
                            waiting for something that&apos;s already written down in a handbook nobody reads.
                        </p>
                    </div>
                    <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 text-green-600 mb-3">
                            <CheckCircle2 size={18} />
                            <span className="text-xs font-black uppercase tracking-widest">The Solution</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-3">Upload your policies once. Employees self-serve.</h2>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            HR and IT upload the documents they already have. Employees ask questions in plain language
                            and get an instant, accurate answer — pulled directly from your company&apos;s own
                            policies, with the source document named every time.
                        </p>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="max-w-5xl mx-auto px-4 md:px-8 py-12">
                <h2 className="text-2xl font-black text-slate-900 text-center mb-2">Built for real companies</h2>
                <p className="text-sm text-slate-500 text-center mb-10">Not a generic chatbot — a grounded, secure assistant scoped to your organization.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <FeatureCard
                        icon={<Upload size={22} />}
                        title="Upload Once"
                        description="HR and IT upload HR handbooks, IT policies, and any other PDF — DOCYRA reads and indexes them automatically."
                    />
                    <FeatureCard
                        icon={<MessageSquare size={22} />}
                        title="Grounded Answers"
                        description="Every answer is checked against the documents that were actually retrieved — no made-up policies, ever."
                    />
                    <FeatureCard
                        icon={<Users size={22} />}
                        title="One Login for Everyone"
                        description="A single shared access code lets every employee reach the assistant — no per-person account setup needed."
                    />
                    <FeatureCard
                        icon={<Lock size={22} />}
                        title="Fully Isolated Per Company"
                        description="Every company's documents and conversations are strictly separated — one company can never see another's data."
                    />
                    <FeatureCard
                        icon={<ShieldCheck size={22} />}
                        title="Enterprise-Grade Security"
                        description="Account lockout, rate limiting, encrypted sessions, and audited access controls protect every workspace."
                    />
                    <FeatureCard
                        icon={<Zap size={22} />}
                        title="Instant, Any Time"
                        description="No waiting for a reply. Employees get answers the moment they ask, day or night."
                    />
                </div>
            </section>

            {/* How it works */}
            <section className="max-w-3xl mx-auto px-4 md:px-8 py-12">
                <h2 className="text-2xl font-black text-slate-900 text-center mb-10">How it works</h2>
                <div className="space-y-8">
                    <Step number="1" title="Register your company" description="Create your workspace with your company details in under a minute." />
                    <Step number="2" title="Upload your policies" description="Drop in your HR and IT documents as PDFs — DOCYRA indexes them for search." />
                    <Step number="3" title="Share the employee access code" description="Give your team the company code and password — they're ready to ask questions immediately." />
                </div>
            </section>

            {/* Final CTA */}
            <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 text-center">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-4">Give your team an answer, not a wait.</h2>
                <button
                    onClick={onGetStarted}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-[#002e5d] text-white rounded-2xl font-black text-sm uppercase tracking-wide hover:bg-blue-900 transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                >
                    Get Started Free <ArrowRight size={16} />
                </button>
            </section>

            <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400 font-medium">
                DOCYRA — AI-powered policy assistant for companies.
            </footer>
        </div>
    );
};

export default LandingPage;
