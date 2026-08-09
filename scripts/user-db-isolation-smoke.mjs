const base = 'https://caspa.ocrowley.com/api/caspa/storage';
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const scopeA = `device-isolation-A-${stamp}`;
const scopeB = `device-isolation-B-${stamp}`;
const headersA = { 'content-type': 'application/json', 'x-caspa-local-scope': scopeA };
const headersB = { 'content-type': 'application/json', 'x-caspa-local-scope': scopeB };

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

let backupId = '';
try {
  const unauth = await json(`${base}/backups`);
  if (unauth.response.status !== 401) throw new Error(`Unauthenticated backup listing should be 401, got ${unauth.response.status}`);

  const created = await json(`${base}/backup`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      entries: { 'caspa.userIsolationSmoke': `A:${stamp}`, 'ls_user_isolation_smoke': 'A-only' },
      label: `isolation-smoke-${stamp}`,
    }),
  });
  if (!created.response.ok || !created.body?.data?.id) throw new Error(`Scope A backup creation failed: ${JSON.stringify(created.body)}`);
  backupId = created.body.data.id;

  const listA = await json(`${base}/backups`, { headers: headersA });
  if (!listA.response.ok) throw new Error(`Scope A list failed: ${listA.response.status}`);
  const visibleA = (listA.body?.data?.backups || []).some((b) => b.id === backupId);
  if (!visibleA) throw new Error('Scope A cannot see its own backup');

  const listB = await json(`${base}/backups`, { headers: headersB });
  if (!listB.response.ok) throw new Error(`Scope B list failed: ${listB.response.status}`);
  const leakedToB = (listB.body?.data?.backups || []).some((b) => b.id === backupId);
  if (leakedToB) throw new Error('ISOLATION FAILURE: Scope B can list Scope A backup');

  const restoreB = await json(`${base}/restore/${backupId}`, { headers: headersB });
  if (restoreB.response.status !== 404) throw new Error(`ISOLATION FAILURE: Scope B restore returned ${restoreB.response.status}, expected 404`);

  const restoreA = await json(`${base}/restore/${backupId}`, { headers: headersA });
  if (!restoreA.response.ok) throw new Error(`Scope A cannot restore its own backup: ${restoreA.response.status}`);
  if (restoreA.body?.data?.entries?.['caspa.userIsolationSmoke'] !== `A:${stamp}`) {
    throw new Error('Scope A restore content mismatch');
  }

  console.log(JSON.stringify({
    ok: true,
    unauthenticatedList: 'blocked-401',
    scopeAOwnBackup: 'visible-and-restorable',
    scopeBListLeak: false,
    scopeBRestore: 'blocked-404',
    backupId,
  }));
} finally {
  if (backupId) {
    const deleted = await json(`${base}/backups/${backupId}`, { method: 'DELETE', headers: headersA }).catch(() => null);
    console.log(JSON.stringify({ cleanup: Boolean(deleted?.response?.ok), backupId }));
  }
}
