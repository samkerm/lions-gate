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
  /** From `Last Averaged Lane Data: Speed = … km/h`; null when missing or invalid (e.g. -1). */
  speedKmh: number | null;
  /** From `Last Averaged Lane Data: … Length = … dm`; null when invalid. */
  lengthDm: number | null;
  /** From `Last Upstream Loop Data: Volume = … VPH`. */
  volumeUpstreamVph: number | null;
  occupancyUpstreamPercent: number | null;
  /** From `Last Downstream Loop Data: …`. */
  volumeDownstreamVph: number | null;
  occupancyDownstreamPercent: number | null;
}

export interface LaneDirectionSummary {
  /** Direction of travel this summary describes. */
  directionId: 'toward_downtown' | 'toward_north_shore';
  /**
   * Which VDS block supplied `lanes` (measurement location). Lane indices are local to
   * this station only — “Lane 1” here is not the same road position as “Lane 1” at VDS 103.
   */
  vdsId: string;
  lanes: LaneState[];
  openLaneCount: number;
  counterflowClosedLaneCount: number;
  degradedLaneCount: number;
}

/** Whether the sign-reported delay got better or worse vs the prior DMS cycle. */
export type DelayTrend = 'up' | 'down' | 'flat' | 'unknown';

export interface BridgeDelay {
  delayMinutes: number | null;
  /** Raw DMS message text (current requested message body). */
  messageRaw: string;
  /** Parsed from "Previous Requested Message" when present (often ~5 min earlier). */
  previousDelayMinutes?: number | null;
  previousMessageRaw?: string;
  /** Current vs previous numeric delay (bridge-wide; not directional). */
  delayTrend?: DelayTrend;
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
  /**
   * Merge / approach south of Marine (ATIS-03), wider cross-section than the bridge deck.
   * Null when that VDS block is missing from the page. Omitted in older cached snapshots.
   */
  approachTowardDowntown?: LaneDirectionSummary | null;
  approachTowardNorthShore?: LaneDirectionSummary | null;
  refresh: RefreshMetadata;
  parseWarnings: ParseWarning[];
}
