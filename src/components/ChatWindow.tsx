import { Send, Bot, User, Database, ShieldQuestion } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { Policy } from '../types';
import { api, ApiError } from '../api/client';
import { useHoverLift } from '../hooks/useHoverLift';

interface Message {
    role: 'assistant' | 'user';
    text: string;
    source: string;
    grounded: boolean;
}

interface ChatResponse {
    answer: string;
    source: string;
    grounded: boolean;
}

// Pops each new bubble in with a little depth (scale + rise) instead of just
// appearing — reads as "alive" without being distracting on re-renders,
// since the entrance only ever plays once per bubble (empty deps).
const MessageBubble = ({ children }: { children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
            gsap.from(el, { opacity: 0, y: 16, scale: 0.94, duration: 0.4, ease: 'back.out(1.4)' });
        });
        return () => mm.revert();
    }, []);

    return <div ref={ref}>{children}</div>;
};

const ChatWindow = ({ policies = [] }: { policies?: Policy[] }) => {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const sendButtonRef = useHoverLift<HTMLButtonElement>();
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            text: 'DOCYRA Intelligence Layer Online. Awaiting vault query.',
            source: 'System',
            grounded: true,
        }
    ]);

    useEffect(() => {
        if (!scrollRef.current) return;
        const mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
            gsap.to(scrollRef.current, { scrollTop: scrollRef.current!.scrollHeight, duration: 0.4, ease: 'power2.out' });
        });
        mm.add('(prefers-reduced-motion: reduce)', () => {
            scrollRef.current!.scrollTop = scrollRef.current!.scrollHeight;
        });
        return () => mm.revert();
    }, [messages, isTyping]);

    const handleSend = async (overrideInput?: string) => {
        const textToSend = overrideInput || input;
        if (!textToSend.trim() || isTyping) return;

        setMessages(prev => [...prev, { role: 'user', text: textToSend, source: 'Client', grounded: true }]);
        setInput('');
        setIsTyping(true);

        try {
            const response = await api.post<ChatResponse>('/api/chat', { message: textToSend });
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: response.answer,
                source: response.source,
                grounded: response.grounded,
            }]);
        } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Something went wrong reaching the vault. Please try again.';
            setMessages(prev => [...prev, { role: 'assistant', text: message, source: 'Error', grounded: false }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
            {/* 1. Chat Display Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {messages.map((msg, index) => (
                    <MessageBubble key={index}>
                        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-[#002e5d]'} text-white shadow-sm`}>
                                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className={`p-4 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                                        {msg.text}
                                    </div>
                                    {msg.role === 'assistant' && (
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                <Database size={10} /> {msg.source}
                                            </div>
                                            <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter ${msg.grounded ? 'text-green-500' : 'text-red-500'}`}>
                                                <ShieldQuestion size={10} /> {msg.grounded ? 'Grounded' : 'Not in vault'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </MessageBubble>
                ))}
                {isTyping && (
                    <div className="ml-12 flex items-center gap-1.5 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        <span className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"></span>
                        </span>
                        ANALYZING VAULTS...
                    </div>
                )}
            </div>

            {/* 2. Input Area */}
            <div className="bg-white border-t p-4 md:p-6">
                <div className="max-w-4xl mx-auto flex gap-2">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={policies.length > 0 ? "Query DOCYRA Vault..." : "Upload PDF to begin..."}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all duration-300 shadow-inner"
                    />
                    <button
                        ref={sendButtonRef}
                        onClick={() => handleSend()}
                        disabled={isTyping}
                        className="bg-[#002e5d] text-white p-3 rounded-xl hover:bg-blue-900 transition-colors duration-300 shadow-lg active:scale-95 flex items-center justify-center disabled:opacity-60"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
