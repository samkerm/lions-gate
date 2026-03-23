/** Runtime feature flags (replace with remote config later if needed). */
export interface FeatureFlags {
  /**
   * [southbound VDS id, northbound VDS id] — each id is one Vehicle Detection Station
   * (green circles on the map): loops per lane at that road cross-section only.
   * Default 102/202 = “north end of causeway, ATIS-02” (102 SB → downtown, 202 NB →
   * North Shore). Lane 1 = reversible middle lane; lane 2 = default through lane.
   * Alternative: 101/201 (south end, ATIS-01). Stations like 103 list more lanes at
   * a wider cross-section — those indices are not comparable to this pair.
   */
  primarySouthCausewayVdsIds: readonly [string, string];
  /**
   * [SB approach, NB approach] at south of Marine (ATIS-03) — merge lanes before the bridge.
   * Used to compare approach vs bridge speeds when DMS shows no delay.
   */
  approachMergeVdsIds?: readonly [string, string];
  /** Treat data as stale if older than this many ms (client clock). */
  staleAfterMs: number;
}

export const defaultFeatureFlags: FeatureFlags = {
  primarySouthCausewayVdsIds: ['102', '202'],
  approachMergeVdsIds: ['103', '203'],
  staleAfterMs: 10 * 60 * 1000,
};
