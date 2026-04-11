import { describe, it, expect } from 'vitest';
import { BOAT_STATS } from '../../src/utils/boatStats';

describe('BOAT_STATS movement values', () => {
  describe('player', () => {
    const m = BOAT_STATS.player.movement;
    it('has bumped thrustForce (+10% to 11000)', () => {
      expect(m.thrustForce).toBe(11000);
    });
    it('has bumped maxSpeed (~25% over old 22)', () => {
      expect(m.maxSpeed).toBe(28);
    });
    it('has bumped reverseForce (+10% to 3300)', () => {
      expect(m.reverseForce).toBe(3300);
    });
    it('has bumped turnTorque (+20% to 2400)', () => {
      expect(m.turnTorque).toBe(2400);
    });
  });

  describe('player cannon mounts', () => {
    const w = BOAT_STATS.player.weapons;

    it('has elevated elevationAngle (0.10 rad ≈5.7°)', () => {
      expect(w.elevationAngle).toBe(0.1);
    });

    it('has 11 mounts total', () => {
      expect(w.mounts).toHaveLength(11);
    });

    it('fore mounts pulled inward to x ±0.2', () => {
      const fore = w.mounts.filter((m) => m.quadrant === 'fore');
      expect(fore).toHaveLength(2);
      for (const m of fore) {
        expect(Math.abs(m.localOffset[0])).toBe(0.2);
      }
    });

    it('fore mounts lowered to y 0.4', () => {
      const fore = w.mounts.filter((m) => m.quadrant === 'fore');
      for (const m of fore) {
        expect(m.localOffset[1]).toBe(0.4);
      }
    });

    it('port mounts pulled inward to x -0.6', () => {
      const port = w.mounts.filter((m) => m.quadrant === 'port');
      expect(port).toHaveLength(4);
      for (const m of port) {
        expect(m.localOffset[0]).toBe(-0.6);
      }
    });

    it('starboard mounts pulled inward to x 0.6', () => {
      const starboard = w.mounts.filter((m) => m.quadrant === 'starboard');
      expect(starboard).toHaveLength(4);
      for (const m of starboard) {
        expect(m.localOffset[0]).toBe(0.6);
      }
    });

    it('all broadside mounts lowered to y 0.4', () => {
      const broadside = w.mounts.filter((m) => m.quadrant === 'port' || m.quadrant === 'starboard');
      for (const m of broadside) {
        expect(m.localOffset[1]).toBe(0.4);
      }
    });

    it('aft mount lowered to y 0.4 with x 0', () => {
      const aftMounts = w.mounts.filter((m) => m.quadrant === 'aft');
      expect(aftMounts).toHaveLength(1);
      for (const m of aftMounts) {
        expect(m.localOffset[0]).toBe(0);
        expect(m.localOffset[1]).toBe(0.4);
      }
    });

    it('fore/aft Z values moved inward by 0.75 from ±2.0 to ±1.25', () => {
      const fore = w.mounts.filter((m) => m.quadrant === 'fore');
      for (const m of fore) {
        expect(m.localOffset[2]).toBe(1.25);
      }
      const aft = w.mounts.filter((m) => m.quadrant === 'aft');
      for (const m of aft) {
        expect(m.localOffset[2]).toBe(-1.25);
      }
    });

    it('port broadside front mount Z is 0.5 (gap closed from 1.0)', () => {
      const port = w.mounts.filter((m) => m.quadrant === 'port');
      const zValues = port.map((m) => m.localOffset[2]).sort((a, b) => b - a);
      expect(zValues[0]).toBe(0.5);
    });

    it('port broadside Z offsets are evenly spaced at 0.5 intervals', () => {
      const port = w.mounts.filter((m) => m.quadrant === 'port');
      const zValues = port.map((m) => m.localOffset[2]).sort((a, b) => b - a);
      for (let i = 1; i < zValues.length; i++) {
        const prev = zValues[i - 1];
        const curr = zValues[i];
        if (prev !== undefined && curr !== undefined) {
          expect(Math.abs(prev - curr)).toBeCloseTo(0.5, 5);
        }
      }
    });

    it('starboard broadside Z offsets are evenly spaced at 0.5 intervals', () => {
      const starboard = w.mounts.filter((m) => m.quadrant === 'starboard');
      const zValues = starboard.map((m) => m.localOffset[2]).sort((a, b) => b - a);
      for (let i = 1; i < zValues.length; i++) {
        const prev = zValues[i - 1];
        const curr = zValues[i];
        if (prev !== undefined && curr !== undefined) {
          expect(Math.abs(prev - curr)).toBeCloseTo(0.5, 5);
        }
      }
    });

    it('port and starboard broadside Z offsets are mirrored exactly', () => {
      const port = w.mounts.filter((m) => m.quadrant === 'port');
      const star = w.mounts.filter((m) => m.quadrant === 'starboard');
      expect(port.length).toBe(star.length);
      const portZ = port.map((m) => m.localOffset[2]).sort((a, b) => b - a);
      const starZ = star.map((m) => m.localOffset[2]).sort((a, b) => b - a);
      portZ.forEach((pz, i) => {
        const sz = starZ[i];
        if (sz !== undefined) {
          expect(pz).toBeCloseTo(sz, 5);
        }
      });
    });
  });

  describe('skiff', () => {
    const m = BOAT_STATS.skiff.movement;
    it('has bumped thrustForce (~75% over old 2000)', () => {
      expect(m.thrustForce).toBe(3500);
    });
    it('has bumped maxSpeed (~75% over old 18)', () => {
      expect(m.maxSpeed).toBe(32);
    });
    it('has bumped reverseForce', () => {
      expect(m.reverseForce).toBe(1400);
    });
    it('has bumped turnTorque (+71% to 600)', () => {
      expect(m.turnTorque).toBe(600);
    });
  });

  describe('barge', () => {
    const m = BOAT_STATS.barge.movement;
    it('has bumped thrustForce (~50% over old 1200)', () => {
      expect(m.thrustForce).toBe(1800);
    });
    it('has bumped maxSpeed (~50% over old 8)', () => {
      expect(m.maxSpeed).toBe(12);
    });
    it('has bumped reverseForce', () => {
      expect(m.reverseForce).toBe(750);
    });
    it('has bumped turnTorque (+47% to 220)', () => {
      expect(m.turnTorque).toBe(220);
    });
  });
});
