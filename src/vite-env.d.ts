/// <reference types="vite/client" />

// Extend Vite's ImportMetaEnv with our custom env vars.
interface ImportMetaEnv {
  /**
   * When set to `'1'`, the built bundle exposes test bridges on `window`
   * (Zustand store, physics body refs, fire bridge, error logger, perf monitor)
   * so Playwright can drive the real production bundle. Unset in deploys.
   */
  readonly VITE_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Extend JSX.IntrinsicElements with React Three Fiber's Three.js element types.
// Required for @react-three/fiber v8 compatibility with React 19's JSX transform.
import type { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    // Extends React's JSX intrinsic elements with all Three.js object types
    // so R3F elements like <mesh>, <ambientLight> etc. are type-safe.
    // eslint rule no-empty-object-type is disabled for app source.
    interface IntrinsicElements extends ThreeElements {}
  }
}
