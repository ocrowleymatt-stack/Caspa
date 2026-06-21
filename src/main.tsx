import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely patch crypto.randomUUID to prevent runtime crashes in non-secure contexts or certain webviews
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    (window as any).crypto = {} as any;
  }
  if (!window.crypto.randomUUID) {
    console.warn("Patching crypto.randomUUID fallback for iframe or non-secure context compatibility.");
    window.crypto.randomUUID = function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    } as any;
  }
}

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen bg-[#090614] flex flex-col items-center justify-center p-2 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1),transparent_70%)] pointer-events-none" />
          <div className="w-20 h-20 bg-brand-primary rounded-md flex items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.5)] mb-3 rotate-3 border border-white/20">
            <span className="text-white text-xs font-semibold font-semibold italic">!</span>
          </div>
          <h1 className="text-white text-xs font-semibold font-semibold mb-1.5 italic font-serif tracking-tight">Neural Protocol Violation</h1>
          <p className="text-slate-400 max-w-md text-[11px] mb-10 font-medium uppercase tracking-widest leading-relaxed opacity-80">
            The narrative engine encountered an architectural anomaly. Intelligence synchronization has been suspended to prevent structural corruption.
          </p>
          <div className="bg-[#140d24] p-3 rounded-md border border-white/10 text-left max-w-2xl overflow-auto mb-10 max-h-40 shadow-2xl relative">
            <div className="text-[10px] font-semibold text-brand-primary uppercase tracking-widest mb-2 opacity-50 underline">Telemetry Data</div>
            <code className="text-brand-accent text-xs break-all font-mono">
              {this.state.error?.message || "UNDEFINED_CORE_EXCEPTION"}
            </code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-2.5 py-1 bg-brand-primary hover:bg-brand-accent text-white rounded font-semibold uppercase tracking-wider text-xs transition-all shadow-[0_20px_40px_rgba(168,85,247,0.3)] active:scale-95"
          >
            Reboot Core Systems
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
