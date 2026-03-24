import type { LaneState } from '../models';
import {
  greenHexForAveragedSpeed,
  greenHexForLaneSpeedTint,
  OCCUPANCY_FREE_FLOW_MAX_PERCENT,
} from '../presentation/green-speed';

function baseLane(over: Partial<LaneState>): LaneState {
  return {
    laneNumber: 1,
    upstreamStatusRaw: '',
    downstreamStatusRaw: '',
    health: 'open',
    speedKmh: null,
    lengthDm: null,
    volumeUpstreamVph: null,
    occupancyUpstreamPercent: null,
    volumeDownstreamVph: null,
    occupancyDownstreamPercent: null,
    ...over,
  };
}

describe('greenHexForAveragedSpeed', () => {
  it('returns default when speed is null or invalid', () => {
    expect(greenHexForAveragedSpeed(null)).toBe('#22c55e');
    expect(greenHexForAveragedSpeed(-1)).toBe('#22c55e');
  });

  it('maps slow to lighter and fast to darker green (capped)', () => {
    const slow = greenHexForAveragedSpeed(5);
    const fast = greenHexForAveragedSpeed(90);
    const lum = (h: string) => {
      const r = Number.parseInt(h.slice(1, 3), 16);
      const g = Number.parseInt(h.slice(3, 5), 16);
      const b = Number.parseInt(h.slice(5, 7), 16);
      return r + g + b;
    };
    expect(lum(slow)).toBeGreaterThan(lum(fast));
  });

  it('treats speeds above 90 km/h the same as 90', () => {
    expect(greenHexForAveragedSpeed(90)).toBe(greenHexForAveragedSpeed(120));
    expect(greenHexForAveragedSpeed(90)).toBe(greenHexForAveragedSpeed(200));
  });
});

describe('greenHexForLaneSpeedTint', () => {
  it('uses default green when max loop occupancy is 0% (no vehicles)', () => {
    expect(
      greenHexForLaneSpeedTint(
        baseLane({
          speedKmh: 0,
          occupancyUpstreamPercent: 0,
          occupancyDownstreamPercent: 0,
        }),
      ),
    ).toBe('#22c55e');
  });

  it('uses default green for low occupancy (e.g. 2%) even when averaged speed is slow', () => {
    expect(
      greenHexForLaneSpeedTint(
        baseLane({
          speedKmh: 8,
          occupancyUpstreamPercent: 2,
          occupancyDownstreamPercent: 1,
        }),
      ),
    ).toBe('#22c55e');
  });

  it(`uses default green at exactly ${OCCUPANCY_FREE_FLOW_MAX_PERCENT}% max occupancy (boundary)`, () => {
    expect(
      greenHexForLaneSpeedTint(
        baseLane({
          speedKmh: 15,
          occupancyUpstreamPercent: OCCUPANCY_FREE_FLOW_MAX_PERCENT,
          occupancyDownstreamPercent: 0,
        }),
      ),
    ).toBe('#22c55e');
  });

  it('uses speed tint when max occupancy is above free-flow threshold', () => {
    const hex = greenHexForLaneSpeedTint(
      baseLane({
        speedKmh: 0,
        occupancyUpstreamPercent: OCCUPANCY_FREE_FLOW_MAX_PERCENT + 1,
        occupancyDownstreamPercent: 0,
      }),
    );
    expect(hex).not.toBe('#22c55e');
  });

  it('still uses slow tint when speed is 0 but occupancy indicates vehicles', () => {
    const hex = greenHexForLaneSpeedTint(
      baseLane({
        speedKmh: 0,
        occupancyUpstreamPercent: 12,
        occupancyDownstreamPercent: 0,
      }),
    );
    expect(hex).not.toBe('#22c55e');
  });

  it('falls back to speed-only gradient when occupancy data is missing', () => {
    expect(greenHexForLaneSpeedTint(baseLane({ speedKmh: 0, occupancyUpstreamPercent: null, occupancyDownstreamPercent: null }))).not.toBe('#22c55e');
  });
});
