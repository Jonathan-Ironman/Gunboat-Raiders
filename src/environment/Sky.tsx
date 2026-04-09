import { Sky } from '@react-three/drei';

const SUN_POSITION: [number, number, number] = [100, 40, -100];
const TURBIDITY = 4;
const RAYLEIGH = 2.5;
const MIE_COEFFICIENT = 0.005;
const MIE_DIRECTIONAL_G = 0.85;

/**
 * Sky backdrop using drei's Preetham sky model.
 * Late-afternoon sun for dramatic orange/teal mood.
 * distance must be large enough to enclose the entire scene including fog range.
 */
export function SkySetup() {
  return (
    <Sky
      distance={450000}
      sunPosition={SUN_POSITION}
      turbidity={TURBIDITY}
      rayleigh={RAYLEIGH}
      mieCoefficient={MIE_COEFFICIENT}
      mieDirectionalG={MIE_DIRECTIONAL_G}
    />
  );
}
