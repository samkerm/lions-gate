import {
  extractCurrentRequestedDmsBody,
  extractDelayFromDmsBody,
  extractLastUpdateLine,
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
});
