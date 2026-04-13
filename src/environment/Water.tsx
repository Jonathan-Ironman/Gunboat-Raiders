import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ShaderMaterial } from 'three';
import { vertexShader, fragmentShader } from './waterShader';
import { SHARED_WAVE_SAMPLING, encodeWaveData } from './waterConfig';
import { WATER_GEOMETRY } from './waterTunables';

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
    const waveData = encodeWaveData(SHARED_WAVE_SAMPLING);
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
      <planeGeometry
        args={[
          WATER_GEOMETRY.planeSize,
          WATER_GEOMETRY.planeSize,
          WATER_GEOMETRY.planeSegments,
          WATER_GEOMETRY.planeSegments,
        ]}
      />
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
