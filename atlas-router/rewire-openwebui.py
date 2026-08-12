#!/usr/bin/env python3
"""Point Atlas OpenWebUI's frontier pipe at the Atlas-owned internal router.

This removes the accidental runtime dependency on caspa.ocrowley.com. The router
binds to the host side of Atlas's Docker bridge and is reachable only from the
Atlas container network / host, not as a public API.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time

DB = "/app/backend/data/webui.db"
FUNCTION_ID = "atlas-frontier-failover"
NEW_URL = "http://172.19.0.1:3014/api/ai/call"
OLD_URL = "https://caspa.ocrowley.com/api/ai/call"
MARKER = "ATLAS ROUTER SEPARATION v1"
BACKUP_DIR = "/app/backend/data/atlas-function-backups"

os.makedirs(BACKUP_DIR, exist_ok=True)
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
row = con.execute("SELECT content, meta FROM function WHERE id=?", (FUNCTION_ID,)).fetchone()
if not row:
    raise SystemExit(f"missing live function: {FUNCTION_ID}")

old = str(row["content"] or "")
if NEW_URL in old and MARKER in old and OLD_URL not in old:
    print("already_separated=true")
    con.close()
    raise SystemExit(0)

stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
backup = os.path.join(BACKUP_DIR, f"{FUNCTION_ID}-pre-router-separation-{stamp}.py")
with open(backup, "w", encoding="utf-8") as fh:
    fh.write(old)
print(f"backup={backup}")

s = old
if OLD_URL in s:
    s = s.replace(OLD_URL, NEW_URL)
elif 'ROUTER_URL: str = Field(default=' in s and NEW_URL not in s:
    import re
    s, count = re.subn(
        r'ROUTER_URL: str = Field\(default="[^"]+"\)',
        f'ROUTER_URL: str = Field(default="{NEW_URL}")',
        s,
        count=1,
    )
    if count != 1:
        raise SystemExit("could not replace ROUTER_URL")

if MARKER not in s:
    anchor = "# ATLAS MULTI-PROVIDER FRONTIER v2.1\n"
    if anchor in s:
        s = s.replace(anchor, anchor + f"# {MARKER}\n", 1)
    else:
        class_anchor = "class Pipe:\n"
        if class_anchor not in s:
            raise SystemExit("could not place separation marker")
        s = s.replace(class_anchor, f"# {MARKER}\nclass Pipe:\n", 1)

compile(s, f"<{FUNCTION_ID}>", "exec")
assert NEW_URL in s
assert OLD_URL not in s

meta = row["meta"]
try:
    meta_obj = json.loads(meta) if isinstance(meta, str) and meta.strip() else {}
except Exception:
    meta_obj = {}
if not isinstance(meta_obj, dict):
    meta_obj = {}
meta_obj["atlas_router_separated"] = True
meta_obj["atlas_router_url"] = NEW_URL
meta_obj["atlas_router_separated_at"] = int(time.time())

con.execute(
    "UPDATE function SET content=?, meta=?, updated_at=? WHERE id=?",
    (s, json.dumps(meta_obj, separators=(",", ":")), int(time.time()), FUNCTION_ID),
)
con.commit()
verify = con.execute("SELECT content FROM function WHERE id=?", (FUNCTION_ID,)).fetchone()
code = str(verify[0] or "")
assert NEW_URL in code
assert OLD_URL not in code
assert MARKER in code
print("atlas_router_separation_live=true")
print(f"router_url={NEW_URL}")
con.close()
