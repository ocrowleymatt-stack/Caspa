#!/usr/bin/env python3
"""Make live Atlas Auto reliably web-aware without recursive custom-model routing.

Ordinary requests remain local-first through OpenWebUI. Explicit web/OSINT/current
requests call AtlasRouter directly, avoiding the fragile Auto -> atlas-research ->
frontier recursive generate_chat_completion path that could consume the answer as
reasoning and finish with no substantive output.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time

DB = "/app/backend/data/webui.db"
FUNCTION_ID = "atlas-auto"
MARKER = "ATLAS AUTO DIRECT WEB ROUTING v1.4"
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
if "ATLAS AUTO WEB-AWARE ROUTING v1.3" not in old:
    raise SystemExit("expected Atlas Auto v1.3 live source was not found")

stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
backup = os.path.join(BACKUP_DIR, f"{FUNCTION_ID}-pre-direct-web-{stamp}.py")
with open(backup, "w", encoding="utf-8") as fh:
    fh.write(old)
print(f"backup={backup}")

patched = old
patched = patched.replace("version: 1.3.0", "version: 1.4.0", 1)
patched = patched.replace(
    "description: Local-first Atlas routing with mandatory research escalation for explicit web, OSINT and current-information requests.",
    "description: Local-first Atlas routing with direct AtlasRouter execution for explicit web, OSINT and current-information requests.",
    1,
)
patched = patched.replace("import re\n", "import re\nimport json\nimport httpx\n", 1)
patched = patched.replace(
    "        # ATLAS AUTO WEB-AWARE ROUTING v1.3\n",
    "        # ATLAS AUTO WEB-AWARE ROUTING v1.3\n        # ATLAS AUTO DIRECT WEB ROUTING v1.4\n",
    1,
)

valve_anchor = '''        DEEP_SEARCH_MODEL: str = Field(\n            default="atlas-deep-research",\n            description="Maximum research model used for explicit deep/exhaustive web or OSINT requests.",\n        )\n'''
valve_extra = valve_anchor + '''        ROUTER_URL: str = Field(\n            default="http://172.19.0.1:3014/api/ai/call",\n            description="Internal AtlasRouter endpoint used for direct live research execution.",\n        )\n        WEB_PRIMARY_PROVIDER: str = Field(\n            default="grok",\n            description="Current preferred live-search provider; AtlasRouter retains provider failover.",\n        )\n        WEB_TIMEOUT_S: int = Field(default=150, ge=30, le=300)\n        DEEP_WEB_TIMEOUT_S: int = Field(default=240, ge=60, le=420)\n'''
if valve_anchor not in patched:
    raise SystemExit("Atlas Auto deep-search valve anchor not found")
patched = patched.replace(valve_anchor, valve_extra, 1)

method_anchor = '''        return self.valves.DEFAULT_MODEL, "general local analysis"\n\n    async def pipe(\n'''
method_replacement = '''        return self.valves.DEFAULT_MODEL, "general local analysis"\n\n    def _router_prompt(self, body: dict) -> str:\n        blocks: list[str] = []\n        for message in body.get("messages") or []:\n            if not isinstance(message, dict):\n                continue\n            role = str(message.get("role") or "message").upper()\n            text = self._text_from_content(message.get("content")).strip()\n            if text:\n                blocks.append(f"[{role}]\\n{text}")\n        transcript = "\\n\\n".join(blocks)\n        if len(transcript) > 100000:\n            transcript = transcript[-100000:]\n        contract = (\n            "[ATLAS AUTO LIVE-RESEARCH CONTRACT]\\n"\n            "Execute current public-web research now rather than describing how one might search. "\n            "Use British English. Prefer primary/authoritative sources where available, cite retrieved URLs, "\n            "cross-check identities and distinguish confirmed matches, plausible joins, collisions and unsupported claims. "\n            "For OSINT, synthesise the retrieved evidence into a useful narrative rather than returning a search plan. "\n            "Do not claim web tools are unavailable if live retrieval succeeds.\\n\\n"\n        )\n        return contract + transcript\n\n    async def pipe(\n'''
if method_anchor not in patched:
    raise SystemExit("Atlas Auto method anchor not found")
patched = patched.replace(method_anchor, method_replacement, 1)

old_tail = '''        # The Qwen3 local fleet supports native function calling. Preserve live\n        # chat/model tool state so Atlas Shared Knowledge and Evidence Graph can\n        # be used after routing. This intentionally replaces the v1.1 emergency\n        # boundary that stripped tools for llama3:latest/mistral:latest.\n        forwarded = dict(body)\n        forwarded["model"] = target\n        if web_search:\n            routed_features = dict(features)\n            routed_features["web_search"] = True\n            forwarded["features"] = routed_features\n\n        if self.valves.SHOW_ROUTE_STATUS and __event_emitter__ is not None:\n            await __event_emitter__(\n                {\n                    "type": "status",\n                    "data": {\n                        "description": (\n                            f"Atlas Auto → {target} ({reason}; {'live retrieval requested' if web_search else 'local'})"\n                        ),\n                        "done": False,\n                    },\n                }\n            )\n\n        # Ordinary Auto remains local-first. Explicit research intent is deliberately\n        # escalated so Atlas never answers a live-search request from an offline model.\n        return await generate_chat_completion(\n            __request__,\n            forwarded,\n            user,\n            bypass_filter=False,\n            bypass_system_prompt=False,\n        )\n'''
new_tail = '''        # ATLAS AUTO DIRECT WEB ROUTING v1.4\n        # Web/OSINT requests do not recurse through another OpenWebUI custom model.\n        # They execute directly against AtlasRouter and return its substantive result\n        # string to the chat. This prevents nested pipe/reasoning streams from being\n        # marked complete before the research answer reaches the user.\n        if web_search:\n            if self.valves.SHOW_ROUTE_STATUS and __event_emitter__ is not None:\n                await __event_emitter__({\n                    "type": "status",\n                    "data": {\n                        "description": f"Atlas Auto → AtlasRouter ({reason}; direct live retrieval)",\n                        "done": False,\n                    },\n                })\n            payload = {\n                "prompt": self._router_prompt(body),\n                "intelligenceMode": "god" if deep_search else "balanced",\n                "maxTokens": 10000 if deep_search else 6500,\n                "primaryProvider": self.valves.WEB_PRIMARY_PROVIDER,\n                "useWebSearch": True,\n                "json": False,\n            }\n            timeout_s = self.valves.DEEP_WEB_TIMEOUT_S if deep_search else self.valves.WEB_TIMEOUT_S\n            try:\n                async with httpx.AsyncClient(timeout=httpx.Timeout(float(timeout_s)), trust_env=False) as client:\n                    response = await client.post(self.valves.ROUTER_URL, json=payload)\n            except Exception as exc:\n                raise RuntimeError(f"Atlas live research transport failed: {type(exc).__name__}: {exc}") from exc\n            if response.status_code < 200 or response.status_code >= 300:\n                raise RuntimeError(f"Atlas live research returned HTTP {response.status_code}: {response.text[:800]}")\n            try:\n                data = response.json()\n            except Exception as exc:\n                raise RuntimeError(f"Atlas live research returned invalid JSON: {response.text[:800]}") from exc\n            result = str(data.get("result") or "").strip() if isinstance(data, dict) else ""\n            if not result:\n                raise RuntimeError(f"Atlas live research returned no substantive result: {str(data)[:1000]}")\n            if self.valves.SHOW_ROUTE_STATUS and __event_emitter__ is not None:\n                provider = str(data.get("provider") or "provider")\n                model = str(data.get("model") or "model")\n                await __event_emitter__({\n                    "type": "status",\n                    "data": {\n                        "description": f"Atlas Auto · live research complete · {provider} / {model}",\n                        "done": True,\n                    },\n                })\n            return result\n\n        # Ordinary Auto remains local-first and preserves OpenWebUI-native tool state.\n        forwarded = dict(body)\n        forwarded["model"] = target\n        if self.valves.SHOW_ROUTE_STATUS and __event_emitter__ is not None:\n            await __event_emitter__({\n                "type": "status",\n                "data": {\n                    "description": f"Atlas Auto → {target} ({reason}; local)",\n                    "done": False,\n                },\n            })\n        return await generate_chat_completion(\n            __request__,\n            forwarded,\n            user,\n            bypass_filter=False,\n            bypass_system_prompt=False,\n        )\n'''
if old_tail not in patched:
    raise SystemExit("Atlas Auto recursive forwarding block not found")
patched = patched.replace(old_tail, new_tail, 1)

compile(patched, "<atlas-auto>", "exec")
meta = row["meta"]
try:
    meta_obj = json.loads(meta) if isinstance(meta, str) and meta.strip() else {}
except Exception:
    meta_obj = {}
if not isinstance(meta_obj, dict):
    meta_obj = {}
meta_obj["atlas_auto_web_routing"] = "v1.4"
meta_obj["atlas_auto_direct_web"] = True
meta_obj["atlas_auto_web_routing_updated_at"] = int(time.time())

con.execute(
    "UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?",
    (patched, json.dumps(meta_obj, separators=(",", ":")), int(time.time()), FUNCTION_ID),
)
con.commit()
code = str(con.execute("SELECT content FROM function WHERE id=?", (FUNCTION_ID,)).fetchone()[0] or "")
for required in [
    MARKER,
    'default="http://172.19.0.1:3014/api/ai/call"',
    'default="grok"',
    '"useWebSearch": True',
    'return result',
    'direct live retrieval',
]:
    if required not in code:
        raise SystemExit(f"post-write verification failed: {required}")
if 'forwarded["model"] = target\n        if web_search:' in code:
    raise SystemExit("recursive web forwarding pattern still present")
print("patched=true")
print("atlas_auto_web_routing=v1.4_direct_router")
con.close()
