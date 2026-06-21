/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Caspa Creative Engine - Complete with Login
 * Main App wrapper with Google OAuth + Email/Password authentication
 */

import { useState, useEffect } from 'react';
import {
  Home,
  PenLine,
  BookOpen,
  CircleAlert,
  Library,
  Search,
  Download,
  Settings,
  Music2,
  Clapperboard,
  Menu,
  X,
  Sparkles,
  LogOut,
} from 'lucide-react';

// ============================================================================
// AUTH CONTEXT & UTILITIES
// ============================================================================

interface User {
  uid: string;
  email: string;
  displayName?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

// ============================================================================
// LOGIN COMPONENT
// ============================================================================

import React from 'react';
import { Globe, Mail, Lock, AlertCircle, Loader } from 'lucide-react';

interface LoginProps {
  onLoginSuccess?: (user: User) => void;
}

function CaspaLogin({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    initializeFirebase();
  }, []);

  const initializeFirebase = async () => {
    try {
      const { initializeApp } = await import('firebase/app');
      const { getAuth, onAuthStateChanged } = await import('firebase/auth');
      
      const firebaseConfig = {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyBdMzl_c0rFT9C_3LKq1hbDDKfRvPAhP0I',
        authDomain: 'novelwrite-27763.firebaseapp.com',
        projectId: 'novelwrite-27763',
        storageBucket: 'novelwrite-27763.appspot.com',
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '506738699621',
        appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:506738699621:web:9e8f9f8b8c8d8e8f8g8h',
      };

      try {
        initializeApp(firebaseConfig);
      } catch (err) {
        // App already initialized
      }

      const auth = getAuth();
      onAuthStateChanged(auth, (user) => {
        if (user) {
          onLoginSuccess?.({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
          });
        }
      });

      setFirebaseReady(true);
    } catch (err) {
      console.error('Firebase init error:', err);
      setFirebaseReady(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');

      const { getAuth } = await import('firebase/auth');
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');

      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      
      provider.addScope('profile');
      provider.addScope('email');

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      onLoginSuccess?.({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
      });
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      
      if (err.code === 'auth/popup-blocked') {
        setError('Pop-up blocked. Please allow pop-ups for this site.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Check your connection.');
      } else {
        setError('Google sign-in failed. Try email/password instead.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');

      if (!email || !password) {
        setError('Email and password required.');
        setLoading(false);
        return;
      }

      const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      const auth = getAuth();

      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess?.({
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || '',
        });
      } catch (signInErr: any) {
        if (isSignUp && signInErr.code === 'auth/user-not-found') {
          const result = await createUserWithEmailAndPassword(auth, email, password);
          onLoginSuccess?.({
            uid: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
          });
        } else {
          throw signInErr;
        }
      }
    } catch (err: any) {
      console.error('Email auth error:', err);
      
      if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Wrong password.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found. Sign up to create one.');
        setIsSignUp(true);
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError('Authentication failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '2rem',
          backgroundColor: '#1e293b',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 1rem',
              backgroundColor: '#fcd34d',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Globe size={36} style={{ color: '#ffffff' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#e2e8f0' }}>
            Caspa
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 500, margin: 0 }}>
            THE GHOST WRITER
          </p>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Architecting Tomorrow's Masterpieces
          </p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: firebaseReady ? '#4285f4' : '#9ca3af',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = firebaseReady ? '#3367d6' : '#9ca3af')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = firebaseReady ? '#4285f4' : '#9ca3af')}
        >
          {loading ? (
            <>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
              Signing in...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="5" r="1" />
                <circle cx="5" cy="19" r="1" />
                <path d="M12 13v8" />
                <path d="M16 16v4" />
                <path d="M8 8v8" />
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <div style={{ borderTop: '1px solid #334155' }} />
          <div
            style={{
              position: 'absolute',
              top: '-0.5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#1e293b',
              padding: '0 0.5rem',
              fontSize: '0.75rem',
              color: '#64748b',
              textTransform: 'uppercase',
            }}
          >
            or
          </div>
        </div>

        <form onSubmit={handleEmailSignIn} style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.5rem' }}>
              Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '0.5rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#e2e8f0',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#7f1d1d', borderRadius: '0.375rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
              <AlertCircle size={18} style={{ color: '#fca5a5', flexShrink: 0, marginTop: '0.125rem' }} />
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#fca5a5' }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#fcd34d',
              color: '#1e293b',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#eab308')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fcd34d')}
          >
            {isSignUp ? 'Create Account' : 'Login'}
          </button>
        </form>

        <div style={{ padding: '1rem', backgroundColor: '#0f172a', borderRadius: '0.375rem', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>
            No account yet?
          </p>
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: 'transparent',
              color: '#60a5fa',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1e293b';
              e.currentTarget.style.borderColor = '#60a5fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#334155';
            }}
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Create new account'}
          </button>
        </div>

        <div style={{ padding: '1rem', backgroundColor: '#1e293b', borderRadius: '0.375rem', borderLeft: '3px solid #8b5cf6' }}>
          <p style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: 0, lineHeight: 1.6 }}>
            <strong>ENTER GUEST PROTOCOL</strong><br />
            Core Sync grants access to cloud storage (Google Drive) for archival persistence. Guest Mode utilizes local neural storage only.
          </p>
        </div>

        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #334155', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
          <p style={{ margin: '0 0 0.5rem 0' }}>v2.0 • Caspa Creative Engine</p>
          <p style={{ margin: 0 }}>Powered by Firebase Auth • Hetzner Cloud</p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// MAIN CASPA APP
// ============================================================================

type ViewType = 
  | 'dashboard'
  | 'write'
  | 'memory'
  | 'intelligence'
  | 'library'
  | 'upload'
  | 'publish'
  | 'musical'
  | 'script'
  | 'settings';

interface NavItem {
  id: ViewType;
  label: string;
  detail: string;
  icon: React.ComponentType<{ size?: number }>;
  category: 'core' | 'creative' | 'production';
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Project Desk', detail: 'Overview & next action', icon: Home, category: 'core' },
  { id: 'write', label: 'Writing Room', detail: 'Draft & edit scenes', icon: PenLine, category: 'core' },
  { id: 'memory', label: 'Story Bible', detail: 'Characters & canon', icon: BookOpen, category: 'core' },
  { id: 'intelligence', label: 'Red Pen', detail: 'Issues & repairs', icon: CircleAlert, category: 'core' },
  { id: 'library', label: 'Library', detail: 'Projects & shelves', icon: Library, category: 'core' },
  { id: 'upload', label: 'Research Desk', detail: 'Sources & notes', icon: Search, category: 'core' },
  { id: 'publish', label: 'Publish', detail: 'Export & readers', icon: Download, category: 'core' },
  { id: 'musical', label: 'Musical Lab', detail: 'Overnight music cycle', icon: Music2, category: 'production' },
  { id: 'script', label: 'Script & Production', detail: 'Full show orchestration', icon: Clapperboard, category: 'production' },
  { id: 'settings', label: 'Settings', detail: 'Account & privacy', icon: Settings, category: 'core' },
];

function CaspaUI() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const authContext = React.useContext(AuthContext);

  const coreItems = navItems.filter(item => item.category === 'core');
  const productionItems = navItems.filter(item => item.category === 'production');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'write':
        return <WritingRoomView />;
      case 'memory':
        return <StoryBibleView />;
      case 'intelligence':
        return <RedPenView />;
      case 'library':
        return <LibraryView />;
      case 'upload':
        return <ResearchDeskView />;
      case 'publish':
        return <PublishView />;
      case 'musical':
        return <MusicalLabView />;
      case 'script':
        return <ScriptProductionView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0' }}>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 50,
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          color: '#e2e8f0',
          padding: '0.5rem',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          display: 'none',
        }}
        className="md:hidden"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Navigation */}
      <nav
        style={{
          width: '280px',
          backgroundColor: '#1e293b',
          borderRight: '1px solid #334155',
          padding: '1.5rem 0',
          overflowY: 'auto',
          position: 'fixed',
          height: '100vh',
          zIndex: 40,
        }}
      >
        <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Sparkles size={24} style={{ color: '#8b5cf6' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Caspa</h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>Creative Engine</p>
          {authContext.user && (
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.5rem 0 0 0' }}>{authContext.user.email}</p>
          )}
        </div>

        {/* Core Writing Tools */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', margin: 0 }}>Writing Tools</h2>
          </div>
          {coreItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                setMobileMenuOpen(false);
              }}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                backgroundColor: currentView === item.id ? '#334155' : 'transparent',
                border: 'none',
                color: currentView === item.id ? '#60a5fa' : '#cbd5e1',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                borderLeft: currentView === item.id ? '3px solid #60a5fa' : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <item.icon size={18} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.detail}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Production */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', margin: 0 }}>Production</h2>
          </div>
          {productionItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                setMobileMenuOpen(false);
              }}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                backgroundColor: currentView === item.id ? '#334155' : 'transparent',
                border: 'none',
                color: currentView === item.id ? '#60a5fa' : '#cbd5e1',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                borderLeft: currentView === item.id ? '3px solid #60a5fa' : '3px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <item.icon size={18} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.detail}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Sign Out Button */}
        <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <button
            onClick={authContext.signOut}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#7f1d1d',
              border: '1px solid #b91c1c',
              color: '#fca5a5',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#991b1b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#7f1d1d';
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ marginLeft: '280px', flex: 1, overflow: 'auto' }}>
        {renderView()}
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// PLACEHOLDER VIEW COMPONENTS
// ============================================================================

function DashboardView() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Project Desk</h1>
      <p>Welcome to your creative workspace.</p>
    </div>
  );
}

function WritingRoomView() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Writing Room</h1>
      <p>Draft and edit your scenes here.</p>
    </div>
  );
}

function StoryBibleView() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Story Bible</h1>
      <p>Manage your characters, timeline, and canon.</p>
    </div>
  );
}

function RedPenView() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Red Pen</h1>
      <p>Review issues and repair your manuscript.</p>
    </div>
  );
}

function LibraryView() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Library</h1>
      <p>Browse your projects and shelves.</p>
    </div>
  );
}

function ResearchDeskView() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Research Desk</h1>
      <p>Upload sources and organize your research.</p>
    </div>
  );
}

function PublishView() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Publish</h1>
      <p>Export and publish to multiple platforms.</p>
    </div>
  );
}

function MusicalLabView() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Musical Lab</h1>
      <p>Overnight music cycle orchestration – compose, arrange, and produce songs with distributed AI agents.</p>
      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155' }}>
        <h3>9 Agents: Composer, Lyricist, Arranger, Musical Director, Actor Panel, Critic, Rights Guardian, Overnight Producer</h3>
        <p>Job types: Music briefs, lyrics, arrangements, MusicXML plans, scorecards</p>
      </div>
    </div>
  );
}

function ScriptProductionView() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Script & Production</h1>
      <p>Full show orchestration – book, script, music, and staging with distributed production team.</p>
      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155' }}>
        <h3>12 Agents: Executive Producer, Showrunner, Book Writer, Lyricist, Composer, Arranger, Musical Director, Director, Actor Table, Critic Panel, Rights Safety, QA Producer</h3>
        <p>Deliverables: Show Bible, Script, Score, Parts, Assembly Manifest</p>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Settings</h1>
      <p>Manage your account and privacy preferences.</p>
    </div>
  );
}

// ============================================================================
// MAIN APP WRAPPER WITH AUTH
// ============================================================================

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Check auth state on mount
    const checkAuth = async () => {
      try {
        const { getAuth, onAuthStateChanged } = await import('firebase/auth');
        const { initializeApp } = await import('firebase/app');

        const firebaseConfig = {
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyBdMzl_c0rFT9C_3LKq1hbDDKfRvPAhP0I',
          authDomain: 'novelwrite-27763.firebaseapp.com',
          projectId: 'novelwrite-27763',
          storageBucket: 'novelwrite-27763.appspot.com',
          messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '506738699621',
          appId: process.env.REACT_APP_FIREBASE_APP_ID || '1:506738699621:web:9e8f9f8b8c8d8e8f8g8h',
        };

        try {
          initializeApp(firebaseConfig);
        } catch (err) {
          // App already initialized
        }

        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
            });
          }
          setAuthLoading(false);
        });

        return unsubscribe;
      } catch (err) {
        console.error('Auth check error:', err);
        setAuthLoading(false);
      }
    };

    const unsubscribe = checkAuth();
    return () => {
      if (unsubscribe instanceof Promise) {
        unsubscribe.then(unsub => unsub?.());
      }
    };
  }, []);

  const handleSignOut = async () => {
    try {
      const { getAuth, signOut } = await import('firebase/auth');
      const auth = getAuth();
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        color: '#e2e8f0',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader size={48} style={{ margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const authContextValue: AuthContextType = {
    user,
    loading: authLoading,
    signOut: handleSignOut,
  };

  if (!user) {
    return <CaspaLogin onLoginSuccess={setUser} />;
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <CaspaUI />
    </AuthContext.Provider>
  );
}
