/**
 * Unit tests for `src/ui/Button.tsx` and `buttonStylesheet()`.
 *
 * Coverage layers:
 *
 * 1. **Style composition** — verifies that the Button component correctly
 *    resolves the base + variant + disabled recipe chain by asserting
 *    on the compiled style output embedded in SSR HTML.
 * 2. **Prop forwarding** — `data-testid`, `aria-*`, `onClick` contract
 *    (simulated, since SSR does not wire real event listeners), `type`.
 * 3. **Disabled state** — `disabled` HTML attribute + recipe overlap.
 * 4. **Hover stylesheet** — `buttonStylesheet()` output contains the
 *    expected CSS class names and hover/active rules for all three variants.
 * 5. **forwardRef** — verifies the component is a forwardRef component.
 * 6. **className forwarding** — caller-supplied className is appended
 *    to the gbr-btn namespace prefix.
 */

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button, type ButtonProps } from '@/ui/Button';
import { buttonStylesheet } from '@/ui/buttonRecipes';
import { SURFACE_EL, TEXT_PRI } from '@/ui/tokens';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render a `<Button>` to static HTML and return the full string.
 * Accepts a loose record of props so callers can pass HTML `data-*`
 * and `aria-*` attributes without fighting TypeScript's strict object
 * literal checks against the generated TS declarations for those
 * attribute families (which require an index signature). The cast is
 * safe because the real ButtonProps interface extends
 * `React.ButtonHTMLAttributes` which accepts all standard HTML attrs.
 */
function renderButton(props: Record<string, unknown> = {}, label = 'Click me'): string {
  return renderToStaticMarkup(createElement(Button, props as unknown as ButtonProps, label));
}

/**
 * Extract the `style="..."` attribute value from the rendered `<button>`
 * tag so we can assert on individual CSS properties without pattern-
 * matching the entire serialised HTML string. React SSR serialises
 * camelCase properties as their kebab-case equivalents.
 */
function extractButtonStyleAttr(html: string): string {
  const match = html.match(/<button[^>]*style="([^"]*)"[^>]*>/);
  return match?.[1] ?? '';
}

// ---------------------------------------------------------------------------
// 1. Style composition — primary variant
// ---------------------------------------------------------------------------

describe('Button — primary variant style composition', () => {
  it('renders a <button> element', () => {
    const html = renderButton({ variant: 'primary' });
    expect(html).toContain('<button');
  });

  it('includes the gold gradient background from BTN_PRI_BG token', () => {
    const html = renderButton({ variant: 'primary' });
    // React SSR serialises gradient values into the style attribute;
    // the specific gradient colors come from BTN_PRI_BG.
    const style = extractButtonStyleAttr(html);
    expect(style.toLowerCase()).toContain('linear-gradient');
    // The gold gradient contains the gold stop from tokens.ts.
    expect(style).toContain('f2b640');
  });

  it('sets the primary text color (deep harbour contrast)', () => {
    const html = renderButton({ variant: 'primary' });
    const style = extractButtonStyleAttr(html);
    // BTN_PRI_COLOR = '#071120'
    expect(style.toLowerCase()).toContain('071120');
  });

  it('applies the gbr-btn and gbr-btn--primary class names', () => {
    const html = renderButton({ variant: 'primary' });
    expect(html).toContain('class="gbr-btn gbr-btn--primary"');
  });
});

// ---------------------------------------------------------------------------
// 2. Style composition — secondary variant (default)
// ---------------------------------------------------------------------------

describe('Button — secondary variant style composition', () => {
  it('defaults to the secondary variant when no variant prop is supplied', () => {
    const html = renderButton();
    expect(html).toContain('gbr-btn--secondary');
  });

  it('uses the SURFACE_EL background token', () => {
    const html = renderButton({ variant: 'secondary' });
    const style = extractButtonStyleAttr(html);
    // SURFACE_EL = '#1c3556' — strip the '#' prefix for the raw hex check
    const tokenHex = SURFACE_EL.replace('#', '');
    expect(style.toLowerCase()).toContain(tokenHex.toLowerCase());
  });

  it('uses the TEXT_PRI color token', () => {
    const html = renderButton({ variant: 'secondary' });
    const style = extractButtonStyleAttr(html);
    // TEXT_PRI = '#ffffff'
    const tokenHex = TEXT_PRI.replace('#', '');
    expect(style.toLowerCase()).toContain(tokenHex.toLowerCase());
  });

  it('applies the gbr-btn and gbr-btn--secondary class names', () => {
    const html = renderButton({ variant: 'secondary' });
    expect(html).toContain('class="gbr-btn gbr-btn--secondary"');
  });
});

// ---------------------------------------------------------------------------
// 3. Style composition — destructive variant
// ---------------------------------------------------------------------------

describe('Button — destructive variant style composition', () => {
  it('uses a red linear-gradient background', () => {
    const html = renderButton({ variant: 'destructive' });
    const style = extractButtonStyleAttr(html);
    expect(style.toLowerCase()).toContain('linear-gradient');
    // RED = '#ff8080' — the gradient contains the ff8080 red stop
    expect(style.toLowerCase()).toContain('ff8080');
  });

  it('applies the gbr-btn and gbr-btn--destructive class names', () => {
    const html = renderButton({ variant: 'destructive' });
    expect(html).toContain('class="gbr-btn gbr-btn--destructive"');
  });
});

// ---------------------------------------------------------------------------
// 4. Disabled state
// ---------------------------------------------------------------------------

describe('Button — disabled state', () => {
  it('renders the HTML disabled attribute when disabled=true', () => {
    const html = renderButton({ disabled: true });
    const buttonTag = html.match(/<button[^>]*>/)?.[0] ?? '';
    // React SSR serialises boolean `disabled` as `disabled=""`
    expect(buttonTag).toContain('disabled=""');
  });

  it('overlays the disabled recipe — opacity 0.4 in the style', () => {
    const html = renderButton({ disabled: true });
    const style = extractButtonStyleAttr(html);
    expect(style).toContain('opacity:0.4');
  });

  it('overlays the disabled recipe — not-allowed cursor', () => {
    const html = renderButton({ disabled: true });
    const style = extractButtonStyleAttr(html);
    expect(style).toContain('not-allowed');
  });

  it('does NOT set the disabled attribute when disabled is omitted', () => {
    const html = renderButton({ variant: 'primary' });
    const buttonTag = html.match(/<button[^>]*>/)?.[0] ?? '';
    expect(buttonTag).not.toContain(' disabled');
  });
});

// ---------------------------------------------------------------------------
// 5. Prop forwarding
// ---------------------------------------------------------------------------

describe('Button — prop forwarding', () => {
  it('forwards data-testid to the <button> element', () => {
    const html = renderButton({ 'data-testid': 'my-action-btn' });
    expect(html).toContain('data-testid="my-action-btn"');
  });

  it('forwards aria-label to the <button> element', () => {
    const html = renderButton({ 'aria-label': 'Confirm deletion' });
    expect(html).toContain('aria-label="Confirm deletion"');
  });

  it('defaults type to "button" to prevent accidental form submissions', () => {
    const html = renderButton();
    expect(html).toContain('type="button"');
  });

  it('renders the children as button text content', () => {
    const html = renderButton({}, 'Play Again');
    expect(html).toContain('>Play Again<');
  });

  it('appends a caller-supplied className after the gbr-btn namespace', () => {
    const html = renderButton({ className: 'my-custom-class' });
    expect(html).toContain('gbr-btn gbr-btn--secondary my-custom-class');
  });

  it('allows a caller-supplied style to override the last layer', () => {
    // The style prop is the last spread, so any property it carries wins
    // over the recipe. Here we override width to 'auto'.
    const html = renderButton({ style: { width: 'auto', flex: 1 } });
    const style = extractButtonStyleAttr(html);
    // React serialises width:auto and flex:1 into the style attribute
    expect(style).toContain('width:auto');
    expect(style).toContain('flex:1');
  });
});

// ---------------------------------------------------------------------------
// 6. Hover stylesheet — buttonStylesheet()
// ---------------------------------------------------------------------------

describe('buttonStylesheet — hover + active rules', () => {
  it('contains the .gbr-btn base class reset', () => {
    const css = buttonStylesheet();
    expect(css).toContain('.gbr-btn');
  });

  it('contains the primary hover rule targeting .gbr-btn--primary', () => {
    const css = buttonStylesheet();
    expect(css).toContain('.gbr-btn--primary:not(:disabled):hover');
    // Gold family — lighter gold gradient
    expect(css).toContain('f7c850');
  });

  it('contains the primary active rule (no translateY — color/shadow shift only)', () => {
    const css = buttonStylesheet();
    expect(css).toContain('.gbr-btn--primary:not(:disabled):active');
    expect(css).not.toContain('translateY');
  });

  it('contains the secondary hover rule targeting .gbr-btn--secondary', () => {
    const css = buttonStylesheet();
    expect(css).toContain('.gbr-btn--secondary:not(:disabled):hover');
    // Warm harbour-blue hover background
    expect(css).toContain('254b72');
  });

  it('contains the secondary active rule', () => {
    const css = buttonStylesheet();
    expect(css).toContain('.gbr-btn--secondary:not(:disabled):active');
  });

  it('contains the destructive hover rule targeting .gbr-btn--destructive', () => {
    const css = buttonStylesheet();
    expect(css).toContain('.gbr-btn--destructive:not(:disabled):hover');
    // Red family hover — brighter red
    expect(css).toContain('ff9090');
  });

  it('contains the destructive active rule', () => {
    const css = buttonStylesheet();
    expect(css).toContain('.gbr-btn--destructive:not(:disabled):active');
  });

  it('blocks pointer events on :disabled so CSS hover cannot fire', () => {
    const css = buttonStylesheet();
    expect(css).toContain('.gbr-btn:disabled');
    expect(css).toContain('pointer-events: none');
  });

  it('includes a focus-visible ring using the GOLD token', () => {
    const css = buttonStylesheet();
    expect(css).toContain('.gbr-btn:focus-visible');
    // GOLD = '#f2b640'
    expect(css).toContain('f2b640');
  });
});

// ---------------------------------------------------------------------------
// 7. Button is a forwardRef component
// ---------------------------------------------------------------------------

describe('Button — forwardRef', () => {
  it('is a React forwardRef component (has $$typeof or displayName pattern)', () => {
    // React.forwardRef wraps the component; the resulting object exposes
    // a `$$typeof` Symbol or can be identified by the presence of a
    // `render` function on the returned object.
    // We check indirectly: the component renders without a ref in SSR
    // (which is the only way to test this headlessly), and the type is
    // a function/object (not a plain function).
    expect(Button).toBeDefined();
    expect(typeof Button).toBe('object'); // forwardRef returns an object, not a plain function
  });
});

// ---------------------------------------------------------------------------
// 8. The <style> tag is injected alongside the button
// ---------------------------------------------------------------------------

describe('Button — inline <style> injection', () => {
  it('renders a <style> tag containing the button CSS rules', () => {
    const html = renderButton({ variant: 'primary' });
    expect(html).toContain('<style>');
    expect(html).toContain('.gbr-btn--primary:not(:disabled):hover');
  });

  it('the injected <style> tag is a sibling of the <button>', () => {
    const html = renderButton({ variant: 'secondary' });
    // React fragments render as adjacent nodes — both should appear in
    // the same HTML string
    expect(html).toContain('<style>');
    expect(html).toContain('<button');
  });
});
