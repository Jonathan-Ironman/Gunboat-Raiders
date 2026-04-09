/**
 * Rocks container -- generates and renders all rock obstacles from a fixed seed.
 *
 * Positions are memoized and never change during a game session.
 */

import { useMemo } from 'react';
import { Rock } from '../entities/Rock';
import { generateRockPositions } from '../utils/rockPlacement';
import { ARENA_RADIUS, ROCK_COUNT } from '../utils/constants';

/** Fixed seed for deterministic rock layout. */
const ROCK_SEED = 42;

/** Player spawn safe zone radius -- no rocks within this distance from center. */
const SAFE_ZONE_RADIUS = 30;

/** Minimum distance between any two rocks. */
const MIN_SPACING = 15;

export function Rocks() {
  const rocks = useMemo(
    () => generateRockPositions(ROCK_SEED, ROCK_COUNT, ARENA_RADIUS, SAFE_ZONE_RADIUS, MIN_SPACING),
    [],
  );

  return (
    <>
      {rocks.map((config, index) => (
        <Rock key={index} config={config} />
      ))}
    </>
  );
}
