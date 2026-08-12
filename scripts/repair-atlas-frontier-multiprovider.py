#!/usr/bin/env python3
"""Replace the live OpenWebUI atlas-frontier-failover pipe with a Venice-primary
multi-provider bridge to Atlas's internal canonical router.

The public manifold IDs remain unchanged so all existing Atlas custom model
records continue to work. Local Qwen remains the final fail-soft only after the
canonical Venice/Grok/Gemini/OpenAI/Claude router is exhausted.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time

DB = "/app/backend/data/webui.db"
FUNCTION_ID = "atlas-frontier-failover"
MARKER = "ATLAS MULTI-PROVIDER FRONTIER v2.2"
BACKUP_DIR = "/app/backend/data/atlas-function-backups"

NEW_CODE = r'''"""
title: Atlas Frontier Multi-Provider
author: Atlas
version: 2.2.0
description: Multi-provider Atlas frontier bridge with mandatory provider-native live search whenever web retrieval is requested and local Qwen as final fail-soft.
"""

from __future__ import annotations

import copy
import json
from typing import Any

import httpx
from fastapi import Request
from pydantic import BaseModel, Field

from open_webui.models.users import Users
from open_webui.utils.chat import generate_chat_completion

# ATLAS MULTI-PROVIDER FRONTIER v2.2
# ATLAS RESEARCH WEB EXECUTION v1

class Pipe:
    class Valves(BaseModel):
        ROUTER_URL: str = Field(default="http://172.19.0.1:3014/api/ai/call")
        PRIMARY_PROVIDER: str = Field(default="venice")
        LOCAL_FALLBACK_MODEL: str = Field(default="atlas-local")
        QUALITY_LOCAL_FALLBACK_MODEL: str = Field(default="atlas-god-mode")
        SPEED_TIMEOUT_S: int = Field(default=75, ge=20, le=240)
        BALANCED_TIMEOUT_S: int = Field(default=150, ge=30, le=300)
        GOD_TIMEOUT_S: int = Field(default=240, ge=45, le=420)
        SHOW_ROUTE_STATUS: bool = Field(default=True)

    def __init__(self):
        self.valves = self.Valves()

    def pipes(self):
        return [
            {"id": "gpt-5.6-luna", "name": "Atlas Luna · multi-provider"},
            {"id": "gpt-5.6-terra", "name": "Atlas Terra · multi-provider"},
            {"id": "gpt-5.6-sol", "name": "Atlas Sol · multi-provider"},
        ]

    @staticmethod
    def _selected_model(body: dict) -> str:
        raw = str(body.get("model") or "").lower()
        for model in ("gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"):
            if model in raw:
                return model
        return "gpt-5.6-luna"

    @staticmethod
    def _content_text(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            parts = []
            for item in value:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    text = item.get("text") or item.get("content")
                    if isinstance(text, str):
                        parts.append(text)
                    elif text is not None:
                        parts.append(str(text))
            return "\n".join(parts)
        try:
            return json.dumps(value, ensure_ascii=False, default=str)
        except Exception:
            return str(value)

    @classmethod
    def _prompt(cls, body: dict) -> str:
        messages = body.get("messages") if isinstance(body.get("messages"), list) else []
        blocks = []
        system_blocks = []
        for message in messages:
            if not isinstance(message, dict):
                continue
            role = str(message.get("role") or "message").upper()
            text = cls._content_text(message.get("content")).strip()
            if not text:
                continue
            block = f"[{role}]\n{text}"
            blocks.append(block)
            if role in {"SYSTEM", "DEVELOPER"}:
                system_blocks.append(block)
        transcript = "\n\n".join(blocks)
        if len(transcript) <= 110000:
            return transcript
        # Preserve governing context plus the newest evidence/conversation material.
        head = "\n\n".join(system_blocks)[:18000]
        tail = transcript[-90000:]
        return (head + "\n\n[... older conversational material trimmed ...]\n\n" + tail).strip()

    @staticmethod
    def _json_requested(body: dict) -> bool:
        rf = body.get("response_format")
        if isinstance(rf, dict) and str(rf.get("type") or "").lower() in {"json_object", "json_schema"}:
            return True
        return bool(body.get("json"))

    @staticmethod
    def _max_tokens(body: dict, selected: str) -> int:
        for key in ("max_tokens", "max_completion_tokens"):
            try:
                value = int(body.get(key) or 0)
                if value > 0:
                    return max(64, min(value, 16000))
            except Exception:
                pass
        return 3072 if selected.endswith("luna") else 6144 if selected.endswith("terra") else 10000

    @staticmethod
    def _mode(selected: str) -> str:
        if selected.endswith("sol"):
            return "god"
        if selected.endswith("terra"):
            return "balanced"
        return "speed"

    def _timeout(self, selected: str) -> int:
        if selected.endswith("sol"):
            return int(self.valves.GOD_TIMEOUT_S)
        if selected.endswith("terra"):
            return int(self.valves.BALANCED_TIMEOUT_S)
        return int(self.valves.SPEED_TIMEOUT_S)

    def _fallback_model(self, selected: str) -> str:
        return self.valves.QUALITY_LOCAL_FALLBACK_MODEL if selected in {"gpt-5.6-terra", "gpt-5.6-sol"} else self.valves.LOCAL_FALLBACK_MODEL

    async def _emit(self, emitter, description: str):
        if self.valves.SHOW_ROUTE_STATUS and emitter is not None:
            await emitter({"type": "status", "data": {"description": description, "done": False}})

    async def _fallback(self, body: dict, user, request: Request, emitter, reason: str, selected: str):
        fallback = self._fallback_model(selected)
        await self._emit(emitter, f"Atlas multi-provider cloud lanes unavailable ({reason}); using {fallback} as final fail-soft")
        forwarded = copy.deepcopy(body)
        forwarded["model"] = fallback
        forwarded.pop("reasoning", None)
        forwarded.pop("reasoning_effort", None)
        return await generate_chat_completion(
            request,
            forwarded,
            user,
            bypass_filter=False,
            bypass_system_prompt=False,
        )

    async def pipe(
        self,
        body: dict,
        __user__: dict,
        __request__: Request,
        __event_emitter__=None,
    ):
        user_id = (__user__ or {}).get("id")
        if not user_id:
            raise ValueError("Atlas Frontier Multi-Provider could not resolve the current user.")
        user = await Users.get_user_by_id(user_id)
        if user is None:
            raise ValueError("Atlas Frontier Multi-Provider could not load the current user.")

        selected = self._selected_model(body)
        mode = self._mode(selected)
        features = body.get("features") if isinstance(body.get("features"), dict) else {}
        use_web = bool(features.get("web_search"))
        # ATLAS RESEARCH WEB EXECUTION v1
        # Do not assume OpenWebUI retrieval has already executed. A requested web
        # search must reach AtlasRouter, whose capability gate restricts execution
        # to Venice/Grok/Gemini. This makes Terra/Research genuinely live as well
        # as Sol/Deep Research.
        provider_web = bool(use_web)
        prompt = self._prompt(body)
        if use_web:
            prompt = (
                "[ATLAS LIVE-RETRIEVAL CONTRACT]\n"
                "Current/public-source web retrieval is required for this request. "
                "Use the provider-native search path and base material claims on retrieved sources. "
                "Do not claim that web/OSINT tools are unavailable merely because unrelated tool schemas are present. "
                "If retrieval itself fails, state that as an execution failure rather than substituting model memory.\n\n"
                + prompt
            )
        if not prompt:
            raise ValueError("Atlas Frontier Multi-Provider received no usable prompt content.")

        await self._emit(
            __event_emitter__,
            f"Atlas {selected.rsplit('-', 1)[-1].title()} · Venice primary · multi-provider failover" + (" · live retrieval" if use_web else "") + (" · provider live search" if provider_web else ""),
        )

        payload = {
            "prompt": prompt,
            "intelligenceMode": mode,
            "maxTokens": self._max_tokens(body, selected),
            "primaryProvider": self.valves.PRIMARY_PROVIDER,
            "useWebSearch": provider_web,
            "json": self._json_requested(body),
        }
        timeout = self._timeout(selected)
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(float(timeout)), trust_env=False) as client:
                response = await client.post(self.valves.ROUTER_URL, json=payload)
            raw = response.text
            if response.status_code < 200 or response.status_code >= 300:
                raise RuntimeError(f"router HTTP {response.status_code}: {raw[:400]}")
            data = response.json()
            text = str(data.get("result") or "").strip()
            if not text:
                raise RuntimeError("canonical router returned empty result")
            provider = str(data.get("provider") or "unknown")
            model = str(data.get("model") or "unknown")
            await self._emit(__event_emitter__, f"Atlas cloud route · {provider}/{model}")
            return text
        except Exception as exc:
            return await self._fallback(
                body,
                user,
                __request__,
                __event_emitter__,
                f"{type(exc).__name__}: {str(exc)[:220]}",
                selected,
            )
'''

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
backup = os.path.join(BACKUP_DIR, f"{FUNCTION_ID}-pre-multiprovider-{stamp}.py")
with open(backup, "w", encoding="utf-8") as fh:
    fh.write(old)
print(f"backup={backup}")

# Compile before touching the live database.
compile(NEW_CODE, f"<{FUNCTION_ID}>", "exec")
meta = row["meta"]
try:
    meta_obj = json.loads(meta) if isinstance(meta, str) and meta.strip() else {}
except Exception:
    meta_obj = {}
if not isinstance(meta_obj, dict):
    meta_obj = {}
meta_obj["atlas_multi_provider_frontier"] = "v2.2"
meta_obj["atlas_research_web_execution"] = "v1"
meta_obj["atlas_multi_provider_updated_at"] = int(time.time())

con.execute(
    "UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?",
    (NEW_CODE, json.dumps(meta_obj, separators=(",", ":")), int(time.time()), FUNCTION_ID),
)
con.commit()
verify = con.execute("SELECT content FROM function WHERE id=?", (FUNCTION_ID,)).fetchone()
code = str(verify[0] or "")
assert MARKER in code
assert 'PRIMARY_PROVIDER: str = Field(default="venice")' in code
assert 'ATLAS RESEARCH WEB EXECUTION v1' in code
assert 'provider_web = bool(use_web)' in code
assert 'provider_web = bool(use_web and selected.endswith("sol"))' not in code
assert 'ROUTER_URL: str = Field(default="http://172.19.0.1:3014/api/ai/call")' in code
print("patched=true")
print("marker=true")
print("venice_primary=true")
print("canonical_router_bridge=true")
con.close()
