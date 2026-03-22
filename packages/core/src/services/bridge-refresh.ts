import type { BridgeSnapshotCache } from '../cache/snapshot-cache';
import type { FeatureFlags } from '../feature-flags';
import { defaultFeatureFlags } from '../feature-flags';
import type { Analytics } from '../logging/analytics';
import type { Crashlytics } from '../logging/crashlytics';
import type { BridgeSnapshot } from '../models';
import { buildDirectionSummary } from '../parser/inference';
import { parseAtisHtmlOrWarn } from '../parser/parse-atis-html';

export interface RefreshBridgeSnapshotInput {
  fetchHtml: () => Promise<string>;
  cache: BridgeSnapshotCache;
  now: Date;
  sourceUrl: string;
  flags?: FeatureFlags;
  analytics: Analytics;
  crashlytics: Crashlytics;
}

function emptySnapshot(now: Date, sourceUrl: string): BridgeSnapshot {
  return {
    schemaVersion: 1,
    delay: null,
    bridgeMode: 'unknown',
    towardDowntown: buildDirectionSummary('toward_downtown', '101', []),
    towardNorthShore: buildDirectionSummary('toward_north_shore', '201', []),
    parseWarnings: [{ code: 'no_data', message: 'No cached or remote data available.' }],
    refresh: {
      fetchedAt: now.toISOString(),
      lastUpdated: null,
      sourceUrl,
      parseSucceeded: false,
      isStale: true,
      staleReason: 'no_data',
    },
  };
}

function withMergedRefresh(base: BridgeSnapshot, patch: Partial<BridgeSnapshot['refresh']>): BridgeSnapshot {
  return {
    ...base,
    refresh: { ...base.refresh, ...patch },
  };
}

export async function refreshBridgeSnapshot(input: RefreshBridgeSnapshotInput): Promise<BridgeSnapshot> {
  const flags = input.flags ?? defaultFeatureFlags;
  input.analytics.track({ name: 'bridge_refresh_started', properties: { source: 'client' } });

  let html: string;
  try {
    html = await input.fetchHtml();
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    input.crashlytics.recordError(err, { phase: 'fetch' });
    input.analytics.track({ name: 'bridge_refresh_failed', properties: { reason: 'fetch' } });
    const cached = await input.cache.load();
    if (cached) {
      return withMergedRefresh(cached, {
        fetchedAt: input.now.toISOString(),
        parseSucceeded: false,
        isStale: true,
        staleReason: 'fetch_failed',
      });
    }
    const empty = emptySnapshot(input.now, input.sourceUrl);
    await input.cache.save(empty);
    return empty;
  }

  const parsed = parseAtisHtmlOrWarn(html, {
    fetchedAt: input.now,
    sourceUrl: input.sourceUrl,
    flags,
  });

  if (!parsed.snapshot) {
    input.analytics.track({ name: 'bridge_refresh_failed', properties: { reason: 'parse_null' } });
    const cached = await input.cache.load();
    if (cached) {
      return withMergedRefresh(cached, {
        fetchedAt: input.now.toISOString(),
        parseSucceeded: false,
        isStale: true,
        staleReason: 'parse_failed',
      });
    }
    const empty = emptySnapshot(input.now, input.sourceUrl);
    await input.cache.save(empty);
    return empty;
  }

  for (const w of parsed.warnings) {
    input.analytics.track({
      name: 'parse_warning',
      properties: { code: w.code },
    });
  }

  await input.cache.save(parsed.snapshot);
  input.analytics.track({ name: 'bridge_refresh_succeeded', properties: {} });
  return parsed.snapshot;
}
