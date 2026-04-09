/**
 * Explosion particle effect — orange/red core + grey smoke on impact.
 *
 * Core particles are emissive for bloom, smoke particles are non-emissive.
 * Uses a simple Points-based particle system.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, NormalBlending } from 'three';
import type { Points } from 'three';

const LIFETIME = 0.5;
const MAX_BUFFER_SIZE = 500; // enough for multiple simultaneous explosions

export interface ExplosionInstance {
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
  isSmoke: boolean;
}

function spawnExplosionParticles(pos: [number, number, number]): Particle[] {
  const particles: Particle[] = [];
  const count = 20 + Math.floor(Math.random() * 11); // 20-30

  for (let i = 0; i < count; i++) {
    const isSmoke = i >= count * 0.6; // ~40% smoke
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = isSmoke ? 2 + Math.random() * 3 : 5 + Math.random() * 8;

    particles.push({
      x: pos[0],
      y: pos[1],
      z: pos[2],
      vx: Math.cos(theta) * Math.sin(phi) * speed,
      vy: Math.sin(phi) * speed * 0.8 + (isSmoke ? 2 : 0),
      vz: Math.sin(theta) * Math.sin(phi) * speed,
      age: 0,
      alive: true,
      isSmoke,
    });
  }
  return particles;
}

/** Renders the emissive (fire) particles of explosions. */
function ExplosionFire({
  particles,
  geometry,
}: {
  particles: React.RefObject<Particle[]>;
  geometry: BufferGeometry;
}) {
  const pointsRef = useRef<Points>(null);

  useFrame(() => {
    const posAttr = geometry.getAttribute('position');
    const sizeAttr = geometry.getAttribute('size');
    let drawCount = 0;

    for (const p of particles.current) {
      if (!p.alive || p.isSmoke) continue;
      if (drawCount >= posAttr.count) break;
      const t = 1 - p.age / LIFETIME;
      posAttr.setXYZ(drawCount, p.x, p.y, p.z);
      sizeAttr.setX(drawCount, t * 4);
      drawCount++;
    }

    geometry.setDrawRange(0, drawCount);
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={[4, 1.5, 0]}
        size={4}
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

/** Renders the smoke particles of explosions. */
function ExplosionSmoke({
  particles,
  geometry,
}: {
  particles: React.RefObject<Particle[]>;
  geometry: BufferGeometry;
}) {
  const pointsRef = useRef<Points>(null);

  useFrame(() => {
    const posAttr = geometry.getAttribute('position');
    const sizeAttr = geometry.getAttribute('size');
    let drawCount = 0;

    for (const p of particles.current) {
      if (!p.alive || !p.isSmoke) continue;
      if (drawCount >= posAttr.count) break;
      const t = 1 - p.age / LIFETIME;
      posAttr.setXYZ(drawCount, p.x, p.y, p.z);
      sizeAttr.setX(drawCount, t * 6);
      drawCount++;
    }

    geometry.setDrawRange(0, drawCount);
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#666666"
        size={6}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={NormalBlending}
      />
    </points>
  );
}

export function Explosion({ instances }: { instances: ExplosionInstance[] }) {
  const particlesRef = useRef<Particle[]>([]);
  const lastSpawnedRef = useRef(0);

  const fireGeometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(MAX_BUFFER_SIZE * 3), 3),
    );
    geo.setAttribute('size', new Float32BufferAttribute(new Float32Array(MAX_BUFFER_SIZE), 1));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const smokeGeometry = useMemo(() => {
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
        const newParticles = spawnExplosionParticles(inst.position);
        particlesRef.current.push(...newParticles);
      }
      lastSpawnedRef.current = instances.length;
    }

    // Update particle physics
    const gravity = -5;
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
    }

    // Remove dead particles periodically (every 30+ dead)
    const deadCount = particlesRef.current.filter((p) => !p.alive).length;
    if (deadCount > 30) {
      particlesRef.current = particlesRef.current.filter((p) => p.alive);
    }
  });

  return (
    <>
      <ExplosionFire particles={particlesRef} geometry={fireGeometry} />
      <ExplosionSmoke particles={particlesRef} geometry={smokeGeometry} />
    </>
  );
}
