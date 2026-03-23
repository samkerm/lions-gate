import { parseAtisHtml } from '../parser/parse-atis-html';
import {
  buildThreeLanePresentation,
  pickMiddleLaneState,
  travelSummaryForPerspective,
} from '../presentation/three-lane-presentation';

describe('three-lane presentation', () => {
  const html = `
    Last Update: 2026/03/21, 18:34:21
    VDS ID: 102
    Lane Number: 1
    Current Upstream Loop Status: OK
    Current Downstream Loop Status: OK
    Lane Number: 2
    Current Upstream Loop Status: OK
    Current Downstream Loop Status: OK
    VDS ID: 202
    Lane Number: 1
    Current Upstream Loop Status: OK
    Current Downstream Loop Status: OK
    Lane Number: 2
    Current Upstream Loop Status: WARNING - COUNTER FLOW LANE IS CLOSED
    Current Downstream Loop Status: OK
  `;

  it('uses NB lanes for downtown perspective and SB lanes for north shore', () => {
    const snap = parseAtisHtml(html, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      flags: { primarySouthCausewayVdsIds: ['102', '202'], staleAfterMs: 600_000 },
    });
    const snapshot = snap.snapshot;
    expect(snapshot).not.toBeNull();
    if (!snapshot) {
      throw new Error('expected snapshot');
    }
    const nb = travelSummaryForPerspective(snapshot, 'downtown_vancouver');
    const sb = travelSummaryForPerspective(snapshot, 'north_west_vancouver');
    expect(nb?.vdsId).toBe('202');
    expect(sb?.vdsId).toBe('102');
  });

  it('prefers lane 2 for middle slot when present', () => {
    const snap = parseAtisHtml(html, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      flags: { primarySouthCausewayVdsIds: ['102', '202'], staleAfterMs: 600_000 },
    });
    const snapshot = snap.snapshot;
    expect(snapshot).not.toBeNull();
    if (!snapshot) {
      throw new Error('expected snapshot');
    }
    const nb = snapshot.towardNorthShore;
    const mid = pickMiddleLaneState(nb);
    expect(mid?.laneNumber).toBe(2);
  });

  it('maps middle lane health to colors for downtown commute', () => {
    const snap = parseAtisHtml(html, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      flags: { primarySouthCausewayVdsIds: ['102', '202'], staleAfterMs: 600_000 },
    });
    const snapshot = snap.snapshot;
    expect(snapshot).not.toBeNull();
    if (!snapshot) {
      throw new Error('expected snapshot');
    }
    const three = buildThreeLanePresentation(snapshot, 'downtown_vancouver');
    expect(three?.travelDirectionLabel).toBe('NB');
    expect(three?.middleLaneLabel).toBe('NB L2');
    expect(three?.middle.color).toBe('red');
    const north = buildThreeLanePresentation(snapshot, 'north_west_vancouver');
    expect(north?.middleLaneLabel).toBe('SB L2');
    expect(north?.middle.color).toBe('green');
  });

  it('picks the worse of L1 vs L2 so NB L1 counterflow shows red when L2 is open', () => {
    const html = `
      Last Update: 2026/03/21, 18:34:21
      VDS ID: 102
      Lane Number: 1
      Current Upstream Loop Status: OK
      Current Downstream Loop Status: OK
      Lane Number: 2
      Current Upstream Loop Status: OK
      Current Downstream Loop Status: OK
      VDS ID: 202
      Lane Number: 1
      Current Upstream Loop Status: WARNING - COUNTER FLOW LANE IS CLOSED
      Current Downstream Loop Status: WARNING - COUNTER FLOW LANE IS CLOSED
      Lane Number: 2
      Current Upstream Loop Status: OK
      Current Downstream Loop Status: OK
    `;
    const snap = parseAtisHtml(html, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      flags: { primarySouthCausewayVdsIds: ['102', '202'], staleAfterMs: 600_000 },
    });
    const snapshot = snap.snapshot;
    expect(snapshot).not.toBeNull();
    if (!snapshot) {
      throw new Error('expected snapshot');
    }
    const downtown = buildThreeLanePresentation(snapshot, 'downtown_vancouver');
    expect(downtown?.middleLaneLabel).toBe('NB L1');
    expect(downtown?.middle.color).toBe('red');
  });

  it('tints middle (L1 speed) and right (L2 speed) with different greens when speeds differ', () => {
    const htmlSpeeds = `
      Last Update: 2026/03/21, 18:34:21
      VDS ID: 102
      Lane Number: 1
      Current Upstream Loop Status: OK
      Current Downstream Loop Status: OK
      Lane Number: 2
      Current Upstream Loop Status: OK
      Current Downstream Loop Status: OK
      VDS ID: 202
      Lane Number: 1
      Current Upstream Loop Status: OK
      Current Downstream Loop Status: OK
      Last Averaged Lane Data: Speed = 40 km/h, Length = 40 dm
      Lane Number: 2
      Current Upstream Loop Status: OK
      Current Downstream Loop Status: OK
      Last Averaged Lane Data: Speed = 75 km/h, Length = 44 dm
    `;
    const snap = parseAtisHtml(htmlSpeeds, {
      fetchedAt: new Date('2026-03-21T18:35:00'),
      flags: { primarySouthCausewayVdsIds: ['102', '202'], staleAfterMs: 600_000 },
    });
    const snapshot = snap.snapshot;
    expect(snapshot).not.toBeNull();
    if (!snapshot) {
      throw new Error('expected snapshot');
    }
    const three = buildThreeLanePresentation(snapshot, 'downtown_vancouver');
    expect(three?.middle.color).toBe('green');
    expect(three?.middleGreenHex).not.toBe(three?.rightGreenHex);
  });
});
