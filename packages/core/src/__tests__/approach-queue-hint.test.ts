import type { BridgeSnapshot } from '../models';
import { approachQueueHint } from '../presentation/approach-queue-hint';
import { buildThreeLanePayload } from '../presentation/three-lane-presentation';

function lane(
  n: number,
  speed: number | null,
): NonNullable<BridgeSnapshot['towardDowntown']>['lanes'][0] {
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
  };
}

function baseSnapshot(override: Partial<BridgeSnapshot>): BridgeSnapshot {
  return {
    schemaVersion: 1,
    delay: null,
    bridgeMode: 'two_to_downtown_two_to_north_shore',
    towardDowntown: {
      directionId: 'toward_downtown',
      vdsId: '102',
      lanes: [lane(1, 70), lane(2, 72)],
      openLaneCount: 2,
      counterflowClosedLaneCount: 0,
      degradedLaneCount: 0,
    },
    towardNorthShore: {
      directionId: 'toward_north_shore',
      vdsId: '202',
      lanes: [lane(1, 70), lane(2, 72)],
      openLaneCount: 2,
      counterflowClosedLaneCount: 0,
      degradedLaneCount: 0,
    },
    approachTowardDowntown: {
      directionId: 'toward_downtown',
      vdsId: '103',
      lanes: [lane(1, 45), lane(2, 48), lane(3, 42), lane(4, 40)],
      openLaneCount: 4,
      counterflowClosedLaneCount: 0,
      degradedLaneCount: 0,
    },
    approachTowardNorthShore: {
      directionId: 'toward_north_shore',
      vdsId: '203',
      lanes: [lane(1, 45), lane(2, 48), lane(3, 42), lane(4, 40)],
      openLaneCount: 4,
      counterflowClosedLaneCount: 0,
      degradedLaneCount: 0,
    },
    refresh: {
      fetchedAt: new Date().toISOString(),
      lastUpdated: null,
      sourceUrl: 'x',
      parseSucceeded: true,
      isStale: false,
      staleReason: null,
    },
    parseWarnings: [],
    ...override,
  };
}

describe('approachQueueHint', () => {
  it('returns possible_queue when merge is much slower than bridge and no DMS delay (toward downtown)', () => {
    const s = baseSnapshot({});
    const h = approachQueueHint(s, 'north_west_vancouver');
    expect(h.kind).toBe('possible_queue');
    if (h.kind === 'possible_queue') {
      expect(h.gapKmh).toBeGreaterThanOrEqual(15);
    }
  });

  it('returns possible_queue for downtown perspective (NB) using 203 vs 202', () => {
    const s = baseSnapshot({
      towardNorthShore: {
        directionId: 'toward_north_shore',
        vdsId: '202',
        lanes: [lane(1, 68), lane(2, 70)],
        openLaneCount: 2,
        counterflowClosedLaneCount: 0,
        degradedLaneCount: 0,
      },
      approachTowardNorthShore: {
        directionId: 'toward_north_shore',
        vdsId: '203',
        lanes: [lane(1, 40), lane(2, 42), lane(3, 38), lane(4, 41)],
        openLaneCount: 4,
        counterflowClosedLaneCount: 0,
        degradedLaneCount: 0,
      },
    });
    const h = approachQueueHint(s, 'downtown_vancouver');
    expect(h.kind).toBe('possible_queue');
  });

  it('returns none when DMS reports a delay', () => {
    const s = baseSnapshot({
      delay: {
        delayMinutes: 5,
        messageRaw: 'x',
        delayTrend: 'unknown',
      },
    });
    expect(approachQueueHint(s, 'north_west_vancouver').kind).toBe('none');
  });

  it('returns none when gap is small', () => {
    const s = baseSnapshot({
      approachTowardDowntown: {
        directionId: 'toward_downtown',
        vdsId: '103',
        lanes: [lane(1, 68), lane(2, 69), lane(3, 67), lane(4, 68)],
        openLaneCount: 4,
        counterflowClosedLaneCount: 0,
        degradedLaneCount: 0,
      },
    });
    expect(approachQueueHint(s, 'north_west_vancouver').kind).toBe('none');
  });

  it('buildThreeLanePayload sets bridgeQueueHint possible_queue when merge hint applies', () => {
    const s = baseSnapshot({});
    expect(buildThreeLanePayload(s, 'north_west_vancouver').bridgeQueueHint).toBe('possible_queue');
    expect(buildThreeLanePayload(s, 'downtown_vancouver').bridgeQueueHint).toBe('possible_queue');
  });

  it('buildThreeLanePayload sets bridgeQueueHint none when DMS delay or no queue hint', () => {
    const withDelay = baseSnapshot({
      delay: {
        delayMinutes: 5,
        messageRaw: 'x',
        delayTrend: 'unknown',
      },
    });
    expect(buildThreeLanePayload(withDelay, 'north_west_vancouver').bridgeQueueHint).toBe('none');

    const smallGap = baseSnapshot({
      approachTowardDowntown: {
        directionId: 'toward_downtown',
        vdsId: '103',
        lanes: [lane(1, 68), lane(2, 69), lane(3, 67), lane(4, 68)],
        openLaneCount: 4,
        counterflowClosedLaneCount: 0,
        degradedLaneCount: 0,
      },
    });
    expect(buildThreeLanePayload(smallGap, 'north_west_vancouver').bridgeQueueHint).toBe('none');
  });
});
