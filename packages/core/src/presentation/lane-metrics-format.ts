import type { LaneState } from '../models';

export function formatLaneSpeed(lane: LaneState): string {
  if (lane.speedKmh == null) {
    return '—';
  }
  return `${Math.round(lane.speedKmh)} km/h`;
}

export function formatLaneLengthDm(lane: LaneState): string {
  if (lane.lengthDm == null) {
    return '—';
  }
  return `${Math.round(lane.lengthDm)} dm`;
}

/** Upstream / downstream volume (VPH); collapses when equal. */
export function formatLaneVolume(lane: LaneState): string {
  const u = lane.volumeUpstreamVph;
  const d = lane.volumeDownstreamVph;
  if (u == null && d == null) {
    return '—';
  }
  if (u != null && d != null && u === d) {
    return `${u} VPH`;
  }
  if (u != null && d != null) {
    return `${u} / ${d} VPH`;
  }
  return `${u ?? d} VPH`;
}

/** Occupancy % up / down. */
export function formatLaneOccupancy(lane: LaneState): string {
  const u = lane.occupancyUpstreamPercent;
  const d = lane.occupancyDownstreamPercent;
  if (u == null && d == null) {
    return '—';
  }
  if (u != null && d != null && u === d) {
    return `${u}%`;
  }
  if (u != null && d != null) {
    return `${u}% / ${d}%`;
  }
  return `${u ?? d}%`;
}
