/**
 * ShowcaseCameraSystem — slow cinematic camera for the main menu.
 *
 * This runs in parallel with the gameplay `CameraSystemR3F`. That
 * system is always mounted outside of `<Physics>`, but it short-
 * circuits whenever `getPlayerBodyState()` returns `null` — which is
 * exactly the case while `phase === 'mainMenu'` (the gameplay player
 * boat isn't spawned yet). That leaves the Three.js camera entirely
 * under this system's control during the main menu.
 *
 * Modes:
 *
 * - **cinematic-side**: Camera sits off the boat's starboard quarter,
 *   tracking the boat with a slow longitudinal drift so the horizon
 *   moves gently — the "heading out to sea" shot.
 *
 * - **orbit-slow**: Camera slowly orbits the boat. One full rotation
 *   over `ORBIT_PERIOD_S` seconds. Paired with the `Lazy Circle`
 *   preset to get an overlapping, dreamy movement.
 *
 * - **pan-slow**: Stationary camera high-and-wide, panning the yaw
 *   slowly back and forth as if the player is looking around an
 *   anchored vessel at dawn.
 *
 * The system never requests pointer lock, never reads mouse input,
 * and never touches the game store.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { getShowcaseBoatBody } from './showcaseRefs';
import type { ShowcaseCameraConfig } from './showcasePresets';

/** Seconds per full orbit for the `orbit-slow` mode. */
const ORBIT_PERIOD_S = 30;
/** Peak yaw amplitude (radians) for the `pan-slow` mode. */
const PAN_AMPLITUDE_RAD = 0.35;
/** Seconds per full pan cycle for the `pan-slow` mode. */
const PAN_PERIOD_S = 20;
/** Side drift range for the `cinematic-side` mode (metres). */
const SIDE_DRIFT_RANGE_M = 4;
/** Seconds per full drift cycle for the `cinematic-side` mode. */
const SIDE_DRIFT_PERIOD_S = 18;
/** Y offset added to the lookAt target so we look slightly above the boat deck. */
const LOOKAT_HEIGHT = 2;
/** Fallback position when the body isn't registered yet (pre-mount frame). */
const FALLBACK_TARGET = new Vector3(0, 0, 0);

const _target = new Vector3();
const _cameraPos = new Vector3();

interface ShowcaseCameraSystemProps {
  readonly preset: ShowcaseCameraConfig;
}

export function ShowcaseCameraSystem({ preset }: ShowcaseCameraSystemProps) {
  const elapsedRef = useRef(0);

  useFrame(({ camera }, delta) => {
    elapsedRef.current += delta;
    const t = elapsedRef.current;

    // Resolve the follow target. Prefer the showcase body; fall back
    // to the origin so the camera still looks somewhere sensible on
    // the first frame before the body ref is published.
    const body = getShowcaseBoatBody();
    if (body !== null) {
      try {
        const p = body.translation();
        if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) {
          _target.set(p.x, p.y + LOOKAT_HEIGHT, p.z);
        } else {
          _target.copy(FALLBACK_TARGET).setY(LOOKAT_HEIGHT);
        }
      } catch {
        _target.copy(FALLBACK_TARGET).setY(LOOKAT_HEIGHT);
      }
    } else {
      _target.copy(FALLBACK_TARGET).setY(LOOKAT_HEIGHT);
    }

    const distance = preset.distance;
    const height = preset.height;

    switch (preset.mode) {
      case 'cinematic-side': {
        // Sit off the boat's starboard quarter and drift a little along
        // the longitudinal axis for a breathing horizon.
        const drift = Math.sin((2 * Math.PI * t) / SIDE_DRIFT_PERIOD_S) * SIDE_DRIFT_RANGE_M;
        _cameraPos.set(
          _target.x + distance,
          _target.y + height,
          _target.z - distance * 0.3 + drift,
        );
        break;
      }

      case 'orbit-slow': {
        const angle = (2 * Math.PI * t) / ORBIT_PERIOD_S;
        _cameraPos.set(
          _target.x + distance * Math.sin(angle),
          _target.y + height,
          _target.z + distance * Math.cos(angle),
        );
        break;
      }

      case 'pan-slow': {
        // Stationary position, but yaw the lookAt target left/right
        // slowly so it feels like a human looking out over the bow.
        const yawOffset = Math.sin((2 * Math.PI * t) / PAN_PERIOD_S) * PAN_AMPLITUDE_RAD;
        _cameraPos.set(
          _target.x + distance * Math.sin(Math.PI + yawOffset),
          _target.y + height,
          _target.z + distance * Math.cos(Math.PI + yawOffset),
        );
        break;
      }
    }

    camera.position.copy(_cameraPos);
    camera.lookAt(_target);
  });

  return null;
}
