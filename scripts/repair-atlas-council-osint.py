#!/usr/bin/env python3
"""Patch the live OpenWebUI Atlas Council function from v3.9.4 to v3.9.5.

v3.9.5 repairs the progressive OSINT quorum contract:
- engine readiness is based on substantive payload, never status alone;
- the same broker job may keep polling to the existing hard OSINT deadline;
- Big Brother identity profile results survive compaction;
- deterministic Council output requires at least one real target observation;
- an incomplete collection renders readable status rather than raw JSON.
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
row = con.execute("SELECT content, meta FROM function WHERE id=?", (FUNCTION_ID,)).fetchone()
if not row:
    raise SystemExit("atlas-council function missing")

old = str(row["content"] or "")
if not old.strip():
    raise SystemExit("atlas-council function empty")

stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
backup = os.path.join(BACKUP_DIR, f"atlas-council-pre-v3.9.5-{stamp}.py")
with open(backup, "w", encoding="utf-8") as handle:
    handle.write(old)
print(f"backup={backup}")

SUBSTANTIVE_MARKER = "substantive payload required for OSINT quorum"
if "Atlas Council v3.9.5" in old and SUBSTANTIVE_MARKER in old:
    print("already_patched=v3.9.5")
    con.close()
    raise SystemExit(0)
if "Atlas Council v3.9.4" not in old:
    raise SystemExit("v3.9.5 repair requires the target-locked v3.9.4 Council baseline")

new_broker = r'''    async def _osint_broker_request(self, kind: str, target: str, question: str, emitter=None) -> dict:
        # v3.9.5 invariant: substantive payload required for OSINT quorum.
        # A status transition, a running engine, an empty completion or zero events
        # is telemetry, not intelligence and must never release the progressive gate.
        depth = "deep" if re.search(r"\b(deep|deeply|thorough|thoroughly|full|fully|exhaustive|comprehensive)\b", question or "", re.I) else "standard"
        payload = {
            "target": target,
            "kind": kind,
            "active": True,
            "depth": depth,
            "timeout_s": min(180, max(60, int(self.valves.ACTIVE_OSINT_TIMEOUT_S) + 60)),
        }
        base = self.valves.OSINT_BROKER_BASE_URL.rstrip("/")
        started = time.monotonic()
        soft_wait_s = float(self.valves.OSINT_PROGRESSIVE_WAIT_S)
        min_useful = int(self.valves.OSINT_PROGRESSIVE_MIN_USEFUL)
        hard_wait_s = max(soft_wait_s, float(self.valves.ACTIVE_OSINT_TIMEOUT_S))
        terminal_states = {"completed", "partial_timeout", "error"}
        bad_engine_states = {"error", "not_configured", "skipped", "failed", "cancelled", "canceled"}
        noise_keys = {
            "status", "state", "elapsed_s", "elapsed", "duration", "duration_s", "progress",
            "target", "kind", "classification", "active", "active_recon", "public_network_only",
            "configured", "enabled", "presets", "command", "engine", "module", "name",
            "started_at", "completed_at", "created_at", "updated_at", "detected_type",
            "job_id", "scan_id", "task_id", "request_id", "id", "message", "error", "reason",
        }
        empty_strings = {"", "none", "null", "unknown", "n/a", "na", "not_configured", "skipped", "pending", "running", "queued"}

        def payload_has_signal(value, key: str = "") -> bool:
            key_l = str(key or "").lower()
            if key_l in noise_keys or key_l.endswith("_id"):
                return False
            if value is None or value is False:
                return False
            if isinstance(value, (int, float)):
                return value != 0
            if isinstance(value, str):
                return value.strip().lower() not in empty_strings
            if isinstance(value, list):
                return any(payload_has_signal(item) for item in value)
            if isinstance(value, dict):
                return any(payload_has_signal(v, str(k)) for k, v in value.items())
            return bool(value)

        def engine_has_substance(name: str, data) -> bool:
            if not isinstance(data, dict):
                return payload_has_signal(data)
            status = str(data.get("status") or "completed").lower()
            if status in bad_engine_states:
                return False
            if name == "bbot":
                event_count = data.get("event_count")
                if isinstance(event_count, (int, float)) and event_count > 0:
                    return True
                return payload_has_signal(data.get("events"))
            if name == "bigbrother":
                return payload_has_signal(data.get("components"))
            for key in ("findings", "results", "events", "data", "observables", "reports", "artifacts"):
                if payload_has_signal(data.get(key), key):
                    return True
            return payload_has_signal(data)

        seen_status: dict[str, str] = {}
        useful: set[str] = set()
        soft_noted = False

        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0), trust_env=False) as client:
            r = await client.post(base + "/v1/jobs", json=payload)
            r.raise_for_status()
            snap = r.json()
            job_id = str(snap.get("job_id") or "")
            if not job_id:
                raise RuntimeError("OSINT broker did not return a job id")
            soft_deadline = started + soft_wait_s
            hard_deadline = started + hard_wait_s

            while True:
                engines = snap.get("engines") if isinstance(snap, dict) else {}
                engines = engines if isinstance(engines, dict) else {}
                useful = {name for name, data in engines.items() if engine_has_substance(name, data)}

                for name, data in engines.items():
                    status = str((data or {}).get("status") or "completed").lower() if isinstance(data, dict) else "completed"
                    if seen_status.get(name) != status:
                        seen_status[name] = status
                        await self._emit(
                            emitter,
                            f"Council · OSINT engine {name} {status} · {len(useful)} substantive lane{'s' if len(useful) != 1 else ''} ready",
                        )

                broker_status = str(snap.get("status") or "").lower() if isinstance(snap, dict) else ""
                now = time.monotonic()
                if len(useful) >= min_useful or broker_status in terminal_states or now >= hard_deadline:
                    break
                if now >= soft_deadline and not soft_noted:
                    soft_noted = True
                    await self._emit(
                        emitter,
                        "Council · initial OSINT window has no substantive findings yet · continuing the same broker job within the hard collection deadline",
                    )
                await asyncio.sleep(float(self.valves.OSINT_PROGRESSIVE_POLL_S))
                r = await client.get(base + "/v1/jobs/" + urllib.parse.quote(job_id, safe=""))
                r.raise_for_status()
                snap = r.json()

        def compact_engine(name: str, data):
            if not isinstance(data, dict):
                return {"status": "completed", "value": str(data)[:1200]}
            status = str(data.get("status") or "completed")
            base_row = {"status": status, "elapsed_s": data.get("elapsed_s")}
            if name == "bigbrother":
                comps = data.get("components") if isinstance(data.get("components"), dict) else {}
                analyst = comps.get("analyst") if isinstance(comps.get("analyst"), dict) else {}
                raw = analyst.get("raw") if isinstance(analyst.get("raw"), dict) else {}
                oracle = raw.get("domain_oracle") if isinstance(raw.get("domain_oracle"), dict) else {}
                network = comps.get("active_network") if isinstance(comps.get("active_network"), dict) else {}
                ssl = comps.get("ssl") if isinstance(comps.get("ssl"), dict) else {}
                geo = network.get("geoip") if isinstance(network.get("geoip"), dict) else {}
                profiles = comps.get("validated_profiles") if isinstance(comps.get("validated_profiles"), dict) else {}
                profile_results = profiles.get("results") if isinstance(profiles.get("results"), list) else []
                return {
                    **base_row,
                    "analyst": {
                        "detected_type": analyst.get("detected_type"),
                        "risk_score": analyst.get("risk_score"),
                        "verdict": analyst.get("verdict"),
                        "findings": (analyst.get("findings") or [])[:12] if isinstance(analyst.get("findings"), list) else analyst.get("findings"),
                    },
                    "validated_profiles": {
                        "status": profiles.get("status"),
                        "results": profile_results[:24],
                    },
                    "domain": {
                        "ip": oracle.get("ip"),
                        "dns": oracle.get("dns"),
                        "email_security": oracle.get("email_security"),
                        "http_security": oracle.get("http_security"),
                        "tls": oracle.get("tls"),
                        "wayback": raw.get("wayback"),
                    },
                    "active_network": {
                        "ip": network.get("ip"),
                        "ports": network.get("ports"),
                        "geo": {k: geo.get(k) for k in ("country", "regionName", "city", "isp", "org", "as") if geo.get(k) is not None},
                        "dns": network.get("dns"),
                    },
                    "ssl": ssl,
                }
            if name == "bbot":
                events = data.get("events") if isinstance(data.get("events"), list) else []
                selected = []
                for ev in events:
                    if not isinstance(ev, dict):
                        continue
                    typ = str(ev.get("type") or "")
                    if typ not in {"DNS_NAME", "IP_ADDRESS", "ASN", "TECHNOLOGY", "URL", "OPEN_TCP_PORT", "HTTP_RESPONSE"}:
                        continue
                    row = {
                        "type": typ,
                        "data": ev.get("data"),
                        "host": ev.get("host"),
                        "module": ev.get("module"),
                        "context": str(ev.get("discovery_context") or "")[:360],
                        "resolved_hosts": ev.get("resolved_hosts"),
                    }
                    selected.append({k: v for k, v in row.items() if v not in (None, "", [], {})})
                    if len(selected) >= 12:
                        break
                return {
                    **base_row,
                    "event_count": data.get("event_count"),
                    "presets": data.get("presets"),
                    "findings": selected,
                }
            raw = json.dumps(data, ensure_ascii=False, default=str)
            if len(raw) <= 8000:
                return data
            return {**base_row, "bounded": True, "preview": raw[:8000]}

        engines = snap.get("engines") if isinstance(snap, dict) and isinstance(snap.get("engines"), dict) else {}
        compact = {name: compact_engine(name, data) for name, data in engines.items()}
        broker_status = str(snap.get("status") or "").lower() if isinstance(snap, dict) else "unknown"
        return {
            "classification": "intelligence_lead_not_evidence",
            "target": snap.get("target", target) if isinstance(snap, dict) else target,
            "kind": snap.get("kind", kind) if isinstance(snap, dict) else kind,
            "job_id": snap.get("job_id") if isinstance(snap, dict) else None,
            "status": snap.get("status") if isinstance(snap, dict) else "unknown",
            "council_collection": "substantive_progressive_quorum" if useful else "bounded_incomplete",
            "council_wait_s": round(time.monotonic() - started, 2),
            "useful_engines_ready": sorted(useful),
            "broker_job_continues": broker_status not in terminal_states,
            "engines": compact,
        }
'''

broker_pattern = re.compile(
    r"    async def _osint_broker_request\(self, kind: str, target: str, question: str, emitter=None\) -> dict:\n.*?(?=    async def _osint_fabric_packet)",
    re.S,
)
patched, broker_count = broker_pattern.subn(lambda _: new_broker + "\n", old, count=1)
if broker_count != 1:
    raise SystemExit(f"OSINT broker anchor mismatch: {broker_count}")

new_brief_methods = r'''    @staticmethod
    def _osint_readable_item(item) -> str:
        if isinstance(item, str):
            return re.sub(r"\s+", " ", item).strip()[:420]
        if not isinstance(item, dict):
            return str(item)[:420]
        preferred = ("type", "platform", "site", "service", "source", "host", "domain", "username", "url", "value", "data", "description", "context")
        bits = []
        for key in preferred:
            value = item.get(key)
            if value in (None, "", [], {}):
                continue
            if isinstance(value, (dict, list)):
                continue
            text = re.sub(r"\s+", " ", str(value)).strip()
            if text:
                bits.append(f"{key}: {text[:220]}")
            if len(bits) >= 4:
                break
        if not bits:
            for key, value in item.items():
                if key in {"status", "elapsed_s", "job_id", "scan_id", "id", "error"} or value in (None, "", [], {}):
                    continue
                if isinstance(value, (dict, list)):
                    continue
                bits.append(f"{key}: {re.sub(r'\s+', ' ', str(value)).strip()[:220]}")
                if len(bits) >= 4:
                    break
        return " · ".join(bits)[:520]

    def _osint_incomplete_brief(self, evidence_packet: str) -> str | None:
        heading = "ATLAS ACTIVE OSINT FABRIC (INTELLIGENCE LEADS — NOT EVIDENCE):"
        payload = self._packet_json_after(evidence_packet or "", heading)
        if not isinstance(payload, dict):
            return None
        targets = payload.get("targets") if isinstance(payload.get("targets"), list) else []
        if not targets:
            return None
        sections = []
        any_continues = False
        for row in targets[:3]:
            if not isinstance(row, dict):
                continue
            target = str(row.get("target") or "unknown target")
            kind = str(row.get("kind") or "target")
            engines = row.get("engines") if isinstance(row.get("engines"), dict) else {}
            state = []
            for name in ("bigbrother", "spiderfoot", "bbot", "intelowl"):
                data = engines.get(name)
                if isinstance(data, dict):
                    state.append(f"{name}: {str(data.get('status') or 'completed')}")
            useful = row.get("useful_engines_ready") if isinstance(row.get("useful_engines_ready"), list) else []
            continues = bool(row.get("broker_job_continues"))
            any_continues = any_continues or continues
            lines = [f"### {target} ({kind})"]
            if state:
                lines += ["#### Engine state", "- " + " · ".join(state)]
            lines += ["#### Collection status"]
            if useful:
                lines.append("- Substantive payload was reported by: " + ", ".join(str(x) for x in useful) + ", but no safely renderable target observation survived the bounded packet.")
            elif continues:
                lines.append("- No substantive target observation was ready inside the Council's hard response window; the existing broker job was still collecting when this response closed.")
            else:
                lines.append("- The broker reached a terminal state without a substantive target observation in this bounded pass.")
            sections.append("\n".join(lines))
        if not sections:
            return None
        lead = "**Council OSINT collection incomplete — no false quorum declared.** Atlas kept the request target-locked and waited on the same broker job to the bounded collection deadline, but no substantive target-specific observation was ready."
        tail = "Pending engines may still add findings to the broker job." if any_continues else "A fresh bounded run may be needed if the upstream engines returned no findings."
        return lead + "\n\n" + "\n\n".join(sections) + "\n\n" + tail + "\n\n**Council audit:** research profile · substantive quorum not reached · 0 additional model generations · no Chair decode."

    def _osint_deterministic_brief(self, evidence_packet: str) -> str | None:
        # v3.9.5 invariant: a readable section is quorum only when it contains at
        # least one substantive target-specific observation. Status text is not a finding.
        heading = "ATLAS ACTIVE OSINT FABRIC (INTELLIGENCE LEADS — NOT EVIDENCE):"
        payload = self._packet_json_after(evidence_packet or "", heading)
        if not isinstance(payload, dict):
            return None
        targets = payload.get("targets") if isinstance(payload.get("targets"), list) else []
        if not targets:
            return None

        sections = []
        for row in targets[:3]:
            if not isinstance(row, dict):
                continue
            target = str(row.get("target") or "unknown target")
            kind = str(row.get("kind") or "target")
            engines = row.get("engines") if isinstance(row.get("engines"), dict) else {}
            observations = []
            caveats = []
            engine_status = []

            for name in ("bigbrother", "bbot", "spiderfoot", "intelowl"):
                data = engines.get(name)
                if not isinstance(data, dict):
                    continue
                status = str(data.get("status") or "completed")
                engine_status.append(f"{name}: {status}")

            bb = engines.get("bigbrother") if isinstance(engines.get("bigbrother"), dict) else {}
            if bb:
                analyst = bb.get("analyst") if isinstance(bb.get("analyst"), dict) else {}
                domain = bb.get("domain") if isinstance(bb.get("domain"), dict) else {}
                network = bb.get("active_network") if isinstance(bb.get("active_network"), dict) else {}
                ssl = bb.get("ssl") if isinstance(bb.get("ssl"), dict) else {}
                profiles = bb.get("validated_profiles") if isinstance(bb.get("validated_profiles"), dict) else {}
                profile_rows = profiles.get("results") if isinstance(profiles.get("results"), list) else []
                for item in profile_rows[:6]:
                    rendered = self._osint_readable_item(item)
                    if rendered:
                        observations.append(f"**Validated public-profile lead:** {rendered}")
                ip = network.get("ip") or domain.get("ip")
                if ip:
                    observations.append(f"**Resolution:** `{target}` resolved to `{ip}` in the Big Brother scan.")
                ports = self._fmt_list(network.get("ports"))
                if ports:
                    observations.append(f"**Reachable services observed:** {ports}.")
                geo = network.get("geo") if isinstance(network.get("geo"), dict) else {}
                provider = geo.get("org") or geo.get("isp")
                asn = geo.get("as")
                place = ", ".join(str(x) for x in (geo.get("city"), geo.get("regionName"), geo.get("country")) if x)
                if provider or asn or place:
                    observations.append("**Hosting/IP attribution:** " + " · ".join(str(x) for x in (provider, asn, place) if x) + ".")
                http = domain.get("http_security") if isinstance(domain.get("http_security"), dict) else {}
                if http:
                    http_bits = []
                    if http.get("status") is not None:
                        http_bits.append(f"HTTP {http.get('status')}")
                    if http.get("server"):
                        http_bits.append(str(http.get("server")))
                    if http_bits:
                        observations.append("**Web response:** " + " · ".join(http_bits) + ".")
                    missing = http.get("missing") if isinstance(http.get("missing"), list) else []
                    if missing:
                        caveats.append("Header absence is a vantage-point observation and should be verified directly before treating it as a security defect.")
                tls = domain.get("tls") if isinstance(domain.get("tls"), dict) else ssl
                if isinstance(tls, dict) and tls:
                    issuer = tls.get("issuer") if isinstance(tls.get("issuer"), dict) else {}
                    issuer_name = issuer.get("organizationName") or issuer.get("commonName")
                    bits = [x for x in (tls.get("tls_version"), issuer_name, tls.get("not_after")) if x]
                    if bits:
                        observations.append("**TLS:** " + " · ".join(str(x) for x in bits) + ".")
                findings = analyst.get("findings") if isinstance(analyst.get("findings"), list) else []
                for finding in findings[:4]:
                    if finding:
                        observations.append(f"**Big Brother heuristic:** {finding}")

            bbot = engines.get("bbot") if isinstance(engines.get("bbot"), dict) else {}
            if bbot:
                event_count = bbot.get("event_count")
                # Zero events is telemetry, not a finding.
                if isinstance(event_count, (int, float)) and event_count > 0:
                    observations.append(f"**BBOT:** completed {int(event_count)} discovery events in the bounded scan.")
                findings = bbot.get("findings") if isinstance(bbot.get("findings"), list) else []
                seen = set()
                for item in findings:
                    if not isinstance(item, dict):
                        continue
                    typ = str(item.get("type") or "")
                    context = str(item.get("context") or "").strip()
                    data = item.get("data")
                    if typ == "DNS_NAME" and item.get("resolved_hosts"):
                        text = f"BBOT DNS: {item.get('host') or data} → {', '.join(str(x) for x in item.get('resolved_hosts')[:5])}"
                    elif typ in {"ASN", "TECHNOLOGY", "URL", "OPEN_TCP_PORT", "HTTP_RESPONSE", "IP_ADDRESS"} and context:
                        text = "BBOT " + typ.replace("_", " ").title() + ": " + context
                    elif data not in (None, ""):
                        text = "BBOT " + typ.replace("_", " ").title() + ": " + str(data)
                    else:
                        continue
                    norm = re.sub(r"\s+", " ", text).strip()
                    if norm and norm not in seen:
                        seen.add(norm)
                        observations.append("**" + norm[:520] + "**" if len(norm) < 100 else norm[:520])
                    if len(seen) >= 5:
                        break

            for engine_name, label in (("spiderfoot", "SpiderFoot"), ("intelowl", "IntelOwl")):
                data = engines.get(engine_name) if isinstance(engines.get(engine_name), dict) else {}
                if not data:
                    continue
                candidates = None
                for key in ("findings", "results", "events", "observables", "reports", "data"):
                    value = data.get(key)
                    if isinstance(value, list) and value:
                        candidates = value
                        break
                if candidates:
                    for item in candidates[:4]:
                        rendered = self._osint_readable_item(item)
                        if rendered:
                            observations.append(f"**{label} lead:** {rendered}")

            # A target with status-only telemetry is not a quorum section.
            if not observations:
                continue

            useful = row.get("useful_engines_ready") if isinstance(row.get("useful_engines_ready"), list) else []
            if row.get("broker_job_continues"):
                caveats.append("The broker returned a substantive initial quorum while slower engines continued collecting; later findings from the same job may add to or contradict this brief.")
            if not useful:
                caveats.append("Target observations were present, but the broker did not label a substantive engine ready; treat this as a conservative fail-soft rendering and verify the source engine state.")

            section = [f"### {target} ({kind})", "#### Strongest completed observations"]
            section.extend("- " + item for item in observations[:12])
            if engine_status:
                section += ["", "#### Engine state", "- " + " · ".join(engine_status)]
            section += ["", "#### Material caveats"]
            if caveats:
                section.extend("- " + c for c in dict.fromkeys(caveats))
            else:
                section.append("- These are OSINT/reconnaissance leads and should be independently corroborated before being treated as established fact.")
            sections.append("\n".join(section))

        if not sections:
            return None
        return (
            "**Council OSINT quorum — readable fail-soft.** Local model synthesis did not complete inside its bounded window, so Atlas rendered the substantive completed engine observations directly instead of returning raw JSON or starting another inference.\n\n"
            + "\n\n".join(sections)
            + "\n\n**Assessment status:** intelligence leads, not established evidence. Pending engines may add or contradict findings."
            + "\n\n**Council audit:** research profile · substantive engine quorum present · deterministic OSINT rendering · no emergency decode."
        )
'''

brief_pattern = re.compile(
    r"    def _osint_deterministic_brief\(self, evidence_packet: str\) -> str \| None:\n.*?(?=    def _osint_fast_result)",
    re.S,
)
patched, brief_count = brief_pattern.subn(lambda _: new_brief_methods + "\n", patched, count=1)
if brief_count != 1:
    raise SystemExit(f"deterministic brief anchor mismatch: {brief_count}")

old_incomplete = '''            # A bounded OSINT request stays on the engine-led path even when its\n            # initial packet is incomplete. Never fall through to two seats + Chair.\n            bounded = (evidence_packet or "").strip()[:3200]\n            answer = (\n                "**Council OSINT collection incomplete — bounded fail-soft returned.** Atlas locked the requested target(s), but no readable engine quorum was available in the initial collection window. "\n                "It did not substitute a generic search and did not queue a second local examiner or Chair decode."\n                + (("\\n\\n" + bounded) if bounded else "")\n                + "\\n\\n**Council audit:** research profile · target lock active · engine quorum incomplete · 0 additional model generations · no Chair decode."\n            )\n            elapsed = time.monotonic() - started\n            await self._emit(__event_emitter__, f"Atlas Council complete · {elapsed:.0f}s · bounded OSINT fail-soft", done=True)\n            return answer\n'''
new_incomplete = '''            # A bounded OSINT request stays on the engine-led path even when its\n            # collection is incomplete. Never expose raw broker JSON and never fall\n            # through to two seats + Chair merely because an engine is slow.\n            answer = self._osint_incomplete_brief(evidence_packet) or (\n                "**Council OSINT collection incomplete — no false quorum declared.** Atlas locked the requested target(s), but no substantive target-specific observation was ready inside the bounded collection deadline. "\n                "It did not substitute a generic search and did not queue a second local examiner or Chair decode."\n                "\\n\\n**Council audit:** research profile · target lock active · substantive quorum not reached · 0 additional model generations · no Chair decode."\n            )\n            elapsed = time.monotonic() - started\n            await self._emit(__event_emitter__, f"Atlas Council complete · {elapsed:.0f}s · bounded OSINT incomplete without false quorum", done=True)\n            return answer\n'''
if old_incomplete not in patched:
    raise SystemExit("OSINT incomplete-render anchor mismatch")
patched = patched.replace(old_incomplete, new_incomplete, 1)

patched = patched.replace("Atlas Council v3.9.4", "Atlas Council v3.9.5")
compile(patched, "<atlas-council-v3.9.5>", "exec")

required_markers = (
    "Atlas Council v3.9.5",
    SUBSTANTIVE_MARKER,
    "substantive_progressive_quorum",
    '"validated_profiles": {',
    "no false quorum declared",
    "Zero events is telemetry, not a finding.",
)
for marker in required_markers:
    if marker not in patched:
        raise AssertionError(f"missing v3.9.5 invariant marker: {marker}")

if 'if status not in bad_status:\n                        useful.add(name)' in patched:
    raise AssertionError("legacy status-only useful-engine gate still present")
if 'if not observations:\n                observations.append("No substantive target-specific observation' in patched:
    raise AssertionError("legacy placeholder-as-observation gate still present")

try:
    meta = json.loads(row["meta"] or "{}")
except Exception:
    meta = {}
meta["description"] = (
    "Council v3.9.5: target-locked OSINT with substantive-payload quorum, bounded same-job polling, "
    "preserved Big Brother identity profile results, readable incomplete-state rendering, and no "
    "status-only false quorum; explicit research OSINT never falls through to a second seat or Chair."
)

con.execute(
    "UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?",
    (patched, json.dumps(meta, ensure_ascii=False), int(time.time()), FUNCTION_ID),
)
con.commit()
con.close()
print("db_update=PASS")
print("live_patch=v3.9.5")
