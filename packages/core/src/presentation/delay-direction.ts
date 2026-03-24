import type { BridgePerspective, BridgeSnapshot } from '../models';
import { bridgeDeckMeanSpeedKmh, minLaneSpeedAllLanesKmh } from './lane-speed-metrics';

/**
 * DMS delay is bridge-wide; loop data helps guess whether the queue is mostly on the
 * North Shore merge (VDS 103) vs the downtown/park end (VDS 101). See `docs/delays-and-vds-stations.md`.
 */
export type InferredDelaySide = 'north_shore_merge' | 'downtown_foreshore' | 'both_or_unknown';

/** Speeds at or below this on the merge cross-section are treated as stall / queue. */
const STALL_SPEED_KMH = 12;
/** Merge must be this much slower than the bridge deck to call it a merge-side queue. */
const MERGE_VS_BRIDGE_GAP_KMH = 12;
/** Foreshore must be clearly worse than the merge to attribute delay downtown. */
const PARK_WORSE_THAN_MERGE_KMH = 5;

export function inferDelaySideFromLoops(snapshot: BridgeSnapshot): InferredDelaySide {
  const merge = snapshot.approachTowardDowntown;
  const deck = snapshot.towardDowntown;
  const park = snapshot.foreshoreTowardDowntown ?? null;

  if (!merge || !deck) {
    return 'both_or_unknown';
  }

  const mergeMin = minLaneSpeedAllLanesKmh(merge.lanes);
  const bridgeMean = bridgeDeckMeanSpeedKmh(deck);
  const parkMean = park ? bridgeDeckMeanSpeedKmh(park) : null;

  if (mergeMin == null || bridgeMean == null) {
    return 'both_or_unknown';
  }

  const mergeStalled = mergeMin <= STALL_SPEED_KMH;
  const bridgeMuchFaster = bridgeMean >= mergeMin + MERGE_VS_BRIDGE_GAP_KMH;
  const parkStalled = parkMean != null && parkMean <= STALL_SPEED_KMH;

  if (mergeStalled && bridgeMuchFaster) {
    if (parkStalled && parkMean != null && parkMean < mergeMin - PARK_WORSE_THAN_MERGE_KMH) {
      return 'downtown_foreshore';
    }
    return 'north_shore_merge';
  }

  if (parkStalled && parkMean != null && mergeMin != null) {
    if (mergeMin > STALL_SPEED_KMH + 5 || mergeMin > parkMean + PARK_WORSE_THAN_MERGE_KMH) {
      return 'downtown_foreshore';
    }
  }

  return 'both_or_unknown';
}

export interface DelayPerspectiveRelevance {
  /** Whether to show the DMS delay banner for this commute perspective. */
  showDelayBanner: boolean;
  inferred: InferredDelaySide;
}

/**
 * North Shore → downtown (SB) commuters are most affected by a queue at the Marine merge (103).
 * Downtown → North Shore (NB) commuters may not be in that queue; hide the DMS banner when we
 * infer SB-only congestion. When uncertain, show the banner to everyone.
 */
export function delayRelevanceForPerspective(
  snapshot: BridgeSnapshot,
  perspective: BridgePerspective,
): DelayPerspectiveRelevance {
  const dm = snapshot.delay?.delayMinutes;
  if (dm == null || dm <= 0) {
    return { showDelayBanner: false, inferred: 'both_or_unknown' };
  }
  if (perspective === 'unknown') {
    return { showDelayBanner: true, inferred: inferDelaySideFromLoops(snapshot) };
  }

  const inferred = inferDelaySideFromLoops(snapshot);
  if (inferred === 'both_or_unknown') {
    return { showDelayBanner: true, inferred };
  }

  return {
    showDelayBanner: perspective === 'north_west_vancouver',
    inferred,
  };
}

export function effectiveDelayMinutesForPerspective(
  snapshot: BridgeSnapshot,
  perspective: BridgePerspective,
): number | null {
  const raw = snapshot.delay?.delayMinutes ?? null;
  if (raw == null || raw <= 0) {
    return null;
  }
  const { showDelayBanner } = delayRelevanceForPerspective(snapshot, perspective);
  return showDelayBanner ? raw : null;
}
