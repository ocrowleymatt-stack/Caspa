import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import { ChevronDown, ChevronRight, ChevronLeft, ChevronUp } from 'lucide-react';
import App from './App.tsx';
import './index.css';
import { installLiteraryRuntime } from './services/installLiteraryRuntime';

// Defensive icon globals for legacy/dynamic bundles that reference lucide icons without importing them.
// This prevents a missing icon variable from killing the entire app at runtime.
(globalThis as any).ChevronDown = (globalThis as any).ChevronDown || ChevronDown;
(globalThis as any).ChevronRight = (globalThis as any).ChevronRight || ChevronRight;
(globalThis as any).ChevronLeft = (globalThis as any).ChevronLeft || ChevronLeft;
(globalThis as any).ChevronUp = (globalThis as any).ChevronUp || ChevronUp;

// 🔥 Activate ALWAYS-ON literary runtime
installLiteraryRuntime();

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught UI crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || String(this.state.error || 'Unknown error');
      const isIconCrash = /Can't find variable: Chevron|Chevron\w+ is not defined|missing icon/i.test(message);

      return (
        <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl mb-6">
            <span className="text-white text-2xl font-bold">!</span>
          </div>
          <h1 className="text-white text-2xl font-bold mb-4 italic font-serif">Narrative System Failure</h1>
          <p className="text-slate-400 max-w-md text-sm mb-8">
            {isIconCrash
              ? 'A UI icon failed to load. The manuscript engine itself is not the likely cause.'
              : 'An unexpected UI error occurred while initializing the manuscript engine.'}
          </p>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-left max-w-2xl overflow-auto mb-8 max-h-40">
            <code className="text-red-400 text-[10px] break-all">
              {message}
            </code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-xl shadow-blue-500/20"
          >
            Reboot Systems
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
