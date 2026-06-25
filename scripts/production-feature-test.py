#!/usr/bin/env python3
"""Authenticated production feature test. Run on server: python3 scripts/production-feature-test.py"""
from __future__ import annotations

import json
import pathlib
import sys
import urllib.error
import urllib.request

BASE = 'http://127.0.0.1:3000'
ENV_PATH = pathlib.Path('/root/Caspa/.env')


def load_env(path: pathlib.Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip()
    return env


def record(results: list[tuple[str, bool]], name: str, ok: bool, detail: str = '') -> None:
    results.append((name, ok))
    suffix = f' — {detail}' if detail else ''
    print(('PASS' if ok else 'FAIL') + f'  {name}{suffix}')


def req(method: str, path: str, body: dict | None = None, token: str | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=30) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    env = load_env(ENV_PATH)
    results: list[tuple[str, bool]] = []

    try:
        health = req('GET', '/health')
        record(results, 'health', health.get('status') == 'ok')
    except Exception as error:
        record(results, 'health', False, str(error))

    candidates: list[tuple[str, str, str]] = []
    if env.get('ADMIN_EMAIL') and env.get('ADMIN_PASSWORD'):
        candidates.append((env['ADMIN_EMAIL'], env['ADMIN_PASSWORD'], 'env admin'))
    candidates.append(('admin@caspa.local', env.get('ADMIN_PASSWORD') or 'changeme', 'bootstrap admin'))

    token: str | None = None
    for email, password, label in candidates:
        try:
            login = req('POST', '/api/auth/login', {'email': email, 'password': password})
            token = login.get('data', {}).get('token')
            if login.get('success') and token:
                record(results, 'admin login', True, label)
                break
        except urllib.error.HTTPError as error:
            record(results, f'admin login ({label})', False, f'HTTP {error.code}')
        except Exception as error:
            record(results, f'admin login ({label})', False, str(error))

    if not token:
        print('\n==> Cannot run authenticated tests')
    else:
        tests: list[tuple[str, str, str, dict | None]] = [
            ('GET /api/projects', 'GET', '/api/projects', None),
            ('GET /providers', 'GET', '/providers', None),
            ('GET /api/casper/status', 'GET', '/api/casper/status', None),
            ('GET show-catalogue show-factory', 'GET', '/api/show-catalogue/show-factory', None),
            ('GET show-catalogue orchestra', 'GET', '/api/show-catalogue/orchestra', None),
            ('GET show-catalogue music-lab', 'GET', '/api/show-catalogue/music-lab', None),
            ('POST command interpret', 'POST', '/api/command/interpret', {'text': 'Summarise my novel project'}),
            ('POST intake analyse', 'POST', '/api/intake/analyse', {'projectId': 'demo', 'text': 'Research note about Milton Keynes theatre.'}),
            ('POST quality ai-smell', 'POST', '/api/quality/ai-smell', {'text': 'Sample marketing copy for a stage comedy.'}),
            ('POST music-prompt interpret', 'POST', '/api/music-prompt/interpret', {'prompt': 'Upbeat panto opening number'}),
            ('POST casper freestyle', 'POST', '/api/casper/freestyle', {'prompt': 'A Dick Turpin comedy', 'mode': 'script'}),
            ('POST publish-confidence', 'POST', '/api/publish-confidence/check', {'projectId': 'demo', 'sections': []}),
            ('POST document-render preview', 'POST', '/api/document-render/preview', {'projectId': 'demo', 'format': 'markdown'}),
        ]
        for name, method, path, body in tests:
            try:
                out = req(method, path, body, token)
                record(results, name, out.get('success') is True)
            except urllib.error.HTTPError as error:
                record(results, name, False, f'HTTP {error.code}')
            except Exception as error:
                record(results, name, False, str(error))

        try:
            providers = req('GET', '/providers', token=token).get('data', [])
            ready = [provider['name'] for provider in providers if provider.get('available')]
            label = ', '.join(ready) if ready else 'none — add API keys in .env'
            record(results, 'AI provider readiness', True, f'{len(ready)} ready ({label})')
        except Exception as error:
            record(results, 'AI provider readiness', False, str(error))

    passed = sum(1 for _, ok in results if ok)
    failed = sum(1 for _, ok in results if not ok)
    print(f'\n==> Feature test: {passed} passed, {failed} failed')
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
