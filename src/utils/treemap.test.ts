import { describe, expect, it } from 'vitest';
import { generateTreemap, getPerformanceColor } from '@/utils/treemap';

describe('treemap utilities', () => {
  it('generates rectangles within bounds and close to full area', () => {
    const rects = generateTreemap(
      [
        { id: 'a', label: 'A', value: 60, change: 4, color: '#000' },
        { id: 'b', label: 'B', value: 30, change: -2, color: '#111' },
        { id: 'c', label: 'C', value: 10, change: 1, color: '#222' },
      ],
      100,
      50
    );

    expect(rects).toHaveLength(3);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
      expect(r.x + r.w).toBeLessThanOrEqual(100.0001);
      expect(r.y + r.h).toBeLessThanOrEqual(50.0001);
    }

    const totalArea = rects.reduce((sum, r) => sum + r.w * r.h, 0);
    expect(totalArea).toBeCloseTo(5000, 4);
  });

  it('maps performance changes to expected color bands', () => {
    expect(getPerformanceColor(10)).toBe('#00c853');
    expect(getPerformanceColor(0)).toBe('#455a64');
    expect(getPerformanceColor(-10)).toBe('#880e4f');
    expect(getPerformanceColor(999)).toBe('#00c853');
    expect(getPerformanceColor(-999)).toBe('#880e4f');
  });
});
