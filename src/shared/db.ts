import * as sqlite from '../services/db';

export async function readCollection<T>(name: string): Promise<T[]> {
  return Promise.resolve(sqlite.readCollection<T>(name));
}

export async function writeCollection<T>(name: string, data: T[]): Promise<void> {
  return Promise.resolve(
    sqlite.writeCollection(name, data as Array<T & { id: string }>),
  );
}

export async function findById<T extends { id: string }>(
  name: string,
  id: string,
): Promise<T | null> {
  const item = sqlite.getById<T>(name, id);
  return Promise.resolve(item ?? null);
}

export async function upsert<T extends { id: string }>(
  name: string,
  item: T,
): Promise<T> {
  sqlite.upsert(name, item);
  return Promise.resolve(item);
}

export async function deleteById(name: string, id: string): Promise<boolean> {
  return Promise.resolve(sqlite.deleteById(name, id));
}

export function generateId(): string {
  return sqlite.generateId();
}
