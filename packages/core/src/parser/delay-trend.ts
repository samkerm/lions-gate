import type { DelayTrend } from '../models';

/** Compare sign delay to prior DMS cycle (e.g. 5 min now vs 10 min previously). */
export function computeDelayTrend(current: number | null, previous: number | null): DelayTrend {
  if (current == null || previous == null) {
    return 'unknown';
  }
  if (current > previous) {
    return 'up';
  }
  if (current < previous) {
    return 'down';
  }
  return 'flat';
}

/** Bridge-wide DMS delay: moderate = yellow on black; heavy = red. */
export type DelayBannerStyle = 'none' | 'yellow' | 'red';

export function delayBannerStyle(delayMinutes: number | null): DelayBannerStyle {
  if (delayMinutes == null || delayMinutes <= 0) {
    return 'none';
  }
  if (delayMinutes >= 6) {
    return 'red';
  }
  return 'yellow';
}
