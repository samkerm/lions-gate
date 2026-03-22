import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { BridgeSnapshotCache } from '../cache/snapshot-cache';
import { noopAnalytics } from '../logging/analytics';
import { noopCrashlytics } from '../logging/crashlytics';
import type { BridgeSnapshot } from '../models';
import { refreshBridgeSnapshot } from '../services/bridge-refresh';

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');
}

function memoryCache(): BridgeSnapshotCache {
  let last: BridgeSnapshot | null = null;
  return {
    async load() {
      return last;
    },
    async save(s) {
      last = s;
    },
  };
}

describe('refreshBridgeSnapshot', () => {
  it('runs fetch + parse + cache save', async () => {
    const html = loadFixture('normal.html');
    const cache = memoryCache();
    const snap = await refreshBridgeSnapshot({
      fetchHtml: async () => html,
      cache,
      now: new Date('2026-03-21T18:35:00'),
      sourceUrl: 'https://example.test',
      flags: { primarySouthCausewayVdsIds: ['101', '201'], staleAfterMs: 600_000 },
      analytics: noopAnalytics,
      crashlytics: noopCrashlytics,
    });
    expect(snap.towardDowntown.lanes.length).toBeGreaterThan(0);
    const cached = await cache.load();
    expect(cached?.towardDowntown.lanes.length).toBe(snap.towardDowntown.lanes.length);
  });

  it('falls back to cache on fetch failure', async () => {
    const html = loadFixture('normal.html');
    const cache = memoryCache();
    await refreshBridgeSnapshot({
      fetchHtml: async () => html,
      cache,
      now: new Date('2026-03-21T18:35:00'),
      sourceUrl: 'https://example.test',
      flags: { primarySouthCausewayVdsIds: ['101', '201'], staleAfterMs: 600_000 },
      analytics: noopAnalytics,
      crashlytics: noopCrashlytics,
    });
    const bad = await refreshBridgeSnapshot({
      fetchHtml: async () => {
        throw new Error('network');
      },
      cache,
      now: new Date('2026-03-21T18:40:00'),
      sourceUrl: 'https://example.test',
      flags: { primarySouthCausewayVdsIds: ['101', '201'], staleAfterMs: 600_000 },
      analytics: noopAnalytics,
      crashlytics: noopCrashlytics,
    });
    expect(bad.refresh.isStale).toBe(true);
    expect(bad.refresh.staleReason).toBe('fetch_failed');
  });
});
