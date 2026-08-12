#!/usr/bin/env python3
"""Make Atlas Research execute live web retrieval rather than merely advertise it.

Repairs three live OpenWebUI contracts:
- Atlas Research and Deep Research explicitly bind the native SearXNG and
  Perplexica tools in addition to Atlas knowledge/graph/Argus tools;
- the frontier multi-provider pipe forwards every requested web search to the
  AtlasRouter provider-native search path (not Sol-only);
- Atlas Auto status text no longer claims tool availability that has not been
  executed; it reports live retrieval as requested.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time

DB = "/app/backend/data/webui.db"
BACKUP_DIR = "/app/backend/data/atlas-function-backups"
MARKER = "ATLAS RESEARCH WEB EXECUTION v1"
WEB_TOOLS = ["tool_searxng_search", "tool_perplexica_research"]
MODELS = ["atlas-research", "atlas-deep-research"]

os.makedirs(BACKUP_DIR, exist_ok=True)
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())

# Prove the native web tools actually exist before advertising/binding them.
for tool_id in WEB_TOOLS:
    row = con.execute("SELECT id FROM tool WHERE id=?", (tool_id,)).fetchone()
    if not row:
        raise SystemExit(f"required live Atlas web tool missing: {tool_id}")

# Explicitly bind the web tools to the two direct research model records.
for model_id in MODELS:
    row = con.execute("SELECT meta FROM model WHERE id=? AND is_active=1", (model_id,)).fetchone()
    if not row:
        raise SystemExit(f"active model missing: {model_id}")
    try:
        meta = json.loads(row["meta"] or "{}")
    except Exception:
        meta = {}
    if not isinstance(meta, dict):
        meta = {}
    before = json.dumps(meta, ensure_ascii=False, indent=2)
    with open(os.path.join(BACKUP_DIR, f"{model_id}-meta-pre-web-execution-{stamp}.json"), "w", encoding="utf-8") as fh:
        fh.write(before)
    tool_ids = list(meta.get("toolIds") or [])
    for tool_id in WEB_TOOLS:
        if tool_id not in tool_ids:
            tool_ids.append(tool_id)
    meta["toolIds"] = tool_ids
    features = list(meta.get("defaultFeatureIds") or [])
    if "web_search" not in features:
        features.append("web_search")
    meta["defaultFeatureIds"] = features
    caps = meta.get("capabilities") if isinstance(meta.get("capabilities"), dict) else {}
    caps = dict(caps)
    caps["web_search"] = True
    caps["builtin_tools"] = True
    meta["capabilities"] = caps
    meta["atlas_research_web_execution"] = "v1"
    meta["atlas_research_web_execution_updated_at"] = int(time.time())
    con.execute("UPDATE model SET meta=?, updated_at=? WHERE id=?", (json.dumps(meta, separators=(",", ":")), int(time.time()), model_id))
    print(f"model_web_tools_bound={model_id}:{','.join(WEB_TOOLS)}")

# Patch the live frontier pipe: web means web on every tier. The router itself
# performs capability gating and will only use Venice/Grok/Gemini for web calls.
row = con.execute("SELECT content, meta FROM function WHERE id='atlas-frontier-failover' AND is_active=1").fetchone()
if not row:
    raise SystemExit("active atlas-frontier-failover missing")
old = str(row["content"] or "")
with open(os.path.join(BACKUP_DIR, f"atlas-frontier-failover-pre-web-execution-{stamp}.py"), "w", encoding="utf-8") as fh:
    fh.write(old)

s = old
if MARKER not in s:
    s = s.replace("# ATLAS MULTI-PROVIDER FRONTIER v2.1", "# ATLAS MULTI-PROVIDER FRONTIER v2.2\n# ATLAS RESEARCH WEB EXECUTION v1", 1)
    s = s.replace("version: 2.1.0", "version: 2.2.0", 1)
    s = s.replace(
        "description: Venice-primary multi-provider Atlas frontier bridge with canonical cloud failover and local Qwen as final fail-soft.",
        "description: Multi-provider Atlas frontier bridge with mandatory provider-native live search whenever web retrieval is requested and local Qwen as final fail-soft.",
        1,
    )
    old_block = '''        # OpenWebUI has already performed SearXNG retrieval when web_search is enabled.\n        # Avoid paying the latency cost twice for Luna/Terra; Sol keeps provider-native\n        # search as a corroborating second retrieval pass.\n        provider_web = bool(use_web and selected.endswith("sol"))\n        prompt = self._prompt(body)\n'''
    new_block = '''        # ATLAS RESEARCH WEB EXECUTION v1\n        # Do not assume OpenWebUI retrieval has already executed. A requested web\n        # search must reach AtlasRouter, whose capability gate restricts execution\n        # to Venice/Grok/Gemini. This makes Terra/Research genuinely live as well\n        # as Sol/Deep Research.\n        provider_web = bool(use_web)\n        prompt = self._prompt(body)\n        if use_web:\n            prompt = (\n                "[ATLAS LIVE-RETRIEVAL CONTRACT]\\n"\n                "Current/public-source web retrieval is required for this request. "\n                "Use the provider-native search path and base material claims on retrieved sources. "\n                "Do not claim that web/OSINT tools are unavailable merely because unrelated tool schemas are present. "\n                "If retrieval itself fails, state that as an execution failure rather than substituting model memory.\\n\\n"\n                + prompt\n            )\n'''
    if old_block not in s:
        # Accept an already partially edited source if the decisive expression remains.
        if 'provider_web = bool(use_web and selected.endswith("sol"))' not in s:
            raise SystemExit("frontier web-search anchor missing")
        s = s.replace('provider_web = bool(use_web and selected.endswith("sol"))', 'provider_web = bool(use_web)', 1)
        s = s.replace('        prompt = self._prompt(body)\n', new_block.split('        prompt = self._prompt(body)\n',1)[1].join(['        prompt = self._prompt(body)\n','']), 1)
    else:
        s = s.replace(old_block, new_block, 1)
    s = s.replace(" · provider corroboration", " · provider live search", 1)

compile(s, "<atlas-frontier-failover>", "exec")
try:
    fmeta = json.loads(row["meta"] or "{}")
except Exception:
    fmeta = {}
if not isinstance(fmeta, dict):
    fmeta = {}
fmeta["atlas_research_web_execution"] = "v1"
fmeta["atlas_research_web_execution_updated_at"] = int(time.time())
con.execute("UPDATE function SET content=?, meta=?, updated_at=? WHERE id='atlas-frontier-failover'", (s, json.dumps(fmeta, separators=(",", ":")), int(time.time())))

# Make the Auto status truthful. The actual bindings are downstream; this text
# should report intent/execution class, not assert a specific tool schema.
row = con.execute("SELECT content, meta FROM function WHERE id='atlas-auto' AND is_active=1").fetchone()
if row:
    a = str(row["content"] or "")
    with open(os.path.join(BACKUP_DIR, f"atlas-auto-pre-web-status-{stamp}.py"), "w", encoding="utf-8") as fh:
        fh.write(a)
    a2 = a.replace(
        "f\"Atlas Auto → {target} ({reason}; {'live retrieval' if web_search else 'local'}; native tools available)\"",
        "f\"Atlas Auto → {target} ({reason}; {'live retrieval requested' if web_search else 'local'})\"",
    )
    if a2 != a:
        compile(a2, "<atlas-auto>", "exec")
        try:
            ameta = json.loads(row["meta"] or "{}")
        except Exception:
            ameta = {}
        if not isinstance(ameta, dict):
            ameta = {}
        ameta["atlas_research_web_execution"] = "v1"
        con.execute("UPDATE function SET content=?, meta=?, updated_at=? WHERE id='atlas-auto'", (a2, json.dumps(ameta, separators=(",", ":")), int(time.time())))
        print("atlas_auto_status_truthful=true")

con.commit()

# Post-write assertions.
for model_id in MODELS:
    row = con.execute("SELECT meta FROM model WHERE id=?", (model_id,)).fetchone()
    meta = json.loads(row["meta"] or "{}")
    for tool_id in WEB_TOOLS:
        assert tool_id in (meta.get("toolIds") or []), (model_id, tool_id, meta)
row = con.execute("SELECT content FROM function WHERE id='atlas-frontier-failover'").fetchone()
code = str(row[0] or "")
assert MARKER in code
assert 'provider_web = bool(use_web)' in code
assert 'provider_web = bool(use_web and selected.endswith("sol"))' not in code
assert 'ATLAS LIVE-RETRIEVAL CONTRACT' in code
print("atlas_research_web_execution_live=v1")
con.close()
