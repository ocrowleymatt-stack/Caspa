#!/usr/bin/env python3
"""Optimise Atlas Auto direct web routing after the v1.4 functional repair.

v1.4 establishes the non-recursive Auto -> AtlasRouter execution path.
v1.5 keeps that architecture but reduces ordinary-research latency and adds
stronger output validation and observability.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time

DB = "/app/backend/data/webui.db"
FUNCTION_ID = "atlas-auto"
BASE_MARKER = "ATLAS AUTO DIRECT WEB ROUTING v1.4"
MARKER = "ATLAS AUTO PERFORMANCE HARDENING v1.5"
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
if BASE_MARKER not in old:
    raise SystemExit("Atlas Auto v1.4 must be installed before v1.5 performance hardening")

stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
backup = os.path.join(BACKUP_DIR, f"{FUNCTION_ID}-pre-performance-v15-{stamp}.py")
with open(backup, "w", encoding="utf-8") as fh:
    fh.write(old)
print(f"backup={backup}")

patched = old
patched = patched.replace("version: 1.4.0", "version: 1.5.0", 1)
patched = patched.replace(
    "        # ATLAS AUTO DIRECT WEB ROUTING v1.4\n",
    "        # ATLAS AUTO DIRECT WEB ROUTING v1.4\n        # ATLAS AUTO PERFORMANCE HARDENING v1.5\n",
    1,
)

old_valves = '''        WEB_TIMEOUT_S: int = Field(default=150, ge=30, le=300)\n        DEEP_WEB_TIMEOUT_S: int = Field(default=240, ge=60, le=420)\n'''
new_valves = '''        WEB_TIMEOUT_S: int = Field(default=95, ge=30, le=180)\n        DEEP_WEB_TIMEOUT_S: int = Field(default=210, ge=60, le=420)\n        WEB_MAX_TOKENS: int = Field(default=3600, ge=500, le=8000)\n        DEEP_WEB_MAX_TOKENS: int = Field(default=9000, ge=2000, le=12000)\n        WEB_CONTEXT_CHARS: int = Field(default=32000, ge=8000, le=100000)\n        WEB_CONTEXT_MESSAGES: int = Field(default=12, ge=2, le=40)\n'''
if old_valves not in patched:
    raise SystemExit("v1.4 timeout valve block not found")
patched = patched.replace(old_valves, new_valves, 1)

old_prompt_method = '''    def _router_prompt(self, body: dict) -> str:\n        blocks: list[str] = []\n        for message in body.get("messages") or []:\n            if not isinstance(message, dict):\n                continue\n            role = str(message.get("role") or "message").upper()\n            text = self._text_from_content(message.get("content")).strip()\n            if text:\n                blocks.append(f"[{role}]\\n{text}")\n        transcript = "\\n\\n".join(blocks)\n        if len(transcript) > 100000:\n            transcript = transcript[-100000:]\n        contract = (\n            "[ATLAS AUTO LIVE-RESEARCH CONTRACT]\\n"\n            "Execute current public-web research now rather than describing how one might search. "\n            "Use British English. Prefer primary/authoritative sources where available, cite retrieved URLs, "\n            "cross-check identities and distinguish confirmed matches, plausible joins, collisions and unsupported claims. "\n            "For OSINT, synthesise the retrieved evidence into a useful narrative rather than returning a search plan. "\n            "Do not claim web tools are unavailable if live retrieval succeeds.\\n\\n"\n        )\n        return contract + transcript\n\n'''
new_prompt_method = '''    def _router_prompt(self, body: dict) -> str:\n        blocks: list[str] = []\n        messages = [m for m in (body.get("messages") or []) if isinstance(m, dict)]\n        messages = messages[-int(self.valves.WEB_CONTEXT_MESSAGES):]\n        for message in messages:\n            role = str(message.get("role") or "message").upper()\n            text = self._text_from_content(message.get("content")).strip()\n            if text:\n                blocks.append(f"[{role}]\\n{text}")\n        transcript = "\\n\\n".join(blocks)\n        context_limit = int(self.valves.WEB_CONTEXT_CHARS)\n        if len(transcript) > context_limit:\n            transcript = transcript[-context_limit:]\n        contract = (\n            "[ATLAS AUTO LIVE-RESEARCH CONTRACT]\\n"\n            "Execute current public-web research now rather than describing how one might search. "\n            "Use British English. Prefer primary/authoritative sources where available, cite retrieved URLs, "\n            "cross-check identities and distinguish confirmed matches, plausible joins, collisions and unsupported claims. "\n            "For OSINT, synthesise the retrieved evidence into a useful narrative rather than returning a search plan. "\n            "Be substantive but concise: spend tokens on evidence and synthesis, not search narration or filler. "\n            "Do not claim web tools are unavailable if live retrieval succeeds.\\n\\n"\n        )\n        return contract + transcript\n\n    def _wants_x_search(self, body: dict) -> bool:\n        latest = self._latest_user_text(body).lower()\n        return bool(re.search(r"\\b(x\\.com|twitter|tweet|tweets|x search|social media|social posts?|posts on x)\\b", latest))\n\n'''
if old_prompt_method not in patched:
    raise SystemExit("v1.4 router prompt method not found")
patched = patched.replace(old_prompt_method, new_prompt_method, 1)

old_payload = '''                "intelligenceMode": "god" if deep_search else "balanced",\n                "maxTokens": 10000 if deep_search else 6500,\n                "primaryProvider": self.valves.WEB_PRIMARY_PROVIDER,\n                "useWebSearch": True,\n                "json": False,\n'''
new_payload = '''                "intelligenceMode": "god" if deep_search else "speed",\n                "maxTokens": self.valves.DEEP_WEB_MAX_TOKENS if deep_search else self.valves.WEB_MAX_TOKENS,\n                "primaryProvider": self.valves.WEB_PRIMARY_PROVIDER,\n                "useWebSearch": True,\n                "useXSearch": self._wants_x_search(body),\n                "taskHint": "factual",\n                "json": False,\n'''
if old_payload not in patched:
    raise SystemExit("v1.4 direct-router payload not found")
patched = patched.replace(old_payload, new_payload, 1)

old_result_check = '''            result = str(data.get("result") or "").strip() if isinstance(data, dict) else ""\n            if not result:\n                raise RuntimeError(f"Atlas live research returned no substantive result: {str(data)[:1000]}")\n'''
new_result_check = '''            result = str(data.get("result") or "").strip() if isinstance(data, dict) else ""\n            if not result:\n                raise RuntimeError(f"Atlas live research returned no substantive result: {str(data)[:1000]}")\n            low_result = result.lower()\n            bad_meta = (\n                "cannot access the internet",\n                "can't access the internet",\n                "unable to access the internet",\n                "cannot browse the web",\n                "i should use tools",\n                "i should search",\n            )\n            if any(marker in low_result for marker in bad_meta):\n                raise RuntimeError(f"Atlas live research returned unusable meta-output: {result[:800]}")\n'''
if old_result_check not in patched:
    raise SystemExit("v1.4 result validation block not found")
patched = patched.replace(old_result_check, new_result_check, 1)

old_status_vars = '''                provider = str(data.get("provider") or "provider")\n                model = str(data.get("model") or "model")\n                await __event_emitter__({\n'''
new_status_vars = '''                provider = str(data.get("provider") or "provider")\n                model = str(data.get("model") or "model")\n                duration_ms = data.get("requestDurationMs")\n                timing = f" · {float(duration_ms) / 1000:.1f}s" if isinstance(duration_ms, (int, float)) else ""\n                await __event_emitter__({\n'''
if old_status_vars not in patched:
    raise SystemExit("v1.4 completion status variables not found")
patched = patched.replace(old_status_vars, new_status_vars, 1)
patched = patched.replace(
    '"description": f"Atlas Auto · live research complete · {provider} / {model}",',
    '"description": f"Atlas Auto · live research complete · {provider} / {model}{timing}",',
    1,
)

compile(patched, "<atlas-auto-v15>", "exec")
meta = row["meta"]
try:
    meta_obj = json.loads(meta) if isinstance(meta, str) and meta.strip() else {}
except Exception:
    meta_obj = {}
if not isinstance(meta_obj, dict):
    meta_obj = {}
meta_obj["atlas_auto_web_routing"] = "v1.5"
meta_obj["atlas_auto_performance_hardening"] = True
meta_obj["atlas_auto_web_routing_updated_at"] = int(time.time())

con.execute(
    "UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?",
    (patched, json.dumps(meta_obj, separators=(",", ":")), int(time.time()), FUNCTION_ID),
)
con.commit()
code = str(con.execute("SELECT content FROM function WHERE id=?", (FUNCTION_ID,)).fetchone()[0] or "")
for required in [
    MARKER,
    'default=3600',
    'default=32000',
    '"intelligenceMode": "god" if deep_search else "speed"',
    '"useXSearch": self._wants_x_search(body)',
    '"taskHint": "factual"',
    'unusable meta-output',
]:
    if required not in code:
        raise SystemExit(f"post-write verification failed: {required}")
print("patched=true")
print("atlas_auto_web_routing=v1.5_performance_hardened")
con.close()
