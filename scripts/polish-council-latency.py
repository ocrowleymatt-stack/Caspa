from pathlib import Path

# ---- cloudModelRouter.ts: fast Council models + strict JSON acceptance ----
p = Path('src/services/cloudModelRouter.ts')
s = p.read_text()

anchor = """function taskAdjustments(provider: CloudProvider, task: TaskKind, mode: IntelligenceMode): string[] {
  if (provider === 'grok') {
    if (task === 'creative' && mode !== 'speed') return ['grok-4.5'];
    if (task === 'fast') return ['grok-4.20-0309-non-reasoning'];
  }
  if (provider === 'gemini') {
    if (task === 'fast') return ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];
    if ((task === 'reasoning' || task === 'legal' || task === 'long' || task === 'synthesis') && mode === 'god') return ['gemini-3.1-pro-preview'];
  }
  if (provider === 'venice') {
    if (task === 'fast') return ['qwen3-6-27b'];
    if (task === 'reasoning' || task === 'legal' || task === 'factual') return mode === 'god' ? ['deepseek-v4-flash', 'openai-gpt-oss-120b'] : ['openai-gpt-oss-120b', 'qwen3-6-27b'];
  }
  if (provider === 'openai' && task === 'fast') return ['gpt-5.4-mini', 'gpt-5.4-nano'];
  if (provider === 'claude' && task === 'fast') return ['claude-fable-5', 'claude-haiku-4-5-20251001'];
  return [];
}
"""
replacement = """function taskAdjustments(provider: CloudProvider, task: TaskKind, mode: IntelligenceMode): string[] {
  // Council seats favour diverse, strong *fast* models. God Mode reserves the
  // slower reasoning/multi-agent engines for synthesis and genuinely deep tasks,
  // instead of making every critic seat pay maximum latency.
  if (task === 'council') {
    if (provider === 'grok') return ['grok-4.5', 'grok-4.20-0309-non-reasoning'];
    if (provider === 'gemini') return ['gemini-3.6-flash', 'gemini-3.5-flash'];
    if (provider === 'venice') return ['openai-gpt-oss-120b', 'qwen3-6-27b'];
    if (provider === 'openai') return ['gpt-5.4-mini', 'gpt-5.5'];
    if (provider === 'claude') return ['claude-sonnet-5', 'claude-fable-5'];
  }
  if (provider === 'grok') {
    if (task === 'creative' && mode !== 'speed') return ['grok-4.5'];
    if (task === 'fast') return ['grok-4.20-0309-non-reasoning'];
  }
  if (provider === 'gemini') {
    if (task === 'fast') return ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];
    if ((task === 'reasoning' || task === 'legal' || task === 'long' || task === 'synthesis') && mode === 'god') return ['gemini-3.1-pro-preview'];
  }
  if (provider === 'venice') {
    if (task === 'fast') return ['qwen3-6-27b'];
    if (task === 'reasoning' || task === 'legal' || task === 'factual') return mode === 'god' ? ['deepseek-v4-flash', 'openai-gpt-oss-120b'] : ['openai-gpt-oss-120b', 'qwen3-6-27b'];
  }
  if (provider === 'openai' && task === 'fast') return ['gpt-5.4-mini', 'gpt-5.4-nano'];
  if (provider === 'claude' && task === 'fast') return ['claude-fable-5', 'claude-haiku-4-5-20251001'];
  return [];
}
"""
if anchor not in s:
    raise SystemExit('taskAdjustments anchor missing')
s = s.replace(anchor, replacement, 1)

insert_anchor = """function outputTextFromResponses(data: any): string {
"""
json_helper = """function requireValidJson(text: string): string {
  let candidate = text.trim();
  if (candidate.startsWith('```')) {
    candidate = candidate.replace(/^```(?:json)?\\s*/i, '').replace(/\\s*```$/, '').trim();
  }
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    // Some otherwise-good models prepend a sentence. Salvage a single JSON
    // object/array only when it parses cleanly; otherwise reject and try the next model.
    const objectStart = candidate.indexOf('{');
    const objectEnd = candidate.lastIndexOf('}');
    const arrayStart = candidate.indexOf('[');
    const arrayEnd = candidate.lastIndexOf(']');
    const slices: string[] = [];
    if (objectStart >= 0 && objectEnd > objectStart) slices.push(candidate.slice(objectStart, objectEnd + 1));
    if (arrayStart >= 0 && arrayEnd > arrayStart) slices.push(candidate.slice(arrayStart, arrayEnd + 1));
    for (const slice of slices) {
      try { JSON.parse(slice); return slice; } catch { /* continue */ }
    }
    throw new Error('Model ignored required JSON output format');
  }
}

""" + insert_anchor
if insert_anchor not in s:
    raise SystemExit('JSON helper insertion anchor missing')
s = s.replace(insert_anchor, json_helper, 1)

return_anchor = """      if (!text) throw new Error(`${provider}/${model} returned empty output`);
      return { text, model, provider };
"""
return_replacement = """      if (!text) throw new Error(`${provider}/${model} returned empty output`);
      if (opts.json) text = requireValidJson(text);
      return { text, model, provider };
"""
if return_anchor not in s:
    raise SystemExit('cloud return anchor missing')
s = s.replace(return_anchor, return_replacement, 1)
p.write_text(s)

# ---- ai.ts: publish each Council seat immediately as it resolves ----
p = Path('src/services/ai.ts')
s = p.read_text()
old = """    for (let offset = 0; offset < roles.length; offset += concurrency) {
      const batch = roles.slice(offset, offset + concurrency);
      const settled = await Promise.allSettled(
        batch.map((role, batchIndex) => runSeat(role, offset + batchIndex, true))
      );

      settled.forEach((result, batchIndex) => {
        const role = batch[batchIndex];
        const index = offset + batchIndex;
        if (result.status === 'fulfilled') {
          critiques.push(result.value);
        } else {
          console.warn(`[Council] Seat ${role} failed on pinned provider ${providerRotation[index % providerRotation.length]}:`, result.reason);
          failedSeats.push({ role, index, error: result.reason });
        }
      });
      onProgress?.([...critiques], Math.min(offset + batch.length, roles.length), roles.length);
    }
"""
new = """    let settledCount = 0;
    for (let offset = 0; offset < roles.length; offset += concurrency) {
      const batch = roles.slice(offset, offset + concurrency);
      const seatPromises = batch.map((role, batchIndex) => {
        const index = offset + batchIndex;
        return runSeat(role, index, true)
          .then((critique) => {
            critiques.push(critique);
            settledCount += 1;
            // Crucially, do not wait for the slowest member of the batch before
            // showing useful work. The UI receives each completed chair at once.
            onProgress?.([...critiques], settledCount, roles.length);
            return critique;
          })
          .catch((error) => {
            settledCount += 1;
            onProgress?.([...critiques], settledCount, roles.length);
            throw error;
          });
      });

      const settled = await Promise.allSettled(seatPromises);
      settled.forEach((result, batchIndex) => {
        if (result.status === 'rejected') {
          const role = batch[batchIndex];
          const index = offset + batchIndex;
          console.warn(`[Council] Seat ${role} failed on pinned provider ${providerRotation[index % providerRotation.length]}:`, result.reason);
          failedSeats.push({ role, index, error: result.reason });
        }
      });
    }
"""
if old not in s:
    raise SystemExit('Council batch anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)
