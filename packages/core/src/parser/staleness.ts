/** Parse “2026/03/21, 18:34:21” style timestamps from the ATIS page. */

export function parseAtisLocalDateTime(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{4})\/(\d{2})\/(\d{2}),\s*(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6]);
  const dt = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function isSnapshotStaleByAge(
  lastUpdatedRaw: string | null,
  now: Date,
  staleAfterMs: number,
): { stale: boolean; reason: string | null } {
  if (!lastUpdatedRaw) {
    return { stale: true, reason: 'missing_last_update' };
  }
  const parsed = parseAtisLocalDateTime(lastUpdatedRaw);
  if (!parsed) {
    return { stale: true, reason: 'unparseable_last_update' };
  }
  if (now.getTime() - parsed.getTime() > staleAfterMs) {
    return { stale: true, reason: 'last_update_too_old' };
  }
  return { stale: false, reason: null };
}
