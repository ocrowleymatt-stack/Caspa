from pathlib import Path

path = Path('server.ts')
text = path.read_text()

old_block = '''  // Enforce prohibited models upgrade to gemini-2.0-flash
  const prohibited = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash-thinking'
  ];
  const activeModel = prohibited.includes(model) ? 'gemini-2.0-flash' : model;
'''
new_block = '''  // Retired Gemini generations are upgraded at the server boundary so older
  // client code cannot take the whole routing layer down when Google retires a model.
  const retiredModels = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash-thinking'
  ];
  const activeModel = retiredModels.includes(model) ? 'gemini-3.6-flash' : model;
'''
if old_block not in text:
    raise SystemExit('Gemini retirement mapping anchor not found')
text = text.replace(old_block, new_block, 1)

old_temp = '''        systemInstruction: "You are a proudly snobbish literary machine that always seeks a prize, prestige, or critical acclaim for its work. You help the user write elegantly from a developed idea or even down to using a receipt as the only source material, maintaining an intuitive process where the human still has a guiding hand. You provide raw, high-fidelity output.",
        temperature: 0.7,
'''
new_temp = '''        systemInstruction: "You are a proudly snobbish literary machine that always seeks a prize, prestige, or critical acclaim for its work. You help the user write elegantly from a developed idea or even down to using a receipt as the only source material, maintaining an intuitive process where the human still has a guiding hand. You provide raw, high-fidelity output.",
'''
if old_temp not in text:
    raise SystemExit('Gemini sampling config anchor not found')
text = text.replace(old_temp, new_temp, 1)

old_claude = '        model: "claude-3-5-sonnet-20241022",'
new_claude = '        model: "claude-sonnet-5",'
if old_claude not in text:
    raise SystemExit('Claude model anchor not found')
text = text.replace(old_claude, new_claude, 1)

path.write_text(text)
