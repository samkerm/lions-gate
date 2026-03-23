/**
 * Map “Last Averaged Lane Data” speed to a green fill: slower → lighter, faster → slightly
 * darker, with a capped maximum darkness so it stays pleasant on dark UI.
 */
const DEFAULT_GREEN_HEX = '#22c55e';

/** RGB for very light green (queued / slow). */
const SLOW_RGB: readonly [number, number, number] = [220, 252, 231];
/** RGB cap — green-500-ish; avoids going as dark as forest green. */
const FAST_RGB: readonly [number, number, number] = [34, 197, 94];

/** Bridge lanes rarely exceed this; speeds above are clamped for the gradient. */
const MAX_SPEED_KMH = 90;

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** `speedKmh` normalized against 0…90 km/h (values above 90 treated as 90); null → default mid green. */
export function greenHexForAveragedSpeed(speedKmh: number | null): string {
  if (speedKmh == null || !Number.isFinite(speedKmh) || speedKmh < 0) {
    return DEFAULT_GREEN_HEX;
  }
  const capped = Math.min(speedKmh, MAX_SPEED_KMH);
  const t = clamp01(capped / MAX_SPEED_KMH);
  const r = lerpChannel(SLOW_RGB[0], FAST_RGB[0], t);
  const g = lerpChannel(SLOW_RGB[1], FAST_RGB[1], t);
  const b = lerpChannel(SLOW_RGB[2], FAST_RGB[2], t);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
