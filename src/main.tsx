import React, {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare state: ErrorBoundaryState;
  declare props: Readonly<ErrorBoundaryProps> & Readonly<{ children?: ReactNode }>;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught error:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl mb-6">
            <span className="text-white text-2xl font-bold">!</span>
          </div>
          <h1 className="text-white text-2xl font-bold mb-4 italic font-serif">Narrative System Failure</h1>
          <p className="text-slate-400 max-w-md text-sm mb-8">
            An unexpected error occurred while initializing the manuscript engine.
            This is often due to missing permissions or synchronization issues.
          </p>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-left max-w-2xl overflow-auto mb-8 max-h-40">
            <code className="text-red-400 text-[10px] break-all">
              {this.state.error?.message}
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
