import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { getConfig } from '../shared/config';
import { logger } from '../shared/logger';

let db: Database.Database | null = null;

function getDbPath(): string {
  const { dataDir } = getConfig();
  return path.join(dataDir, 'caspa.db');
}

function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        name TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (name, id)
      )
    `);
  }
  return db;
}

export function readCollection<T>(name: string): T[] {
  const rows = getDb()
    .prepare('SELECT data FROM collections WHERE name = ?')
    .all(name) as { data: string }[];
  return rows.map((row) => JSON.parse(row.data) as T);
}

export function writeCollection<T extends { id: string }>(name: string, items: T[]): void {
  const database = getDb();
  const write = database.transaction((records: T[]) => {
    database.prepare('DELETE FROM collections WHERE name = ?').run(name);
    const insert = database.prepare(
      'INSERT INTO collections (name, id, data) VALUES (?, ?, ?)',
    );
    for (const item of records) {
      insert.run(name, item.id, JSON.stringify(item));
    }
  });
  write(items);
}

export function getById<T>(name: string, id: string): T | undefined {
  const row = getDb()
    .prepare('SELECT data FROM collections WHERE name = ? AND id = ?')
    .get(name, id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : undefined;
}

export function upsert<T extends { id: string }>(name: string, item: T): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO collections (name, id, data) VALUES (?, ?, ?)')
    .run(name, item.id, JSON.stringify(item));
}

export function deleteById(name: string, id: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM collections WHERE name = ? AND id = ?')
    .run(name, id);
  return result.changes > 0;
}

export function generateId(): string {
  return nanoid(12);
}

function normalizeCollectionName(filename: string): string {
  const base = filename.replace(/\.json$/i, '');
  return base
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function collectionHasRows(name: string): boolean {
  const row = getDb().prepare('SELECT 1 FROM collections WHERE name = ? LIMIT 1').get(name);
  return row !== undefined;
}

export function runMigrations(): void {
  const { dataDir } = getConfig();
  const resolvedDir = path.resolve(dataDir);

  if (!fs.existsSync(resolvedDir)) {
    return;
  }

  const files = fs.readdirSync(resolvedDir);

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const jsonPath = path.join(resolvedDir, file);
    const migratedPath = `${jsonPath}.migrated`;

    if (fs.existsSync(migratedPath)) {
      continue;
    }

    const collectionName = normalizeCollectionName(file);

    if (collectionHasRows(collectionName)) {
      continue;
    }

    const content = fs.readFileSync(jsonPath, 'utf-8');
    const items = JSON.parse(content) as { id: string }[];

    if (!Array.isArray(items)) {
      logger.warn(`Skipping ${file}: not a JSON array`);
      continue;
    }

    for (const item of items) {
      if (item && typeof item.id === 'string') {
        upsert(collectionName, item);
      }
    }

    fs.renameSync(jsonPath, migratedPath);
    logger.info(
      `Migrated data/${file} → SQLite collection '${collectionName}' (${items.length} records)`,
    );
  }
}
