import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// plotHoldService persists via localStorage (browser global). Shim it for Node.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
(globalThis as any).localStorage = new MemStorage();

import {
  emptyPlotHold,
  savePlotHold,
  loadPlotHold,
  markBeatDrafted,
  nextPendingBeat,
  type PlotBeat,
} from '../src/services/plotHoldService';

function seedHold() {
  const beats: PlotBeat[] = [
    { id: 'b1', title: 'Opening', turn: 'a', status: 'pending' },
    { id: 'b2', title: 'Midpoint', turn: 'b', status: 'pending' },
  ];
  savePlotHold(emptyPlotHold({ title: 'Test', beats }));
}

beforeEach(() => {
  (globalThis as any).localStorage.clear();
  seedHold();
});

test('markBeatDrafted marks exactly the beat with the given id', () => {
  const updated = markBeatDrafted('b1');
  assert.equal(updated?.beats.find((b) => b.id === 'b1')?.status, 'drafted');
  assert.equal(updated?.beats.find((b) => b.id === 'b2')?.status, 'pending');
});

test('the drafted status persists to storage', () => {
  markBeatDrafted('b1');
  const reloaded = loadPlotHold();
  assert.equal(reloaded?.beats.find((b) => b.id === 'b1')?.status, 'drafted');
});

test('nextPendingBeat advances after a beat is drafted (the continue superpower)', () => {
  assert.equal(nextPendingBeat(loadPlotHold())?.id, 'b1');
  markBeatDrafted('b1');
  assert.equal(nextPendingBeat(loadPlotHold())?.id, 'b2', 'must advance to the next pending beat');
});

test('a wrong identity (e.g. a title instead of an id) marks nothing — guards the fixed bug', () => {
  const updated = markBeatDrafted('Opening'); // title, not id
  assert.equal(updated?.beats.every((b) => b.status === 'pending'), true);
});
