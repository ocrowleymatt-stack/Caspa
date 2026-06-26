#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "=== CASPA RUNTIME SMOKE ==="
date -u

echo "--- PUBLIC HEALTH ---"
curl -sS http://127.0.0.1:3000/health || true
echo

echo "--- PUBLIC DOCTOR ---"
curl -sS http://127.0.0.1:3000/api/doctor || true
echo

echo "--- OLLAMA DIRECT TAGS ---"
curl -sS http://127.0.0.1:11434/api/tags || true
echo

echo "--- PROTECTED ROUTE CHECK ---"
curl -sS -i http://127.0.0.1:3000/api/projects | head -30 || true
echo

if [[ -f .env ]]; then
  echo "--- AUTHENTICATED USABILITY (local .env) ---"
  python3 - <<'PY' || true
import json, pathlib, urllib.request, urllib.error

def load_env():
    env = {}
    for line in pathlib.Path(".env").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env

def req(method, path, body=None, token=None, timeout=180):
    data = None if body is None else json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request("http://127.0.0.1:3000" + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode())
    return payload.get("data", payload)

env = load_env()
try:
    login = req("POST", "/api/auth/login", {
        "email": env.get("ADMIN_EMAIL", "admin@caspa.local"),
        "password": env.get("ADMIN_PASSWORD", "changeme"),
    })
    token = login["token"]
    print("LOGIN: ok")

    print("OLLAMA HEALTH:", json.dumps(req("GET", "/api/ollama/health", token=token)))
    print("PROVIDERS:", len(req("GET", "/providers", token=token)))

    project = req("POST", "/api/projects", {
        "title": "Smoke Test Project",
        "genre": "Novel",
        "description": "Runtime smoke",
        "targetWordCount": 80000,
        "status": "draft",
    }, token=token)
    pid = project["id"]
    print("PROJECT:", pid)

    bible = req("GET", f"/api/projects/{pid}/bible", token=token)
    print("BIBLE premise empty?", not bool(bible.get("premise")))

    nwp = req("POST", "/api/casper/novel-write-pro", {
        "projectId": pid,
        "mode": "script",
        "output": "First scene",
        "spark": "A haunted theatre reopening",
        "tone": "Gothic",
        "source": "",
    }, token=token, timeout=300)
    print("NWP:", nwp["outputId"], "structured?", "structured" in nwp)

    cont = req("POST", "/api/casper/continue", {
        "projectId": pid,
        "currentText": nwp["text"][:1200],
        "mode": "continue",
    }, token=token, timeout=180)
    print("CONTINUE:", cont["outputId"])

    gen_bible = req("POST", f"/api/projects/{pid}/bible/generate", token=token, timeout=180)
    print("BIBLE GENERATED premise?", bool(gen_bible.get("premise")))

    gold = req("POST", "/api/gold/run", {"projectId": pid, "source": nwp["text"][:2000]}, token=token, timeout=180)
    print("GOLD:", gold["outputId"])

    outs = req("GET", f"/api/outputs?projectId={pid}", token=token)
    print("OUTPUTS:", len(outs))
except urllib.error.HTTPError as e:
    print("AUTH TEST FAILED:", e.read().decode()[:500])
except Exception as e:
    print("AUTH TEST ERROR:", e)
PY
  echo
fi

echo "--- PM2 ---"
pm2 status || true
