from pathlib import Path

path = Path('server.ts')
text = path.read_text()

old_claude = '        model: "claude-sonnet-5",'
new_claude = '        model: "claude-sonnet-4-6",'
if old_claude not in text:
    raise SystemExit('Claude Sonnet 5 anchor not found')
text = text.replace(old_claude, new_claude, 1)

path.write_text(text)
