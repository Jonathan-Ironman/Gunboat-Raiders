/**
 * Camera shake effect — triggered by nearby explosions.
 *
 * Uses a simple per-frame camera offset approach rather than drei's CameraShake,
 * since we need precise control over trigger timing and intensity based on
 * explosion distance.
 */

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

const SHAKE_DURATION = 0.2;
const SHAKE_MAX_DISTANCE = 30;
const SHAKE_MAX_INTENSITY = 0.3;
const SHAKE_FREQUENCY = 12; // Hz

export interface ShakeEvent {
  position: [number, number, number];
  time: number;
}

export function CameraShakeEffect({ events }: { events: ShakeEvent[] }) {
  const { camera } = useThree();
  const activeShakeRef = useRef<{ intensity: number; remaining: number } | null>(null);
  const lastProcessedRef = useRef(0);

  useFrame((_state, delta) => {
    // Process new shake events
    if (events.length > lastProcessedRef.current) {
      for (let i = lastProcessedRef.current; i < events.length; i++) {
        const event = events[i];
        if (!event) continue;

        const camPos = camera.position;
        const dx = event.position[0] - camPos.x;
        const dy = event.position[1] - camPos.y;
        const dz = event.position[2] - camPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < SHAKE_MAX_DISTANCE) {
          const intensity = SHAKE_MAX_INTENSITY * (1 - dist / SHAKE_MAX_DISTANCE);
          // Only replace if stronger than current shake
          if (!activeShakeRef.current || intensity > activeShakeRef.current.intensity) {
            activeShakeRef.current = { intensity, remaining: SHAKE_DURATION };
          }
        }
      }
      lastProcessedRef.current = events.length;
    }

    // Apply active shake
    const shake = activeShakeRef.current;
    if (!shake || shake.remaining <= 0) {
      activeShakeRef.current = null;
      return;
    }

    shake.remaining -= delta;
    const t = shake.remaining / SHAKE_DURATION;
    const amplitude = shake.intensity * t; // Decay over time

    const time = performance.now() / 1000;
    const offsetX = Math.sin(time * SHAKE_FREQUENCY * Math.PI * 2) * amplitude;
    const offsetY = Math.cos(time * SHAKE_FREQUENCY * Math.PI * 2 * 1.3) * amplitude * 0.7;

    camera.position.x += offsetX;
    camera.position.y += offsetY;
  });

  return null;
}
