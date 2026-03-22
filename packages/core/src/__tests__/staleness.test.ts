import { isSnapshotStaleByAge, parseAtisLocalDateTime } from '../parser/staleness';

describe('staleness', () => {
  it('parses ATIS datetime strings', () => {
    const d = parseAtisLocalDateTime('2026/03/21, 18:34:21');
    expect(d?.getFullYear()).toBe(2026);
  });

  it('flags stale when beyond threshold', () => {
    const now = new Date('2026-03-21T18:40:00');
    const res = isSnapshotStaleByAge('2026/03/21, 18:34:21', now, 10 * 60 * 1000);
    expect(res.stale).toBe(false);
    const stale = isSnapshotStaleByAge('2026/03/21, 17:00:00', now, 10 * 60 * 1000);
    expect(stale.stale).toBe(true);
  });
});
