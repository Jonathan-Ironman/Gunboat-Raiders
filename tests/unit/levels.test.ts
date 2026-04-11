/**
 * Unit tests for `src/config/levels.ts`.
 *
 * The briefing modal consumes `LEVELS[briefingLevelIndex]` without any
 * runtime validation, so the catalogue must always ship with at least
 * one fully-populated entry and the indexes must line up with their
 * array positions. These tests pin that contract.
 */

import { describe, expect, it } from 'vitest';

import { LEVELS, type LevelConfig } from '@/config/levels';

describe('config/levels — LEVELS catalogue', () => {
  it('contains at least one level entry', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(1);
  });

  it('entry zero is the "First Light" level with all briefing copy populated', () => {
    const firstLight = LEVELS[0];
    expect(firstLight).toBeDefined();
    if (firstLight === undefined) throw new Error('expected LEVELS[0] to exist');

    expect(firstLight.index).toBe(0);
    expect(firstLight.name).toBe('First Light');
    expect(firstLight.missionStatement.length).toBeGreaterThan(0);
    expect(firstLight.controlsSummary.length).toBeGreaterThan(0);
    expect(firstLight.mechanicsExplanation.length).toBeGreaterThan(0);
  });

  it('every entry has a non-empty name / mission / controls / briefing string', () => {
    for (const level of LEVELS) {
      expect(typeof level.name).toBe('string');
      expect(level.name.trim().length).toBeGreaterThan(0);
      expect(typeof level.missionStatement).toBe('string');
      expect(level.missionStatement.trim().length).toBeGreaterThan(0);
      expect(typeof level.controlsSummary).toBe('string');
      expect(level.controlsSummary.trim().length).toBeGreaterThan(0);
      expect(typeof level.mechanicsExplanation).toBe('string');
      expect(level.mechanicsExplanation.trim().length).toBeGreaterThan(0);
    }
  });

  it('each level.index matches its position in the array', () => {
    LEVELS.forEach((level, arrayIdx) => {
      expect(level.index).toBe(arrayIdx);
    });
  });

  it('LevelConfig type is structurally compatible with plain object literals', () => {
    // Compile-time assertion: if `LevelConfig` ever loses a field, this
    // literal would stop type-checking. Kept here to pin the public
    // shape — the runtime assertions below are a belt-and-braces check.
    const sample: LevelConfig = {
      index: 0,
      name: 'Unit Test Level',
      missionStatement: 'Test mission',
      controlsSummary: 'Test controls',
      mechanicsExplanation: 'Test briefing',
    };
    expect(sample.index).toBe(0);
    expect(sample.name).toBe('Unit Test Level');
  });
});
