import type { FeatureFlags } from '../feature-flags';
import { defaultFeatureFlags } from '../feature-flags';
import type { BridgeSnapshot, ParseResult, ParseWarning } from '../models';
import { extractCurrentRequestedDmsBody, extractDelayFromDmsBody, extractLastUpdateLine } from './extract';
import { stripHtmlToText } from './html-text';
import { buildDirectionSummary, inferBridgeMode } from './inference';
import { isSnapshotStaleByAge } from './staleness';
import { parseLanesInVdsSection, splitVdsSections } from './vds';

const SOURCE_URL = 'https://www.th.gov.bc.ca/ATIS/lgcws/private_status.htm#dms1';

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
    delay = {
      delayMinutes: ex.delayMinutes,
      messageRaw: ex.messageRaw,
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

  const stale = isSnapshotStaleByAge(lastUpdateRaw, options.fetchedAt, flags.staleAfterMs);

  const snapshot: BridgeSnapshot = {
    schemaVersion: 1,
    delay,
    bridgeMode,
    towardDowntown,
    towardNorthShore,
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
