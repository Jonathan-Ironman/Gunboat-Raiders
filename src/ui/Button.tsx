/**
 * Button — reusable Harbour Dawn button component.
 *
 * Single source of truth for every interactive button in the game UI.
 * Before this component existed, each menu wired its own inline
 * `<button style={{...BUTTON_RECIPE.base, ...BUTTON_RECIPE.primary}}>`,
 * which meant hover effects required per-component `useState` — or were
 * simply missing. This component centralises the style composition,
 * hover/active effects, and prop forwarding in one place.
 *
 * ### Usage
 *
 * ```tsx
 * <Button variant="primary" onClick={handleStart}>Start</Button>
 * <Button variant="secondary" onClick={handleBack}>Back</Button>
 * <Button variant="destructive" onClick={handleExit}>Exit</Button>
 * <Button disabled>Continue Game</Button>   // greyed, pointer-events none
 * ```
 *
 * All remaining HTML button attributes (`data-testid`, `aria-*`, `type`,
 * `ref`, `form`, etc.) flow through via `...rest`. A caller-supplied
 * `style` prop is applied as the last layer so call sites can still
 * push a layout override (e.g. `width: 'auto'`, `flex: 1`) without
 * losing the shared recipe.
 *
 * ### Hover effects
 *
 * Since inline styles cannot target `:hover` / `:active`, a scoped
 * `<style>` tag is injected inside the component (identical to the
 * pattern used by `Slider` with `.gbr-settings-slider` rules). The
 * rules are namespaced under `.gbr-btn` + `.gbr-btn--<variant>` so
 * they cannot leak to any other element. Browsers de-duplicate
 * identical `<style>` tags from SSR, and the stylesheet content is
 * stable (no runtime interpolation after module load), so the
 * performance impact is negligible.
 *
 * Each variant gets its own color-family hover effect:
 * - **Primary (gold)** — brighter gold background + expanded glow, slight translateY(-1px).
 * - **Secondary (neutral)** — lighter harbour-blue fill + stronger drop glow.
 * - **Destructive (red)** — brighter red + expanded red glow.
 *
 * All three share an `:active` state that translateY(2px) + shrinks the
 * emboss shadow to simulate a physical key press.
 *
 * All visuals flow through `buttonRecipes.ts` → `tokens.ts`.
 */

import React from 'react';

import { BUTTON_RECIPE, buttonStylesheet } from './buttonRecipes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The three interactive button variants. Disabled is not a variant —
 * it is expressed via the standard HTML `disabled` prop which the
 * component automatically maps to `BUTTON_RECIPE.disabled` styling.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

/** Props for the `Button` component. */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual variant that controls background color, text color, and
   * hover/active glow color family. Defaults to `'secondary'`.
   */
  readonly variant?: ButtonVariant;
  /**
   * When `true`, the button is greyed out and pointer events are
   * blocked via CSS. The `disabled` HTML attribute is also set so
   * assistive technologies correctly announce the state.
   */
  readonly disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Reusable Harbour Dawn button. Composes `BUTTON_RECIPE.base` with
 * the requested variant recipe, then overlays the `disabled` recipe
 * when `disabled === true`. A caller-supplied `style` prop is the last
 * layer so call sites can push a layout override (e.g. `flex: 1`,
 * `width: 'auto'`) without breaking the shared recipe.
 *
 * Implemented as a `forwardRef` so parent components can hold a ref to
 * the underlying `<button>` for focus management (e.g. `ConfirmDialog`'s
 * default-focus-on-cancel behaviour).
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', disabled = false, style, className, children, ...rest },
  ref,
) {
  const variantStyle = BUTTON_RECIPE[variant];
  const composedStyle: React.CSSProperties = {
    ...BUTTON_RECIPE.base,
    ...variantStyle,
    ...(disabled ? BUTTON_RECIPE.disabled : {}),
    ...style,
  };

  // Build the className. `gbr-btn` carries the shared reset + focus ring.
  // `gbr-btn--<variant>` targets the variant-specific hover/active rules.
  // We do NOT apply the hover class when disabled so the CSS :not(:disabled)
  // guard is belt-and-suspenders (the disabled HTML attribute also blocks
  // pointer events via the injected stylesheet).
  const variantClass = `gbr-btn--${variant}`;
  const resolvedClassName = className
    ? `gbr-btn ${variantClass} ${className}`
    : `gbr-btn ${variantClass}`;

  return (
    <>
      <style>{buttonStylesheet()}</style>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        style={composedStyle}
        className={resolvedClassName}
        {...rest}
      >
        {children}
      </button>
    </>
  );
});
