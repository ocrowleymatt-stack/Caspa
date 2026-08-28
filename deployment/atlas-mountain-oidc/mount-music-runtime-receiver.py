#!/usr/bin/env python3
"""Mount the Atlas Music runtime receiver into every effective Atlas HTTPS vhost."""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

SNIPPET = "/etc/nginx/snippets/atlas-mountain-music-runtime-receiver.conf"
INCLUDE_LINE = f"    include {SNIPPET};\n"
CONFIG_FILE_RE = re.compile(r"^\s*# configuration file (?P<path>/[^:\r\n]+):\s*$", re.M)
SERVER_START_RE = re.compile(r"\bserver\s*\{")
HTTPS_RE = re.compile(r"\blisten\s+[^;]*\b443\b[^;]*;")
ATLAS_NAME_RE = re.compile(r"server_name\s+[^;]*\batlas\.ocrowley\.com\b[^;]*;")
ATLAS_STATIC_RE = re.compile(r"/var/www/atlas-mountain(?:/v12)?(?:/|\b)")
ATLAS_V12_RE = re.compile(r"location\s+(?:(?:=|\^~|~\*?|~)\s+)?/v12(?:/|\s|\{)")
DEPLOY_ROUTE_RE = re.compile(r"/__atlas_mountain_deploy(?:/|\b)")
MUSIC_ROUTE_RE = re.compile(r"/__atlas_mountain_music_runtime(?:/|\b)")
DEBRIS_RE = re.compile(r"(?:\.bak(?:\.|$)|\.backup(?:\.|$)|\.pre-|\.before-|\.new$|~$)", re.I)


def server_blocks(source: str):
    for start_match in SERVER_START_RE.finditer(source):
        open_brace = source.find("{", start_match.start())
        depth = 0
        close = None
        quote = None
        comment = False
        escape = False
        for index in range(open_brace, len(source)):
            char = source[index]
            if comment:
                if char == "\n":
                    comment = False
                continue
            if quote:
                if escape:
                    escape = False
                elif char == "\\":
                    escape = True
                elif char == quote:
                    quote = None
                continue
            if char == "#":
                comment = True
                continue
            if char in ('"', "'"):
                quote = char
                continue
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    close = index
                    break
        if close is not None:
            yield start_match.start(), close, source[start_match.start() : close + 1]


def effective_paths() -> list[Path]:
    result = subprocess.run(
        ["nginx", "-T"],
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
    )
    rendered = f"{result.stdout}\n{result.stderr}"
    found: dict[str, Path] = {}
    for match in CONFIG_FILE_RE.finditer(rendered):
        raw = Path(match.group("path"))
        if DEBRIS_RE.search(raw.name):
            continue
        try:
            resolved = raw.resolve()
        except OSError:
            continue
        if DEBRIS_RE.search(resolved.name) or not resolved.is_file():
            continue
        if not str(resolved).startswith(("/etc/nginx/sites-", "/etc/nginx/conf.d/")):
            continue
        found[str(resolved)] = resolved
    if not found:
        raise SystemExit("No effective nginx site configuration files were discovered from nginx -T")
    return [found[key] for key in sorted(found)]


def eligible(block: str) -> bool:
    if not HTTPS_RE.search(block):
        return False
    return bool(
        ATLAS_NAME_RE.search(block)
        or ATLAS_STATIC_RE.search(block)
        or ATLAS_V12_RE.search(block)
        or DEPLOY_ROUTE_RE.search(block)
    )


def mount_file(path: Path, backup_dir: Path, ordinal: int) -> tuple[int, Path | None]:
    source = path.read_text(encoding="utf-8")
    replacements: list[tuple[int, int, str]] = []
    for start, close, block in server_blocks(source):
        if not eligible(block):
            continue
        if MUSIC_ROUTE_RE.search(block) or SNIPPET in block:
            continue
        insert_at = block.rfind("}")
        if insert_at < 0:
            continue
        updated = block[:insert_at] + INCLUDE_LINE + block[insert_at:]
        replacements.append((start, close + 1, updated))

    if not replacements:
        return 0, None

    backup_dir.mkdir(parents=True, exist_ok=True)
    backup = backup_dir / f"{ordinal:03d}-{path.name}"
    shutil.copy2(path, backup)
    updated_source = source
    for start, end, replacement in sorted(replacements, reverse=True):
        updated_source = updated_source[:start] + replacement + updated_source[end:]
    path.write_text(updated_source, encoding="utf-8")
    return len(replacements), backup


def restore(backups: list[tuple[Path, Path]]) -> None:
    for target, backup in backups:
        shutil.copy2(backup, target)


def main() -> None:
    backup_dir = Path("/root/AtlasMountainDeploy/backups/music-runtime-nginx")
    paths = effective_paths()
    backups: list[tuple[Path, Path]] = []
    mounted = 0

    for ordinal, config_path in enumerate(paths, start=1):
        count, backup = mount_file(config_path, backup_dir, ordinal)
        if count:
            mounted += count
            assert backup is not None
            backups.append((config_path, backup))
            print(f"atlas_music_runtime_nginx_file={config_path} blocks={count}")

    # A previously mounted configuration is also valid; verify that the effective
    # source contains the Music route or include even when this run changed zero files.
    effective_text = "\n".join(path.read_text(encoding="utf-8") for path in paths)
    if mounted == 0 and MUSIC_ROUTE_RE.search(effective_text) is None and SNIPPET not in effective_text:
        raise SystemExit("No effective Atlas HTTPS vhost accepted the Music runtime receiver mount")

    check = subprocess.run(["nginx", "-t"], check=False, capture_output=True, text=True, timeout=20)
    if check.returncode != 0:
        restore(backups)
        subprocess.run(["nginx", "-t"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        raise SystemExit(f"nginx rejected Music runtime receiver mount: {check.stderr[-2000:]}")

    print(f"atlas_music_runtime_nginx_blocks_mounted={mounted}")
    print("atlas_music_runtime_nginx_valid=true")


if __name__ == "__main__":
    main()
