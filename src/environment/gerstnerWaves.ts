/**
 * CPU-side Gerstner wave math — pure functions, zero DOM/GPU dependencies.
 * Used for buoyancy sampling and must exactly match the GPU shader.
 */

const TWO_PI = 2 * Math.PI;
const GRAVITY = 9.8;
const MODULATION_SPATIAL_SCALE = 0.005;
const MODULATION_TIME_SCALE = 0.01;
const MODULATION_MIN = 0.6;
const MODULATION_MAX = 1.2;
const MODULATED_WAVE_COUNT = 2;

export interface GerstnerWave {
  direction: [number, number]; // normalized 2D direction (x, z)
  steepness: number; // 0-1
  wavelength: number; // meters
  amplitude: number; // derived via initWaves
  speed: number; // derived: sqrt(9.8 / k) where k = 2*PI/wavelength
  phase: number; // phase offset
}

export interface WaveSample {
  height: number;
  normal: [number, number, number];
}

export const AMPLITUDE_MODULATION = {
  spatialScale: MODULATION_SPATIAL_SCALE,
  timeScale: MODULATION_TIME_SCALE,
  min: MODULATION_MIN,
  max: MODULATION_MAX,
  modulatedWaveCount: MODULATED_WAVE_COUNT,
} as const;

export const DEFAULT_WAVES: readonly GerstnerWave[] = [
  // Primary swell — large, slow, dramatic rolling waves
  { direction: [0.8, 0.6], steepness: 0.55, wavelength: 80, amplitude: 0, speed: 0, phase: 0 },
  // Secondary swell — crosses primary for a natural look
  {
    direction: [-0.4, 0.9],
    steepness: 0.48,
    wavelength: 55,
    amplitude: 0,
    speed: 0,
    phase: 0.7,
  },
  // Medium chop — adds visible detail
  {
    direction: [0.6, -0.8],
    steepness: 0.38,
    wavelength: 30,
    amplitude: 0,
    speed: 0,
    phase: 1.3,
  },
  // Small chop — fine detail and realism
  {
    direction: [-0.9, -0.4],
    steepness: 0.28,
    wavelength: 15,
    amplitude: 0,
    speed: 0,
    phase: 2.1,
  },
  // Long diagonal swell — breaks tiling patterns
  { direction: [0.3, 0.95], steepness: 0.22, wavelength: 42, amplitude: 0, speed: 0, phase: 3.5 },
  // Cross-chop — adds asymmetric detail
  {
    direction: [-0.7, 0.3],
    steepness: 0.18,
    wavelength: 22,
    amplitude: 0,
    speed: 0,
    phase: 0.4,
  },
  // Fine diagonal ripple — high-frequency variety
  {
    direction: [0.5, -0.5],
    steepness: 0.14,
    wavelength: 11,
    amplitude: 0,
    speed: 0,
    phase: 1.9,
  },
  // Micro-chop — subtle texture breaker
  {
    direction: [-0.2, -0.8],
    steepness: 0.1,
    wavelength: 7,
    amplitude: 0,
    speed: 0,
    phase: 5.1,
  },
];

/**
 * Normalize a 2D direction vector in-place (returns a new tuple).
 */
function normalize2D(dir: [number, number]): [number, number] {
  const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]);
  if (len === 0) return [1, 0];
  return [dir[0] / len, dir[1] / len];
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function mix(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

function vertHash(x: number, z: number): number {
  return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);
}

function vertNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  let fx = fract(x);
  let fz = fract(z);

  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);

  const a = vertHash(ix, iz);
  const b = vertHash(ix + 1, iz);
  const c = vertHash(ix, iz + 1);
  const d = vertHash(ix + 1, iz + 1);

  return mix(mix(a, b, fx), mix(c, d, fx), fz);
}

export function getAmplitudeModulation(x: number, z: number, time: number): number {
  const noise = vertNoise(
    x * MODULATION_SPATIAL_SCALE + time * MODULATION_TIME_SCALE,
    z * MODULATION_SPATIAL_SCALE + time * MODULATION_TIME_SCALE,
  );
  return mix(MODULATION_MIN, MODULATION_MAX, noise);
}

/**
 * Compute derived amplitude and speed fields for each wave.
 * k = 2*PI / wavelength
 * speed = sqrt(9.8 / k)  (deep water dispersion)
 * amplitude = steepness / (k * numWaves)
 */
export function initWaves(waves: readonly GerstnerWave[]): GerstnerWave[] {
  const numWaves = waves.length;
  return waves.map((w) => {
    const k = TWO_PI / w.wavelength;
    const speed = Math.sqrt(GRAVITY / k);
    const amplitude = w.steepness / (k * numWaves);
    const direction = normalize2D(w.direction);
    return { ...w, direction, speed, amplitude };
  });
}

/**
 * Sample the Gerstner wave surface at world position (x, z) and given time.
 * Returns the displacement height (Y) and the surface normal.
 *
 * Gerstner formula per wave component:
 *   theta = k * dot(dir, [x, z]) - speed * k * time + phase
 *   dx += dir.x * amplitude * cos(theta)
 *   dz += dir.z * amplitude * cos(theta)
 *   dy += amplitude * sin(theta)
 *
 * Normal is computed from partial derivatives of the displaced surface.
 *
 * NOTE: The GPU shader displaces vertices both horizontally (dx,dz) and vertically (dy),
 * but theta is computed from the ORIGINAL (undisplaced) vertex position in both CPU and GPU.
 * For buoyancy sampling we query "what is the wave height at world position (x,z)?",
 * so we only need the vertical displacement (dy). The horizontal displacement affects
 * WHERE a GPU vertex ends up, but does not change the height at a given world coordinate.
 * Both CPU and GPU use the same theta formula, so the vertical displacement matches.
 */
export function getWaveHeight(
  x: number,
  z: number,
  time: number,
  waves: readonly GerstnerWave[],
): WaveSample {
  let dy = 0;

  // Partial derivative accumulators for normal computation
  let dNx = 0;
  let dNz = 0;
  const amplitudeModulation = getAmplitudeModulation(x, z, time);

  for (const [i, wave] of waves.entries()) {
    const dirX = wave.direction[0];
    const dirZ = wave.direction[1];
    const k = TWO_PI / wave.wavelength;
    const ampMod = i < MODULATED_WAVE_COUNT ? amplitudeModulation : 1;
    const amp = wave.amplitude * ampMod;

    const theta = k * (dirX * x + dirZ * z) - wave.speed * k * time + wave.phase;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    dy += amp * sinTheta;

    // Partial derivatives: d(height)/dx and d(height)/dz
    // For the normal: N = (-dH/dx, 1, -dH/dz) then normalized
    dNx += dirX * k * amp * cosTheta;
    dNz += dirZ * k * amp * cosTheta;
  }

  // Construct and normalize the surface normal
  const nx = -dNx;
  const ny = 1;
  const nz = -dNz;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

  return {
    height: dy,
    normal: [nx / len, ny / len, nz / len],
  };
}
