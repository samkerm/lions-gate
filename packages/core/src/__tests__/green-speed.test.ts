import { greenHexForAveragedSpeed } from '../presentation/green-speed';

describe('greenHexForAveragedSpeed', () => {
  it('returns default when speed is null or invalid', () => {
    expect(greenHexForAveragedSpeed(null)).toBe('#22c55e');
    expect(greenHexForAveragedSpeed(-1)).toBe('#22c55e');
  });

  it('maps slow to lighter and fast to darker green (capped)', () => {
    const slow = greenHexForAveragedSpeed(5);
    const fast = greenHexForAveragedSpeed(90);
    const lum = (h: string) => {
      const r = Number.parseInt(h.slice(1, 3), 16);
      const g = Number.parseInt(h.slice(3, 5), 16);
      const b = Number.parseInt(h.slice(5, 7), 16);
      return r + g + b;
    };
    expect(lum(slow)).toBeGreaterThan(lum(fast));
  });

  it('treats speeds above 90 km/h the same as 90', () => {
    expect(greenHexForAveragedSpeed(90)).toBe(greenHexForAveragedSpeed(120));
    expect(greenHexForAveragedSpeed(90)).toBe(greenHexForAveragedSpeed(200));
  });
});
