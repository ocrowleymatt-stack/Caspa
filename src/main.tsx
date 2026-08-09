import {StrictMode, Component, ErrorInfo, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ChapterSourceDock from './components/ChapterSourceDock.tsx';
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

/**
 * Body-level fast upload control.
 *
 * This intentionally lives outside React and outside the Atlas application shell.
 * It cannot be hidden by sidebar/mobile/layout CSS or replaced by a component error.
 * The user selects files with this native picker; we forward that FileList into the
 * existing sidebar ingest input so the normal high-speed multi-file pipeline runs.
 */
function installBodyFastUploadControl(): void {
  if (typeof document === 'undefined' || document.getElementById('atlas-body-fast-upload')) return;

  const picker = document.createElement('input');
  picker.id = 'atlas-body-fast-upload-picker';
  picker.type = 'file';
  picker.multiple = true;
  picker.style.setProperty('display', 'none', 'important');
  document.body.appendChild(picker);

  const button = document.createElement('button');
  button.id = 'atlas-body-fast-upload';
  button.type = 'button';
  button.textContent = '⚡ FAST FILE UPLOAD · MULTI';
  button.setAttribute('aria-label', 'Fast multi-file upload');
  button.title = 'High-speed Atlas file upload — select multiple files';

  const style: Record<string, string> = {
    position: 'fixed',
    right: '18px',
    bottom: '18px',
    zIndex: '2147483647',
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    minWidth: '220px',
    minHeight: '52px',
    padding: '13px 18px',
    border: '3px solid #111111',
    borderRadius: '14px',
    background: '#ffdf4d',
    color: '#111111',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontSize: '13px',
    fontWeight: '900',
    letterSpacing: '0.35px',
    lineHeight: '1.2',
    textAlign: 'center',
    boxShadow: '0 10px 36px rgba(0,0,0,.35)',
    cursor: 'pointer',
    pointerEvents: 'auto',
    transform: 'none',
  };
  Object.entries(style).forEach(([name, value]) => button.style.setProperty(name, value, 'important'));

  button.addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => {
    const files = Array.from(picker.files || []);
    if (!files.length) return;

    const target = document.querySelector<HTMLInputElement>('.caspa-sidebar input[type="file"][multiple]')
      || document.querySelector<HTMLInputElement>('input[type="file"][multiple]:not(#atlas-body-fast-upload-picker)');

    if (!target) {
      button.textContent = 'UPLOAD READY · OPEN ATLAS WORKSPACE';
      window.setTimeout(() => { button.textContent = '⚡ FAST FILE UPLOAD · MULTI'; }, 2600);
      picker.value = '';
      return;
    }

    try {
      const transfer = new DataTransfer();
      files.forEach((file) => transfer.items.add(file));
      target.files = transfer.files;
      button.textContent = `⚡ INGESTING ${files.length} FILE${files.length === 1 ? '' : 'S'}…`;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      window.setTimeout(() => { button.textContent = '⚡ FAST FILE UPLOAD · MULTI'; }, 3000);
    } catch (error) {
      console.error('[Atlas fast upload bridge]', error);
      button.textContent = 'UPLOAD ERROR · CLICK TO RETRY';
      window.setTimeout(() => { button.textContent = '⚡ FAST FILE UPLOAD · MULTI'; }, 3000);
    } finally {
      picker.value = '';
    }
  });

  document.body.appendChild(button);
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

installBodyFastUploadControl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <ChapterSourceDock />
    </ErrorBoundary>
  </StrictMode>,
);