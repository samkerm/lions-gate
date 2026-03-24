/** Resilient HTML → plain text for line-oriented parsing. */

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|td|th|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Light cleanup for DMS snippets that still contain entities or odd whitespace. */
export function sanitizeAtisPlainText(raw: string): string {
  return raw
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes phase boilerplate and duplicate delay headline from DMS plain text for in-app display.
 * Timestamps and “Current Requested Message at …” are kept.
 */
export function stripDmsBoilerplateForUi(s: string): string {
  let t = s.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/\(\s*\d+\s+phase\s+message\s*\)/gi, ' ');
  t = t.replace(/Message\s+Phase\s+\d+\s*:/gi, ' ');
  t = t.replace(/\(\s*This\s+Phase\s+(?:is\s+)?(?:in\s+)?Automatic\s+Control\s+Mode\s*\)/gi, ' ');
  t = t.replace(/\bLIONS\s+GATE\s+DELAYS\s+\d+\s*MIN\b/gi, ' ');
  return t.replace(/\s{2,}/g, ' ').trim();
}
