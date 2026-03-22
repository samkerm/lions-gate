import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseAtisHtml } from '../parser/parse-atis-html';

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, '..', 'fixtures', name), 'utf8');
}

describe('parseAtisHtml', () => {
  it('parses last update, DMS delay, and VDS lanes from normal fixture', () => {
    const html = loadFixture('normal.html');
    const res = parseAtisHtml(html, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      sourceUrl: 'https://example.test',
      flags: { primarySouthCausewayVdsIds: ['101', '201'], staleAfterMs: 600_000 },
    });
    expect(res.snapshot).not.toBeNull();
    expect(res.snapshot?.refresh.lastUpdated).toBe('2026/03/21, 18:34:21');
    expect(res.snapshot?.delay?.delayMinutes).toBe(90);
    expect(res.snapshot?.towardDowntown.lanes).toHaveLength(2);
    expect(res.snapshot?.towardDowntown.lanes[0]?.health).toBe('counterflow_closed');
    expect(res.snapshot?.towardDowntown.lanes[1]?.health).toBe('open');
    expect(res.snapshot?.bridgeMode).toBe('counterflow_active');
  });

  it('marks stale when last update is too old', () => {
    const html = loadFixture('stale.html');
    const res = parseAtisHtml(html, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      flags: { primarySouthCausewayVdsIds: ['101', '201'], staleAfterMs: 600_000 },
    });
    expect(res.snapshot?.refresh.isStale).toBe(true);
    expect(res.snapshot?.delay?.delayMinutes).toBe(25);
  });

  it('tolerates malformed tags but still extracts lanes', () => {
    const html = loadFixture('malformed.html');
    const res = parseAtisHtml(html, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      flags: { primarySouthCausewayVdsIds: ['101', '201'], staleAfterMs: 600_000 },
    });
    expect(res.snapshot?.towardDowntown.lanes.length).toBeGreaterThan(0);
  });

  it('returns null delay minutes when no MIN/HR token', () => {
    const html = loadFixture('no-delay.html');
    const res = parseAtisHtml(html, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      flags: { primarySouthCausewayVdsIds: ['101', '201'], staleAfterMs: 600_000 },
    });
    expect(res.snapshot?.delay?.delayMinutes).toBeNull();
  });

  it('classifies error-heavy lanes as degraded', () => {
    const html = loadFixture('error-heavy.html');
    const res = parseAtisHtml(html, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      flags: { primarySouthCausewayVdsIds: ['101', '201'], staleAfterMs: 600_000 },
    });
    expect(res.snapshot?.delay?.delayMinutes).toBe(120);
    expect(res.snapshot?.towardDowntown.lanes[0]?.health).toBe('degraded');
    expect(res.snapshot?.bridgeMode).toBe('partial_or_degraded');
  });

  it('detects counterflow on a single lane', () => {
    const html = loadFixture('counterflow-one-lane.html');
    const res = parseAtisHtml(html, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      flags: { primarySouthCausewayVdsIds: ['101', '201'], staleAfterMs: 600_000 },
    });
    expect(res.snapshot?.bridgeMode).toBe('counterflow_active');
    expect(res.snapshot?.delay?.delayMinutes).toBe(10);
  });
});
