import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { installInspirationFetchBridge } from './services/sourcePackService.ts';
import './index.css';
import './components/CaspaThemeOverride.css';
import './components/GoldRefineryMobile.css';
import './components/CaspaContrastEmergency.css';
import './components/CaspaContrastFix.css';

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
  installInspirationFetchBridge();
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
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0d0912', color: '#f8f3fb', textAlign: 'center' }}>
          <div style={{ maxWidth: 480 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 18px', display: 'grid', placeItems: 'center', background: '#d4a6ff', color: '#1a1021', fontSize: 28, fontWeight: 800 }}>!</div>
            <h1 style={{ margin: '0 0 10px', fontSize: 28, letterSpacing: -1 }}>Caspa hit a snag</h1>
            <p style={{ margin: '0 0 18px', color: '#b9aec2', lineHeight: 1.5 }}>
              Something broke in the studio. Your local drafts are usually still in this browser — reload and continue.
            </p>
            <pre style={{ textAlign: 'left', background: '#181120', border: '1px solid rgba(212,166,255,.2)', borderRadius: 14, padding: 14, overflow: 'auto', maxHeight: 140, color: '#ead6ff', fontSize: 12 }}>
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ marginTop: 18, border: 'none', borderRadius: 14, padding: '12px 18px', background: '#d4a6ff', color: '#1a1021', fontWeight: 800, cursor: 'pointer' }}
            >
              Reload Caspa
            </button>
          </div>
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
