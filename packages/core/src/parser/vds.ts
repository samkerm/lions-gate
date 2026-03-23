/**
 * ATIS publishes many VDS sections per page. Each section is a slice across the road at
 * one location; “Lane Number: n” is that station’s lane index (often 2 lanes on the
 * bridge deck, more on wide approaches). Parser output must never concatenate lanes
 * from different VDS ids — compare only within the pair selected in feature flags.
 */
import type { LaneHealth, LaneState } from '../models';

function classifyLoopStatus(raw: string): LaneHealth {
  const s = raw.trim();
  if (/COUNTER\s+FLOW\s+LANE\s+IS\s+CLOSED/i.test(s)) {
    return 'counterflow_closed';
  }
  if (/^OK\b/i.test(s)) {
    return 'open';
  }
  if (/\bERROR\b/i.test(s)) {
    return 'degraded';
  }
  if (/\bWARNING\b/i.test(s)) {
    return 'degraded';
  }
  if (s.length === 0) {
    return 'unknown';
  }
  return 'unknown';
}

function combineHealth(a: LaneHealth, b: LaneHealth): LaneHealth {
  const rank: Record<LaneHealth, number> = {
    unknown: 0,
    open: 1,
    degraded: 2,
    counterflow_closed: 3,
  };
  return rank[a] >= rank[b] ? a : b;
}

function parseNonNegativeFloat(raw: string | undefined): number | null {
  if (raw == null) {
    return null;
  }
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v) || v < 0) {
    return null;
  }
  return v;
}

/** Speed and length from `Last Averaged Lane Data` (same line in ATIS). */
function parseAveragedLaneData(chunk: string): {
  speedKmh: number | null;
  lengthDm: number | null;
} {
  const m =
    /Last\s+Averaged\s+Lane\s+Data:\s*Speed\s*=\s*(-?\d+(?:\.\d+)?)\s*km\/h\s*,\s*Length\s*=\s*(-?\d+(?:\.\d+)?)\s*dm/i.exec(
      chunk,
    );
  if (m) {
    return {
      speedKmh: parseNonNegativeFloat(m[1]),
      lengthDm: parseNonNegativeFloat(m[2]),
    };
  }
  const speedOnly = /Last\s+Averaged\s+Lane\s+Data:\s*Speed\s*=\s*(-?\d+(?:\.\d+)?)\s*km\/h/i.exec(
    chunk,
  );
  if (speedOnly) {
    return { speedKmh: parseNonNegativeFloat(speedOnly[1]), lengthDm: null };
  }
  return { speedKmh: null, lengthDm: null };
}

function parseVolumeOccupancyLine(
  chunk: string,
  kind: 'upstream' | 'downstream',
): { volumeVph: number | null; occupancyPercent: number | null } {
  const re =
    kind === 'upstream'
      ? /Last\s+Upstream\s+Loop\s+Data:\s*Volume\s*=\s*(-?\d+)\s*VPH,\s*Occupancy\s*=\s*(-?\d+)\s*%/i
      : /Last\s+Downstream\s+Loop\s+Data:\s*Volume\s*=\s*(-?\d+)\s*VPH,\s*Occupancy\s*=\s*(-?\d+)\s*%/i;
  const m = re.exec(chunk);
  if (!m) {
    return { volumeVph: null, occupancyPercent: null };
  }
  const vol = Number.parseInt(m[1], 10);
  const occ = Number.parseInt(m[2], 10);
  return {
    volumeVph: Number.isFinite(vol) && vol >= 0 ? vol : null,
    occupancyPercent: Number.isFinite(occ) && occ >= 0 ? occ : null,
  };
}

export function laneFromLoopStatuses(
  laneNumber: number,
  upstreamStatusRaw: string,
  downstreamStatusRaw: string,
  extras: {
    speedKmh: number | null;
    lengthDm: number | null;
    volumeUpstreamVph: number | null;
    occupancyUpstreamPercent: number | null;
    volumeDownstreamVph: number | null;
    occupancyDownstreamPercent: number | null;
  },
): LaneState {
  const health = combineHealth(
    classifyLoopStatus(upstreamStatusRaw),
    classifyLoopStatus(downstreamStatusRaw),
  );
  return {
    laneNumber,
    upstreamStatusRaw: upstreamStatusRaw.trim(),
    downstreamStatusRaw: downstreamStatusRaw.trim(),
    health,
    speedKmh: extras.speedKmh,
    lengthDm: extras.lengthDm,
    volumeUpstreamVph: extras.volumeUpstreamVph,
    occupancyUpstreamPercent: extras.occupancyUpstreamPercent,
    volumeDownstreamVph: extras.volumeDownstreamVph,
    occupancyDownstreamPercent: extras.occupancyDownstreamPercent,
  };
}

export interface VdsSection {
  vdsId: string;
  raw: string;
}

export function splitVdsSections(htmlOrText: string): VdsSection[] {
  const text = htmlOrText;
  const re = /VDS\s+ID:\s*(\d+)/gi;
  const matches: Array<{ index: number; id: string }> = [];
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    matches.push({ index: m.index, id: m[1] });
    m = re.exec(text);
  }
  const sections: VdsSection[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const cur = matches[i];
    const next = matches[i + 1];
    const end = next ? next.index : text.length;
    const raw = text.slice(cur.index, end);
    sections.push({ vdsId: cur.id, raw });
  }
  return sections;
}

const upstreamRe = /Current\s+Upstream\s+Loop\s+Status:\s*([^\n]+)/i;
const downstreamRe = /Current\s+Downstream\s+Loop\s+Status:\s*([^\n]+)/i;

/** Parse one `VDS ID: …` block; lane numbers are relative to this block only. */
export function parseLanesInVdsSection(sectionText: string): LaneState[] {
  const chunks = sectionText.split(/Lane\s+Number:/i).slice(1);
  const lanes: LaneState[] = [];
  for (const chunk of chunks) {
    const head = /^(\d+)\b/.exec(chunk.trim());
    if (!head) {
      continue;
    }
    const laneNumber = Number.parseInt(head[1], 10);
    if (!Number.isFinite(laneNumber)) {
      continue;
    }
    const um = upstreamRe.exec(chunk);
    const dm = downstreamRe.exec(chunk);
    const up = um?.[1]?.trim() ?? '';
    const down = dm?.[1]?.trim() ?? '';
    if (!up && !down) {
      continue;
    }
    const averaged = parseAveragedLaneData(chunk);
    const upData = parseVolumeOccupancyLine(chunk, 'upstream');
    const downData = parseVolumeOccupancyLine(chunk, 'downstream');
    lanes.push(
      laneFromLoopStatuses(laneNumber, up, down, {
        speedKmh: averaged.speedKmh,
        lengthDm: averaged.lengthDm,
        volumeUpstreamVph: upData.volumeVph,
        occupancyUpstreamPercent: upData.occupancyPercent,
        volumeDownstreamVph: downData.volumeVph,
        occupancyDownstreamPercent: downData.occupancyPercent,
      }),
    );
  }
  return lanes;
}
