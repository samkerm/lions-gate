import type { LaneState } from '../models';

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

/**
 * When either loop reports occupancy above this (max of upstream/downstream %), we treat the
 * lane as “traffic-ish” and tint from averaged speed. At or below → free-flow default green.
 * (Typical engineering band is ~5–9%; start at 6 and tune from field feedback.)
 */
export const OCCUPANCY_FREE_FLOW_MAX_PERCENT = 6;

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

function maxLoopOccupancyPercent(lane: LaneState): number | null {
  const u = lane.occupancyUpstreamPercent;
  const d = lane.occupancyDownstreamPercent;
  if (u === null && d === null) {
    return null;
  }
  return Math.max(u ?? 0, d ?? 0);
}

/**
 * Low occupancy (0%, 1–2%, … up to {@link OCCUPANCY_FREE_FLOW_MAX_PERCENT}) means the lane is
 * effectively free — use default green. Above that, speed drives the slow→pale traffic tint.
 * If both loops are missing, we only have speed (no occupancy signal).
 */
function isFreeFlowByOccupancy(lane: LaneState): boolean {
  const maxOcc = maxLoopOccupancyPercent(lane);
  if (maxOcc === null) {
    return false;
  }
  return maxOcc <= OCCUPANCY_FREE_FLOW_MAX_PERCENT;
}

/**
 * Same gradient as {@link greenHexForAveragedSpeed}, with occupancy gating: low loop % → default
 * green; higher % → tint from averaged speed (incl. empty-bridge 0 km/h + 0% as free).
 */
export function greenHexForLaneSpeedTint(lane: LaneState | null): string {
  if (!lane) {
    return DEFAULT_GREEN_HEX;
  }
  if (isFreeFlowByOccupancy(lane)) {
    return DEFAULT_GREEN_HEX;
  }
  return greenHexForAveragedSpeed(lane.speedKmh);
}
