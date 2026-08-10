from pathlib import Path
import re
from datetime import datetime, timezone


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'{label}: expected source block not found')
    return text.replace(old, new, 1)


# ── App shell: canonical ATLAS logo + one upload entry point per mobile view ──
p = Path('src/App.tsx')
s = p.read_text()

old_menu = '''      <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="mobile-menu" style={{ position: 'fixed', top: 16, left: 16, zIndex: 60, border: '1px solid #e0d3bf', background: '#fffaf2', borderRadius: 12, padding: 10 }}>
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside'''
new_menu = '''      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="mobile-menu"
        aria-label={mobileMenuOpen ? 'Close Atlas menu' : 'Open Atlas menu'}
        style={{ position: 'fixed', top: 16, left: 16, zIndex: 60, border: '1px solid #e0d3bf', background: '#fffaf2', borderRadius: 12, padding: 10 }}
      >
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div className="atlas-mobile-brand" aria-label="ATLAS — Nexus Strategist">
        <img src="/atlas-logo.svg" alt="ATLAS — Nexus Strategist" />
      </div>

      <button
        type="button"
        onClick={() => sidebarFastUploadRef.current?.click()}
        disabled={sidebarFastUploading}
        className="atlas-mobile-upload"
        aria-label="Upload data to Atlas"
      >
        {sidebarFastUploading ? <Loader size={17} className="spin" /> : <UploadCloud size={17} />}
        <span>{sidebarFastUploading ? 'Ingesting…' : 'Upload'}</span>
      </button>

      <aside'''
s = replace_once(s, old_menu, new_menu, 'mobile Atlas header')

s = s.replace('className="caspa-sidebar"', 'className="caspa-sidebar atlas-sidebar"', 1)

old_brand = '''        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 46, height: 46, borderRadius: 16, background: '#d6a846', color: '#1a1208', display: 'grid', placeItems: 'center' }}><Sparkles size={24} /></div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>Caspa</div>
            <div style={{ color: '#c9b898', fontSize: 13 }}>Make the thing first. Tools second.</div>
          </div>
        </div>'''
new_brand = '''        <div className="atlas-brand atlas-brand--sidebar" style={{ marginBottom: 28 }}>
          <img src="/atlas-logo.svg" alt="ATLAS — Nexus Strategist" style={{ display: 'block', width: 232, maxWidth: '100%', height: 'auto' }} />
        </div>'''
s = replace_once(s, old_brand, new_brand, 'sidebar Atlas logo')

old_ingest_wrap = '''        <div style={{ marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => sidebarFastUploadRef.current?.click()}'''
new_ingest_wrap = '''        <div className="atlas-desktop-ingest" style={{ marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => sidebarFastUploadRef.current?.click()}'''
s = replace_once(s, old_ingest_wrap, new_ingest_wrap, 'desktop ingest wrapper')

# The launchpad's second upload control is the source of the duplicated mobile upload entry point.
s = s.replace('<LaunchpadView onStart={startProject} onFastUpload={handleFastDataUpload} />', '<LaunchpadView onStart={startProject} />')

old_launch_sig = '''function LaunchpadView({ onStart, onFastUpload }: {
  onStart: (mode: CreativeMode, idea: string, tone: string, output: string, audience: string, targetWordCount?: number) => void;
  onFastUpload: (files: File[]) => Promise<void>;
}) {'''
new_launch_sig = '''function LaunchpadView({ onStart }: {
  onStart: (mode: CreativeMode, idea: string, tone: string, output: string, audience: string, targetWordCount?: number) => void;
}) {'''
s = replace_once(s, old_launch_sig, new_launch_sig, 'launchpad signature')

old_fast_state = '''  const [fastUploading, setFastUploading] = useState(false);
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

'''
if old_fast_state in s:
    s = s.replace(old_fast_state, '', 1)

old_launch_upload = '''          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
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
              style={{ display: 'none' }}
              onChange={(event) => runFastUpload(event.target.files)}
            />
          </div>
          {fastUploadError ? <p style={{ margin: '10px 0 0', color: '#ffb4aa', fontSize: 13 }}>{fastUploadError}</p> : null}
'''
if old_launch_upload in s:
    s = s.replace(old_launch_upload, '', 1)
elif 'Fast Data Upload' in s:
    raise SystemExit('launchpad duplicate upload block changed shape; refusing partial repair')

# Atlas brand kicker on launch screen.
s = s.replace("fontSize: 12, marginBottom: 16 }}>Caspa</div>", "fontSize: 12, marginBottom: 16 }}>ATLAS</div>", 1)

old_css = '''        .mobile-menu { display: none; }
        textarea:focus, input:focus, select:focus { outline: 2px solid #d6a846; outline-offset: 2px; }
        button { font-family: inherit; }
        @media (max-width: 860px) {
          .mobile-menu { display: block; }
          .caspa-sidebar { position: fixed !important; z-index: 55; transform: translateX(-105%); transition: transform .2s ease; }
        }'''
new_css = '''        .mobile-menu { display: none; }
        .atlas-mobile-brand, .atlas-mobile-upload { display: none; }
        textarea:focus, input:focus, select:focus { outline: 2px solid #d6a846; outline-offset: 2px; }
        button { font-family: inherit; }
        @media (max-width: 860px) {
          .mobile-menu { display: block; }
          .atlas-mobile-brand {
            display: flex;
            position: fixed;
            top: 11px;
            left: 64px;
            z-index: 60;
            height: 44px;
            align-items: center;
            pointer-events: none;
          }
          .atlas-mobile-brand img { display: block; width: 126px; height: auto; }
          .atlas-mobile-upload {
            display: flex;
            position: fixed;
            top: 13px;
            right: max(12px, env(safe-area-inset-right));
            z-index: 60;
            min-height: 40px;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 8px 11px;
            border-radius: 12px;
            border: 1px solid rgba(212,175,55,.55) !important;
            background: linear-gradient(180deg, #f0cc58, #c99b22) !important;
            color: #090e16 !important;
            font-size: 12px;
            font-weight: 800;
            box-shadow: 0 8px 24px rgba(0,0,0,.28);
          }
          .atlas-brand--sidebar, .atlas-desktop-ingest { display: none !important; }
          .caspa-sidebar { position: fixed !important; z-index: 55; padding-top: 72px !important; transform: translateX(-105%); transition: transform .2s ease; }
        }'''
s = replace_once(s, old_css, new_css, 'mobile shell CSS')

# Sanity: no duplicate launchpad uploader remains.
if 'Fast Data Upload' in s:
    raise SystemExit('Fast Data Upload still present in App.tsx after repair')
if 'atlas-mobile-upload' not in s or '/atlas-logo.svg' not in s:
    raise SystemExit('Atlas mobile shell repair incomplete')
p.write_text(s)


# ── Browser identity ──────────────────────────────────────────────────────────
p = Path('index.html')
s = p.read_text()
s = s.replace('<title>Casper The Ghost Writer</title>', '<link rel="icon" type="image/svg+xml" href="/atlas-logo.svg" />\n    <title>ATLAS • Nexus Strategist</title>')
p.write_text(s)

p = Path('src/main.tsx')
s = p.read_text()
s = s.replace('Caspa hit a snag', 'ATLAS hit a snag')
s = s.replace('Reload Caspa', 'Reload ATLAS')
p.write_text(s)


# ── Atlas network namespace for knowledge/data ingest ────────────────────────
p = Path('src/services/knowledgeClient.ts')
s = p.read_text()
s = s.replace('/api/caspa/knowledge', '/api/atlas/knowledge')
s = s.replace("'X-Caspa-Local-Scope': getDeviceBackupScope()", "'X-Atlas-Local-Scope': getDeviceBackupScope()")
p.write_text(s)

p = Path('src/routes/caspa-knowledge-routes.ts')
s = p.read_text()
s = s.replace("const local = String(req.headers['x-caspa-local-scope'] || '').trim();", "const local = String(req.headers['x-atlas-local-scope'] || req.headers['x-caspa-local-scope'] || '').trim();")
p.write_text(s)

p = Path('server.ts')
s = p.read_text()
s = s.replace('service: "Caspa",', 'service: "Atlas",', 1)
mount = 'app.use("/api/caspa/knowledge", caspaKnowledgeRoutes);'
if 'app.use("/api/atlas/knowledge", caspaKnowledgeRoutes);' not in s:
    if mount not in s:
        raise SystemExit('knowledge route mount not found')
    s = s.replace(mount, 'app.use("/api/atlas/knowledge", caspaKnowledgeRoutes);\n' + mount, 1)
s = s.replace('📚 Caspa Studio running at', '🧭 Atlas running at')
p.write_text(s)

p = Path('src/services/doctorService.ts')
s = p.read_text()
s = s.replace("service: 'Caspa',", "service: 'Atlas',", 1)
p.write_text(s)

# Deploy gate must validate Atlas, not Caspa.
p = Path('.github/workflows/deploy-atlas.yml')
s = p.read_text()
s = s.replace("grep -q '\"service\":\"Caspa\"'", "grep -q '\"service\":\"Atlas\"'")
s = s.replace('Public /api/doctor is not serving Caspa.', 'Public /api/doctor is not serving Atlas.')
p.write_text(s)

# Trigger production only after tests/build have passed in the workflow.
# The workflow rewrites this again immediately before the verified commit.
print('Atlas shell/network repair staged successfully')
