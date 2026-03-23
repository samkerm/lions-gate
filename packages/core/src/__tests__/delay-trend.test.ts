import { computeDelayTrend, delayBannerStyle } from '../parser/delay-trend';

describe('delay trend', () => {
  it('compares current vs previous delay', () => {
    expect(computeDelayTrend(5, 10)).toBe('down');
    expect(computeDelayTrend(10, 5)).toBe('up');
    expect(computeDelayTrend(5, 5)).toBe('flat');
    expect(computeDelayTrend(5, null)).toBe('unknown');
  });

  it('maps delay minutes to banner style', () => {
    expect(delayBannerStyle(null)).toBe('none');
    expect(delayBannerStyle(0)).toBe('none');
    expect(delayBannerStyle(5)).toBe('yellow');
    expect(delayBannerStyle(6)).toBe('red');
  });
});
