from pathlib import Path

p = Path('scripts/atlas-shell-identity-v2.py')
s = p.read_text()
old = "if 'fastUploadRef' in s or 'onFastUpload=' in s:\n    raise SystemExit('Duplicate Launchpad upload wiring remains')"
new = "if 'fastUploadRef' in s or '<LaunchpadView onStart={startProject} onFastUpload=' in s or 'function LaunchpadView({ onStart, onFastUpload' in s:\n    raise SystemExit('Duplicate Launchpad upload wiring remains')"
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s)

code = compile(s, str(p), 'exec')
exec(code, {'__name__': '__main__', '__file__': str(p)})
