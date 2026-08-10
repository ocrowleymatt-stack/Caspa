from pathlib import Path

p = Path('src/App.tsx')
s = p.read_text()
start = s.find('      <button\n        type="button"\n        onClick={() => sidebarFastUploadRef.current?.click()}\n        disabled={sidebarFastUploading}\n        aria-label="Fast file upload"')
if start < 0:
    raise SystemExit('global fast upload block not found')
end_marker = '      <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="mobile-menu"'
end = s.find(end_marker, start)
if end < 0:
    raise SystemExit('mobile menu marker not found')
s = s[:start] + s[end:]
p.write_text(s)
print('removed misplaced global fast upload from Caspa')
