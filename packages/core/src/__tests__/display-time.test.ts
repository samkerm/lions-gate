import { formatAtisLastUpdateForDisplay, formatVancouverFromIso } from '../presentation/display-time';

describe('display-time', () => {
  it('formats ATIS last update as 12-hour PT', () => {
    expect(formatAtisLastUpdateForDisplay('2026/03/22, 17:25:01')).toBe('Mar 22, 2026 · 5:25 PM PT');
  });

  it('formats ISO instant in Vancouver', () => {
    const s = formatVancouverFromIso('2026-03-23T00:26:35.440Z');
    expect(s).toMatch(/Mar 22, 2026/);
    expect(s).toMatch(/5:26/);
    expect(s.toLowerCase()).toMatch(/pm/);
  });
});
