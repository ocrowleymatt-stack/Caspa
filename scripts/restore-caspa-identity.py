from pathlib import Path
import re


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


# Restore visible CASPA identity while preserving all current product/workflow code.
app = Path("src/App.tsx")
s = app.read_text()

s = s.replace(
    "aria-label={mobileMenuOpen ? 'Close Atlas menu' : 'Open Atlas menu'}",
    "aria-label={mobileMenuOpen ? 'Close Caspa menu' : 'Open Caspa menu'}",
)

mobile_pattern = re.compile(
    r'\n\s*<div className="atlas-mobile-brand" aria-label="ATLAS — Nexus Strategist">\s*'
    r'<img src="/atlas-logo\.svg" alt="ATLAS — Nexus Strategist" />\s*'
    r'</div>\s*'
    r'<button\s*'
    r'type="button"\s*'
    r'onClick=\{\(\) => sidebarFastUploadRef\.current\?\.click\(\)\}\s*'
    r'disabled=\{sidebarFastUploading\}\s*'
    r'className="atlas-mobile-upload"\s*'
    r'aria-label="Upload data to Atlas"\s*'
    r'>.*?</button>\s*',
    re.S,
)
s, _ = mobile_pattern.subn("\n", s, count=1)

s = s.replace('className="caspa-sidebar atlas-sidebar"', 'className="caspa-sidebar"')

atlas_brand = '''        <div className="atlas-brand atlas-brand--sidebar" style={{ marginBottom: 28 }}>
          <img src="/atlas-logo.svg" alt="ATLAS — Nexus Strategist" style={{ display: 'block', width: 232, maxWidth: '100%', height: 'auto' }} />
        </div>'''
caspa_brand = '''        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 46, height: 46, borderRadius: 16, background: '#d6a846', color: '#1a1208', display: 'grid', placeItems: 'center' }}><Sparkles size={24} /></div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1 }}>Caspa</div>
            <div style={{ color: '#c9b898', fontSize: 13 }}>Make the thing first. Tools second.</div>
          </div>
        </div>'''
s = s.replace(atlas_brand, caspa_brand)
s = s.replace('className="atlas-desktop-ingest" style={{ marginBottom: 18 }}', 'style={{ marginBottom: 18 }}')
s = s.replace('marginBottom: 16 }}>ATLAS</div>', 'marginBottom: 16 }}>Caspa</div>')
s = s.replace('        .atlas-mobile-brand, .atlas-mobile-upload { display: none; }\n', '')

require('/atlas-logo.svg' not in s, 'Visible Atlas logo reference remains in App.tsx')
require('ATLAS — Nexus Strategist' not in s, 'Visible Atlas brand string remains in App.tsx')
require('className="atlas-mobile-upload"' not in s, 'Atlas mobile upload control remains in App.tsx')
require('>Caspa</div>' in s, 'Caspa brand label missing from App.tsx')
require('Make the thing first. Tools second.' in s, 'Caspa tagline missing from App.tsx')
app.write_text(s)

main = Path('src/main.tsx')
s = main.read_text()
s = s.replace('ATLAS hit a snag', 'Caspa hit a snag')
s = s.replace('Reload ATLAS', 'Reload Caspa')
main.write_text(s)

index = Path('index.html')
s = index.read_text()
s = re.sub(r'\s*<link rel="icon" type="image/svg\+xml" href="/atlas-logo\.svg" />', '', s)
s = s.replace('<title>ATLAS • Nexus Strategist</title>', '<title>CASPA • Creative Engine</title>')
index.write_text(s)

doctor = Path('src/services/doctorService.ts')
s = doctor.read_text().replace("service: 'Atlas',", "service: 'Caspa',")
doctor.write_text(s)

# The lightweight /health route had also been relabelled Atlas. Keep diagnostics consistent.
server = Path('server.ts')
s = server.read_text()
s = s.replace('service: "Atlas"', 'service: "Caspa"')
s = s.replace("service: 'Atlas'", "service: 'Caspa'")
server.write_text(s)

# Remove only non-workflow files whose sole purpose was to impose the accidental Atlas shell identity.
# Workflow files are handled separately because GitHub Actions tokens may not edit workflows.
for dead in (
    'public/atlas-logo.svg',
    'scripts/fix-atlas-shell-branding.py',
    'scripts/atlas-shell-identity-v2.py',
    'scripts/run-atlas-shell-identity-v2.py',
):
    p = Path(dead)
    if p.exists():
        p.unlink()

# Assertions: identity changed, capability/compatibility namespaces left alone.
require('CASPA • Creative Engine' in index.read_text(), 'CASPA document title missing')
require('Caspa hit a snag' in main.read_text(), 'CASPA error boundary missing')
require("service: 'Caspa'" in doctor.read_text(), 'CASPA doctor identity missing')
require('service: "Atlas"' not in server.read_text() and "service: 'Atlas'" not in server.read_text(), 'Atlas diagnostic service label remains in server.ts')
require('/api/atlas/knowledge' in Path('src/services/knowledgeClient.ts').read_text(), 'Compatibility knowledge route was unexpectedly altered')

print('CASPA_IDENTITY_RESTORED')
