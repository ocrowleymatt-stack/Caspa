#!/usr/bin/env python3
"""Patch live OpenWebUI Atlas Council v3.9.4 -> v3.9.5.

Fixes status-only OSINT quorum, preserves Big Brother identity profile results,
uses the existing hard collection deadline before returning incomplete, and
never promotes an empty engine packet into a readable 'quorum'.
"""
import json, os, sqlite3, time

DB = "/app/backend/data/webui.db"
BACKUP_DIR = "/app/backend/data/atlas-council-backups"
FUNCTION_ID = "atlas-council"
MARKER = "substantive payload required for OSINT quorum"

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
with open(backup, "w", encoding="utf-8") as f:
    f.write(old)
print(f"backup={backup}")

if "Atlas Council v3.9.5" in old and MARKER in old:
    print("already_patched=v3.9.5")
    con.close()
    raise SystemExit(0)
if "Atlas Council v3.9.4" not in old:
    raise SystemExit("expected live Atlas Council v3.9.4 baseline")

patched = old

def replace_once(label: str, before: str, after: str):
    global patched
    count = patched.count(before)
    if count != 1:
        raise SystemExit(f"{label} anchor mismatch: {count}")
    patched = patched.replace(before, after, 1)

old_preamble = '''        started = time.monotonic()\n        wait_s = float(self.valves.OSINT_PROGRESSIVE_WAIT_S)\n        min_useful = int(self.valves.OSINT_PROGRESSIVE_MIN_USEFUL)\n        bad_status = {"error", "not_configured", "skipped"}\n        seen: set[str] = set()\n        useful: set[str] = set()\n'''
new_preamble = '''        # v3.9.5 invariant: substantive payload required for OSINT quorum.\n        started = time.monotonic()\n        soft_wait_s = float(self.valves.OSINT_PROGRESSIVE_WAIT_S)\n        hard_wait_s = max(soft_wait_s, float(self.valves.ACTIVE_OSINT_TIMEOUT_S))\n        min_useful = int(self.valves.OSINT_PROGRESSIVE_MIN_USEFUL)\n        bad_status = {"error", "not_configured", "skipped", "failed", "cancelled", "canceled"}\n        terminal_states = {"completed", "partial_timeout", "error"}\n        seen_status: dict[str, str] = {}\n        useful: set[str] = set()\n        soft_noted = False\n\n        def has_signal(value, key: str = "") -> bool:\n            noise = {\n                "status", "state", "elapsed_s", "elapsed", "duration", "duration_s", "progress",\n                "target", "kind", "classification", "active", "configured", "enabled", "presets",\n                "command", "engine", "module", "name", "detected_type", "message", "error", "reason",\n                "job_id", "scan_id", "task_id", "request_id", "id",\n            }\n            key_l = str(key or "").lower()\n            if key_l in noise or key_l.endswith("_id"):\n                return False\n            if value is None or value is False:\n                return False\n            if isinstance(value, (int, float)):\n                return value != 0\n            if isinstance(value, str):\n                return value.strip().lower() not in {"", "none", "null", "unknown", "n/a", "na", "pending", "running", "queued", "skipped", "not_configured"}\n            if isinstance(value, list):\n                return any(has_signal(x) for x in value)\n            if isinstance(value, dict):\n                return any(has_signal(v, str(k)) for k, v in value.items())\n            return bool(value)\n\n        def engine_has_substance(name: str, data) -> bool:\n            if not isinstance(data, dict):\n                return has_signal(data)\n            status = str(data.get("status") or "completed").lower()\n            if status in bad_status:\n                return False\n            if name == "bbot":\n                count = data.get("event_count")\n                return bool((isinstance(count, (int, float)) and count > 0) or has_signal(data.get("events")))\n            if name == "bigbrother":\n                return has_signal(data.get("components"))\n            for key in ("findings", "results", "events", "data", "observables", "reports", "artifacts"):\n                if has_signal(data.get(key), key):\n                    return True\n            return has_signal(data)\n'''
replace_once("broker preamble", old_preamble, new_preamble)

old_loop = '''            deadline = time.monotonic() + wait_s\n            while True:\n                engines = snap.get("engines") if isinstance(snap, dict) else {}\n                engines = engines if isinstance(engines, dict) else {}\n                for name, data in engines.items():\n                    if name in seen:\n                        continue\n                    seen.add(name)\n                    status = str((data or {}).get("status") or "completed").lower() if isinstance(data, dict) else "completed"\n                    if status not in bad_status:\n                        useful.add(name)\n                    await self._emit(emitter, f"Council · OSINT engine {name} {status} · {len(useful)} useful lane{'s' if len(useful) != 1 else ''} ready")\n                terminal = str(snap.get("status") or "").lower() in {"completed", "partial_timeout", "error"}\n                if len(useful) >= min_useful or terminal or time.monotonic() >= deadline:\n                    break\n                await asyncio.sleep(float(self.valves.OSINT_PROGRESSIVE_POLL_S))\n                r = await client.get(base + "/v1/jobs/" + urllib.parse.quote(job_id, safe=""))\n                r.raise_for_status()\n                snap = r.json()\n'''
new_loop = '''            soft_deadline = started + soft_wait_s\n            hard_deadline = started + hard_wait_s\n            while True:\n                engines = snap.get("engines") if isinstance(snap, dict) else {}\n                engines = engines if isinstance(engines, dict) else {}\n                useful = {name for name, data in engines.items() if engine_has_substance(name, data)}\n                for name, data in engines.items():\n                    status = str((data or {}).get("status") or "completed").lower() if isinstance(data, dict) else "completed"\n                    if seen_status.get(name) != status:\n                        seen_status[name] = status\n                        await self._emit(emitter, f"Council · OSINT engine {name} {status} · {len(useful)} substantive lane{'s' if len(useful) != 1 else ''} ready")\n                broker_status = str(snap.get("status") or "").lower() if isinstance(snap, dict) else ""\n                now = time.monotonic()\n                if len(useful) >= min_useful or broker_status in terminal_states or now >= hard_deadline:\n                    break\n                if now >= soft_deadline and not soft_noted:\n                    soft_noted = True\n                    await self._emit(emitter, "Council · initial OSINT window has no substantive findings yet · continuing the same broker job within the hard collection deadline")\n                await asyncio.sleep(float(self.valves.OSINT_PROGRESSIVE_POLL_S))\n                r = await client.get(base + "/v1/jobs/" + urllib.parse.quote(job_id, safe=""))\n                r.raise_for_status()\n                snap = r.json()\n'''
replace_once("broker loop", old_loop, new_loop)

old_geo = '''                geo = network.get("geoip") if isinstance(network.get("geoip"), dict) else {}\n                return {\n'''
new_geo = '''                geo = network.get("geoip") if isinstance(network.get("geoip"), dict) else {}\n                profiles = comps.get("validated_profiles") if isinstance(comps.get("validated_profiles"), dict) else {}\n                profile_results = profiles.get("results") if isinstance(profiles.get("results"), list) else []\n                return {\n'''
replace_once("profile compaction preamble", old_geo, new_geo)

old_domain_field = '''                    "domain": {\n'''
new_domain_field = '''                    "validated_profiles": {\n                        "status": profiles.get("status"),\n                        "results": profile_results[:24],\n                    },\n                    "domain": {\n'''
replace_once("profile compaction field", old_domain_field, new_domain_field)

replace_once(
    "collection label",
    '''            "council_collection": "progressive_initial_quorum",\n''',
    '''            "council_collection": "substantive_progressive_quorum" if useful else "bounded_incomplete",\n''',
)

incomplete_helper = '''    def _osint_incomplete_brief(self, evidence_packet: str) -> str | None:\n        heading = "ATLAS ACTIVE OSINT FABRIC (INTELLIGENCE LEADS — NOT EVIDENCE):"\n        payload = self._packet_json_after(evidence_packet or "", heading)\n        if not isinstance(payload, dict):\n            return None\n        targets = payload.get("targets") if isinstance(payload.get("targets"), list) else []\n        if not targets:\n            return None\n        sections = []\n        any_continues = False\n        for row in targets[:3]:\n            if not isinstance(row, dict):\n                continue\n            target = str(row.get("target") or "unknown target")\n            kind = str(row.get("kind") or "target")\n            engines = row.get("engines") if isinstance(row.get("engines"), dict) else {}\n            state = []\n            for name in ("bigbrother", "spiderfoot", "bbot", "intelowl"):\n                data = engines.get(name)\n                if isinstance(data, dict):\n                    state.append(f"{name}: {str(data.get('status') or 'completed')}")\n            continues = bool(row.get("broker_job_continues"))\n            any_continues = any_continues or continues\n            lines = [f"### {target} ({kind})"]\n            if state:\n                lines += ["#### Engine state", "- " + " · ".join(state)]\n            lines += ["#### Collection status"]\n            if continues:\n                lines.append("- No substantive target observation was ready inside the Council's hard response window; the existing broker job was still collecting when this response closed.")\n            else:\n                lines.append("- The broker reached a terminal state without a substantive target observation in this bounded pass.")\n            sections.append("\\n".join(lines))\n        if not sections:\n            return None\n        tail = "Pending engines may still add findings to the broker job." if any_continues else "A fresh bounded run may be needed if the upstream engines returned no findings."\n        return (\n            "**Council OSINT collection incomplete — no false quorum declared.** Atlas kept the request target-locked and waited on the same broker job to the bounded collection deadline, but no substantive target-specific observation was ready.\\n\\n"\n            + "\\n\\n".join(sections) + "\\n\\n" + tail\n            + "\\n\\n**Council audit:** research profile · substantive quorum not reached · 0 additional model generations · no Chair decode."\n        )\n\n'''
brief_def = '''    def _osint_deterministic_brief(self, evidence_packet: str) -> str | None:\n'''
replace_once("incomplete helper insertion", brief_def, incomplete_helper + brief_def)

old_bb_open = '''            bb = engines.get("bigbrother") if isinstance(engines.get("bigbrother"), dict) else {}\n            if bb:\n                analyst = bb.get("analyst") if isinstance(bb.get("analyst"), dict) else {}\n'''
new_bb_open = '''            bb = engines.get("bigbrother") if isinstance(engines.get("bigbrother"), dict) else {}\n            if bb:\n                analyst = bb.get("analyst") if isinstance(bb.get("analyst"), dict) else {}\n                profiles = bb.get("validated_profiles") if isinstance(bb.get("validated_profiles"), dict) else {}\n                profile_rows = profiles.get("results") if isinstance(profiles.get("results"), list) else []\n                for item in profile_rows[:6]:\n                    if isinstance(item, dict):\n                        bits = []\n                        for key in ("platform", "site", "service", "username", "url", "profile_url", "source"):\n                            value = item.get(key)\n                            if value not in (None, "", [], {}):\n                                bits.append(f"{key}: {str(value)[:220]}")\n                        if bits:\n                            observations.append("**Validated public-profile lead:** " + " · ".join(bits[:4]))\n                    elif item:\n                        observations.append(f"**Validated public-profile lead:** {str(item)[:420]}")\n'''
replace_once("identity renderer", old_bb_open, new_bb_open)

replace_once(
    "BBOT zero-event gate",
    '''                event_count = bbot.get("event_count")\n                if event_count is not None:\n                    observations.append(f"**BBOT:** completed {event_count} discovery events in the initial bounded scan.")\n''',
    '''                event_count = bbot.get("event_count")\n                # Zero events is telemetry, not a finding.\n                if isinstance(event_count, (int, float)) and event_count > 0:\n                    observations.append(f"**BBOT:** completed {int(event_count)} discovery events in the bounded scan.")\n''',
)

old_empty = '''            useful = row.get("useful_engines_ready") if isinstance(row.get("useful_engines_ready"), list) else []\n            if row.get("broker_job_continues"):\n                caveats.append("The broker returned an initial useful quorum while slower engines continued collecting; this brief may therefore omit later SpiderFoot/BBOT/other findings from the same job.")\n            if not useful:\n                caveats.append("No substantive specialist engine had completed when the initial broker window closed.")\n            if not observations:\n                observations.append("No substantive target-specific observation was available in the initial engine quorum.")\n\n            section = [f"### {target} ({kind})", "#### Strongest completed observations"]\n'''
new_empty = '''            # Status-only engine telemetry is not a Council quorum.\n            if not observations:\n                continue\n            useful = row.get("useful_engines_ready") if isinstance(row.get("useful_engines_ready"), list) else []\n            if row.get("broker_job_continues"):\n                caveats.append("The broker returned a substantive initial quorum while slower engines continued collecting; later findings from the same job may add to or contradict this brief.")\n            if not useful:\n                caveats.append("Target observations were present, but the broker did not label a substantive engine ready; verify the source engine state.")\n\n            section = [f"### {target} ({kind})", "#### Strongest completed observations"]\n'''
replace_once("empty observation quorum", old_empty, new_empty)

replace_once(
    "deterministic heading",
    '''            "**Council OSINT quorum — readable fail-soft.** Local model synthesis did not complete inside its bounded window, "\n            "so Atlas rendered the completed engine observations directly instead of returning raw JSON or starting another inference.\\n\\n"\n''',
    '''            "**Council OSINT quorum — readable fail-soft.** Local model synthesis did not complete inside its bounded window, "\n            "so Atlas rendered the substantive completed engine observations directly instead of returning raw JSON or starting another inference.\\n\\n"\n''',
)

old_fallback = '''            if osint_active and profile == "research":\n                answer = self._osint_deterministic_brief(evidence_packet)\n                if answer:\n                    elapsed = time.monotonic() - started\n                    await self._emit(__event_emitter__, f"Atlas Council complete · {elapsed:.0f}s · readable deterministic OSINT quorum", done=True)\n                    return answer\n'''
new_fallback = '''            if osint_active and profile == "research":\n                answer = self._osint_deterministic_brief(evidence_packet)\n                if answer:\n                    elapsed = time.monotonic() - started\n                    await self._emit(__event_emitter__, f"Atlas Council complete · {elapsed:.0f}s · substantive deterministic OSINT quorum", done=True)\n                    return answer\n                answer = self._osint_incomplete_brief(evidence_packet)\n                if answer:\n                    elapsed = time.monotonic() - started\n                    await self._emit(__event_emitter__, f"Atlas Council complete · {elapsed:.0f}s · bounded OSINT incomplete without false quorum", done=True)\n                    return answer\n'''
replace_once("research fallback", old_fallback, new_fallback)

patched = patched.replace("Atlas Council v3.9.4", "Atlas Council v3.9.5")
compile(patched, "<atlas-council-v3.9.5>", "exec")

required = (
    "Atlas Council v3.9.5", MARKER, "substantive_progressive_quorum",
    '"validated_profiles": {', "no false quorum declared",
    "Zero events is telemetry, not a finding.",
    "bounded OSINT incomplete without false quorum",
)
for item in required:
    if item not in patched:
        raise AssertionError(f"missing invariant: {item}")
if "No substantive target-specific observation was available in the initial engine quorum." in patched:
    raise AssertionError("legacy placeholder observation remains")

try:
    meta = json.loads(row["meta"] or "{}")
except Exception:
    meta = {}
meta["description"] = (
    "Council v3.9.5: target-locked OSINT with substantive-payload quorum, same-job hard-deadline polling, "
    "preserved Big Brother identity profiles, readable incomplete rendering and no status-only false quorum; "
    "explicit research OSINT never falls through after an empty deterministic packet."
)
con.execute(
    "UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?",
    (patched, json.dumps(meta, ensure_ascii=False), int(time.time()), FUNCTION_ID),
)
con.commit(); con.close()
print("db_update=PASS")
print("live_patch=v3.9.5")
