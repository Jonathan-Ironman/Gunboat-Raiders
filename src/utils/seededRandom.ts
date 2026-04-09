/**
 * Mulberry32 — fast, high-quality 32-bit seeded PRNG.
 * Returns a function that produces values in [0, 1) from a given seed.
 *
 * Same seed always produces the same sequence (deterministic).
 */
export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0; // coerce to uint32
  return function next(): number {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}
