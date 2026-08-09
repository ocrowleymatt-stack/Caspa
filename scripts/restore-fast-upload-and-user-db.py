from pathlib import Path

# ---------------- App.tsx ----------------
p = Path('src/App.tsx')
s = p.read_text()

s = s.replace(
    "import React, { useEffect, useMemo, useState } from 'react';",
    "import React, { useEffect, useMemo, useRef, useState } from 'react';",
    1,
)

s = s.replace(
    "  Zap,\n  X,",
    "  UploadCloud,\n  Zap,\n  X,",
    1,
)

project_import = """import {
  completeProject,
  loadProjectSnapshot,
  pruneStaleProjects,
  recordProjectSnapshot,
  saveCurrentProjectState,
  switchToProject,
} from './services/projectShelfService';
"""
if project_import not in s:
    raise SystemExit('projectShelfService import anchor missing')
s = s.replace(
    project_import,
    project_import + """import {
  activateUserDatabase,
  deactivateUserDatabase,
  persistActiveUserDatabase,
} from './services/userDatabaseService';
""",
    1,
)

# Add the actual fast-ingest implementation beneath startProject.
patch_anchor = """  const patchBrief = (patch: Partial<ProjectBrief>) => {
"""
fast_upload = r'''  const handleFastDataUpload = async (files: File[]) => {
    if (!files.length) return;
    saveCurrentProjectState();

    const parsed: Array<{ name: string; text: string }> = [];
    for (const file of files.slice(0, 20)) {
      if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name} is over the 100MB fast-upload limit.`);

      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const form = new FormData();
        form.append('pdf', file);
        const response = await fetch('/api/pdf-upload/upload', { method: 'POST', body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.content?.text) {
          throw new Error(data?.details || data?.error || `Could not parse ${file.name}`);
        }
        parsed.push({ name: file.name, text: String(data.content.text) });
        continue;
      }

      if (!/\.(txt|md|markdown|rtf|html?|json|ya?ml|csv|log)$/i.test(file.name) && !file.type.startsWith('text/')) {
        throw new Error(`${file.name} is not yet supported by Fast Data Upload. Use PDF, text, Markdown, RTF, HTML, JSON, YAML or CSV.`);
      }
      parsed.push({ name: file.name, text: await file.text() });
    }

    const useful = parsed.filter((item) => item.text.trim());
    if (!useful.length) throw new Error('The uploaded files contained no readable text.');

    const combined = useful.length === 1
      ? useful[0].text
      : useful.map((item) => `===== ${item.name} =====\n\n${item.text}`).join('\n\n');
    const title = useful.length === 1
      ? useful[0].name.replace(/\.[^.]+$/, '') || 'Uploaded material'
      : `Data pack — ${new Date().toLocaleDateString('en-GB')}`;

    const nextBrief: ProjectBrief = {
      title,
      mode: 'adaptation',
      idea: useful.length === 1 ? `Fast data upload: ${useful[0].name}` : `Fast data upload: ${useful.length} source files`,
      tone: 'Preserve the source voice and evidential boundaries. Structure before embellishment.',
      output: 'Analyse, organise and turn the uploaded material into the strongest appropriate finished form.',
      audience: 'Determine from the source material and project intent.',
      targetWordCount: defaultTargetWordCount('adaptation'),
      createdAt: new Date().toISOString(),
    };

    setBrief(nextBrief);
    saveBrief(nextBrief);
    setProjectStatus('active');
    setDraftPage('');
    setManuscriptSource(combined);
    localStorage.setItem('caspa.whitePage', '');
    localStorage.setItem('caspa.manuscriptSource', combined);
    localStorage.removeItem('caspa.commission');
    localStorage.removeItem('caspa.commission.tab');
    clearShowBox();
    clearPlotHold();
    recordProjectSnapshot(nextBrief);
    persistActiveUserDatabase();
    goTo('workshop');
  };

'''
if patch_anchor not in s:
    raise SystemExit('patchBrief anchor missing')
s = s.replace(patch_anchor, fast_upload + patch_anchor, 1)

s = s.replace(
    "return <LaunchpadView onStart={startProject} />;",
    "return <LaunchpadView onStart={startProject} onFastUpload={handleFastDataUpload} />;",
    1,
)
s = s.replace(
    "return <SettingsStudio userEmail={authContext.user?.email} />;",
    "return <SettingsStudio userEmail={authContext.user?.email} userId={authContext.user?.uid} onFastUpload={handleFastDataUpload} />;",
    1,
)
# Default fallback has a second Launchpad instance.
s = s.replace(
    "return <LaunchpadView onStart={startProject} />;",
    "return <LaunchpadView onStart={startProject} onFastUpload={handleFastDataUpload} />;",
    1,
)

old_launch_sig = "function LaunchpadView({ onStart }: { onStart: (mode: CreativeMode, idea: string, tone: string, output: string, audience: string, targetWordCount?: number) => void }) {"
new_launch_sig = """function LaunchpadView({ onStart, onFastUpload }: {
  onStart: (mode: CreativeMode, idea: string, tone: string, output: string, audience: string, targetWordCount?: number) => void;
  onFastUpload: (files: File[]) => Promise<void>;
}) {"""
if old_launch_sig not in s:
    raise SystemExit('Launchpad signature anchor missing')
s = s.replace(old_launch_sig, new_launch_sig, 1)

launch_state_anchor = """  const [audience, setAudience] = useState('Literary / general readers.');

  const selected = modeCards.find((card) => card.mode === mode)!;
"""
launch_state_new = """  const [audience, setAudience] = useState('Literary / general readers.');
  const [fastUploading, setFastUploading] = useState(false);
  const [fastUploadError, setFastUploadError] = useState('');
  const fastUploadRef = useRef<HTMLInputElement | null>(null);

  const runFastUpload = async (list: FileList | null) => {
    const files = Array.from(list || []);
    if (!files.length) return;
    setFastUploading(true);
    setFastUploadError('');
    try {
      await onFastUpload(files);
    } catch (error) {
      setFastUploadError(error instanceof Error ? error.message : 'Fast upload failed.');
    } finally {
      setFastUploading(false);
      if (fastUploadRef.current) fastUploadRef.current.value = '';
    }
  };

  const selected = modeCards.find((card) => card.mode === mode)!;
"""
if launch_state_anchor not in s:
    raise SystemExit('Launchpad state anchor missing')
s = s.replace(launch_state_anchor, launch_state_new, 1)

hero_paragraph = """          <p style={{ maxWidth: 640, color: '#d7c8aa', fontSize: 18, lineHeight: 1.5, marginTop: 18 }}>
            Fiction is one door. Non-fiction, picture books, a show in a box — pick the form first.
          </p>
"""
hero_with_upload = hero_paragraph + """          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              onClick={() => fastUploadRef.current?.click()}
              disabled={fastUploading}
              style={{ ...primaryButton('#d6a846', '#1d1408'), width: 'auto', padding: '12px 16px' }}
            >
              {fastUploading ? <Loader size={17} className="spin" /> : <UploadCloud size={17} />}
              {fastUploading ? 'Reading data…' : 'Fast Data Upload'}
            </button>
            <span style={{ alignSelf: 'center', color: '#a89572', fontSize: 12 }}>PDF · TXT · MD · RTF · HTML · JSON · YAML · CSV · up to 20 files</span>
            <input
              ref={fastUploadRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.markdown,.rtf,.html,.htm,.json,.yaml,.yml,.csv,.log,text/*,application/pdf"
              style={{ display: 'none' }}
              onChange={(event) => runFastUpload(event.target.files)}
            />
          </div>
          {fastUploadError ? <p style={{ margin: '10px 0 0', color: '#ffb4aa', fontSize: 13 }}>{fastUploadError}</p> : null}
"""
if hero_paragraph not in s:
    raise SystemExit('Launchpad hero paragraph anchor missing')
s = s.replace(hero_paragraph, hero_with_upload, 1)

# Add the fast upload to the sticky footer too, so it cannot disappear below the fold.
footer_button = """          <button
            onClick={launch}
            style={{ ...primaryButton('#d6a846', '#1d1408'), width: 'auto', padding: '14px 24px', fontSize: 16 }}
          >
            <Sparkles size={19} /> {ctaLabel}
          </button>
"""
footer_replacement = """          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fastUploadRef.current?.click()}
              disabled={fastUploading}
              style={{ ...ghostButton, color: '#ffe2a5', borderColor: '#6b5430', background: '#21180f' }}
            >
              <UploadCloud size={17} /> Fast Data Upload
            </button>
            <button
              onClick={launch}
              style={{ ...primaryButton('#d6a846', '#1d1408'), width: 'auto', padding: '14px 24px', fontSize: 16 }}
            >
              <Sparkles size={19} /> {ctaLabel}
            </button>
          </div>
"""
if footer_button not in s:
    raise SystemExit('Launchpad footer button anchor missing')
s = s.replace(footer_button, footer_replacement, 1)

# Mount/unmount each browser database before CaspaUI sees it.
app_anchor = """export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

"""
app_new = app_anchor + """  const acceptUser = (nextUser: User) => {
    activateUserDatabase(nextUser.uid);
    if (nextUser.email) localStorage.setItem('currentUserEmail', nextUser.email);
    setUser(nextUser);
  };

"""
if app_anchor not in s:
    raise SystemExit('App anchor missing')
s = s.replace(app_anchor, app_new, 1)
s = s.replace("setUser(createLocalGuest());", "acceptUser(createLocalGuest());", 1)
s = s.replace(
    "setUser({ uid: firebaseUser.uid, email: firebaseUser.email || '', displayName: firebaseUser.displayName || '' });",
    "acceptUser({ uid: firebaseUser.uid, email: firebaseUser.email || '', displayName: firebaseUser.displayName || '' });",
    1,
)
s = s.replace("if (!user) return <CaspaLogin onLoginSuccess={setUser} />;", "if (!user) return <CaspaLogin onLoginSuccess={acceptUser} />;", 1)

signout_anchor = """  const handleSignOut = async () => {
    try {
      localStorage.removeItem(LOCAL_GUEST_KEY);
"""
signout_new = """  const handleSignOut = async () => {
    try {
      persistActiveUserDatabase();
      deactivateUserDatabase(user?.uid);
    } catch (error) {
      console.warn('Could not fully unmount user database during sign-out:', error);
    }
    try {
      localStorage.removeItem(LOCAL_GUEST_KEY);
"""
if signout_anchor not in s:
    raise SystemExit('signout anchor missing')
s = s.replace(signout_anchor, signout_new, 1)

p.write_text(s)

# ---------------- SettingsStudio.tsx ----------------
p = Path('src/components/SettingsStudio.tsx')
s = p.read_text()
s = s.replace(
    "import React, { useCallback, useEffect, useState } from 'react';",
    "import React, { useCallback, useEffect, useRef, useState } from 'react';",
    1,
)
s = s.replace(
    "} from '../services/localSnapshotService';\n",
    "} from '../services/localSnapshotService';\nimport { getDeviceBackupScope, persistActiveUserDatabase } from '../services/userDatabaseService';\n",
    1,
)
old_props = """interface Props {
  userEmail?: string;
}

export default function SettingsStudio({ userEmail }: Props) {
"""
new_props = """interface Props {
  userEmail?: string;
  userId?: string;
  onFastUpload?: (files: File[]) => Promise<void>;
}

export default function SettingsStudio({ userEmail, userId, onFastUpload }: Props) {
"""
if old_props not in s:
    raise SystemExit('SettingsStudio props anchor missing')
s = s.replace(old_props, new_props, 1)

state_anchor = """  const [checkingDoctor, setCheckingDoctor] = useState(false);

  const refreshBackups = useCallback(async () => {
"""
state_new = """  const [checkingDoctor, setCheckingDoctor] = useState(false);
  const [fastUploading, setFastUploading] = useState(false);
  const fastUploadRef = useRef<HTMLInputElement | null>(null);

  const storageHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (userId && userId !== 'local-guest') {
      const { getAuth } = await import('firebase/auth');
      const current = getAuth().currentUser;
      if (!current) throw new Error('Your Firebase session is not available. Sign in again before using server backups.');
      const token = await current.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
    return { 'X-Caspa-Local-Scope': getDeviceBackupScope() };
  }, [userId]);

  const refreshBackups = useCallback(async () => {
"""
if state_anchor not in s:
    raise SystemExit('SettingsStudio state anchor missing')
s = s.replace(state_anchor, state_new, 1)

s = s.replace(
    "const res = await fetch('/api/caspa/storage/backups');",
    "const res = await fetch('/api/caspa/storage/backups', { headers: await storageHeaders() });",
    1,
)
s = s.replace("  }, []);\n\n  const refreshDoctor", "  }, [storageHeaders]);\n\n  const refreshDoctor", 1)

backup_fetch = """      const res = await fetch('/api/caspa/storage/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
"""
backup_fetch_new = """      persistActiveUserDatabase();
      const res = await fetch('/api/caspa/storage/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await storageHeaders()) },
"""
if backup_fetch not in s:
    raise SystemExit('Settings backup fetch anchor missing')
s = s.replace(backup_fetch, backup_fetch_new, 1)

s = s.replace(
    "const res = await fetch(`/api/caspa/storage/restore/${id}`);",
    "const res = await fetch(`/api/caspa/storage/restore/${id}`, { headers: await storageHeaders() });",
    1,
)
s = s.replace(
    """      const applied = applyLocalSnapshot(data.data.entries);
      setStatus(`Restored ${applied} keys. Reload the page to see changes everywhere.`);
""",
    """      const applied = applyLocalSnapshot(data.data.entries);
      persistActiveUserDatabase();
      setStatus(`Restored ${applied} keys. Reload the page to see changes everywhere.`);
""",
    1,
)

islocal_anchor = """  const isLocal = !userEmail || userEmail.includes('local@caspa');

  return (
"""
islocal_new = """  const isLocal = !userEmail || userEmail.includes('local@caspa');

  const runFastUpload = async (files: FileList | null) => {
    if (!onFastUpload) return;
    const selected = Array.from(files || []);
    if (!selected.length) return;
    setFastUploading(true);
    setStatus('Reading uploaded data…');
    try {
      await onFastUpload(selected);
      setStatus(`Loaded ${selected.length} file${selected.length === 1 ? '' : 's'} into a new isolated project.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Fast data upload failed.');
    } finally {
      setFastUploading(false);
      if (fastUploadRef.current) fastUploadRef.current.value = '';
    }
  };

  return (
"""
if islocal_anchor not in s:
    raise SystemExit('Settings isLocal anchor missing')
s = s.replace(islocal_anchor, islocal_new, 1)

auth_card = """        <article style={{ ...card, marginTop: 18 }}>
          <h2 style={sectionTitle}>Authentication</h2>
          <p style={{ margin: 0, lineHeight: 1.6, color: '#5c5146' }}>
            {isLocal
              ? 'You are in local mode — work stays in this browser. Sign in from the login screen if you want a cloud account; back up below either way.'
              : 'Signed in with Firebase. Creative work still lives in browser local storage unless you back it up below.'}
          </p>
        </article>
"""
auth_card_new = """        <article style={{ ...card, marginTop: 18 }}>
          <h2 style={sectionTitle}>Authentication & data separation</h2>
          <p style={{ margin: 0, lineHeight: 1.6, color: '#5c5146' }}>
            {isLocal
              ? 'Local workspace is isolated to this device scope. Signing into another account unmounts this workspace before the other user is loaded.'
              : 'Signed in with Firebase. Browser projects and server backups are now isolated to this verified user ID; another signed-in user gets a separate database.'}
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#8a7a66', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            Database: {isLocal ? 'local-device' : `user:${(userId || '').slice(0, 10)}…`}
          </p>
        </article>

        {onFastUpload ? (
          <article style={{ ...card, marginTop: 18, borderColor: '#d6a846' }}>
            <h2 style={sectionTitle}>Fast Data Upload</h2>
            <p style={{ margin: '0 0 14px', color: '#73695d', lineHeight: 1.6 }}>
              Drop a manuscript or evidence/data pack straight into a fresh project. PDF, text, Markdown, RTF, HTML, JSON, YAML and CSV are accepted; multiple files are combined with filenames preserved.
            </p>
            <button type="button" onClick={() => fastUploadRef.current?.click()} disabled={fastUploading} style={primaryBtn}>
              {fastUploading ? <Loader size={16} className="spin" /> : <UploadCloud size={16} />}
              {fastUploading ? 'Reading data…' : 'Fast Data Upload'}
            </button>
            <input
              ref={fastUploadRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.markdown,.rtf,.html,.htm,.json,.yaml,.yml,.csv,.log,text/*,application/pdf"
              style={{ display: 'none' }}
              onChange={(event) => runFastUpload(event.target.files)}
            />
          </article>
        ) : null}
"""
if auth_card not in s:
    raise SystemExit('Settings auth card anchor missing')
s = s.replace(auth_card, auth_card_new, 1)

p.write_text(s)
