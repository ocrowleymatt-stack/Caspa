#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TARGET=/root/AtlasMountainDeploy
RECEIVER_SNIPPET=/etc/nginx/snippets/atlas-mountain-deploy-receiver.conf
MUSIC_RECEIVER_SNIPPET=/etc/nginx/snippets/atlas-mountain-music-runtime-receiver.conf
SERVICE=atlas-mountain-deploy-receiver.service
QISKIT_VENV=/var/lib/atlas-mountain/qiskit-venv
QISKIT_VERSION=2.5.1

[[ "$EUID" -eq 0 ]] || { echo 'bootstrap must run as root' >&2; exit 2; }
command -v node >/dev/null
command -v nginx >/dev/null
command -v flock >/dev/null
command -v python3 >/dev/null
nginx -t >/dev/null
curl -fsS --max-time 5 http://127.0.0.1:3002/health >/dev/null

node_major="$(node -p 'process.versions.node.split(`.`)[0]')"
(( node_major >= 22 )) || { echo "Node 22+ required; found $node_major" >&2; exit 2; }

if ! id atlasmountain >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/atlas-mountain --create-home --shell /usr/sbin/nologin atlasmountain
fi

# Every path named in the receiver's ReadWritePaths must exist before systemd
# creates the service mount namespace, otherwise systemd exits with 226/NAMESPACE.
install -d -o root -g root -m 0700 "$TARGET" "$TARGET/inbox" "$TARGET/backups" "$TARGET/logs"
install -d -o root -g root -m 0755 /opt/atlas-mountain /opt/atlas-mountain/releases /var/www/atlas-mountain /etc/nginx/snippets
install -d -o root -g atlasmountain -m 0750 /etc/atlas-mountain
install -d -o atlasmountain -g atlasmountain -m 0750 /var/lib/atlas-mountain /var/lib/atlas-mountain/workspace

# Qiskit is deployment infrastructure, not an on-demand browser download. Keep it
# outside immutable Atlas releases so the scientific compiler is persistent and
# cannot inflate the signed deployment archive. The service account owns only the
# venv under its existing writable data root.
qiskit_ready=false
if [[ -x "$QISKIT_VENV/bin/python" ]]; then
  if runuser -u atlasmountain -- "$QISKIT_VENV/bin/python" - <<PY >/dev/null 2>&1
import qiskit
raise SystemExit(0 if qiskit.__version__ == '$QISKIT_VERSION' else 1)
PY
  then
    qiskit_ready=true
  fi
fi
if [[ "$qiskit_ready" != true ]]; then
  rm -rf "$QISKIT_VENV"
  runuser -u atlasmountain -- python3 -m venv "$QISKIT_VENV"
  runuser -u atlasmountain -- "$QISKIT_VENV/bin/python" -m pip install \
    --disable-pip-version-check \
    --no-input \
    "qiskit==$QISKIT_VERSION"
fi

# Exercise the actual preset-pass-manager path used by Atlas. This is local only:
# no IBM credentials are loaded and no QPU/network job can be submitted.
runuser -u atlasmountain -- "$QISKIT_VENV/bin/python" - <<'PY'
from qiskit import QuantumCircuit, __version__ as qiskit_version
from qiskit.transpiler import CouplingMap, generate_preset_pass_manager

qc = QuantumCircuit(2, 2)
qc.h(0)
qc.cx(0, 1)
qc.measure([0, 1], [0, 1])
pm = generate_preset_pass_manager(
    optimization_level=1,
    basis_gates=['rz', 'sx', 'x', 'ecr'],
    coupling_map=CouplingMap([[0, 1], [1, 0]]),
    seed_transpiler=7331,
)
compiled = pm.run(qc)
assert compiled.depth() > 0
assert compiled.num_qubits >= 2
print('atlas_qiskit_runtime=true')
print('qiskit_version=' + qiskit_version)
PY

install -o root -g root -m 0600 "$SOURCE_DIR/receiver.mjs" "$TARGET/receiver.mjs"
install -o root -g root -m 0700 "$SOURCE_DIR/deploy.sh" "$TARGET/deploy.sh"
install -o root -g root -m 0700 "$SOURCE_DIR/deploy-runner.sh" "$TARGET/deploy-runner.sh"
install -o root -g root -m 0700 "$SOURCE_DIR/mount-music-runtime-receiver.py" "$TARGET/mount-music-runtime-receiver.py"
install -o root -g root -m 0644 "$SOURCE_DIR/atlas-mountain-nexus.service" "$TARGET/atlas-mountain-nexus.service"
install -o root -g root -m 0644 "$SOURCE_DIR/nginx-app.conf" "$TARGET/nginx-app.conf"
install -o root -g root -m 0644 "$SOURCE_DIR/nginx-receiver.conf" "$RECEIVER_SNIPPET"
install -o root -g root -m 0644 "$SOURCE_DIR/nginx-music-runtime-receiver.conf" "$MUSIC_RECEIVER_SNIPPET"
install -o root -g root -m 0644 "$SOURCE_DIR/atlas-mountain-deploy-receiver.service" "/etc/systemd/system/$SERVICE"

mapfile -t candidates < <(
  grep -RIl --include='*.conf' --include='*' 'atlas\.ocrowley\.com' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null \
    | while read -r f; do readlink -f "$f"; done | sort -u
)
vhost=""
for candidate in "${candidates[@]}"; do
  if grep -Eq 'server_name[^;]*atlas\.ocrowley\.com' "$candidate"; then vhost="$candidate"; break; fi
done
[[ -n "$vhost" ]] || { echo 'atlas.ocrowley.com nginx vhost not found' >&2; exit 2; }
backup="${vhost}.mountain-receiver.$(date -u +%Y%m%dT%H%M%SZ).bak"
cp -a "$vhost" "$backup"

python3 - "$vhost" <<'PY'
import re, sys
path=sys.argv[1]
text=open(path, encoding='utf-8').read()
inc='/etc/nginx/snippets/atlas-mountain-deploy-receiver.conf'
if inc in text:
    raise SystemExit(0)
m=re.search(r'server_name\s+[^;]*\batlas\.ocrowley\.com\b[^;]*;', text)
if not m: raise SystemExit('server_name not found')
starts=list(re.finditer(r'\bserver\s*\{', text[:m.start()]))
if not starts: raise SystemExit('server block start not found')
open_pos=text.find('{', starts[-1].start())
depth=0; quote=None; comment=False; escape=False; close=None
for i in range(open_pos, len(text)):
    c=text[i]
    if comment:
        if c=='\n': comment=False
        continue
    if quote:
        if escape: escape=False
        elif c=='\\': escape=True
        elif c==quote: quote=None
        continue
    if c=='#': comment=True; continue
    if c in ('"', "'"): quote=c; continue
    if c=='{': depth+=1
    elif c=='}':
        depth-=1
        if depth==0: close=i; break
if close is None or close < m.end(): raise SystemExit('server block end not found')
text=text[:close]+'    include /etc/nginx/snippets/atlas-mountain-deploy-receiver.conf;\n'+text[close:]
open(path,'w',encoding='utf-8').write(text)
PY

# Atlas currently has more than one effective HTTPS edge. Mount the narrow Music
# receiver into every Atlas-serving block so public DNS cannot land on a sibling
# static/auth vhost that answers the POST itself instead of proxying it.
python3 "$TARGET/mount-music-runtime-receiver.py"

if ! nginx -t; then
  cp -a "$backup" "$vhost"
  nginx -t >/dev/null 2>&1 || true
  echo 'receiver nginx change rejected and rolled back' >&2
  exit 2
fi

systemctl daemon-reload
systemctl reset-failed "$SERVICE" >/dev/null 2>&1 || true
systemctl enable --now "$SERVICE"
systemctl restart "$SERVICE"
for _ in $(seq 1 20); do
  curl -fsS --max-time 3 http://127.0.0.1:3016/health >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 5 http://127.0.0.1:3016/health >/dev/null
systemctl reload nginx

# Public routes exist but reject requests without the correct signed GitHub OIDC token.
deploy_status="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 -X POST \
  -H 'Content-Type: application/json' --data '{}' \
  https://atlas.ocrowley.com/__atlas_mountain_deploy/v1 || true)"
[[ "$deploy_status" == '401' ]] || { echo "unexpected public deploy receiver status: ${deploy_status:-000}" >&2; exit 2; }

music_status="$(curl -ksS -o /dev/null -w '%{http_code}' --max-time 8 -X POST \
  -H 'Content-Type: application/json' --data '{}' \
  https://atlas.ocrowley.com/__atlas_mountain_music_runtime/v1 || true)"
[[ "$music_status" == '401' ]] || { echo "unexpected public music runtime receiver status: ${music_status:-000}" >&2; exit 2; }

curl -fsS --max-time 8 https://atlas.ocrowley.com/health >/dev/null

echo 'atlas_mountain_receiver_bootstrap=true'
echo 'receiver_local_health=ok'
echo "receiver_public_unauthenticated=$deploy_status"
echo "music_runtime_receiver_public_unauthenticated=$music_status"
echo 'existing_atlas_health=ok'
