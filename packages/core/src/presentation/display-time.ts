/**
 * Human-readable times in America/Vancouver (Pacific) for ATIS + app metadata.
 */

const VAN = 'America/Vancouver';

/** ISO-8600 instant (e.g. fetchedAt) → local Vancouver, 12-hour. */
export function formatVancouverFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: VAN,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(d);
}

/**
 * ATIS "Last Update" line is already BC local wall time (yyyy/MM/dd, HH:mm:ss).
 * Reformat to 12-hour with Pacific label (no UTC confusion).
 */
export function formatAtisLastUpdateForDisplay(raw: string | null): string {
  if (!raw?.trim()) {
    return '—';
  }
  const m = raw.match(/^(\d{4})\/(\d{2})\/(\d{2}),\s*(\d{1,2}):(\d{2}):(\d{2})/);
  if (!m) {
    return raw.trim();
  }
  const [, y, mo, d, hh, mm] = m;
  const hour = Number.parseInt(hh, 10);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const mi = Number.parseInt(mo, 10) - 1;
  if (mi < 0 || mi > 11) {
    return raw.trim();
  }
  return `${months[mi]} ${Number.parseInt(d, 10)}, ${y} · ${h12}:${mm} ${ampm} PT`;
}
