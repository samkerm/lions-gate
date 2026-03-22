import type { BridgePerspective } from '../models';

/** Approximate Lions Gate bridge midpoint (WGS84). Tweak if perspective feels off. */
const BRIDGE_LAT = 49.315;

/**
 * Heuristic: north of the bridge centerline → North/West Vancouver view preference;
 * south → Downtown Vancouver.
 */
export function perspectiveFromCoordinates(latitude: number, longitude: number): BridgePerspective {
  void longitude;
  if (!Number.isFinite(latitude)) {
    return 'unknown';
  }
  if (latitude > BRIDGE_LAT + 0.004) {
    return 'north_west_vancouver';
  }
  if (latitude < BRIDGE_LAT - 0.004) {
    return 'downtown_vancouver';
  }
  return 'unknown';
}

export function describePerspective(p: BridgePerspective): string {
  switch (p) {
    case 'downtown_vancouver':
      return 'Downtown Vancouver';
    case 'north_west_vancouver':
      return 'North / West Vancouver';
    default:
      return 'Unknown';
  }
}
