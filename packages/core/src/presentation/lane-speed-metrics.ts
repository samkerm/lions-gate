import type { LaneDirectionSummary, LaneState } from '../models';

const MIN_SPEED_FOR_MEAN_KMH = 5;

function meanValidSpeedKmh(lanes: LaneState[]): number | null {
  const speeds = lanes
    .map((l) => l.speedKmh)
    .filter((s): s is number => s != null && s >= MIN_SPEED_FOR_MEAN_KMH);
  if (speeds.length === 0) {
    return null;
  }
  return speeds.reduce((a, b) => a + b, 0) / speeds.length;
}

/** Bridge deck L1 + L2 only (same geometry as the three-lane UI). */
export function bridgeDeckMeanSpeedKmh(summary: LaneDirectionSummary): number | null {
  const l1 = summary.lanes.find((l) => l.laneNumber === 1);
  const l2 = summary.lanes.find((l) => l.laneNumber === 2);
  const lanes = [l1, l2].filter((x): x is LaneState => x != null);
  return meanValidSpeedKmh(lanes);
}

/** Minimum reported speed across all lanes (includes stall speeds 0–4 km/h). */
export function minLaneSpeedAllLanesKmh(lanes: LaneState[]): number | null {
  const speeds = lanes
    .map((l) => l.speedKmh)
    .filter((s): s is number => s != null && Number.isFinite(s) && s >= 0);
  if (speeds.length === 0) {
    return null;
  }
  return Math.min(...speeds);
}
