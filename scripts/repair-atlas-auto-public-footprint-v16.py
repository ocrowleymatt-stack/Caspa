#!/usr/bin/env python3
"""Atlas Auto v1.6: route implicit public-footprint questions to live research.

v1.5 made explicit web/OSINT requests fast and non-recursive. v1.6 closes the
remaining intent gap: queries about social-media activity, online/public footprint
or local-community involvement are inherently public-web research even when the
user does not literally say "search the web".
"""
from __future__ import annotations
import json, os, sqlite3, time

DB = "/app/backend/data/webui.db"
FUNCTION_ID = "atlas-auto"
BASE_MARKER = "ATLAS AUTO PERFORMANCE HARDENING v1.5"
MARKER = "ATLAS AUTO PUBLIC FOOTPRINT ROUTING v1.6"
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
    raise SystemExit("Atlas Auto v1.5 must be installed before v1.6")

stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
backup = os.path.join(BACKUP_DIR, f"{FUNCTION_ID}-pre-public-footprint-v16-{stamp}.py")
with open(backup, "w", encoding="utf-8") as fh:
    fh.write(old)
print(f"backup={backup}")

patched = old.replace("version: 1.5.0", "version: 1.6.0", 1)
patched = patched.replace(
    "        # ATLAS AUTO PERFORMANCE HARDENING v1.5\n",
    "        # ATLAS AUTO PERFORMANCE HARDENING v1.5\n        # ATLAS AUTO PUBLIC FOOTPRINT ROUTING v1.6\n",
    1,
)

old_intent = '''        explicit_web = bool(re.search(\n            r"\\b(?:osint|open[- ]source intelligence|search (?:the )?(?:web|internet|online)|web search|internet search|browse (?:the )?web|look (?:this|it) up|look up online|research online|current info(?:rmation)?|latest (?:info(?:rmation)?|news|details)|public[- ]source research)\\b",\n            lowered,\n        ))\n        web_search = bool((features.get("web_search") or explicit_web) and not explicit_no_web)\n'''
new_intent = '''        explicit_web = bool(re.search(\n            r"\\b(?:osint|open[- ]source intelligence|search (?:the )?(?:web|internet|online)|web search|internet search|browse (?:the )?web|look (?:this|it) up|look up online|research online|current info(?:rmation)?|latest (?:info(?:rmation)?|news|details)|public[- ]source research)\\b",\n            lowered,\n        ))\n        # ATLAS AUTO PUBLIC FOOTPRINT ROUTING v1.6\n        public_footprint_web = bool(re.search(\n            r"\\b(?:social[- ]media activity|social[- ]media accounts?|social profiles?|online presence|online activity|digital footprint|public profiles?|public posts?|facebook|instagram|linkedin|tiktok|twitter|x\\.com|reddit|community involvement|local community involvement|community groups?|local groups?|volunteer(?:ing)?|charit(?:y|ies) involvement)\\b",\n            lowered,\n        ))\n        web_search = bool((features.get("web_search") or explicit_web or public_footprint_web) and not explicit_no_web)\n'''
if old_intent not in patched:
    raise SystemExit("v1.5 web-intent block not found")
patched = patched.replace(old_intent, new_intent, 1)

old_reason = '''        if web_search:\n            target = self.valves.DEEP_SEARCH_MODEL if deep_search else self.valves.SEARCH_MODEL\n            reason = "deep live research" if deep_search else "live web/OSINT research"\n'''
new_reason = '''        if web_search:\n            target = self.valves.DEEP_SEARCH_MODEL if deep_search else self.valves.SEARCH_MODEL\n            if deep_search:\n                reason = "deep live research"\n            elif public_footprint_web and not explicit_web:\n                reason = "public-footprint live research"\n            else:\n                reason = "live web/OSINT research"\n'''
if old_reason not in patched:
    raise SystemExit("v1.5 route reason block not found")
patched = patched.replace(old_reason, new_reason, 1)

compile(patched, "<atlas-auto-v16>", "exec")
try:
    meta_obj = json.loads(row["meta"]) if isinstance(row["meta"], str) and row["meta"].strip() else {}
except Exception:
    meta_obj = {}
if not isinstance(meta_obj, dict):
    meta_obj = {}
meta_obj["atlas_auto_web_routing"] = "v1.6"
meta_obj["atlas_auto_public_footprint_routing"] = True
meta_obj["atlas_auto_web_routing_updated_at"] = int(time.time())
con.execute("UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?", (patched, json.dumps(meta_obj, separators=(",", ":")), int(time.time()), FUNCTION_ID))
con.commit()
code = str(con.execute("SELECT content FROM function WHERE id=?", (FUNCTION_ID,)).fetchone()[0] or "")
for required in [MARKER, "public_footprint_web = bool(re.search(", "social[- ]media activity", "online presence", "community involvement", "public-footprint live research", "explicit_web or public_footprint_web"]:
    if required not in code:
        raise SystemExit(f"post-write verification failed: {required}")
print("patched=true")
print("atlas_auto_web_routing=v1.6_public_footprint")
con.close()
