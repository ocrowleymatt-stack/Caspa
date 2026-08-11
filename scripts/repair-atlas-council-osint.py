#!/usr/bin/env python3
"""Patch the live OpenWebUI Atlas Council function to v3.9.4.

Runs inside the atlas-openwebui container. The script is deliberately
anchor-checked, syntax-checked, unit-tested and backed up before DB mutation.
"""

import json
import os
import re
import sqlite3
import time

DB = "/app/backend/data/webui.db"
BACKUP_DIR = "/app/backend/data/atlas-council-backups"
FUNCTION_ID = "atlas-council"

os.makedirs(BACKUP_DIR, exist_ok=True)
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
row = con.execute(
    "SELECT content, meta FROM function WHERE id=?", (FUNCTION_ID,)
).fetchone()
if not row:
    raise SystemExit("atlas-council function missing")

old = str(row["content"] or "")
if not old.strip():
    raise SystemExit("atlas-council function empty")

stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
backup = os.path.join(BACKUP_DIR, f"atlas-council-pre-v3.9.4-{stamp}.py")
with open(backup, "w", encoding="utf-8") as handle:
    handle.write(old)
print(f"backup={backup}")

if "Atlas Council v3.9.4" in old and "Council OSINT target unresolved — no broad search launched." in old:
    print("already_patched=v3.9.4")
    con.close()
    raise SystemExit(0)

new_extract = r'''    def _extract_osint_targets(self, question: str) -> list[tuple[str, str]]:
        q = question or ""
        found: list[tuple[str, str]] = []
        seen: set[tuple[str, str]] = set()

        def add(kind: str, value: str):
            cleaned = str(value or "").strip().strip(".,;:()[]{}<>\"'“”‘’")
            cleaned = re.sub(r"\s+", " ", cleaned).strip()
            key = (kind, cleaned.lower())
            if not cleaned or key in seen:
                return
            seen.add(key)
            found.append((kind, cleaned))

        for m in self._EMAIL_TARGET.finditer(q):
            add("email", m.group(1))
        for m in self._IPV4_TARGET.finditer(q):
            try:
                ipaddress.ip_address(m.group(1))
                add("ip", m.group(1))
            except ValueError:
                pass
        for m in self._DOMAIN_TARGET.finditer(q + " "):
            domain = m.group(1).rstrip(".")
            if "@" not in domain:
                add("domain", domain)
        for m in self._AT_USERNAME_TARGET.finditer(q):
            add("username", m.group(1))

        if found or not self._explicit_osint_requested(q):
            return found[: int(self.valves.MAX_ACTIVE_OSINT_TARGETS)]

        generic = {
            "this", "that", "the", "a", "an", "person", "people", "target", "targets",
            "domain", "website", "email", "username", "ip", "osint", "open", "source",
            "intelligence", "active", "recon", "reconnaissance", "digital", "internet",
            "public", "footprint", "search", "research", "deep", "deeply", "full", "fully",
            "thorough", "thoroughly", "find", "check", "verify", "trace", "profile", "scan",
            "identify", "investigate", "investigation", "look", "up", "on", "for", "into",
            "about", "of", "named", "called", "please", "everything", "connections",
        }

        def add_identity_candidate(value: str, *, allow_single: bool = False):
            candidate = re.sub(
                r"\s+", " ", str(value or "").strip().strip(" .,:;-—\"'“”‘’")
            ).strip()
            if not candidate:
                return
            candidate = re.split(
                r"\s+(?:then\s+)?(?:find|identify|map|show|tell|check|verify|investigate|research|explain|compare)\b",
                candidate,
                maxsplit=1,
                flags=re.I,
            )[0].strip()
            parts = [
                x.strip(" .,:;-—\"'“”‘’")
                for x in re.split(r"\s+(?:and|&)\s+|[,;/]+", candidate, flags=re.I)
                if x.strip(" .,:;-—\"'“”‘’")
            ]
            for part in parts:
                part = re.sub(
                    r"(?i)^(?:(?:please|deep(?:ly)?|full(?:y)?|thorough(?:ly)?|search|research|scan|profile|check|find|trace|identify|investigate|on|for|into|about|of|target|person|people|named|called)\s+)+",
                    "",
                    part,
                ).strip(" .,:;-—\"'“”‘’")
                words = part.split()
                if not part or len(part) > 80 or len(words) > 6:
                    continue
                if len(words) < 2 and not allow_single:
                    continue
                lowered = [re.sub(r"[^a-z0-9]+", "", w.lower()) for w in words]
                if lowered and all((not w) or w in generic for w in lowered):
                    continue
                if re.search(
                    r"(?i)\b(?:what|where|when|why|how|results?|sources?|links?|details?|background)\b",
                    part,
                ):
                    continue
                add("identity", part)

        # Quoted identities are a strong free-text target signal.
        for m in re.finditer(r"[\"“]([^\"”\n]{2,80})[\"”]", q):
            add_identity_candidate(m.group(1), allow_single=True)

        # Capture the tail following explicit OSINT/recon language. This handles
        # natural forms such as "deep OSINT into A and B" and lower-case names.
        if not found:
            m = re.search(
                r"(?is)\b(?:osint|open[- ]source intelligence|active osint|recon(?:naissance)?|digital footprint|internet footprint|public footprint)\b"
                r"(.{1,220}?)(?:[?\n]|$)",
                q,
            )
            if m:
                tail = re.sub(
                    r"(?i)^\s*(?:[:\-—]\s*)?(?:(?:please|deep(?:ly)?|full(?:y)?|thorough(?:ly)?|search|research|scan|profile|check|find|trace|identify|investigate|on|for|into|about|of|target|person|people|named|called)\s+){0,12}",
                    "",
                    m.group(1),
                )
                add_identity_candidate(tail, allow_single=True)

        # Final safety net when a title-cased name precedes the OSINT instruction,
        # e.g. "Alice Example — deep OSINT please".
        if not found:
            for m in re.finditer(
                r"\b([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,}(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'’\-]{1,}){1,4})\b",
                q,
            ):
                phrase = m.group(1)
                words = [re.sub(r"[^a-z0-9]+", "", w.lower()) for w in phrase.split()]
                if any(w in generic for w in words):
                    continue
                add_identity_candidate(phrase)

        return found[: int(self.valves.MAX_ACTIVE_OSINT_TARGETS)]
'''

extract_pattern = re.compile(
    r"    def _extract_osint_targets\(self, question: str\) -> list\[tuple\[str, str\]\]:\n.*?(?=    async def _public_network_target)",
    re.S,
)
# A callable replacement is essential here: new_extract deliberately contains
# regex escapes such as \s which must not be interpreted as re.sub template escapes.
patched, count = extract_pattern.subn(lambda _: new_extract + "\n", old, count=1)
if count != 1:
    raise SystemExit(f"target extractor anchor mismatch: {count}")

old_web = '''    async def _web_packet(self, question: str) -> str:\n        search_text = question[:420]\n        if self._explicit_osint_requested(question):\n            targets = self._extract_osint_targets(question)\n            if targets:\n                # Search the targets, not command adjectives such as "deep".  Quoted\n                # OR terms also stop a two-person request becoming one accidental name.\n                quoted = [f'"{value}"' for _, value in targets[:3]]\n                search_text = " OR ".join(quoted)[:420]\n        q = urllib.parse.urlencode({"q": search_text, "format": "json", "language": "all"})\n'''
new_web = '''    async def _web_packet(self, question: str) -> str:\n        search_text = question[:420]\n        if self._explicit_osint_requested(question):\n            targets = self._extract_osint_targets(question)\n            if not targets:\n                # Hard target lock: never turn an unbounded OSINT instruction into a generic query.\n                return "SELF-HOSTED PUBLIC WEB SEARCH: skipped — explicit OSINT requested but no bounded target was resolved."\n            quoted = [f'"{value}"' for _, value in targets[:3]]\n            search_text = " OR ".join(quoted)[:420]\n        q = urllib.parse.urlencode({"q": search_text, "format": "json", "language": "all"})\n'''
if old_web not in patched:
    raise SystemExit("web packet anchor mismatch")
patched = patched.replace(old_web, new_web, 1)

pipe_anchor = '''        osint_active = self._explicit_osint_requested(question)\n        await self._emit(__event_emitter__, f"Atlas Council v3.9.3 · {profile} · {len(specs)} independent examiners · {parallel} concurrent · staged Mistral Council · evidence → adversarial challenge → Chair · UK context")\n        if osint_active:\n            await self._emit(__event_emitter__, "Council · explicit OSINT request detected · multi-engine active OSINT fabric enabled · Big Brother + SpiderFoot + BBOT + enrichment lane…")\n        else:\n            await self._emit(__event_emitter__, "Council · gathering one bounded shared source packet · active reconnaissance off…")\n'''
pipe_new = '''        osint_active = self._explicit_osint_requested(question)\n        osint_targets = self._extract_osint_targets(question) if osint_active else []\n        await self._emit(__event_emitter__, f"Atlas Council v3.9.4 · {profile} · {len(specs)} independent examiners · {parallel} concurrent · target-locked OSINT · staged Mistral Council · UK context")\n        if osint_active:\n            if profile == "research" and not osint_targets:\n                answer = (\n                    "**Council OSINT target unresolved — no broad search launched.** Atlas detected an explicit OSINT request but could not safely isolate a person, domain, email, IP address or username from the task. "\n                    "To prevent unrelated discovery results and needless local-model load, Atlas stopped before web retrieval or Council inference."\n                    "\\n\\n**Council audit:** research profile · 0 bounded targets · target lock enforced · 0 model generations · no Chair decode."\n                )\n                await self._emit(__event_emitter__, "Atlas Council complete · OSINT target lock stopped unbounded search", done=True)\n                return answer\n            await self._emit(__event_emitter__, f"Council · explicit OSINT request detected · {len(osint_targets)} bounded target{'s' if len(osint_targets) != 1 else ''} locked · multi-engine fabric enabled…")\n        else:\n            await self._emit(__event_emitter__, "Council · gathering one bounded shared source packet · active reconnaissance off…")\n'''
if pipe_anchor not in patched:
    raise SystemExit("pipe target-lock anchor mismatch")
patched = patched.replace(pipe_anchor, pipe_new, 1)

fast_anchor = '''        if osint_active and profile == "research":\n            engine_brief = self._osint_deterministic_brief(evidence_packet)\n            if engine_brief:\n                sem = asyncio.Semaphore(1)\n                analyst_timeout = 12\n                await self._emit(__event_emitter__, "Council · OSINT engine quorum ready · one optional 12s analyst pass · no second seat/Chair")\n                analyst = await self._run_raw_worker(\n                    specs[0], question, evidence_packet, sem, __event_emitter__, case_scope, profile,\n                    timeout_override_s=analyst_timeout,\n                )\n                answer = self._osint_fast_result(evidence_packet, analyst if analyst.get("ok") else None) or engine_brief\n                elapsed = time.monotonic() - started\n                mode = "analyst+engine" if analyst.get("ok") else "engine-only"\n                await self._emit(__event_emitter__, f"Atlas Council complete · {elapsed:.0f}s · OSINT {mode} fast quorum", done=True)\n                return answer\n'''
fast_new = fast_anchor + '''\n            # A bounded OSINT request stays on the engine-led path even when its\n            # initial packet is incomplete. Never fall through to two seats + Chair.\n            bounded = (evidence_packet or "").strip()[:3200]\n            answer = (\n                "**Council OSINT collection incomplete — bounded fail-soft returned.** Atlas locked the requested target(s), but no readable engine quorum was available in the initial collection window. "\n                "It did not substitute a generic search and did not queue a second local examiner or Chair decode."\n                + (("\\n\\n" + bounded) if bounded else "")\n                + "\\n\\n**Council audit:** research profile · target lock active · engine quorum incomplete · 0 additional model generations · no Chair decode."\n            )\n            elapsed = time.monotonic() - started\n            await self._emit(__event_emitter__, f"Atlas Council complete · {elapsed:.0f}s · bounded OSINT fail-soft", done=True)\n            return answer\n'''
if fast_anchor not in patched:
    raise SystemExit("OSINT fast-path anchor mismatch")
patched = patched.replace(fast_anchor, fast_new, 1)

compile(patched, "<atlas-council-v3.9.4>", "exec")
namespace = {}
exec(compile(patched, "<atlas-council-v3.9.4>", "exec"), namespace)
pipe = namespace["Pipe"]()

cases = {
    "Deep OSINT on Alice Example and Bob Sample": {"alice example", "bob sample"},
    "Alice Example — deep OSINT please": {"alice example"},
    "Run active OSINT research for alice example and bob sample": {"alice example", "bob sample"},
}
for prompt, expected in cases.items():
    got = {
        value.lower()
        for kind, value in pipe._extract_osint_targets(prompt)
        if kind == "identity"
    }
    if not expected.issubset(got):
        raise AssertionError(
            f"target parser failed: expected={sorted(expected)} got={sorted(got)}"
        )
if pipe._extract_osint_targets("Deep OSINT"):
    raise AssertionError("unbounded OSINT prompt unexpectedly produced a target")
print("target_parser_tests=PASS")

required_markers = (
    "Atlas Council v3.9.4",
    "Council OSINT target unresolved — no broad search launched.",
    "SELF-HOSTED PUBLIC WEB SEARCH: skipped — explicit OSINT requested but no bounded target was resolved.",
    "Never fall through to two seats + Chair.",
)
for marker in required_markers:
    if marker not in patched:
        raise AssertionError(f"missing invariant marker: {marker}")

try:
    meta = json.loads(row["meta"] or "{}")
except Exception:
    meta = {}
meta["description"] = (
    "Council v3.9.4: hard OSINT target lock, target-only web retrieval, engine-led "
    "quorum and at most one optional bounded analyst; explicit research OSINT never "
    "falls through to a second seat or Chair."
)

con.execute(
    "UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?",
    (patched, json.dumps(meta, ensure_ascii=False), int(time.time()), FUNCTION_ID),
)
con.commit()
con.close()
print("db_update=PASS")
