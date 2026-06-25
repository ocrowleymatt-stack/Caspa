#!/usr/bin/env tsx
/**
 * Casper Freestyle CLI — natural language command interface
 * Usage: npm run casper -- "check quality on my project"
 */
const API_BASE = process.env.CASPA_API_URL ?? 'http://localhost:3000';
const TOKEN = process.env.CASPA_TOKEN ?? '';

async function main(): Promise<void> {
  const input = process.argv.slice(2).join(' ').trim();
  if (!input) {
    console.log('Casper Freestyle CLI');
    console.log('Usage: npm run casper -- "your command here"');
    console.log('Env: CASPA_API_URL, CASPA_TOKEN');
    process.exit(0);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const res = await fetch(`${API_BASE}/api/casper/freestyle`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ input }),
  });

  const json = (await res.json()) as { success: boolean; data?: unknown; error?: string };
  if (!json.success) {
    console.error('Error:', json.error ?? res.status);
    process.exit(1);
  }

  console.log(JSON.stringify(json.data, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
