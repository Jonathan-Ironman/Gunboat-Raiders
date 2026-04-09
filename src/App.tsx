import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';

export function App() {
  return (
    <Canvas
      camera={{ position: [0, 10, 20], fov: 60 }}
      style={{ width: '100vw', height: '100vh', background: '#0a1628' }}
    >
      <Physics gravity={[0, -9.81, 0]}>
        {null /* Future phases add entities here */}
      </Physics>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
    </Canvas>
  );
}
