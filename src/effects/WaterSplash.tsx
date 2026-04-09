/**
 * Water splash particle effect — column of white/blue particles on water impact.
 *
 * Non-emissive (no bloom), upward velocity for column shape.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, NormalBlending } from 'three';
import type { Points } from 'three';

const LIFETIME = 0.3;
const MAX_BUFFER_SIZE = 300;

export interface WaterSplashInstance {
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

function spawnSplashParticles(pos: [number, number, number]): Particle[] {
  const particles: Particle[] = [];
  const count = 15 + Math.floor(Math.random() * 6); // 15-20

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const spread = 0.5 + Math.random() * 1.5;
    const upSpeed = 5 + Math.random() * 8;

    particles.push({
      x: pos[0] + Math.cos(theta) * spread * 0.3,
      y: pos[1],
      z: pos[2] + Math.sin(theta) * spread * 0.3,
      vx: Math.cos(theta) * spread,
      vy: upSpeed,
      vz: Math.sin(theta) * spread,
      age: 0,
      alive: true,
    });
  }
  return particles;
}

export function WaterSplash({ instances }: { instances: WaterSplashInstance[] }) {
  const pointsRef = useRef<Points>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastSpawnedRef = useRef(0);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(MAX_BUFFER_SIZE * 3), 3),
    );
    geo.setAttribute('size', new Float32BufferAttribute(new Float32Array(MAX_BUFFER_SIZE), 1));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  useFrame((_state, delta) => {
    // Spawn new particles
    if (instances.length > lastSpawnedRef.current) {
      for (let i = lastSpawnedRef.current; i < instances.length; i++) {
        const inst = instances[i];
        if (!inst) continue;
        const newParticles = spawnSplashParticles(inst.position);
        particlesRef.current.push(...newParticles);
      }
      lastSpawnedRef.current = instances.length;
    }

    // Update particles
    const gravity = -15;
    const posAttr = geometry.getAttribute('position');
    const sizeAttr = geometry.getAttribute('size');
    let drawCount = 0;

    for (const p of particlesRef.current) {
      if (!p.alive) continue;
      p.age += delta;
      if (p.age >= LIFETIME) {
        p.alive = false;
        continue;
      }
      p.vy += gravity * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      if (drawCount < posAttr.count) {
        const t = 1 - p.age / LIFETIME;
        posAttr.setXYZ(drawCount, p.x, p.y, p.z);
        sizeAttr.setX(drawCount, t * 3);
        drawCount++;
      }
    }

    // Clean up dead particles periodically
    const deadCount = particlesRef.current.filter((p) => !p.alive).length;
    if (deadCount > 20) {
      particlesRef.current = particlesRef.current.filter((p) => p.alive);
    }

    geometry.setDrawRange(0, drawCount);
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#a8d8ea"
        size={3}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={NormalBlending}
      />
    </points>
  );
}
