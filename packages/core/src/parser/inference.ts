import type { BridgeMode, LaneDirectionSummary, LaneState } from '../models';

function countHealth(lanes: LaneState[]) {
  let openLaneCount = 0;
  let counterflowClosedLaneCount = 0;
  let degradedLaneCount = 0;
  for (const l of lanes) {
    if (l.health === 'open') {
      openLaneCount += 1;
    } else if (l.health === 'counterflow_closed') {
      counterflowClosedLaneCount += 1;
    } else if (l.health === 'degraded') {
      degradedLaneCount += 1;
    }
  }
  return { openLaneCount, counterflowClosedLaneCount, degradedLaneCount };
}

export function buildDirectionSummary(
  directionId: 'toward_downtown' | 'toward_north_shore',
  vdsId: string,
  lanes: LaneState[],
): LaneDirectionSummary {
  const c = countHealth(lanes);
  return {
    directionId,
    vdsId,
    lanes,
    openLaneCount: c.openLaneCount,
    counterflowClosedLaneCount: c.counterflowClosedLaneCount,
    degradedLaneCount: c.degradedLaneCount,
  };
}

export function inferBridgeMode(
  towardDowntown: LaneDirectionSummary,
  towardNorthShore: LaneDirectionSummary,
): BridgeMode {
  const cf =
    towardDowntown.counterflowClosedLaneCount > 0 ||
    towardNorthShore.counterflowClosedLaneCount > 0;
  if (cf) {
    return 'counterflow_active';
  }
  const dLanes = towardDowntown.lanes.length;
  const nLanes = towardNorthShore.lanes.length;
  if (dLanes === 0 && nLanes === 0) {
    return 'unknown';
  }
  if (dLanes > 0 && nLanes > 0) {
    const dOk = towardDowntown.openLaneCount >= 2;
    const nOk = towardNorthShore.openLaneCount >= 2;
    if (dOk && nOk) {
      return 'two_to_downtown_two_to_north_shore';
    }
  }
  return 'partial_or_degraded';
}
