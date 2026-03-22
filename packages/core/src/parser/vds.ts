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

export function laneFromLoopStatuses(
  laneNumber: number,
  upstreamStatusRaw: string,
  downstreamStatusRaw: string,
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
    lanes.push(laneFromLoopStatuses(laneNumber, up, down));
  }
  return lanes;
}
