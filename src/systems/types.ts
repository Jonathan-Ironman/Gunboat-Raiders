/** Input state that systems read each frame */
export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  mouseX: number; // normalized -1..1
  mouseY: number; // normalized -1..1
}

/** Default input (nothing pressed) */
export const EMPTY_INPUT: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  fire: false,
  mouseX: 0,
  mouseY: 0,
};

/**
 * All game systems implement this interface.
 * Systems read from the Zustand store via getState(),
 * apply logic, then write back via actions.
 *
 * The `step` method can be called:
 * - From useFrame (rendering context)
 * - From a headless test (no Canvas, no GPU)
 */
export interface SimulatableSystem {
  step(delta: number, input: InputState): void;
}
