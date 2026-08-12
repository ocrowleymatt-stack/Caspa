#!/usr/bin/env python3
"""Harden the live OpenWebUI Atlas public-source filter.

Explicit natural-language web/OSINT intent must activate OpenWebUI's configured
web-search feature for every Atlas custom model. Explicit no-web instructions
win and disable it. This operates at the global Atlas filter layer so local,
frontier, Auto and specialist models all inherit the same contract.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time

DB = "/app/backend/data/webui.db"
FUNCTION_ID = "atlas-public-source-research"
MARKER = "ATLAS WEB INTENT ACTIVATION v1"
BACKUP_DIR = "/app/backend/data/atlas-function-backups"

os.makedirs(BACKUP_DIR, exist_ok=True)
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
row = con.execute(
    "SELECT content, meta FROM function WHERE id=?", (FUNCTION_ID,)
).fetchone()
if not row:
    raise SystemExit(f"missing live function: {FUNCTION_ID}")

old = str(row["content"] or "")
if not old.strip():
    raise SystemExit(f"empty live function: {FUNCTION_ID}")

if MARKER in old:
    print("already_patched=true")
    con.close()
    raise SystemExit(0)

stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
backup = os.path.join(BACKUP_DIR, f"{FUNCTION_ID}-pre-web-intent-{stamp}.py")
with open(backup, "w", encoding="utf-8") as fh:
    fh.write(old)
print(f"backup={backup}")

anchor = '''    async def inlet(self, body: dict, __model__: dict | None = None, **kwargs) -> dict:\n        if self.valves.APPLY_ONLY_TO_ATLAS and not self._is_atlas(body, __model__):\n            return body\n        out = copy.deepcopy(body)\n'''

replacement = '''    async def inlet(self, body: dict, __model__: dict | None = None, **kwargs) -> dict:\n        if self.valves.APPLY_ONLY_TO_ATLAS and not self._is_atlas(body, __model__):\n            return body\n        out = copy.deepcopy(body)\n\n        # ATLAS WEB INTENT ACTIVATION v1\n        # Policy permission is not execution. Turn explicit user search intent into\n        # OpenWebUI's real web_search feature so every Atlas model reaches the\n        # configured retrieval layer before synthesis. Explicit no-web intent wins.\n        messages = out.get("messages") if isinstance(out.get("messages"), list) else []\n        latest_user = ""\n        for message in reversed(messages):\n            if not isinstance(message, dict) or message.get("role") != "user":\n                continue\n            content = message.get("content")\n            if isinstance(content, str):\n                latest_user = content\n            elif isinstance(content, list):\n                parts = []\n                for item in content:\n                    if isinstance(item, dict):\n                        value = item.get("text") or item.get("content")\n                        if isinstance(value, str):\n                            parts.append(value)\n                    elif isinstance(item, str):\n                        parts.append(item)\n                latest_user = " ".join(parts)\n            elif content is not None:\n                latest_user = str(content)\n            break\n\n        intent = " ".join(latest_user.lower().split())\n        deny = (\n            "don't browse", "do not browse", "dont browse",\n            "don't search", "do not search", "dont search",\n            "no web search", "no internet search", "offline only",\n            "without browsing", "without web search", "without internet search",\n            "use only the provided", "use only provided",\n            "use only the attached", "use only attached",\n            "no external search", "no external sources",\n        )\n        allow = (\n            "search the web", "search web", "web search",\n            "search the internet", "internet search",\n            "browse the web", "browse web", "browse online",\n            "look this up", "look it up", "look up online",\n            "search online", "research online",\n            "public-source research", "public source research",\n            "open-source intelligence", "open source intelligence", "osint",\n        )\n\n        explicit_no_web = bool(intent and any(phrase in intent for phrase in deny))\n        explicit_web = bool(intent and any(phrase in intent for phrase in allow))\n        features = out.get("features") if isinstance(out.get("features"), dict) else {}\n        features = dict(features)\n        if explicit_no_web:\n            features["web_search"] = False\n        elif explicit_web:\n            features["web_search"] = True\n        if explicit_no_web or explicit_web:\n            out["features"] = features\n'''

count = old.count(anchor)
if count != 1:
    raise SystemExit(f"inlet anchor mismatch: {count}")
patched = old.replace(anchor, replacement, 1)

meta = row["meta"]
try:
    meta_obj = json.loads(meta) if isinstance(meta, str) and meta.strip() else {}
except Exception:
    meta_obj = {}
if not isinstance(meta_obj, dict):
    meta_obj = {}
meta_obj["atlas_web_intent_activation"] = "v1"
meta_obj["atlas_web_intent_updated_at"] = int(time.time())

con.execute(
    "UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?",
    (patched, json.dumps(meta_obj, separators=(",", ":")), int(time.time()), FUNCTION_ID),
)
con.commit()

verify = con.execute(
    "SELECT content, meta FROM function WHERE id=?", (FUNCTION_ID,)
).fetchone()
code = str(verify["content"] or "")
if MARKER not in code or 'features["web_search"] = True' not in code or 'features["web_search"] = False' not in code:
    raise SystemExit("post-write verification failed")
print("patched=true")
print("marker=true")
print("explicit_web_activation=true")
print("explicit_no_web_override=true")
con.close()
