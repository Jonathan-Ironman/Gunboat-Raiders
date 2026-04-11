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
