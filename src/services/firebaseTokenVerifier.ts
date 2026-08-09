/**
 * Minimal Firebase ID-token verifier for Caspa's custom Express backend.
 *
 * This follows Firebase's documented verification rules: RS256 signature using
 * Google's Secure Token certificates, matching aud/iss, non-expired timestamps,
 * and a non-empty subject (uid). It avoids requiring a new service-account secret
 * just to verify client ID tokens.
 */

import crypto from 'crypto';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'novelwrite-27763';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface FirebaseTokenPayload {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  auth_time?: number;
  email?: string;
  [key: string]: unknown;
}

let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

function decodePart<T>(part: string): T {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
}

async function getCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() < certCache.expiresAt) return certCache.certs;
  const response = await fetch(CERTS_URL, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Firebase certificate fetch failed (${response.status})`);
  const certs = await response.json() as Record<string, string>;
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 1800);
  certCache = { certs, expiresAt: Date.now() + Math.max(60, maxAge - 30) * 1000 };
  return certs;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string; payload: FirebaseTokenPayload }> {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed Firebase ID token');

  const header = decodePart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodePart<FirebaseTokenPayload>(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Firebase ID token header');

  const certs = await getCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Unknown Firebase signing key');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(cert, Buffer.from(parts[2], 'base64url'))) {
    throw new Error('Invalid Firebase ID token signature');
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) throw new Error('Expired Firebase ID token');
  if (!payload.iat || payload.iat > now + 60) throw new Error('Invalid Firebase issued-at time');
  if (payload.auth_time && payload.auth_time > now + 60) throw new Error('Invalid Firebase auth time');
  if (payload.aud !== PROJECT_ID) throw new Error('Firebase token audience mismatch');
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) throw new Error('Firebase token issuer mismatch');
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) throw new Error('Firebase token has no valid uid');

  return { uid: payload.sub, payload };
}
