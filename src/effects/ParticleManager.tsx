/**
 * Particle manager — listens for VFX events and manages effect instances.
 *
 * Subscribes to the vfxEvents pub/sub system and maintains arrays of
 * active effect instances. Cleans up old instances periodically.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { onVfxEvent, type VfxEvent } from './vfxEvents';
import { MuzzleFlash, type MuzzleFlashInstance } from './MuzzleFlash';
import { Explosion, type ExplosionInstance } from './Explosion';
import { WaterSplash, type WaterSplashInstance } from './WaterSplash';
import { CameraShakeEffect, type ShakeEvent } from './CameraShake';
import { AudioManager } from '@/audio/AudioManager';

/** Max age (seconds) before an instance is cleaned up. */
const INSTANCE_MAX_AGE = 2;

export function ParticleManager() {
  const [muzzleFlashes, setMuzzleFlashes] = useState<MuzzleFlashInstance[]>([]);
  const [explosions, setExplosions] = useState<ExplosionInstance[]>([]);
  const [splashes, setSplashes] = useState<WaterSplashInstance[]>([]);
  const [shakeEvents, setShakeEvents] = useState<ShakeEvent[]>([]);
  const cleanupTimerRef = useRef(0);

  const handleVfxEvent = useCallback((event: VfxEvent) => {
    const instance = { position: event.position, time: event.time };

    switch (event.type) {
      case 'muzzle-flash':
        setMuzzleFlashes((prev) => [...prev, instance]);
        AudioManager.play('cannon_fire', event.position);
        break;
      case 'explosion':
        setExplosions((prev) => [...prev, instance]);
        setShakeEvents((prev) => [...prev, instance]);
        AudioManager.play('explosion', event.position);
        break;
      case 'water-splash':
        setSplashes((prev) => [...prev, instance]);
        setShakeEvents((prev) => [...prev, instance]);
        AudioManager.play('splash', event.position);
        break;
    }
  }, []);

  useEffect(() => {
    // Initialize audio on first mount
    AudioManager.init();
    const unsub = onVfxEvent(handleVfxEvent);
    return () => {
      unsub();
    };
  }, [handleVfxEvent]);

  // Periodic cleanup of old instances to prevent unbounded growth
  useFrame((_state, delta) => {
    cleanupTimerRef.current += delta;
    if (cleanupTimerRef.current < 2) return; // Clean up every 2 seconds
    cleanupTimerRef.current = 0;

    const now = performance.now() / 1000;
    const cutoff = now - INSTANCE_MAX_AGE;

    setMuzzleFlashes((prev) => {
      const filtered = prev.filter((i) => i.time > cutoff);
      return filtered.length === prev.length ? prev : filtered;
    });
    setExplosions((prev) => {
      const filtered = prev.filter((i) => i.time > cutoff);
      return filtered.length === prev.length ? prev : filtered;
    });
    setSplashes((prev) => {
      const filtered = prev.filter((i) => i.time > cutoff);
      return filtered.length === prev.length ? prev : filtered;
    });
    setShakeEvents((prev) => {
      const filtered = prev.filter((i) => i.time > cutoff);
      return filtered.length === prev.length ? prev : filtered;
    });
  });

  return (
    <>
      <MuzzleFlash instances={muzzleFlashes} />
      <Explosion instances={explosions} />
      <WaterSplash instances={splashes} />
      <CameraShakeEffect events={shakeEvents} />
    </>
  );
}
