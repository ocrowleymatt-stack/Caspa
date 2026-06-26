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
        "workType": "novel",
        "fictionality": "fiction",
        "form": "book",
        "structureType": "chapters",
        "description": "Runtime smoke",
        "targetWordCount": 80000,
        "status": "draft",
    }, token=token)
    pid = project["id"]
    assert project.get("workType") == "novel", "project must include workType"
    assert project.get("structureType") == "chapters", "project must include structureType"
    print("PROJECT:", pid, "workType:", project.get("workType"))

    novel_text = "Chapter 1\\n\\nThe harbour fog never lifted.\\n\\nChapter 2\\n\\nBy noon the pier was empty."
    analysis = req("POST", "/api/manuscript/import/analyse", {
        "filename": "novel.txt",
        "rawText": novel_text,
        "declaredWorkType": "novel",
    }, token=token)
    assert len(analysis.get("detectedUnits", [])) >= 2, "novel with chapters should detect multiple units"
    print("IMPORT ANALYSE:", len(analysis["detectedUnits"]), "units,", analysis["recommendedImportMode"])

    plain = req("POST", "/api/manuscript/import/analyse", {
        "filename": "notes.txt",
        "rawText": "A long unbroken manuscript with no headings at all. " * 80,
    }, token=token)
    assert plain.get("recommendedImportMode") == "whole-manuscript-source", plain.get("recommendedImportMode")
    print("IMPORT PLAIN:", plain["recommendedImportMode"])

    bible = req("GET", f"/api/projects/{pid}/bible", token=token)
    print("BIBLE premise empty?", not bool(bible.get("premise")))

    chapter = req("POST", f"/api/projects/{pid}/chapters", {
        "title": "Source manuscript: smoke.txt",
        "order": 1,
        "content": "The old lighthouse keeper heard footsteps on the stairs again. Nobody lived upstairs anymore.",
        "status": "draft",
    }, token=token)
    cid = chapter["id"]
    assert chapter.get("unitType"), "chapter must include unitType"
    assert chapter.get("sourceRole"), "chapter must include sourceRole"
    print("CHAPTER:", cid, "unitType:", chapter.get("unitType"), "sourceRole:", chapter.get("sourceRole"))

    structure = req("GET", f"/api/projects/{pid}/structure", token=token)
    assert len(structure.get("flatUnits", [])) >= 1, "structure endpoint must return flatUnits"
    assert len(structure.get("units", [])) >= 1, "structure endpoint must return tree units"
    print("STRUCTURE:", len(structure["flatUnits"]), "units")

    pier = req("POST", "/api/manuscript/pier/survey", {"projectId": pid}, token=token)
    assert pier.get("recommendedNextStep"), "pier survey must recommend next step"
    print("PIER SURVEY:", pier["recommendedNextStep"], pier.get("poleCount", 0), "poles")

    pole_a = req("POST", "/api/manuscript/pier/place-pole", {
        "projectId": pid,
        "title": "Fog on the harbour",
        "description": "Protagonist senses wrongness at the pier — foreshadows the hidden occupant and raises immediate pressure.",
        "type": "inciting-incident",
    }, token=token)
    pole_b = req("POST", "/api/manuscript/pier/place-pole", {
        "projectId": pid,
        "title": "Footsteps upstairs",
        "description": "Evidence confirms someone is in the lighthouse — escalates conflict and forces a decision.",
        "type": "rising-action",
    }, token=token)
    assert pole_a["pole"]["id"] and pole_b["pole"]["id"], "place-pole must return poles"
    print("PIER POLES:", pole_a["pole"]["title"], "->", pole_b["pole"]["title"])

    filler = req("POST", "/api/manuscript/pier/stretch-decking", {
        "projectId": pid,
        "sourceText": chapter["content"],
        "structuralPurpose": "make it longer",
    }, token=token)
    assert filler.get("refused"), "stretch without structural purpose must refuse filler"
    print("PIER FILLER REFUSAL:", filler.get("message", "")[:60])

    extend = req("POST", "/api/manuscript/pier/extend", {"projectId": pid}, token=token)
    assert extend.get("recommendedNextStep"), "extend must return recommendation"
    print("PIER EXTEND:", extend["recommendedNextStep"])

    topics = req("POST", "/api/research/suggest-topics", {"projectId": pid, "query": "harbour history"}, token=token)
    assert topics.get("topics"), "suggest-topics must return topics"
    assert topics.get("disclaimer"), "must include AI disclaimer"
    print("RESEARCH TOPICS:", len(topics["topics"]))

    claims = req("POST", "/api/research/extract-claims", {
        "projectId": pid,
        "text": chapter["content"],
    }, token=token)
    assert len(claims.get("claims", [])) >= 1, "extract-claims must return claims"
    print("RESEARCH CLAIMS:", len(claims["claims"]))

    confirmed = req("POST", "/api/research", {
        "projectId": pid,
        "title": "Lighthouse staffing records",
        "content": "Historical note: remote lighthouses were often single-keeper stations with monthly supply runs.",
        "tags": ["history", "lighthouse"],
        "verificationStatus": "confirmed",
        "sourceType": "user",
    }, token=token)
    assert confirmed.get("verificationStatus") == "confirmed"
    print("RESEARCH NOTE:", confirmed["id"], confirmed["verificationStatus"])

    accuracy = req("POST", "/api/research/check-accuracy", {
        "projectId": pid,
        "sourceText": chapter["content"],
    }, token=token)
    assert len(accuracy.get("verdicts", [])) >= 1
    print("RESEARCH ACCURACY:", accuracy["verdicts"][0]["status"])

    depth = req("POST", "/api/research/depth-pass", {
        "projectId": pid,
        "topic": "lighthouse history",
    }, token=token)
    assert depth.get("summary")
    print("RESEARCH DEPTH:", depth["topic"])

    catalog = req("GET", "/api/awards", token=token)
    assert len(catalog) >= 10, "awards catalog should include built-in lenses"
    print("AWARDS CATALOG:", len(catalog))

    shelf = req("PATCH", f"/api/projects/{pid}/awards", {"awardIds": [catalog[0]["id"], catalog[1]["id"]]}, token=token)
    assert len(shelf.get("selectedAwardIds", [])) == 2
    print("AWARDS SHELF:", shelf["selectedAwardIds"])

    assessment = req("POST", "/api/awards/assess", {
        "projectId": pid,
        "awardIds": shelf["selectedAwardIds"],
        "stage": "draft",
    }, token=token, timeout=180)
    assert assessment.get("overallReadiness") is not None
    assert len(assessment.get("awardFit", [])) == 2
    assert assessment.get("outputId")
    print("AWARDS ASSESS:", assessment["overallReadiness"], "output", assessment["outputId"][:8])

    agent_list = req("GET", "/api/agents", token=token)
    assert len(agent_list) >= 10, "agent catalog should list swarm agents"
    print("AGENTS:", len(agent_list))

    swarm = req("POST", "/api/agents/swarm", {
        "projectId": pid,
        "agentIds": [agent_list[0]["id"], agent_list[1]["id"], "anti-filler-inspector"],
        "mode": "critique",
    }, token=token, timeout=300)
    assert swarm.get("consensus"), "swarm must return consensus"
    assert len(swarm.get("agentReports", [])) >= 2
    assert swarm.get("outputId")
    print("SWARM:", swarm["swarmId"][:8], "agents", len(swarm["agentReports"]))

    gold = req("POST", "/api/gold/run", {
        "projectId": pid,
        "source": chapter["content"][:2000],
        "stage": "revision",
    }, token=token, timeout=300)
    assert gold.get("synthesis"), "gold run must return synthesis"
    assert gold.get("outputId")
    assert gold["synthesis"].get("revisionPlan"), "synthesis needs revision plan"
    print("GOLD SYNTHESIS:", gold["synthesis"]["judgeAssessment"][:60], "output", gold["outputId"][:8])

    projects_before = req("GET", "/api/projects", token=token)
    count_before = len(projects_before)

    improve = req("POST", "/api/casper/novel-write-pro", {
        "projectId": pid,
        "chapterId": cid,
        "sourceChapterTitle": chapter["title"],
        "improveExisting": True,
        "mode": "polish",
        "output": "Award Pass Rewrite",
        "spark": "Improve smoke test manuscript",
        "source": chapter["content"],
        "tone": "Clear and vivid",
    }, token=token, timeout=300)
    print("IMPROVE:", improve["outputId"], "kind:", improve.get("kind"))
    assert improve.get("projectId") == pid, "improve must stay on same project"
    assert improve.get("kind") == "manuscript-improvement", "expected manuscript-improvement kind"

    projects_after = req("GET", "/api/projects", token=token)
    assert len(projects_after) == count_before, "improveExisting must not create a duplicate project"

    original = req("GET", f"/api/chapters/{cid}", token=token)
    assert original["content"] == chapter["content"], "original chapter must be preserved"

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
