import type { BridgePerspective, BridgeSnapshot, LaneDirectionSummary, LaneState } from '../models';

/** Minimum km/h gap (approach slower than bridge) before we hint at a forming queue. */
const GAP_KMH = 15;
const MIN_SPEED_KMH = 5;
/** Need at least this many lanes with valid speeds on the wide approach for a stable mean. */
const MIN_APPROACH_SAMPLES = 2;

function meanValidSpeedKmh(lanes: LaneState[]): number | null {
  const speeds = lanes
    .map((l) => l.speedKmh)
    .filter((s): s is number => s != null && s >= MIN_SPEED_KMH);
  if (speeds.length === 0) {
    return null;
  }
  return speeds.reduce((a, b) => a + b, 0) / speeds.length;
}

/** Bridge deck L1 + L2 only (same geometry as the three-lane UI). */
function bridgeDeckMeanSpeed(summary: LaneDirectionSummary): number | null {
  const l1 = summary.lanes.find((l) => l.laneNumber === 1);
  const l2 = summary.lanes.find((l) => l.laneNumber === 2);
  const lanes = [l1, l2].filter((x): x is LaneState => x != null);
  return meanValidSpeedKmh(lanes);
}

export type ApproachQueueHint =
  | { kind: 'none' }
  | {
      kind: 'possible_queue';
      message: string;
      approachMeanKmh: number;
      bridgeMeanKmh: number;
      gapKmh: number;
    };

/**
 * When DMS reports no delay, compare south-of-Marine merge speeds (VDS 103 / 203) to the
 * bridge deck (102 / 202). If the approach is materially slower, traffic may be backing up
 * before the bridge.
 */
export function approachQueueHint(
  snapshot: BridgeSnapshot,
  perspective: BridgePerspective,
): ApproachQueueHint {
  if (perspective === 'unknown') {
    return { kind: 'none' };
  }

  const dm = snapshot.delay?.delayMinutes;
  if (dm != null && dm > 0) {
    return { kind: 'none' };
  }

  const bridge: LaneDirectionSummary =
    perspective === 'downtown_vancouver' ? snapshot.towardNorthShore : snapshot.towardDowntown;
  const approach: LaneDirectionSummary | null =
    perspective === 'downtown_vancouver'
      ? snapshot.approachTowardNorthShore ?? null
      : snapshot.approachTowardDowntown ?? null;

  if (!approach) {
    return { kind: 'none' };
  }

  const approachSamples = approach.lanes.filter(
    (l) => l.speedKmh != null && l.speedKmh >= MIN_SPEED_KMH,
  );
  if (approachSamples.length < MIN_APPROACH_SAMPLES) {
    return { kind: 'none' };
  }

  const approachMean = meanValidSpeedKmh(approach.lanes);
  const bridgeMean = bridgeDeckMeanSpeed(bridge);

  if (bridgeMean == null || approachMean == null) {
    return { kind: 'none' };
  }

  const gap = bridgeMean - approachMean;
  if (gap < GAP_KMH) {
    return { kind: 'none' };
  }

  return {
    kind: 'possible_queue',
    message:
      'Merge approach is slower than the bridge — a queue may be building before the crossing.',
    approachMeanKmh: approachMean,
    bridgeMeanKmh: bridgeMean,
    gapKmh: gap,
  };
}
