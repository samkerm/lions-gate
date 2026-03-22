/** Text-field extractors tolerant of whitespace / table quirks. */

export function extractLastUpdateLine(text: string): string | null {
  const m = text.match(/Last\s+Update:\s*([0-9/:,\s-]+)/i);
  const raw = m?.[1]?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function sliceBetweenMarkers(
  text: string,
  startMarker: RegExp,
  endMarker: RegExp,
): string | null {
  const start = text.search(startMarker);
  if (start < 0) {
    return null;
  }
  const fromStart = text.slice(start);
  const end = fromStart.search(endMarker);
  const block = end < 0 ? fromStart : fromStart.slice(0, end);
  return block.trim().length > 0 ? block.trim() : null;
}

export function extractCurrentRequestedDmsBody(text: string): string | null {
  return sliceBetweenMarkers(
    text,
    /Current\s+Requested\s+Message/i,
    /Previous\s+Requested\s+Message/i,
  );
}

export interface DelayExtraction {
  delayMinutes: number | null;
  messageRaw: string;
}

export function extractDelayFromDmsBody(body: string): DelayExtraction {
  const normalized = body.replace(/\s+/g, ' ').trim();
  const hr = /(\d+)\s*HR\b/i.exec(normalized);
  if (hr) {
    const n = Number.parseInt(hr[1], 10);
    return { delayMinutes: Number.isFinite(n) ? n * 60 : null, messageRaw: normalized };
  }
  const min = /(\d+)\s*MIN\b/i.exec(normalized);
  if (min) {
    const n = Number.parseInt(min[1], 10);
    return { delayMinutes: Number.isFinite(n) ? n : null, messageRaw: normalized };
  }
  return { delayMinutes: null, messageRaw: normalized };
}
