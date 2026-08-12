#!/usr/bin/env python3
"""Make live Atlas Auto web-aware.

Ordinary requests remain local-first. Explicit web/OSINT/current-information
requests must never be routed to an offline local model; they go to Atlas
Research, while explicit deep research goes to Atlas Deep Research.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time

DB = "/app/backend/data/webui.db"
FUNCTION_ID = "atlas-auto"
MARKER = "ATLAS AUTO WEB-AWARE ROUTING v1.3"
BACKUP_DIR = "/app/backend/data/atlas-function-backups"

os.makedirs(BACKUP_DIR, exist_ok=True)
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
row = con.execute("SELECT content, meta FROM function WHERE id=?", (FUNCTION_ID,)).fetchone()
if not row:
    raise SystemExit(f"missing live function: {FUNCTION_ID}")
old = str(row["content"] or "")
if MARKER in old:
    print("already_patched=true")
    con.close()
    raise SystemExit(0)

stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
backup = os.path.join(BACKUP_DIR, f"{FUNCTION_ID}-pre-web-aware-{stamp}.py")
with open(backup, "w", encoding="utf-8") as fh:
    fh.write(old)
print(f"backup={backup}")

patched = old
patched = patched.replace("version: 1.2.0", "version: 1.3.0", 1)
patched = patched.replace(
    "description: Cost-safe local-first routing between tool-capable Atlas Local and Atlas Local Extract.",
    "description: Local-first Atlas routing with mandatory research escalation for explicit web, OSINT and current-information requests.",
    1,
)

valve_anchor = '''        EXTRACT_MODEL: str = Field(\n            default="atlas-local-extract",\n            description="Zero-API-cost model used for structured extraction requests.",\n        )\n'''
valve_replacement = valve_anchor + '''        SEARCH_MODEL: str = Field(\n            default="atlas-research",\n            description="Research model used whenever live web/OSINT retrieval is requested.",\n        )\n        DEEP_SEARCH_MODEL: str = Field(\n            default="atlas-deep-research",\n            description="Maximum research model used for explicit deep/exhaustive web or OSINT requests.",\n        )\n'''
if valve_anchor not in patched:
    raise SystemExit("Atlas Auto valve anchor not found")
patched = patched.replace(valve_anchor, valve_replacement, 1)

choose_anchor = '''        target, reason = self._choose_model(self._latest_user_text(body))\n        if target == "atlas-auto":\n            raise ValueError("Atlas Auto routing loop prevented.")\n'''
choose_replacement = '''        # ATLAS AUTO WEB-AWARE ROUTING v1.3\n        latest = self._latest_user_text(body)\n        lowered = " ".join(latest.lower().split())\n        features = body.get("features") if isinstance(body.get("features"), dict) else {}\n        explicit_no_web = bool(re.search(\n            r"\\b(?:do not|don't|dont)\\s+(?:browse|search)|\\bno\\s+(?:web|internet|external)\\s+(?:search|sources?)|\\boffline only\\b|\\bwithout (?:browsing|web search|internet search)\\b",\n            lowered,\n        ))\n        explicit_web = bool(re.search(\n            r"\\b(?:osint|open[- ]source intelligence|search (?:the )?(?:web|internet|online)|web search|internet search|browse (?:the )?web|look (?:this|it) up|look up online|research online|current info(?:rmation)?|latest (?:info(?:rmation)?|news|details)|public[- ]source research)\\b",\n            lowered,\n        ))\n        web_search = bool((features.get("web_search") or explicit_web) and not explicit_no_web)\n        deep_search = bool(re.search(\n            r"\\b(?:deep(?:ly)?[- ]?(?:search|research|osint)|exhaustive|comprehensive(?:ly)?|full osint|full investigation|investigate (?:deeply|fully|thoroughly)|cross[- ]check|corroborate)\\b",\n            lowered,\n        ))\n\n        if web_search:\n            target = self.valves.DEEP_SEARCH_MODEL if deep_search else self.valves.SEARCH_MODEL\n            reason = "deep live research" if deep_search else "live web/OSINT research"\n        else:\n            target, reason = self._choose_model(latest)\n\n        if target == "atlas-auto":\n            raise ValueError("Atlas Auto routing loop prevented.")\n'''
if choose_anchor not in patched:
    raise SystemExit("Atlas Auto choose-model anchor not found")
patched = patched.replace(choose_anchor, choose_replacement, 1)

forward_anchor = '''        forwarded = dict(body)\n        forwarded["model"] = target\n'''
forward_replacement = '''        forwarded = dict(body)\n        forwarded["model"] = target\n        if web_search:\n            routed_features = dict(features)\n            routed_features["web_search"] = True\n            forwarded["features"] = routed_features\n'''
if forward_anchor not in patched:
    raise SystemExit("Atlas Auto forwarding anchor not found")
patched = patched.replace(forward_anchor, forward_replacement, 1)

status_anchor = '''                            f"Atlas Auto → {target} ({reason}; local; zero OpenAI API-token cost; native tools available)"\n'''
status_replacement = '''                            f"Atlas Auto → {target} ({reason}; {'live retrieval' if web_search else 'local'}; native tools available)"\n'''
if status_anchor not in patched:
    raise SystemExit("Atlas Auto status anchor not found")
patched = patched.replace(status_anchor, status_replacement, 1)

legacy_comment = '''        # Auto is deliberately local-only. Paid Atlas presets are selectable directly,\n        # ensuring an automatic routing decision can never create an OpenAI API charge.\n'''
patched = patched.replace(
    legacy_comment,
    '''        # Ordinary Auto remains local-first. Explicit research intent is deliberately\n        # escalated so Atlas never answers a live-search request from an offline model.\n''',
    1,
)

compile(patched, "<atlas-auto>", "exec")
meta = row["meta"]
try:
    meta_obj = json.loads(meta) if isinstance(meta, str) and meta.strip() else {}
except Exception:
    meta_obj = {}
if not isinstance(meta_obj, dict):
    meta_obj = {}
meta_obj["atlas_auto_web_routing"] = "v1.3"
meta_obj["atlas_auto_web_routing_updated_at"] = int(time.time())

con.execute(
    "UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?",
    (patched, json.dumps(meta_obj, separators=(",", ":")), int(time.time()), FUNCTION_ID),
)
con.commit()
verify = con.execute("SELECT content FROM function WHERE id=?", (FUNCTION_ID,)).fetchone()
code = str(verify[0] or "")
for required in [
    MARKER,
    'default="atlas-research"',
    'default="atlas-deep-research"',
    'routed_features["web_search"] = True',
    'live web/OSINT research',
]:
    if required not in code:
        raise SystemExit(f"post-write verification failed: {required}")
print("patched=true")
print("atlas_auto_web_routing=v1.3")
con.close()
