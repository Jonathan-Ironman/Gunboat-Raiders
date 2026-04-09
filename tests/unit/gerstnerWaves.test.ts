import { describe, it, expect } from 'vitest';
import {
  initWaves,
  getWaveHeight,
  DEFAULT_WAVES,
  type GerstnerWave,
} from '../../src/environment/gerstnerWaves';

describe('gerstnerWaves', () => {
  const waves: GerstnerWave[] = initWaves([...DEFAULT_WAVES]);

  describe('initWaves', () => {
    it('computes non-zero amplitude and speed for each wave', () => {
      for (const wave of waves) {
        expect(wave.amplitude).toBeGreaterThan(0);
        expect(wave.speed).toBeGreaterThan(0);
      }
    });

    it('computes speed as sqrt(9.8 * wavelength / (2 * PI))', () => {
      for (const wave of waves) {
        const k = (2 * Math.PI) / wave.wavelength;
        const expectedSpeed = Math.sqrt(9.8 / k);
        expect(wave.speed).toBeCloseTo(expectedSpeed, 10);
      }
    });

    it('normalizes direction vectors', () => {
      for (const wave of waves) {
        const len = Math.sqrt(
          wave.direction[0] * wave.direction[0] + wave.direction[1] * wave.direction[1],
        );
        expect(len).toBeCloseTo(1, 5);
      }
    });
  });

  describe('getWaveHeight', () => {
    it('returns different heights for different x positions', () => {
      const sample1 = getWaveHeight(0, 0, 0, waves);
      const sample2 = getWaveHeight(10, 0, 0, waves);
      expect(sample1.height).not.toBe(sample2.height);
    });

    it('returns different heights for different time values', () => {
      const sample1 = getWaveHeight(0, 0, 0, waves);
      const sample2 = getWaveHeight(0, 0, 1, waves);
      expect(sample1.height).not.toBe(sample2.height);
    });

    it('returns a valid normal vector with length approximately 1', () => {
      const sample = getWaveHeight(5, 3, 2.5, waves);
      const [nx, ny, nz] = sample.normal;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      expect(len).toBeCloseTo(1, 5);
    });

    it('is deterministic (same inputs produce same output)', () => {
      const a = getWaveHeight(7.3, -2.1, 4.0, waves);
      const b = getWaveHeight(7.3, -2.1, 4.0, waves);
      expect(a.height).toBe(b.height);
      expect(a.normal[0]).toBe(b.normal[0]);
      expect(a.normal[1]).toBe(b.normal[1]);
      expect(a.normal[2]).toBe(b.normal[2]);
    });

    it('keeps wave height within reasonable bounds (-5 to +5) for default waves', () => {
      // Sample many positions and times
      for (let x = -50; x <= 50; x += 10) {
        for (let z = -50; z <= 50; z += 10) {
          for (let t = 0; t < 10; t += 1) {
            const sample = getWaveHeight(x, z, t, waves);
            expect(sample.height).toBeGreaterThanOrEqual(-5);
            expect(sample.height).toBeLessThanOrEqual(5);
          }
        }
      }
    });

    it('returns a WaveSample with numeric height and 3-element normal', () => {
      const sample = getWaveHeight(0, 0, 0, waves);
      expect(typeof sample.height).toBe('number');
      expect(Number.isFinite(sample.height)).toBe(true);
      expect(sample.normal).toHaveLength(3);
      for (const component of sample.normal) {
        expect(typeof component).toBe('number');
        expect(Number.isFinite(component)).toBe(true);
      }
    });

    it('returns different heights for different z positions', () => {
      const sample1 = getWaveHeight(0, 0, 0, waves);
      const sample2 = getWaveHeight(0, 10, 0, waves);
      expect(sample1.height).not.toBe(sample2.height);
    });
  });
});
