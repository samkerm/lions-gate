import type { BridgePerspective, BridgeSnapshot, LaneHealth } from '../models';

export type LanePresentationKind = 'favorable' | 'opposing' | 'neutral';

export interface LanePresentation {
  label: string;
  kind: LanePresentationKind;
}

export interface BridgePresentation {
  /** Lanes shown as “your direction” vs “other” depending on perspective. */
  yourDirection: LanePresentation[];
  otherDirection: LanePresentation[];
  perspectiveLabel: string;
}

function laneKind(health: LaneHealth): LanePresentationKind {
  if (health === 'open') {
    return 'favorable';
  }
  if (health === 'counterflow_closed') {
    return 'opposing';
  }
  if (health === 'degraded') {
    return 'neutral';
  }
  return 'neutral';
}

/**
 * Downtown perspective: emphasize travel toward downtown as “your” side when arriving from the north.
 * North Shore perspective: invert which direction is highlighted as “yours”.
 */
export function buildBridgePresentation(
  snapshot: BridgeSnapshot,
  perspective: BridgePerspective,
): BridgePresentation {
  const d = snapshot.towardDowntown;
  const n = snapshot.towardNorthShore;
  const downtownLanes: LanePresentation[] = d.lanes.map((l) => ({
    label: `SB L${l.laneNumber}`,
    kind: laneKind(l.health),
  }));
  const northLanes: LanePresentation[] = n.lanes.map((l) => ({
    label: `NB L${l.laneNumber}`,
    kind: laneKind(l.health),
  }));

  if (perspective === 'north_west_vancouver') {
    return {
      yourDirection: northLanes,
      otherDirection: downtownLanes,
      perspectiveLabel: 'North / West Vancouver',
    };
  }
  if (perspective === 'downtown_vancouver') {
    return {
      yourDirection: downtownLanes,
      otherDirection: northLanes,
      perspectiveLabel: 'Downtown Vancouver',
    };
  }
  return {
    yourDirection: [...downtownLanes, ...northLanes],
    otherDirection: [],
    perspectiveLabel: 'Perspective not set',
  };
}
