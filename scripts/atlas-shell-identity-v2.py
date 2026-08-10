from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'{label}: expected source not found')
    return text.replace(old, new, 1)


def remove_between(text: str, start_marker: str, end_marker: str, label: str, include_end: bool = False) -> str:
    start = text.find(start_marker)
    if start < 0:
        return text
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f'{label}: end marker not found')
    if include_end:
        end += len(end_marker)
    return text[:start] + text[end:]


# ── Public Atlas shell ────────────────────────────────────────────────────────
p = Path('src/App.tsx')
s = p.read_text()

# Launchpad uses the global ingest handler only. It must not own another uploader.
s = s.replace('<LaunchpadView onStart={startProject} onFastUpload={handleFastDataUpload} />', '<LaunchpadView onStart={startProject} />')
s = replace_required(
    s,
    """function LaunchpadView({ onStart, onFastUpload }: {
  onStart: (mode: CreativeMode, idea: string, tone: string, output: string, audience: string, targetWordCount?: number) => void;
  onFastUpload: (files: File[]) => Promise<void>;
}) {""",
    """function LaunchpadView({ onStart }: {
  onStart: (mode: CreativeMode, idea: string, tone: string, output: string, audience: string, targetWordCount?: number) => void;
}) {""",
    'Launchpad signature',
)

state_start = "  const [fastUploading, setFastUploading] = useState(false);\n"
state_end = "  const selected = modeCards.find((card) => card.mode === mode)!;\n"
s = remove_between(s, state_start, state_end, 'Launchpad uploader state')

# Remove the hero upload group, including its error row.
hero_anchor = "{fastUploading ? 'Reading data…' : 'Fast Data Upload'}"
if hero_anchor in s:
    pos = s.index(hero_anchor)
    start_marker = "          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>\n"
    start = s.rfind(start_marker, 0, pos)
    if start < 0:
        raise SystemExit('Hero upload group start not found')
    end_marker = "          {fastUploadError ? <p style={{ margin: '10px 0 0', color: '#ffb4aa', fontSize: 13 }}>{fastUploadError}</p> : null}\n"
    end = s.find(end_marker, pos)
    if end < 0:
        raise SystemExit('Hero upload group end not found')
    s = s[:start] + s[end + len(end_marker):]

# Remove the second launchpad upload button from the sticky footer.
footer_anchor = '<UploadCloud size={17} /> Fast Data Upload'
if footer_anchor in s:
    pos = s.index(footer_anchor)
    start = s.rfind('            <button\n', 0, pos)
    end_marker = '            </button>\n'
    end = s.find(end_marker, pos)
    if start < 0 or end < 0:
        raise SystemExit('Footer upload button bounds not found')
    s = s[:start] + s[end + len(end_marker):]

# Mobile shell: one menu, one Atlas logo, one upload button.
old_menu = """      <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className=\"mobile-menu\" style={{ position: 'fixed', top: 16, left: 16, zIndex: 60, border: '1px solid #e0d3bf', background: '#fffaf2', borderRadius: 12, padding: 10 }}>
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside"""
new_menu = """      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className=\"mobile-menu\"
        aria-label={mobileMenuOpen ? 'Close Atlas menu' : 'Open Atlas menu'}
        style={{ position: 'fixed', top: 16, left: 16, zIndex: 60, border: '1px solid #e0d3bf', background: '#fffaf2', borderRadius: 12, padding: 10 }}
      >
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div className=\"atlas-mobile-brand\" aria-label=\"ATLAS — Nexus Strategist\">
        <img src=\"/atlas-logo.svg\" alt=\"ATLAS — Nexus Strategist\" />
      </div>

      <button
        type=\"button\"
        onClick={() => sidebarFastUploadRef.current?.click()}
        disabled={sidebarFastUploading}
        className=\"atlas-mobile-upload\"
        aria-label=\"Upload data to Atlas\"
      >
        {sidebarFastUploading ? <Loader size={17} className=\"spin\" /> : <UploadCloud size={17} />}
        <span>{sidebarFastUploading ? 'Ingesting…' : 'Upload'}</span>
      </button>

      <aside"""
s = replace_required(s, old_menu, new_menu, 'Atlas mobile header')

if 'className="caspa-sidebar atlas-sidebar"' not in s:
    s = s.replace('className="caspa-sidebar"', 'className="caspa-sidebar atlas-sidebar"', 1)

old_brand = """        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 46, height: 46, borderRadius: 16, background: '#d6a846', color: '#1a1208', display: 'grid', placeItems: 'center' }}><Sparkles size={24} /></div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>Caspa</div>
            <div style={{ color: '#c9b898', fontSize: 13 }}>Make the thing first. Tools second.</div>
          </div>
        </div>"""
new_brand = """        <div className=\"atlas-brand atlas-brand--sidebar\" style={{ marginBottom: 28 }}>
          <img src=\"/atlas-logo.svg\" alt=\"ATLAS — Nexus Strategist\" style={{ display: 'block', width: 232, maxWidth: '100%', height: 'auto' }} />
        </div>"""
s = replace_required(s, old_brand, new_brand, 'Atlas sidebar logo')

old_ingest = """        <div style={{ marginBottom: 18 }}>
          <button
            type=\"button\"
            onClick={() => sidebarFastUploadRef.current?.click()}"""
new_ingest = """        <div className=\"atlas-desktop-ingest\" style={{ marginBottom: 18 }}>
          <button
            type=\"button\"
            onClick={() => sidebarFastUploadRef.current?.click()}"""
s = replace_required(s, old_ingest, new_ingest, 'Desktop Atlas ingest wrapper')

s = s.replace("fontSize: 12, marginBottom: 16 }}>Caspa</div>", "fontSize: 12, marginBottom: 16 }}>ATLAS</div>", 1)

old_css = """        .mobile-menu { display: none; }
        textarea:focus, input:focus, select:focus { outline: 2px solid #d6a846; outline-offset: 2px; }
        button { font-family: inherit; }
        @media (max-width: 860px) {
          .mobile-menu { display: block; }
          .caspa-sidebar { position: fixed !important; z-index: 55; transform: translateX(-105%); transition: transform .2s ease; }
        }"""
new_css = """        .mobile-menu { display: none; }
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
        }"""
s = replace_required(s, old_css, new_css, 'Atlas responsive shell CSS')

if 'fastUploadRef' in s or 'onFastUpload=' in s:
    raise SystemExit('Duplicate Launchpad upload wiring remains')
if s.count('className="atlas-mobile-upload"') != 1:
    raise SystemExit('Expected exactly one Atlas mobile upload control')
if '/atlas-logo.svg' not in s:
    raise SystemExit('Atlas logo is not wired into the shell')
p.write_text(s)


# ── Browser identity ──────────────────────────────────────────────────────────
p = Path('index.html')
s = p.read_text()
if '/atlas-logo.svg' not in s:
    s = s.replace('<title>Casper The Ghost Writer</title>', '<link rel="icon" type="image/svg+xml" href="/atlas-logo.svg" />\n    <title>ATLAS • Nexus Strategist</title>')
else:
    s = s.replace('<title>Casper The Ghost Writer</title>', '<title>ATLAS • Nexus Strategist</title>')
p.write_text(s)

p = Path('src/main.tsx')
s = p.read_text().replace('Caspa hit a snag', 'ATLAS hit a snag').replace('Reload Caspa', 'Reload ATLAS')
p.write_text(s)


# ── Atlas knowledge/data-ingest namespace ────────────────────────────────────
p = Path('src/services/knowledgeClient.ts')
s = p.read_text().replace('/api/caspa/knowledge', '/api/atlas/knowledge')
s = s.replace("'X-Caspa-Local-Scope': getDeviceBackupScope()", "'X-Atlas-Local-Scope': getDeviceBackupScope()")
p.write_text(s)

p = Path('src/routes/caspa-knowledge-routes.ts')
s = p.read_text()
s = s.replace(
    "const local = String(req.headers['x-caspa-local-scope'] || '').trim();",
    "const local = String(req.headers['x-atlas-local-scope'] || req.headers['x-caspa-local-scope'] || '').trim();",
)
p.write_text(s)

p = Path('server.ts')
s = p.read_text().replace('service: "Caspa",', 'service: "Atlas",', 1)
legacy_mount = 'app.use("/api/caspa/knowledge", caspaKnowledgeRoutes);'
atlas_mount = 'app.use("/api/atlas/knowledge", caspaKnowledgeRoutes);'
if atlas_mount not in s:
    if legacy_mount not in s:
        raise SystemExit('Legacy knowledge route mount not found')
    s = s.replace(legacy_mount, atlas_mount + '\n' + legacy_mount, 1)
s = s.replace('📚 Caspa Studio running at', '🧭 Atlas running at')
p.write_text(s)

p = Path('src/services/doctorService.ts')
s = p.read_text().replace("service: 'Caspa',", "service: 'Atlas',", 1)
p.write_text(s)

print('Atlas identity, namespace and single-upload repair applied')
