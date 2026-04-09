# Phase 1: Water and Sky

## Objective

Render a convincing ocean with animated Gerstner waves and a sky, with a CPU-side `getWaveHeight()` function that exactly matches the GPU shader for buoyancy sampling.

## Prerequisites

- Phase 0 complete (project scaffolding, store, test infrastructure)

## Files to Create/Modify

```
src/
  environment/
    gerstnerWaves.ts      # CPU-side wave math (pure functions, no DOM/GPU)
    waterShader.ts         # GLSL vertex + fragment shader strings
    Water.tsx              # R3F mesh with custom ShaderMaterial
    WaterContext.tsx        # React context providing getWaveHeight()
    Sky.tsx                # drei Sky component config
  App.tsx                  # Add Water + Sky + orbit camera
tests/
  unit/
    gerstnerWaves.test.ts  # Wave math unit tests
```

## Implementation Details

### 1. Gerstner Wave Math (`gerstnerWaves.ts`)

Pure TypeScript, zero dependencies on Three.js or DOM.

```typescript
export interface GerstnerWave {
  direction: [number, number]; // normalized 2D direction (x, z)
  steepness: number;           // 0-1
  wavelength: number;          // meters
  amplitude: number;           // derived
  speed: number;               // derived: sqrt(9.8 * wavelength / (2 * PI))
  phase: number;               // offset
}

export interface WaveSample {
  height: number;
  normal: [number, number, number];
}

export const DEFAULT_WAVES: GerstnerWave[] = [
  { direction: [1, 0],     steepness: 0.25, wavelength: 60, amplitude: 0, speed: 0, phase: 0 },
  { direction: [0, 1],     steepness: 0.25, wavelength: 40, amplitude: 0, speed: 0, phase: 0.5 },
  { direction: [0.7, 0.7], steepness: 0.15, wavelength: 25, amplitude: 0, speed: 0, phase: 1.0 },
  { direction: [0.3, -0.9],steepness: 0.10, wavelength: 15, amplitude: 0, speed: 0, phase: 1.5 },
];
// Call initWaves() to compute derived amplitude and speed fields.

export function initWaves(waves: GerstnerWave[]): GerstnerWave[];
export function getWaveHeight(x: number, z: number, time: number, waves: GerstnerWave[]): WaveSample;
```

Key math for a single Gerstner wave component:
- `k = 2 * PI / wavelength`
- `speed = sqrt(9.8 / k)` (deep water dispersion)
- `amplitude = steepness / (k * numWaves)`
- Displacement at point (x, z):
  - `theta = k * dot(direction, [x, z]) - speed * k * time + phase`
  - `dx += direction[0] * amplitude * cos(theta)`
  - `dz += direction[1] * amplitude * cos(theta)`
  - `dy += amplitude * sin(theta)`
- Normal computed from partial derivatives of the Gerstner surface

The GLSL shader must use the identical formula with the same constants passed as uniforms.

### 2. Water Shader (`waterShader.ts`)

Export `vertexShader` and `fragmentShader` as strings.

Vertex shader:
- Uniform: `uTime` (float), `uWaves` (array of structs or flat array encoding direction, steepness, wavelength, speed, phase for 4 waves)
- Apply Gerstner displacement to each vertex of a subdivided plane
- Pass normal to fragment shader

Fragment shader:
- Deep ocean base color: `vec3(0.0, 0.05, 0.1)`
- Fresnel effect for specular highlights using view direction
- Foam on steep crests (where displacement.y is high relative to neighbors)
- Use `toneMapped = true` (water itself is not emissive)

### 3. Water Component (`Water.tsx`)

- `PlaneGeometry(256, 256, 256, 256)` rotated to lie in XZ plane
- Custom `ShaderMaterial` using the vertex/fragment shaders
- `useFrame` updates `uTime` uniform each frame
- Position at world Y=0

### 4. Water Context (`WaterContext.tsx`)

- React context providing `getWaveHeight(x, z, time)` to child components
- Stores initialized wave parameters
- Time tracked via `useFrame` and stored in a ref

### 5. Sky (`Sky.tsx`)

- drei `<Sky>` component
- Preetham model with late-afternoon sun: `sunPosition={[100, 20, -100]}`
- Turbidity ~8, rayleigh ~2 for dramatic orange/teal mood

### 6. App.tsx Updates

- Add `<WaterContext>` provider wrapping the Physics component
- Add `<Water />` and `<SkySetup />` inside the Canvas
- Add drei `<OrbitControls>` temporarily for testing (replaced by custom camera in Phase 3)
- Set Canvas `camera` prop: `{ position: [0, 15, 30], fov: 60 }`

## Tests to Write

### `tests/unit/gerstnerWaves.test.ts`

```
- test: initWaves computes non-zero amplitude and speed for each wave
- test: getWaveHeight returns height=0 approximately at time=0 x=0 z=0 (sum of phases)
- test: getWaveHeight returns different heights for different x positions
- test: getWaveHeight returns different heights for different time values
- test: getWaveHeight returns a valid normal vector (length approximately 1)
- test: getWaveHeight is deterministic (same inputs = same output)
- test: wave height stays within reasonable bounds (e.g. -5 to +5 meters for default waves)
- test: speed is correctly computed as sqrt(9.8 * wavelength / (2 * PI))
```

## Acceptance Criteria

- [ ] `pnpm test -- tests/unit/gerstnerWaves.test.ts` passes all 8+ tests
- [ ] `getWaveHeight` runs in Node.js without any browser APIs
- [ ] `getWaveHeight(0, 0, 0, waves)` returns a `WaveSample` with numeric `height` and 3-element `normal`
- [ ] `getWaveHeight(10, 0, 0, waves).height !== getWaveHeight(0, 0, 0, waves).height` (spatial variation)
- [ ] `getWaveHeight(0, 0, 1, waves).height !== getWaveHeight(0, 0, 0, waves).height` (temporal variation)
- [ ] `pnpm verify` still passes (all prior + new tests)
- [ ] Playwright smoke test: canvas renders (no crash from shader compilation)

## Verification Command

```bash
pnpm verify && pnpm test -- tests/unit/gerstnerWaves.test.ts
```
