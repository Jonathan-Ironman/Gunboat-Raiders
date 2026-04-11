/**
 * Slider — reusable token-styled range input.
 *
 * Thin wrapper around a native `<input type="range">`, styled entirely
 * through `settingsModal.helpers.ts`. The native element is the right
 * primitive here: it is keyboard-accessible for free (arrow keys,
 * Home/End), exposes the correct ARIA role without extra work, and
 * plays nicely with form autofill / browser extensions.
 *
 * ### Shape
 *
 * ```ts
 * interface SliderProps {
 *   value: number;        // 0..100 (slider range, not store range)
 *   onChange?: (v: number) => void;
 *   disabled?: boolean;
 *   ariaLabel: string;
 *   testId?: string;
 * }
 * ```
 *
 * - The component intentionally does NOT know about the store's
 *   `[0, 1]` volume range — callers are responsible for the conversion
 *   using `sliderValueFromVolume` / `volumeFromSliderValue` from the
 *   helpers module. This keeps `Slider` a generic reusable primitive.
 * - `onChange` is optional so the component can render as a read-only
 *   slider (combine with `disabled`) without forcing callers to pass a
 *   no-op handler.
 * - `ariaLabel` is required, not optional — every slider must be
 *   accessible, and forgetting to label it is a common bug we want the
 *   type system to catch.
 *
 * All visual styling flows through `settingsModal.helpers.ts`, which
 * in turn pulls from `tokens.ts`. No hardcoded colours / spacings /
 * fonts live in this file.
 */

import { useId, type ChangeEvent } from 'react';

import {
  SLIDER_MAX,
  SLIDER_MIN,
  sliderInputDisabledStyle,
  sliderInputStyle,
  sliderStylesheet,
  sliderWrapperStyle,
} from './settingsModal.helpers';

/** Public props for the `Slider` component. */
export interface SliderProps {
  /** Current value in the range `[0, 100]`. */
  readonly value: number;
  /**
   * Called whenever the user drags the slider or uses the keyboard
   * (arrows / Home / End). The new value is passed in `[0, 100]`. When
   * `disabled` is `true` this callback is never invoked.
   */
  readonly onChange?: (value: number) => void;
  /**
   * When `true`, the slider renders greyed out with no thumb and
   * swallows any user input. Defaults to `false`.
   */
  readonly disabled?: boolean;
  /**
   * Accessible label announced by screen readers. Required — every
   * slider must have a label so the surrounding form is understandable
   * without sighted context.
   */
  readonly ariaLabel: string;
  /** Optional `data-testid` attribute forwarded to the native input. */
  readonly testId?: string;
}

/**
 * Token-styled slider component.
 *
 * Renders a native `<input type="range">` wrapped in a small div so
 * the parent layout can reliably reserve vertical space even if the
 * thumb is hidden (disabled state). The `<style>` tag injected inside
 * the wrapper carries the WebKit / Gecko pseudo-element rules — these
 * cannot be expressed as inline styles, but the selectors are
 * namespaced to `.gbr-settings-slider` so they cannot leak.
 */
export function Slider(props: SliderProps) {
  const { value, onChange, disabled = false, ariaLabel, testId } = props;
  // `useId` produces a stable SSR/CSR-friendly id that tests can rely
  // on not to collide with other sliders on the page. We only use it
  // as a unique prefix for the slider's own data-testid fallback when
  // one is not supplied.
  const generatedId = useId();
  const resolvedTestId = testId ?? `slider-${generatedId}`;

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    if (disabled) return;
    if (!onChange) return;
    const parsed = Number(event.target.value);
    if (!Number.isFinite(parsed)) return;
    onChange(parsed);
  };

  const inputStyle = disabled
    ? { ...sliderInputStyle, ...sliderInputDisabledStyle }
    : sliderInputStyle;

  return (
    <div style={sliderWrapperStyle} data-testid={`${resolvedTestId}-wrapper`}>
      <style>{sliderStylesheet()}</style>
      <input
        type="range"
        className="gbr-settings-slider"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={1}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuemin={SLIDER_MIN}
        aria-valuemax={SLIDER_MAX}
        aria-valuenow={value}
        aria-disabled={disabled}
        data-testid={resolvedTestId}
        style={inputStyle}
      />
    </div>
  );
}
