import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Unhandled UI error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-[100dvh] w-full flex items-center justify-center bg-slate-50 p-4">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm text-center">
                        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                            <ShieldAlert size={28} />
                        </div>
                        <h2 className="text-lg font-extrabold text-slate-800 mb-1">Something went wrong</h2>
                        <p className="text-slate-400 text-sm mb-4">Try reloading the page. If the problem continues, contact your workspace admin.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-[#002e5d] text-white p-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-900 transition-all"
                        >
                            Reload
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
