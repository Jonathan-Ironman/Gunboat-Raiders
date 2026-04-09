import { Sky } from '@react-three/drei';

const SUN_POSITION: [number, number, number] = [100, 40, -100];
const TURBIDITY = 6;
const RAYLEIGH = 1.5;

/**
 * Sky backdrop using drei's Preetham sky model.
 * Late-afternoon sun for dramatic orange/teal mood.
 */
export function SkySetup() {
  return <Sky sunPosition={SUN_POSITION} turbidity={TURBIDITY} rayleigh={RAYLEIGH} />;
}
