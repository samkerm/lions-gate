/**
 * Normalized domain model for Lions Gate ATIS HTML.
 * UI must consume BridgeSnapshot only — never raw parser output.
 */

export type BridgePerspective = 'downtown_vancouver' | 'north_west_vancouver' | 'unknown';

/** Inferred traffic configuration from lane + counterflow signals. */
export type BridgeMode =
  | 'unknown'
  | 'two_to_downtown_two_to_north_shore'
  | 'counterflow_active'
  | 'partial_or_degraded';

export type LaneHealth = 'open' | 'counterflow_closed' | 'degraded' | 'unknown';

export interface LaneState {
  laneNumber: number;
  upstreamStatusRaw: string;
  downstreamStatusRaw: string;
  health: LaneHealth;
}

export interface LaneDirectionSummary {
  /** Direction of travel this summary describes. */
  directionId: 'toward_downtown' | 'toward_north_shore';
  /** Primary VDS id used for this summary (e.g. 101 / 201). */
  vdsId: string;
  lanes: LaneState[];
  openLaneCount: number;
  counterflowClosedLaneCount: number;
  degradedLaneCount: number;
}

export interface BridgeDelay {
  delayMinutes: number | null;
  /** Raw DMS message text (current requested message body). */
  messageRaw: string;
}

export interface RefreshMetadata {
  fetchedAt: string;
  /** Parsed from page “Last Update” when available. */
  lastUpdated: string | null;
  sourceUrl: string;
  parseSucceeded: boolean;
  isStale: boolean;
  staleReason: string | null;
}

export interface ParseWarning {
  code: string;
  message: string;
}

export interface ParseResult {
  ok: boolean;
  warnings: ParseWarning[];
  snapshot: BridgeSnapshot | null;
}

export interface BridgeSnapshot {
  schemaVersion: 1;
  /** Null when DMS block could not be read. */
  delay: BridgeDelay | null;
  bridgeMode: BridgeMode;
  towardDowntown: LaneDirectionSummary;
  towardNorthShore: LaneDirectionSummary;
  refresh: RefreshMetadata;
  parseWarnings: ParseWarning[];
}
