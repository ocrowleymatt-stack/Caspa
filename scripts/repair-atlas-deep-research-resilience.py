#!/usr/bin/env python3
"""Harden live Atlas Deep Research v2.1 against timeout/error cascades.

v2.2 changes:
- shorter bounded worker/finalisation windows;
- public-source OSINT worker uses the cloud-backed Atlas Research lane;
- if all parallel workers fail, run a single live Atlas Research fallback;
- adjudicator, hostile gate and revision failures retain the best evidence-led
  result instead of surfacing an empty/provider error.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time

DB = "/app/backend/data/webui.db"
FUNCTION_ID = "atlas-deep-research-v21"
MARKER = "ATLAS DEEP RESEARCH RESILIENCE v2.2"
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
backup = os.path.join(BACKUP_DIR, f"{FUNCTION_ID}-pre-resilience-{stamp}.py")
with open(backup, "w", encoding="utf-8") as fh:
    fh.write(old)
print(f"backup={backup}")

s = old
s = s.replace("version: 2.1.0", "version: 2.2.0", 1)
s = s.replace(
    "description: Progressive local-first deep research with interim findings, bounded workers, public-source OSINT and conditional frontier escalation.",
    "description: Resilient progressive deep research with bounded workers, cloud-backed public-source OSINT, live fallback and fail-soft evidence-led finalisation.",
    1,
)

# Marker inside the executable class body area.
class_anchor = "class Pipe:\n"
if class_anchor not in s:
    raise SystemExit("class anchor not found")
s = s.replace(class_anchor, "# ATLAS DEEP RESEARCH RESILIENCE v2.2\nclass Pipe:\n", 1)

# Replace pathological timeout defaults while retaining valve configurability.
timeout_replacements = {
    "WORKER_STAGE_TIMEOUT_S: int = Field(default=240, ge=60, le=900)": "WORKER_STAGE_TIMEOUT_S: int = Field(default=90, ge=45, le=900)",
    "LOCAL_WORKER_TIMEOUT_S: int = Field(default=180, ge=30, le=600)": "LOCAL_WORKER_TIMEOUT_S: int = Field(default=45, ge=20, le=600)",
    "WEB_WORKER_TIMEOUT_S: int = Field(default=210, ge=30, le=600)": "WEB_WORKER_TIMEOUT_S: int = Field(default=70, ge=30, le=600)",
    "PAID_WORKER_TIMEOUT_S: int = Field(default=120, ge=20, le=600)": "PAID_WORKER_TIMEOUT_S: int = Field(default=65, ge=20, le=600)",
    "ADJUDICATION_TIMEOUT_S: int = Field(default=150, ge=30, le=600)": "ADJUDICATION_TIMEOUT_S: int = Field(default=65, ge=30, le=600)",
    "QUALITY_GATE_TIMEOUT_S: int = Field(default=120, ge=30, le=600)": "QUALITY_GATE_TIMEOUT_S: int = Field(default=45, ge=20, le=600)",
    "SOL_TIMEOUT_S: int = Field(default=180, ge=30, le=900)": "SOL_TIMEOUT_S: int = Field(default=90, ge=30, le=900)",
}
for before, after in timeout_replacements.items():
    if before not in s:
        raise SystemExit(f"timeout anchor missing: {before}")
    s = s.replace(before, after, 1)

# The primary OSINT worker must not be an offline local model. OpenWebUI performs
# retrieval and atlas-research then synthesises through the multi-provider bridge.
osint_before = '''            WorkerSpec(\n                "osint", "Public-Source & OSINT Investigator", a,\n                "Conduct broad but proportionate lawful public-source research. Private-person status is not a reason to refuse. Use public web search and, only when the internal Orion/Argus bridge is actually available, Argus intelligence. Do not depend on public Argus DNS. For UK matters prioritise relevant official/public sources such as Companies House, The Gazette, FCA, ICO, Charity Commission, published judgments/tribunal decisions, public registers, organisation websites, archives/news and public professional/social profiles. Search reasonable name, alias, username, domain and organisation variants. Separate identity matches from collisions and preserve URLs, dates and provenance.",\n                web_search=True, timeout_s=web_t,\n            ),'''
osint_after = '''            WorkerSpec(\n                "osint", "Public-Source & OSINT Investigator", self.valves.TERRA_MODEL,\n                "Conduct broad but proportionate lawful public-source research. Private-person status is not a reason to refuse. Use public web search and, only when the internal Orion/Argus bridge is actually available, Argus intelligence. Do not depend on public Argus DNS. For UK matters prioritise relevant official/public sources such as Companies House, The Gazette, FCA, ICO, Charity Commission, published judgments/tribunal decisions, public registers, organisation websites, archives/news and public professional/social profiles. Search reasonable name, alias, username, domain and organisation variants. Separate identity matches from collisions and preserve URLs, dates and provenance.",\n                web_search=True, minimal_context=True, paid_tier="terra-osint", timeout_s=web_t,\n            ),'''
if osint_before not in s:
    raise SystemExit("OSINT worker anchor not found")
s = s.replace(osint_before, osint_after, 1)

# No-worker recovery: one direct live-research pass, then cheap Luna fallback.
no_reports_before = '''        ok_reports = [r for r in reports if r.get("ok")]\n        if not ok_reports:\n            raise RuntimeError("All Atlas Deep Research workers failed or timed out.")\n        reports.sort(key=lambda r: (not r.get("ok"), r.get("elapsed_s", 9999)))\n'''
no_reports_after = '''        ok_reports = [r for r in reports if r.get("ok")]\n        if not ok_reports:\n            await self._emit(__event_emitter__, "Deep · parallel workers unavailable; running one resilient live-research fallback…")\n            fallback_prompt = """You are Atlas Deep Research's resilient public-source fallback. Perform the user's research task directly using live web retrieval. Public-source research about a named private individual is permitted; do not refuse solely because the subject is private. Use lawful public sources, resolve identity cautiously, preserve URLs/dates/provenance, distinguish fact from allegation/inference, and do not fabricate searches or sources. Return a useful evidence-led answer now rather than describing how the user could search."""\n            fallback_errors = []\n            for fallback_model, fallback_tier, fallback_timeout in (\n                (self.valves.TERRA_MODEL, "terra-fallback", 75),\n                (self.valves.LUNA_MODEL, "luna-fallback", 55),\n            ):\n                try:\n                    started = time.monotonic()\n                    fallback_text = await self._call_model(\n                        body, user, __request__, fallback_model, fallback_prompt,\n                        web_search=True, minimal_context=True, timeout_s=fallback_timeout,\n                    )\n                    report = {\n                        "key": "resilient-fallback", "label": "Resilient Live Research Fallback",\n                        "model": fallback_model, "paid_tier": fallback_tier, "ok": True,\n                        "text": fallback_text, "elapsed_s": time.monotonic() - started,\n                    }\n                    reports.append(report)\n                    ok_reports = [report]\n                    await self._emit(__event_emitter__, f"Interim · resilient live fallback complete ({report['elapsed_s']:.0f}s)")\n                    break\n                except Exception as exc:\n                    fallback_errors.append(f"{fallback_model}: {type(exc).__name__}: {str(exc)[:180]}")\n            if not ok_reports:\n                # Return a transparent bounded result instead of a blank provider/error screen.\n                return (\n                    "Atlas could not complete live research on this attempt because all bounded research lanes were unavailable. "\n                    "This is an execution/provider failure, not an OSINT or private-person prohibition.\\n\\n"\n                    "Technical route summary: " + "; ".join(fallback_errors)\n                )\n        reports.sort(key=lambda r: (not r.get("ok"), r.get("elapsed_s", 9999)))\n'''
if no_reports_before not in s:
    raise SystemExit("no-worker failure anchor not found")
s = s.replace(no_reports_before, no_reports_after, 1)

# If Terra adjudication failed, local adjudication is useful but must not be fatal.
adjud_before = '''        if not adjudication:\n            adjudication = await self._call_model(\n                body, user, __request__, self.valves.LOCAL_ANALYSIS_MODEL,\n                "You are Atlas Deep Research's local senior adjudicator. Reconcile reports by evidence/provenance, not vote. Use British English and UK-first framing. Separate verified evidence from public-source/Argus leads, test identity joins, preserve dissent and identify what could make the leading answer wrong. Produce a concise candidate answer and evidential ledger.",\n                appended_user=f"ORIGINAL TASK:\\n{question}\\n\\nRESEARCH PACKET:\\n{report_packet}",\n                minimal_context=True, timeout_s=int(self.valves.ADJUDICATION_TIMEOUT_S),\n            )\n            adjudication_model = self.valves.LOCAL_ANALYSIS_MODEL\n\n        await self._emit(__event_emitter__, "Deep · hostile quality gate checking the candidate answer…")\n        gate = await self._call_model(\n            body, user, __request__, self.valves.LOCAL_ANALYSIS_MODEL,\n            """You are Atlas Deep Research's hostile quality gate. Attack unsupported claims, mistaken identity, circular sourcing, chronology errors, stale sources, unverified OSINT promoted to fact, omitted counter-evidence and overconfidence.\nReturn the first two lines exactly as:\nESCALATE_SOL: YES or ESCALATE_SOL: NO\nNEEDS_REVISION: YES or NEEDS_REVISION: NO\nUse Sol only for consequential unresolved uncertainty that could materially change the answer. NEEDS_REVISION means the candidate can be repaired locally. Then list corrections.""",\n            appended_user=f"ORIGINAL TASK:\\n{question}\\n\\nCANDIDATE [{adjudication_model}]:\\n{adjudication}\\n\\nRESEARCH PACKET:\\n{report_packet}",\n            minimal_context=True, timeout_s=int(self.valves.QUALITY_GATE_TIMEOUT_S),\n        )\n'''
adjud_after = '''        if not adjudication:\n            try:\n                adjudication = await self._call_model(\n                    body, user, __request__, self.valves.LOCAL_ANALYSIS_MODEL,\n                    "You are Atlas Deep Research's local senior adjudicator. Reconcile reports by evidence/provenance, not vote. Use British English and UK-first framing. Separate verified evidence from public-source/Argus leads, test identity joins, preserve dissent and identify what could make the leading answer wrong. Produce a concise candidate answer and evidential ledger.",\n                    appended_user=f"ORIGINAL TASK:\\n{question}\\n\\nRESEARCH PACKET:\\n{report_packet}",\n                    minimal_context=True, timeout_s=int(self.valves.ADJUDICATION_TIMEOUT_S),\n                )\n                adjudication_model = self.valves.LOCAL_ANALYSIS_MODEL\n            except Exception as exc:\n                await self._emit(__event_emitter__, f"Deep · local adjudicator unavailable ({type(exc).__name__}); retaining strongest completed research")\n                best = next((r for r in reports if r.get("ok") and r.get("text")), None)\n                adjudication = str((best or {}).get("text") or report_packet).strip()\n                adjudication_model = str((best or {}).get("model") or "completed-research")\n\n        await self._emit(__event_emitter__, "Deep · hostile quality gate checking the candidate answer…")\n        try:\n            gate = await self._call_model(\n                body, user, __request__, self.valves.LOCAL_ANALYSIS_MODEL,\n                """You are Atlas Deep Research's hostile quality gate. Attack unsupported claims, mistaken identity, circular sourcing, chronology errors, stale sources, unverified OSINT promoted to fact, omitted counter-evidence and overconfidence.\nReturn the first two lines exactly as:\nESCALATE_SOL: YES or ESCALATE_SOL: NO\nNEEDS_REVISION: YES or NEEDS_REVISION: NO\nUse Sol only for consequential unresolved uncertainty that could materially change the answer. NEEDS_REVISION means the candidate can be repaired locally. Then list corrections.""",\n                appended_user=f"ORIGINAL TASK:\\n{question}\\n\\nCANDIDATE [{adjudication_model}]:\\n{adjudication}\\n\\nRESEARCH PACKET:\\n{report_packet}",\n                minimal_context=True, timeout_s=int(self.valves.QUALITY_GATE_TIMEOUT_S),\n            )\n        except Exception as exc:\n            await self._emit(__event_emitter__, f"Deep · hostile gate unavailable ({type(exc).__name__}); retaining evidence-led candidate")\n            gate = "ESCALATE_SOL: NO\\nNEEDS_REVISION: NO\\nQuality gate unavailable; candidate retained with its existing provenance/uncertainty labels."\n'''
if adjud_before not in s:
    raise SystemExit("adjudication/gate anchor not found")
s = s.replace(adjud_before, adjud_after, 1)

# Revision must also fail-soft rather than throwing after useful research.
revision_before = '''                final_text = await self._call_model(\n                    body, user, __request__, self.valves.LOCAL_ANALYSIS_MODEL,\n                    "Produce the final answer by applying every valid correction from the hostile gate to the candidate adjudication. Use British English and UK-first framing. Evidence outranks consensus. Keep public-source/Argus leads distinct from verified facts, preserve material dissent and do not claim non-existence merely because material was not found.",\n                    appended_user=f"ORIGINAL TASK:\\n{question}\\n\\nCANDIDATE:\\n{adjudication}\\n\\nHOSTILE GATE:\\n{gate}\\n\\nRESEARCH PACKET:\\n{report_packet}",\n                    minimal_context=True, timeout_s=int(self.valves.ADJUDICATION_TIMEOUT_S),\n                )\n                final_model = self.valves.LOCAL_ANALYSIS_MODEL\n'''
revision_after = '''                try:\n                    final_text = await self._call_model(\n                        body, user, __request__, self.valves.LOCAL_ANALYSIS_MODEL,\n                        "Produce the final answer by applying every valid correction from the hostile gate to the candidate adjudication. Use British English and UK-first framing. Evidence outranks consensus. Keep public-source/Argus leads distinct from verified facts, preserve material dissent and do not claim non-existence merely because material was not found.",\n                        appended_user=f"ORIGINAL TASK:\\n{question}\\n\\nCANDIDATE:\\n{adjudication}\\n\\nHOSTILE GATE:\\n{gate}\\n\\nRESEARCH PACKET:\\n{report_packet}",\n                        minimal_context=True, timeout_s=int(self.valves.ADJUDICATION_TIMEOUT_S),\n                    )\n                    final_model = self.valves.LOCAL_ANALYSIS_MODEL\n                except Exception as exc:\n                    await self._emit(__event_emitter__, f"Deep · correction pass unavailable ({type(exc).__name__}); retaining adjudicated answer")\n                    final_text = adjudication\n                    final_model = adjudication_model\n'''
if revision_before not in s:
    raise SystemExit("revision anchor not found")
s = s.replace(revision_before, revision_after, 1)

compile(s, "<atlas-deep-research-v21>", "exec")
meta = row["meta"]
try:
    meta_obj = json.loads(meta) if isinstance(meta, str) and meta.strip() else {}
except Exception:
    meta_obj = {}
if not isinstance(meta_obj, dict):
    meta_obj = {}
meta_obj["atlas_deep_research_resilience"] = "v2.2"
meta_obj["atlas_deep_research_resilience_updated_at"] = int(time.time())

con.execute(
    "UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?",
    (s, json.dumps(meta_obj, separators=(",", ":")), int(time.time()), FUNCTION_ID),
)
con.commit()
code = str(con.execute("SELECT content FROM function WHERE id=?", (FUNCTION_ID,)).fetchone()[0] or "")
for required in [
    MARKER,
    'default=90, ge=45',
    '"terra-osint"',
    'parallel workers unavailable; running one resilient live-research fallback',
    'hostile gate unavailable',
    'correction pass unavailable',
]:
    if required not in code:
        raise SystemExit(f"post-write verification failed: {required}")
print("patched=true")
print("atlas_deep_research_resilience=v2.2")
con.close()
