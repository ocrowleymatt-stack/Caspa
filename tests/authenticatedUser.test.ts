import assert from 'node:assert/strict';
import test from 'node:test';
import { requireAuthenticatedUser } from '../src/middleware/authenticatedUser';

function mockRes() {
  const res: any = { statusCode: 200, body: null, locals: {} };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
}

test('authentication accepts only Authentik uid plus the proxy secret', () => {
  const previous = process.env.CASPA_PROXY_SHARED_SECRET;
  process.env.CASPA_PROXY_SHARED_SECRET = 'proxy-secret';
  try {
    let nextCalls = 0;
    const ok = mockRes();
    requireAuthenticatedUser(
      { headers: { 'x-caspa-proxy-secret': 'proxy-secret', 'x-authentik-uid': 'ak-user' } } as any,
      ok,
      () => { nextCalls += 1; },
    );
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.locals.caspaUser.id, 'ak-user');
    assert.equal(nextCalls, 1);

    const forged = mockRes();
    requireAuthenticatedUser(
      { headers: { 'x-caspa-proxy-secret': 'proxy-secret', 'x-caspa-user-id': 'forged-user' } } as any,
      forged,
      () => { nextCalls += 1; },
    );
    assert.equal(forged.statusCode, 401);
    assert.equal(forged.locals.caspaUser, undefined);
    assert.equal(nextCalls, 1);

    const mixed = mockRes();
    requireAuthenticatedUser(
      {
        headers: {
          'x-caspa-proxy-secret': 'proxy-secret',
          'x-authentik-uid': 'ak-user',
          'x-caspa-user-id': 'forged-user',
          'x-caspa-user-email': 'forged@example.test',
        },
      } as any,
      mixed,
      () => { nextCalls += 1; },
    );
    assert.equal(mixed.locals.caspaUser.id, 'ak-user');
    assert.equal(mixed.locals.caspaUser.email, '');
    assert.equal(nextCalls, 2);
  } finally {
    if (previous === undefined) delete process.env.CASPA_PROXY_SHARED_SECRET;
    else process.env.CASPA_PROXY_SHARED_SECRET = previous;
  }
});
