/**
 * Post-processing effects — Bloom + Vignette.
 *
 * Bloom picks up emissive materials with toneMapped={false}.
 * Vignette adds atmospheric edge darkening; pulses on player damage.
 *
 * Gracefully skips in environments without full WebGL2 support
 * (e.g., headless Playwright) by checking renderer capabilities
 * synchronously before mounting EffectComposer.
 */

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useGameStore } from '@/store/gameStore';

const VIGNETTE_BASE_DARKNESS = 0.5;
const VIGNETTE_DAMAGE_DARKNESS = 0.9;
const VIGNETTE_PULSE_DURATION = 0.3;

/**
 * Synchronously check if the renderer supports post-processing.
 * This runs during render (not in useEffect) to prevent EffectComposer
 * from ever mounting in unsupported environments.
 */
function useCanPostProcess(): boolean {
  const { gl } = useThree();

  return useMemo(() => {
    try {
      // gl.getContext() is typed non-nullable but CAN return null in headless/broken WebGL environments
      const ctx = gl.getContext() as WebGL2RenderingContext | null;
      // Post-processing needs WebGL2 render targets and framebuffers.
      // In headless/software renderers, extensions may be missing causing crashes.
      // Check for the actual WebGL2 context and basic framebuffer support.
      if (ctx === null) return false;

      // Test if we can actually create and use a framebuffer (required for render targets)
      // createFramebuffer() is typed non-nullable but CAN return null in broken environments
      const fb = ctx.createFramebuffer() as WebGLFramebuffer | null;
      if (fb === null) return false;
      ctx.deleteFramebuffer(fb);

      // Check that the renderer reports reasonable capabilities
      if (gl.capabilities.maxTextureSize <= 0) return false;

      // Additional check: try to create a render target to verify it works
      // If the renderer's internal state is broken, getExtension will return null
      // for critical extensions that postprocessing needs
      const ext = ctx.getExtension('EXT_color_buffer_float');
      if (!ext) {
        // EXT_color_buffer_float is needed for HDR render targets (bloom)
        // Without it, post-processing will crash
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }, [gl]);
}

function PostProcessingEffects() {
  const [vignetteDarkness, setVignetteDarkness] = useState(VIGNETTE_BASE_DARKNESS);
  const damageFlashRef = useRef(0);
  const prevHullRef = useRef<number | null>(null);
  const isFlashingRef = useRef(false);

  const checkDamageFlash = useCallback(() => {
    const player = useGameStore.getState().player;
    if (!player) {
      prevHullRef.current = null;
      return;
    }

    const currentHull = player.health.hull + player.health.armor;
    if (prevHullRef.current !== null && currentHull < prevHullRef.current) {
      damageFlashRef.current = VIGNETTE_PULSE_DURATION;
      isFlashingRef.current = true;
    }
    prevHullRef.current = currentHull;
  }, []);

  useEffect(() => {
    const unsub = useGameStore.subscribe(checkDamageFlash);
    return unsub;
  }, [checkDamageFlash]);

  useFrame((_state, delta) => {
    if (!isFlashingRef.current) return;

    damageFlashRef.current = Math.max(0, damageFlashRef.current - delta);
    const t = damageFlashRef.current / VIGNETTE_PULSE_DURATION;
    const darkness =
      VIGNETTE_BASE_DARKNESS + t * (VIGNETTE_DAMAGE_DARKNESS - VIGNETTE_BASE_DARKNESS);
    setVignetteDarkness(darkness);

    if (damageFlashRef.current <= 0) {
      isFlashingRef.current = false;
      setVignetteDarkness(VIGNETTE_BASE_DARKNESS);
    }
  });

  return (
    <EffectComposer>
      <Bloom luminanceThreshold={1} luminanceSmoothing={0.9} intensity={0.5} mipmapBlur />
      <Vignette eskil={false} offset={0.1} darkness={vignetteDarkness} />
    </EffectComposer>
  );
}

export function PostProcessing() {
  const canUse = useCanPostProcess();

  if (!canUse) return null;

  return <PostProcessingEffects />;
}
