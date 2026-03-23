import { perspectiveFromCoordinates } from '../location/perspective';
import { parseAtisHtml } from '../parser/parse-atis-html';
import { buildBridgePresentation } from '../presentation/lane-presentation';

describe('perspective', () => {
  it('infers north shore vs downtown heuristically', () => {
    expect(perspectiveFromCoordinates(49.33, -123.14)).toBe('north_west_vancouver');
    expect(perspectiveFromCoordinates(49.30, -123.14)).toBe('downtown_vancouver');
  });

  it('inverts presentation when perspective flips', () => {
    const html = `
      Last Update: 2026/03/21, 18:34:21
      Current Requested Message
      10 MIN
      Previous Requested Message
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
    const downtown = buildBridgePresentation(snapshot, 'downtown_vancouver');
    const north = buildBridgePresentation(snapshot, 'north_west_vancouver');
    expect(downtown.yourDirection[0]?.label.startsWith('NB')).toBe(true);
    expect(north.yourDirection[0]?.label.startsWith('SB')).toBe(true);
  });
});
