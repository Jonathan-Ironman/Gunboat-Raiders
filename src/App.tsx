import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Water } from './environment/Water';
import { WaterProvider } from './environment/WaterContext';
import { SkySetup } from './environment/Sky';

export function App() {
  return (
    <Canvas
      camera={{ position: [0, 8, 25], fov: 60 }}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    >
      <color attach="background" args={['#6b8cad']} />
      <fog attach="fog" args={['#6b8cad', 200, 800]} />
      <WaterProvider>
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]}>{null /* Future phases add entities here */}</Physics>
        </Suspense>
        <Water />
        <SkySetup />
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 40, -100]} intensity={1.5} castShadow />
        <OrbitControls />
      </WaterProvider>
    </Canvas>
  );
}
