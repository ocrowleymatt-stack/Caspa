#!/usr/bin/env python3
"""Repair Atlas Auto v1.6 social/public-research follow-up routing.

This updates the live OpenWebUI function row `atlas-auto` in webui.db. It is
idempotent for v1.7 and refuses blind patching if the expected v1.6 routing
block is not present. Run inside the atlas-openwebui container.
"""
from __future__ import annotations

import argparse
import asyncio
import shutil
import sqlite3
import sys
import time
from pathlib import Path

DB = Path('/app/backend/data/webui.db')
FUNCTION_ID = 'atlas-auto'

OLD_BLOCK = '''        public_footprint_web = bool(re.search(
            r"\\b(?:social[- ]media activity|social[- ]media accounts?|social profiles?|online presence|online activity|digital footprint|public profiles?|public posts?|facebook|instagram|linkedin|tiktok|twitter|x\\.com|reddit|community involvement|local community involvement|community groups?|local groups?|volunteer(?:ing)?|charit(?:y|ies) involvement)\\b",
            lowered,
        ))
        web_search = bool((features.get("web_search") or explicit_web or public_footprint_web) and not explicit_no_web)
'''

NEW_BLOCK = '''        # ATLAS AUTO SOCIAL/RESEARCH CONTINUATION ROUTING v1.7
        # A follow-up does not need to repeat the words "OSINT" or "web search".
        # Bare social-media relationship/tag language is itself a public-source
        # retrieval request, and terse continuation cues inherit recent research
        # context instead of falling back to the local tool-schema model.
        public_footprint_web = bool(re.search(
            r"\\b(?:social[- ]media(?: activity| accounts?| connections?| profiles?| posts?)?|social profiles?|online presence|online activity|digital footprint|public profiles?|public posts?|tagged (?:posts?|photos?|content)|mutual connections?|profile connections?|facebook|instagram|linkedin|tiktok|twitter|x\\.com|reddit|community involvement|local community involvement|community groups?|local groups?|volunteer(?:ing)?|charit(?:y|ies) involvement)\\b",
            lowered,
        ))
        prior_messages = [m for m in (body.get("messages") or [])[:-1] if isinstance(m, dict)]
        prior_text = " ".join(
            self._text_from_content(m.get("content")) for m in prior_messages[-6:]
        ).lower()
        continuation_cue = bool(re.search(
            r"\\b(?:dig deeper|keep digging|go deeper|look further|keep looking|search further|continue(?: searching| researching)?|more(?: on this)?|what else|anything else|take another look|go on)\\b",
            lowered,
        ))
        prior_research_context = bool(re.search(
            r"(?:\\bosint\\b|public[- ]source|live research|web research|social[- ]media|facebook|instagram|linkedin|tiktok|twitter|x\\.com|https?://)",
            prior_text,
        ))
        continuation_web = bool(continuation_cue and prior_research_context)
        web_search = bool((features.get("web_search") or explicit_web or public_footprint_web or continuation_web) and not explicit_no_web)
'''

OLD_BAD_META = '''            bad_meta = (
                "cannot access the internet",
                "can't access the internet",
                "unable to access the internet",
                "cannot browse the web",
                "i should use tools",
                "i should search",
            )
'''

NEW_BAD_META = '''            bad_meta = (
                "cannot access the internet",
                "can't access the internet",
                "unable to access the internet",
                "cannot browse the web",
                "i should use tools",
                "i should search",
                "my capabilities are limited to the tools",
                "do not include public social media",
                "no function related to social media",
            )
'''


def load_source(con: sqlite3.Connection) -> str:
    row = con.execute('select content from function where id=?', (FUNCTION_ID,)).fetchone()
    if not row:
        raise SystemExit('atlas-auto function missing')
    return str(row[0])


def patch() -> None:
    if not DB.exists():
        raise SystemExit(f'OpenWebUI database missing: {DB}')
    backup = DB.with_name(f'webui.db.bak-atlas-auto-v17-{int(time.time())}')
    shutil.copy2(DB, backup)
    con = sqlite3.connect(DB)
    source = load_source(con)
    if 'ATLAS AUTO SOCIAL/RESEARCH CONTINUATION ROUTING v1.7' in source:
        compile(source, 'atlas-auto-v17', 'exec')
        print('ATLAS_AUTO_V17_ALREADY_PRESENT=true')
        print(f'BACKUP={backup}')
        return
    if OLD_BLOCK not in source:
        raise SystemExit('expected v1.6 public-footprint routing block not found; refusing blind patch')
    source = source.replace('version: 1.6.0', 'version: 1.7.0', 1)
    source = source.replace(OLD_BLOCK, NEW_BLOCK, 1)
    if OLD_BAD_META in source:
        source = source.replace(OLD_BAD_META, NEW_BAD_META, 1)
    compile(source, 'atlas-auto-v17', 'exec')
    con.execute(
        'update function set content=?, updated_at=? where id=?',
        (source, int(time.time()), FUNCTION_ID),
    )
    con.commit()
    con.close()
    print(f'BACKUP={backup}')
    print('PATCHED_ATLAS_AUTO_V17=true')


async def run_regression() -> None:
    con = sqlite3.connect(DB)
    source = load_source(con)
    con.close()
    if 'ATLAS AUTO SOCIAL/RESEARCH CONTINUATION ROUTING v1.7' not in source:
        raise SystemExit('v1.7 marker missing')
    backend = '/app/backend'
    if backend not in sys.path:
        sys.path.insert(0, backend)
    ns: dict = {}
    exec(compile(source, 'atlas-auto-live-v17', 'exec'), ns)

    async def fake_user(_uid):
        return object()

    async def local_sentinel(*_args, **_kwargs):
        return 'LOCAL_PATH_SELECTED'

    ns['Users'].get_user_by_id = staticmethod(fake_user)
    ns['generate_chat_completion'] = local_sentinel
    pipe = ns['Pipe']()
    prior = (
        'OSINT-derived background narrative with public web sources: '
        'https://example.com/source and public profile findings.'
    )
    exact = (
        'Can you dig deeper into any public social media connections or tagged posts '
        'linking Stuart A Hardman to Scott Millard or Adam Walsh?'
    )
    body = {
        'messages': [
            {'role': 'assistant', 'content': prior},
            {'role': 'user', 'content': exact},
        ],
        'features': {},
    }
    result = await pipe.pipe(body, {'id': 'regression-user'}, None, None)
    text = str(result)
    print('EXACT_RESULT_PREFIX=' + text[:1200].replace('\n', ' '))
    if text == 'LOCAL_PATH_SELECTED':
        raise SystemExit('exact social follow-up still routed local')
    low = text.lower()
    for bad in (
        'my capabilities are limited to the tools',
        'no function related to social media',
        'search_calendar_events',
        'calendar-related tasks',
    ):
        if bad in low:
            raise SystemExit(f'bad meta-output survived: {bad}')
    if len(text) <= 120:
        raise SystemExit('exact social follow-up result too short')
    print('EXACT_SOCIAL_FOLLOWUP_ROUTES_WEB=true')

    short_body = {
        'messages': [
            {'role': 'assistant', 'content': prior},
            {'role': 'user', 'content': 'Keep digging.'},
        ],
        'features': {},
    }
    short = str(await pipe.pipe(short_body, {'id': 'regression-user'}, None, None))
    print('SHORT_RESULT_PREFIX=' + short[:500].replace('\n', ' '))
    if short == 'LOCAL_PATH_SELECTED':
        raise SystemExit('terse research continuation still routed local')
    print('TERSE_RESEARCH_CONTINUATION_ROUTES_WEB=true')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--test', action='store_true')
    args = parser.parse_args()
    if args.test:
        asyncio.run(run_regression())
    else:
        patch()


if __name__ == '__main__':
    main()
