import { describe, it, expect } from 'vitest';
import { BOAT_STATS } from '../../src/utils/boatStats';

describe('BOAT_STATS movement values', () => {
  describe('player', () => {
    const m = BOAT_STATS.player.movement;
    it('has bumped thrustForce (~25% over old 8000)', () => {
      expect(m.thrustForce).toBe(10000);
    });
    it('has bumped maxSpeed (~25% over old 22)', () => {
      expect(m.maxSpeed).toBe(28);
    });
    it('has bumped reverseForce', () => {
      expect(m.reverseForce).toBe(3000);
    });
    it('leaves turnTorque unchanged', () => {
      expect(m.turnTorque).toBe(2000);
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

    it('fore/aft Z values unchanged', () => {
      const fore = w.mounts.filter((m) => m.quadrant === 'fore');
      for (const m of fore) {
        expect(m.localOffset[2]).toBe(2.0);
      }
      const aft = w.mounts.filter((m) => m.quadrant === 'aft');
      for (const m of aft) {
        expect(m.localOffset[2]).toBe(-2.0);
      }
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
    it('leaves turnTorque unchanged', () => {
      expect(m.turnTorque).toBe(350);
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
    it('leaves turnTorque unchanged', () => {
      expect(m.turnTorque).toBe(150);
    });
  });
});
