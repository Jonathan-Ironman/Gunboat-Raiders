import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Water } from './environment/Water';
import { WaterProvider } from './environment/WaterContext';
import { SkySetup } from './environment/Sky';
import { PlayerBoat } from './entities/PlayerBoat';
import { EnemyBoat } from './entities/EnemyBoat';
import { ProjectilePool } from './entities/ProjectilePool';
import { BuoyancySystemR3F } from './systems/BuoyancySystemR3F';
import { MovementSystemR3F } from './systems/MovementSystemR3F';
import { CameraSystemR3F } from './systems/CameraSystemR3F';
import { WeaponSystemR3F } from './systems/WeaponSystemR3F';
import { ProjectileSystemR3F } from './systems/ProjectileSystemR3F';
import { AISystemR3F } from './systems/AISystemR3F';
import { WaveSystemR3F } from './systems/WaveSystemR3F';
import { TrajectoryPreview } from './effects/TrajectoryPreview';
import { useGameStore } from './store/gameStore';

const KEY_MAP = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'fire', keys: ['Space'] },
];

/** Renders all enemy boats from the store. */
function EnemyFleet() {
  const enemies = useGameStore((s) => s.enemies);

  return (
    <>
      {[...enemies.values()].map((enemy) => (
        <EnemyBoat
          key={enemy.id}
          id={enemy.id}
          enemyType={enemy.enemyType ?? 'skiff'}
          position={enemy.position}
        />
      ))}
    </>
  );
}

export function App() {
  const keyMap = useMemo(() => KEY_MAP, []);

  return (
    <KeyboardControls map={keyMap}>
      <Canvas
        camera={{ position: [0, 8, 25], fov: 60 }}
        style={{ width: '100vw', height: '100vh', display: 'block' }}
      >
        {/* Fallback background — Sky dome covers most of the view.
            No scene-level fog: the water shader handles its own distance fog,
            preventing fog from washing out the Sky dome. */}
        <color attach="background" args={['#1a2a3a']} />
        <WaterProvider>
          <Suspense fallback={null}>
            <Physics gravity={[0, -9.81, 0]}>
              <PlayerBoat />
              <EnemyFleet />
              <ProjectilePool />
              <BuoyancySystemR3F />
              <MovementSystemR3F />
              <WeaponSystemR3F />
              <ProjectileSystemR3F />
              <AISystemR3F />
              <WaveSystemR3F />
            </Physics>
          </Suspense>
          <Water />
          <SkySetup />
          <CameraSystemR3F />
          <TrajectoryPreview />
          <ambientLight intensity={0.5} />
          <directionalLight position={[100, 40, -100]} intensity={1.5} castShadow />
        </WaterProvider>
      </Canvas>
    </KeyboardControls>
  );
}
