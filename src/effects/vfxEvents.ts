/**
 * VFX event system — lightweight pub/sub for spawning visual effects.
 *
 * Systems (weapon, damage, projectile) emit events here.
 * Effect components subscribe and spawn particles accordingly.
 */

export interface VfxEvent {
  type: 'muzzle-flash' | 'explosion' | 'water-splash';
  position: [number, number, number];
  /** Timestamp for deduplication / expiry. */
  time: number;
}

type VfxListener = (event: VfxEvent) => void;

const listeners = new Set<VfxListener>();

/** Subscribe to VFX events. Returns unsubscribe function. */
export function onVfxEvent(listener: VfxListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Emit a VFX event to all listeners. */
export function emitVfxEvent(event: VfxEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}
