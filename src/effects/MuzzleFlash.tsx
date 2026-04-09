/**
 * Muzzle flash particle effect — bright orange/yellow burst at cannon fire.
 *
 * Uses a simple Points-based particle system with manual buffer updates.
 * Particles are emissive with toneMapped={false} to trigger bloom.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute } from 'three';
import type { Points } from 'three';

const MAX_PARTICLES = 10;
const LIFETIME = 0.15;
const INITIAL_SPEED = 8;

export interface MuzzleFlashInstance {
  position: [number, number, number];
  time: number;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  alive: boolean;
}

export function MuzzleFlash({ instances }: { instances: MuzzleFlashInstance[] }) {
  const pointsRef = useRef<Points>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastSpawnedRef = useRef(0);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 50 * 3); // 50 particles per instance max
    const sizes = new Float32Array(MAX_PARTICLES * 50);
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('size', new Float32BufferAttribute(sizes, 1));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  useFrame((_state, delta) => {
    // Spawn new particles for new instances
    if (instances.length > lastSpawnedRef.current) {
      for (let i = lastSpawnedRef.current; i < instances.length; i++) {
        const inst = instances[i];
        if (!inst) continue;
        const count = 5 + Math.floor(Math.random() * 6); // 5-10 particles
        for (let j = 0; j < count; j++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI * 0.5;
          const speed = INITIAL_SPEED * (0.5 + Math.random() * 0.5);
          particlesRef.current.push({
            x: inst.position[0],
            y: inst.position[1],
            z: inst.position[2],
            vx: Math.cos(theta) * Math.sin(phi) * speed,
            vy: Math.abs(Math.sin(phi)) * speed * 0.5,
            vz: Math.sin(theta) * Math.sin(phi) * speed,
            age: 0,
            alive: true,
          });
        }
      }
      lastSpawnedRef.current = instances.length;
    }

    // Update particles
    const particles = particlesRef.current;
    const posAttr = geometry.getAttribute('position');
    const sizeAttr = geometry.getAttribute('size');
    let drawCount = 0;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      p.age += delta;
      if (p.age >= LIFETIME) {
        p.alive = false;
      }
    }

    // Remove dead particles
    particlesRef.current = particles.filter((p) => p.alive);

    // Write live particles to buffers
    for (const p of particlesRef.current) {
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      if (drawCount < posAttr.count) {
        posAttr.setXYZ(drawCount, p.x, p.y, p.z);
        const t = 1 - p.age / LIFETIME;
        sizeAttr.setX(drawCount, t * 3);
        drawCount++;
      }
    }

    geometry.setDrawRange(0, drawCount);
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={[5, 3, 0]}
        size={3}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
