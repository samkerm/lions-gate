import type { FeatureFlags } from '../feature-flags';
import { defaultFeatureFlags } from '../feature-flags';
import type { BridgeSnapshot, ParseResult, ParseWarning } from '../models';
import { computeDelayTrend } from './delay-trend';
import {
  extractCurrentRequestedDmsBody,
  extractDelayFromDmsBody,
  extractLastUpdateLine,
  extractPreviousRequestedDmsBody,
} from './extract';
import { stripHtmlToText } from './html-text';
import { buildDirectionSummary, inferBridgeMode } from './inference';
import { isSnapshotStaleByAge } from './staleness';
import { parseLanesInVdsSection, splitVdsSections } from './vds';

const SOURCE_URL = 'https://www.th.gov.bc.ca/ATIS/lgcws/private_status.htm#dms1';

/*
 * Page structure (see MOT map legend): DMS = sign text; ATC = intersection controller;
 * VDS = per-lane detectors. “ERROR - INVALID SPEED LOOP” in *previous* lines while
 * current status is OK means the sensor recovered — we classify current upstream/downstream
 * only. Counterflow closure is the explicit WARNING text on the active loops.
 */

function findSectionById(sections: ReturnType<typeof splitVdsSections>, id: string) {
  return sections.find((s) => s.vdsId === id) ?? null;
}

export function parseAtisHtml(
  html: string,
  options: { fetchedAt: Date; sourceUrl?: string; flags?: FeatureFlags },
): ParseResult {
  const flags = options.flags ?? defaultFeatureFlags;
  const sourceUrl = options.sourceUrl ?? SOURCE_URL;
  const warnings: ParseWarning[] = [];
  const text = stripHtmlToText(html);

  const lastUpdateRaw = extractLastUpdateLine(text);
  if (!lastUpdateRaw) {
    warnings.push({ code: 'missing_last_update', message: 'Could not find Last Update line.' });
  }

  const dmsBody = extractCurrentRequestedDmsBody(text);
  let delay = null as BridgeSnapshot['delay'];
  if (dmsBody) {
    const ex = extractDelayFromDmsBody(dmsBody);
    const prevBody = extractPreviousRequestedDmsBody(text);
    let previousDelayMinutes: number | null = null;
    let previousMessageRaw: string | undefined;
    if (prevBody) {
      const prevEx = extractDelayFromDmsBody(prevBody);
      previousDelayMinutes = prevEx.delayMinutes;
      previousMessageRaw = prevEx.messageRaw;
    }
    delay = {
      delayMinutes: ex.delayMinutes,
      messageRaw: ex.messageRaw,
      previousDelayMinutes,
      previousMessageRaw,
      delayTrend: computeDelayTrend(ex.delayMinutes, previousDelayMinutes),
    };
  } else {
    warnings.push({
      code: 'missing_dms_message',
      message: 'Could not isolate Current Requested Message block.',
    });
  }

  const sections = splitVdsSections(text);
  const [sbId, nbId] = flags.primarySouthCausewayVdsIds;
  const sb = findSectionById(sections, sbId);
  const nb = findSectionById(sections, nbId);

  if (!sb) {
    warnings.push({
      code: 'missing_vds',
      message: `Missing southbound VDS ${sbId} section.`,
    });
  }
  if (!nb) {
    warnings.push({
      code: 'missing_vds',
      message: `Missing northbound VDS ${nbId} section.`,
    });
  }

  const sbLanes = sb ? parseLanesInVdsSection(sb.raw) : [];
  const nbLanes = nb ? parseLanesInVdsSection(nb.raw) : [];

  if (sbLanes.length === 0 && nbLanes.length === 0) {
    warnings.push({ code: 'no_lanes', message: 'No lane rows parsed from primary VDS sections.' });
  }

  const towardDowntown = buildDirectionSummary('toward_downtown', sbId, sbLanes);
  const towardNorthShore = buildDirectionSummary('toward_north_shore', nbId, nbLanes);
  const bridgeMode = inferBridgeMode(towardDowntown, towardNorthShore);

  const approachMergePair =
    flags.approachMergeVdsIds ??
    defaultFeatureFlags.approachMergeVdsIds ??
    (['103', '203'] as const);
  const [sbApproachId, nbApproachId] = approachMergePair;
  const sbApproachSec = findSectionById(sections, sbApproachId);
  const nbApproachSec = findSectionById(sections, nbApproachId);
  const sbApproachLanes = sbApproachSec ? parseLanesInVdsSection(sbApproachSec.raw) : [];
  const nbApproachLanes = nbApproachSec ? parseLanesInVdsSection(nbApproachSec.raw) : [];
  const approachTowardDowntown = sbApproachSec
    ? buildDirectionSummary('toward_downtown', sbApproachId, sbApproachLanes)
    : null;
  const approachTowardNorthShore = nbApproachSec
    ? buildDirectionSummary('toward_north_shore', nbApproachId, nbApproachLanes)
    : null;

  const foreshorePair =
    flags.foreshoreCausewayVdsIds ??
    defaultFeatureFlags.foreshoreCausewayVdsIds ??
    (['101', '201'] as const);
  const [sbForeshoreId, nbForeshoreId] = foreshorePair;
  const sbForeshoreSec = findSectionById(sections, sbForeshoreId);
  const nbForeshoreSec = findSectionById(sections, nbForeshoreId);
  const sbForeshoreLanes = sbForeshoreSec ? parseLanesInVdsSection(sbForeshoreSec.raw) : [];
  const nbForeshoreLanes = nbForeshoreSec ? parseLanesInVdsSection(nbForeshoreSec.raw) : [];
  const foreshoreTowardDowntown = sbForeshoreSec
    ? buildDirectionSummary('toward_downtown', sbForeshoreId, sbForeshoreLanes)
    : null;
  const foreshoreTowardNorthShore = nbForeshoreSec
    ? buildDirectionSummary('toward_north_shore', nbForeshoreId, nbForeshoreLanes)
    : null;

  const stale = isSnapshotStaleByAge(lastUpdateRaw, options.fetchedAt, flags.staleAfterMs);

  const snapshot: BridgeSnapshot = {
    schemaVersion: 1,
    delay,
    bridgeMode,
    towardDowntown,
    towardNorthShore,
    approachTowardDowntown,
    approachTowardNorthShore,
    foreshoreTowardDowntown,
    foreshoreTowardNorthShore,
    parseWarnings: [...warnings],
    refresh: {
      fetchedAt: options.fetchedAt.toISOString(),
      lastUpdated: lastUpdateRaw,
      sourceUrl,
      parseSucceeded: true,
      isStale: stale.stale,
      staleReason: stale.reason,
    },
  };

  return { ok: true, warnings, snapshot };
}

export function parseAtisHtmlOrWarn(
  html: string,
  options: { fetchedAt: Date; sourceUrl?: string; flags?: FeatureFlags },
): ParseResult {
  try {
    return parseAtisHtml(html, options);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    return {
      ok: false,
      warnings: [{ code: 'parse_exception', message: err.message }],
      snapshot: null,
    };
  }
}
