import type { BridgeSnapshot, LaneDirectionSummary, LaneState } from '../models';
import {
  delayRelevanceForPerspective,
  inferDelaySideFromLoops,
} from '../presentation/delay-direction';

function lane(n: number, speed: number, overrides: Partial<LaneState> = {}): LaneState {
  return {
    laneNumber: n,
    upstreamStatusRaw: 'OK',
    downstreamStatusRaw: 'OK',
    health: 'open',
    speedKmh: speed,
    lengthDm: null,
    volumeUpstreamVph: null,
    occupancyUpstreamPercent: null,
    volumeDownstreamVph: null,
    occupancyDownstreamPercent: null,
    ...overrides,
  };
}

function summary(
  directionId: 'toward_downtown' | 'toward_north_shore',
  vdsId: string,
  lanes: LaneState[],
): LaneDirectionSummary {
  return {
    directionId,
    vdsId,
    lanes,
    openLaneCount: lanes.length,
    counterflowClosedLaneCount: 0,
    degradedLaneCount: 0,
  };
}

function minimalSnapshot(partial: Partial<BridgeSnapshot>): BridgeSnapshot {
  return {
    schemaVersion: 1,
    delay: { delayMinutes: 25, messageRaw: 'LIONS GATE DELAYS 25 MIN', delayTrend: 'unknown' },
    bridgeMode: 'two_to_downtown_two_to_north_shore',
    towardDowntown: summary('toward_downtown', '102', [lane(1, 52), lane(2, 52)]),
    towardNorthShore: summary('toward_north_shore', '202', [lane(1, 60), lane(2, 58)]),
    approachTowardDowntown: summary('toward_downtown', '103', [
      lane(1, 2),
      lane(2, 4),
      lane(3, 2),
      lane(4, 1),
    ]),
    approachTowardNorthShore: summary('toward_north_shore', '203', [lane(1, 70), lane(2, 72)]),
    foreshoreTowardDowntown: summary('toward_downtown', '101', [lane(1, 62), lane(2, 62)]),
    foreshoreTowardNorthShore: summary('toward_north_shore', '201', [lane(1, 15), lane(2, 66)]),
    refresh: {
      fetchedAt: new Date().toISOString(),
      lastUpdated: null,
      sourceUrl: 'x',
      parseSucceeded: true,
      isStale: false,
      staleReason: null,
    },
    parseWarnings: [],
    ...partial,
  };
}

describe('inferDelaySideFromLoops', () => {
  it('infers north_shore_merge when 103 is stalled and 102 is moving', () => {
    const s = minimalSnapshot({});
    expect(inferDelaySideFromLoops(s)).toBe('north_shore_merge');
  });

  it('returns both_or_unknown when merge and bridge are similar', () => {
    const s = minimalSnapshot({
      approachTowardDowntown: summary('toward_downtown', '103', [lane(1, 48), lane(2, 50)]),
    });
    expect(inferDelaySideFromLoops(s)).toBe('both_or_unknown');
  });

  it('infers downtown_foreshore when park end (101) is worse than merge', () => {
    const s = minimalSnapshot({
      approachTowardDowntown: summary('toward_downtown', '103', [lane(1, 25), lane(2, 28)]),
      foreshoreTowardDowntown: summary('toward_downtown', '101', [lane(1, 8), lane(2, 8)]),
    });
    expect(inferDelaySideFromLoops(s)).toBe('downtown_foreshore');
  });
});

describe('delayRelevanceForPerspective', () => {
  it('hides directional delay for downtown perspective when merge queue inferred', () => {
    const s = minimalSnapshot({});
    expect(delayRelevanceForPerspective(s, 'downtown_vancouver').showDelayBanner).toBe(false);
    expect(delayRelevanceForPerspective(s, 'north_west_vancouver').showDelayBanner).toBe(true);
  });
});
