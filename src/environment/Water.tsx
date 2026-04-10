import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ShaderMaterial } from 'three';
import { vertexShader, fragmentShader } from './waterShader';
import { initWaves, DEFAULT_WAVES } from './gerstnerWaves';

const PLANE_SIZE = 2000;
const PLANE_SEGMENTS = 128;
const FLOATS_PER_WAVE = 7;

/**
 * Encode initialized waves into a flat Float32Array for the GPU uniform.
 * Per wave: [dirX, dirZ, steepness, wavelength, amplitude, speed, phase] = 7 floats
 */
function encodeWaveData(waves: ReturnType<typeof initWaves>): Float32Array {
  const data = new Float32Array(waves.length * FLOATS_PER_WAVE);
  for (let i = 0; i < waves.length; i++) {
    const w = waves[i];
    if (!w) continue;
    const base = i * FLOATS_PER_WAVE;
    data[base + 0] = w.direction[0];
    data[base + 1] = w.direction[1];
    data[base + 2] = w.steepness;
    data[base + 3] = w.wavelength;
    data[base + 4] = w.amplitude;
    data[base + 5] = w.speed;
    data[base + 6] = w.phase;
  }
  return data;
}

/**
 * Ocean surface mesh with Gerstner wave displacement via custom shaders.
 * PlaneGeometry lies in the XZ plane at Y=0.
 *
 * The material ref is used to update uTime directly on the GPU material
 * each frame. Updating a detached uniforms object does NOT propagate to
 * the ShaderMaterial instance created by R3F's reconciler — we must
 * mutate material.uniforms.uTime.value via the ref.
 */
export function Water() {
  const matRef = useRef<ShaderMaterial>(null);

  const uniforms = useMemo(() => {
    const waves = initWaves([...DEFAULT_WAVES]);
    const waveData = encodeWaveData(waves);
    return {
      uTime: { value: 0 },
      uWaveData: { value: waveData },
    };
  }, []);

  useFrame((state) => {
    const mat = matRef.current;
    if (mat) {
      const uTime = mat.uniforms['uTime'];
      if (uTime) {
        uTime.value = state.clock.elapsedTime;
      }
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} renderOrder={-1}>
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE, PLANE_SEGMENTS, PLANE_SEGMENTS]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        toneMapped={false}
        depthWrite={true}
        depthTest={true}
      />
    </mesh>
  );
}
