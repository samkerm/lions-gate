import {
  extractCurrentRequestedDmsBody,
  extractDelayFromDmsBody,
  extractLastUpdateLine,
  extractPreviousRequestedDmsBody,
} from '../parser/extract';

describe('extract', () => {
  it('extracts last update line flexibly', () => {
    expect(extractLastUpdateLine('foo Last Update: 2026/03/21, 18:34:21 bar')).toBe(
      '2026/03/21, 18:34:21',
    );
    expect(extractLastUpdateLine('no stamp')).toBeNull();
  });

  it('isolates current requested DMS body', () => {
    const text = `
      Current Requested Message
      LIONS GATE DELAYS
      25 MIN
      Previous Requested Message
      old
    `;
    const body = extractCurrentRequestedDmsBody(text);
    expect(body).toContain('25 MIN');
    expect(body).not.toContain('Previous');
  });

  it('extracts minutes and hours from DMS body', () => {
    expect(extractDelayFromDmsBody('LIONS GATE DELAYS 25 MIN').delayMinutes).toBe(25);
    expect(extractDelayFromDmsBody('LIONS GATE DELAYS 2 HR').delayMinutes).toBe(120);
    expect(extractDelayFromDmsBody('NO NUMBERS HERE').delayMinutes).toBeNull();
  });

  it('prefers LIONS GATE DELAYS line when multiple numbers exist', () => {
    expect(
      extractDelayFromDmsBody(
        'Phase 1 LIONS GATE DELAYS 5 MIN Current Requested Message at: 2026/03/22',
      ).delayMinutes,
    ).toBe(5);
  });

  it('extracts previous requested DMS body before NTCIP section', () => {
    const text = `
      Current Requested Message
      LIONS GATE DELAYS 5 MIN
      Previous Requested Message
      at: 2026/03/22, 16:41:21
      LIONS GATE DELAYS 10 MIN
      NTCIP DMS Status Information
    `;
    const prev = extractPreviousRequestedDmsBody(text);
    expect(prev).toContain('10 MIN');
    expect(prev).toContain('Previous');
    expect(prev).not.toContain('NTCIP');
  });
});
