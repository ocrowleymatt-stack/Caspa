#!/usr/bin/env python3
"""Receive an official ChatGPT export directly on a server without staging on a laptop.

Run interactively over SSH. Never paste the expiring export URL into GitHub,
shell commands, logs, or ChatGPT. This tool downloads only; it does not upload
to Dropbox or process the archive.
"""
import getpass
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone

def main():
    root = Path(os.environ.get("ATLAS_ARCHIVE_DIR", str(Path.home() / "atlas-private-archives"))).expanduser()
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(root, 0o700)
    free = shutil.disk_usage(root).free
    print(f"Destination: {root}; free disk: {free / (1024**3):.2f} GiB")
    url = getpass.getpass("Paste official ChatGPT export download URL (hidden): ").strip()
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("Only HTTPS export links are accepted")
    minimum_reserve = int(os.environ.get("ATLAS_MIN_FREE_BYTES", str(5 * 1024**3)))
    if free <= minimum_reserve:
        raise RuntimeError("Insufficient free space above reserve; aborting")
    request = urllib.request.Request(url, headers={"User-Agent": "ATLAS-Archive-Receiver/1.0"})
    fd, temporary = tempfile.mkstemp(prefix=".incoming-", suffix=".zip", dir=root)
    os.fchmod(fd, 0o600)
    digest = hashlib.sha256()
    total = 0
    try:
        with urllib.request.urlopen(request, timeout=90) as response, os.fdopen(fd, "wb") as out:
            length = response.headers.get("Content-Length")
            if length and int(length) > free - minimum_reserve:
                raise RuntimeError("Export exceeds available disk space after reserve")
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > free - minimum_reserve:
                    raise RuntimeError("Export exceeds disk budget")
                digest.update(chunk)
                out.write(chunk)
            out.flush()
            os.fsync(out.fileno())
        import zipfile
        if not zipfile.is_zipfile(temporary):
            raise RuntimeError("Downloaded file is not a ZIP archive")
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        final = root / f"chatgpt-export-{stamp}.zip"
        os.replace(temporary, final)
        manifest = {"filename": final.name, "bytes": total, "sha256": digest.hexdigest(),
                    "received_at_utc": datetime.now(timezone.utc).isoformat()}
        manifest_path = root / (final.name + ".manifest.json")
        with os.fdopen(os.open(manifest_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as f:
            json.dump(manifest, f, indent=2)
        print(json.dumps(manifest, indent=2))
        print("Private archive received. Dropbox backup and ATLAS ingestion NOT yet performed.")
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Transfer failed: {exc}", file=sys.stderr)
        sys.exit(1)
