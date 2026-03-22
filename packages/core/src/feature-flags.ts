/** Runtime feature flags (replace with remote config later if needed). */
export interface FeatureFlags {
  /** Prefer south-causeway VDS ids for primary bridge deck lanes. */
  primarySouthCausewayVdsIds: readonly [string, string];
  /** Treat data as stale if older than this many ms (client clock). */
  staleAfterMs: number;
}

export const defaultFeatureFlags: FeatureFlags = {
  primarySouthCausewayVdsIds: ['101', '201'],
  staleAfterMs: 10 * 60 * 1000,
};
