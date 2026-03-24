import { describePerspective } from '../location/perspective';
import type {
  BridgePerspective,
  BridgeSnapshot,
  LaneDirectionSummary,
  LaneHealth,
} from '../models';
import { delayBannerStyle } from '../parser/delay-trend';
import { approachQueueHint } from './approach-queue-hint';
import { effectiveDelayMinutesForPerspective } from './delay-direction';
import { greenHexForLaneSpeedTint } from './green-speed';
import { formatLaneSpeed } from './lane-metrics-format';

export type ThreeLaneSlotColor = 'red' | 'green' | 'neutral';

export interface ThreeLanePresentation {
  perspectiveLabel: string;
  /** Middle lane travel direction label (SB = toward downtown, NB = toward North Shore). */
  travelDirectionLabel: string;
  /** Which lane row drives the middle icon (e.g. NB L2 vs SB L2) — differs by perspective. */
  middleLaneLabel: string;
  /** Dynamic middle circle: reflects counterflow / lane health for *your* direction of travel. */
  middle: { color: ThreeLaneSlotColor; health: LaneHealth };
  /** When middle is green, fill from averaged speed on the driving lane (else null). */
  middleGreenHex: string | null;
  /** Right anchor is always “go”; tint from lane 2 averaged speed when available. */
  rightGreenHex: string;
  /** Fixed anchors: left always red, right always green (visual convention). */
  leftFixed: 'red';
  rightFixed: 'green';
}

export interface WidgetBridgePayloadV1 {
  /** 4 = lane speed lines under icons (widget). */
  schemaVersion: 1 | 2 | 3 | 4;
  lastUpdated: string | null;
  fetchedAt: string | null;
  perspectiveLabel: string;
  travelDirectionLabel: string;
  middleSlot: ThreeLaneSlotColor;
  /** `#RRGGBB` when middle is green; omit or null otherwise. */
  middleGreenHex?: string | null;
  /** `#RRGGBB` for right lane icon (always green semantics). */
  rightGreenHex?: string | null;
  /** L1 / L2 averaged speed for widget (no occupancy). Middle omitted when lane closed (red). */
  middleSpeedLine?: string | null;
  rightSpeedLine?: string | null;
  /** Bridge-wide DMS delay (not per direction). */
  delayMinutes: number | null;
  delayBanner: 'none' | 'yellow' | 'red';
  delayTrend: 'up' | 'down' | 'flat' | 'unknown';
  previousDelayMinutes: number | null;
  /**
   * When DMS shows no delay but merge (south of Marine) is much slower than the bridge deck,
   * matches in-app “possible queue” hint — widget can show a soft headline instead of “No delays”.
   */
  bridgeQueueHint: 'none' | 'possible_queue';
}

function healthToColor(health: LaneHealth): ThreeLaneSlotColor {
  if (health === 'open') {
    return 'green';
  }
  if (health === 'counterflow_closed') {
    return 'red';
  }
  return 'neutral';
}

function rankLaneHealth(h: LaneHealth): number {
  if (h === 'counterflow_closed') {
    return 3;
  }
  if (h === 'degraded') {
    return 2;
  }
  if (h === 'unknown') {
    return 1;
  }
  return 0;
}

/**
 * Middle icon should reflect counterflow on *either* primary lane: pick the worse of L1 and L2
 * for your direction. (Previously we always used L2, so a closed L1 + open L2 still looked green.)
 */
export function pickMiddleLaneState(summary: LaneDirectionSummary) {
  const sorted = [...summary.lanes].sort((a, b) => a.laneNumber - b.laneNumber);
  if (sorted.length === 0) {
    return null;
  }
  const l1 = sorted.find((l) => l.laneNumber === 1);
  const l2 = sorted.find((l) => l.laneNumber === 2);
  if (l1 && l2) {
    const r1 = rankLaneHealth(l1.health);
    const r2 = rankLaneHealth(l2.health);
    if (r1 > r2) {
      return l1;
    }
    if (r2 > r1) {
      return l2;
    }
    return l2;
  }
  if (l2) {
    return l2;
  }
  return sorted[sorted.length - 1];
}

/**
 * Travel direction summary for *your* commute:
 * - Downtown → toward North Shore (NB lanes)
 * - North / West Van → toward Downtown (SB lanes)
 */
export function travelSummaryForPerspective(
  snapshot: BridgeSnapshot,
  perspective: BridgePerspective,
): LaneDirectionSummary | null {
  if (perspective === 'unknown') {
    return null;
  }
  if (perspective === 'downtown_vancouver') {
    return snapshot.towardNorthShore;
  }
  return snapshot.towardDowntown;
}

function travelDirectionLabelForPerspective(perspective: BridgePerspective): string {
  if (perspective === 'downtown_vancouver') {
    return 'NB';
  }
  if (perspective === 'north_west_vancouver') {
    return 'SB';
  }
  return '—';
}

export function buildThreeLanePresentation(
  snapshot: BridgeSnapshot,
  perspective: BridgePerspective,
): ThreeLanePresentation | null {
  const summary = travelSummaryForPerspective(snapshot, perspective);
  if (!summary) {
    return null;
  }
  const lane = pickMiddleLaneState(summary);
  const lane1 = summary.lanes.find((l) => l.laneNumber === 1) ?? null;
  const lane2 = summary.lanes.find((l) => l.laneNumber === 2) ?? null;
  const middleHealth: LaneHealth = lane?.health ?? 'unknown';
  const middleColor = healthToColor(middleHealth);
  const dir = travelDirectionLabelForPerspective(perspective);
  const middleLaneLabel = lane ? `${dir} L${lane.laneNumber}` : `${dir} —`;
  /** Middle slot = reversible lane (L1); right = default lane (L2) — two speeds → two greens. */
  const middleGreenHex = middleColor === 'green' ? greenHexForLaneSpeedTint(lane1) : null;
  const rightGreenHex = greenHexForLaneSpeedTint(lane2);
  return {
    perspectiveLabel: describePerspective(perspective),
    travelDirectionLabel: travelDirectionLabelForPerspective(perspective),
    middleLaneLabel,
    middle: { color: middleColor, health: middleHealth },
    middleGreenHex,
    rightGreenHex,
    leftFixed: 'red',
    rightFixed: 'green',
  };
}

export function buildThreeLanePayload(
  snapshot: BridgeSnapshot,
  perspective: BridgePerspective,
): WidgetBridgePayloadV1 {
  const three = buildThreeLanePresentation(snapshot, perspective);
  const dm = effectiveDelayMinutesForPerspective(snapshot, perspective);
  const prev =
    dm != null ? (snapshot.delay?.previousDelayMinutes ?? null) : null;
  const summary = travelSummaryForPerspective(snapshot, perspective);
  const l1 = summary?.lanes.find((l) => l.laneNumber === 1) ?? null;
  const l2 = summary?.lanes.find((l) => l.laneNumber === 2) ?? null;
  const middleClosed = three?.middle.color === 'red';
  const middleSpeedLine = l1 && !middleClosed ? formatLaneSpeed(l1) : null;
  const rightSpeedLine = l2 ? formatLaneSpeed(l2) : null;
  const queueHint = approachQueueHint(snapshot, perspective);
  const bridgeQueueHintField: 'none' | 'possible_queue' =
    dm == null || dm <= 0
      ? queueHint.kind === 'possible_queue'
        ? 'possible_queue'
        : 'none'
      : 'none';
  return {
    schemaVersion: 4,
    lastUpdated: snapshot.refresh.lastUpdated,
    fetchedAt: snapshot.refresh.fetchedAt,
    perspectiveLabel: three?.perspectiveLabel ?? describePerspective(perspective),
    travelDirectionLabel: three?.travelDirectionLabel ?? '—',
    middleSlot: three?.middle.color ?? 'neutral',
    middleGreenHex: three?.middleGreenHex ?? null,
    rightGreenHex: three?.rightGreenHex ?? null,
    middleSpeedLine,
    rightSpeedLine,
    delayMinutes: dm,
    delayBanner: delayBannerStyle(dm),
    delayTrend: dm != null ? snapshot.delay?.delayTrend ?? 'unknown' : 'unknown',
    previousDelayMinutes: prev,
    bridgeQueueHint: bridgeQueueHintField,
  };
}
