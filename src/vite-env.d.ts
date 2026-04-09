/// <reference types="vite/client" />

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
