import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Water } from './environment/Water';
import { Rocks } from './environment/Rocks';
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
import { DamageSystemR3F } from './systems/DamageSystemR3F';
import { WaveSystemR3F } from './systems/WaveSystemR3F';
import { PhysicsSyncSystem } from './systems/PhysicsSyncSystem';
import { TrajectoryPreview } from './effects/TrajectoryPreview';
import { PostProcessing } from './effects/PostProcessing';
import { ParticleManager } from './effects/ParticleManager';
import { useGameStore } from './store/gameStore';
import { HUD } from './ui/HUD';
import { TitleScreen } from './ui/TitleScreen';
import { GameOverScreen } from './ui/GameOverScreen';
import { PerfMonitorR3F } from './components/PerfMonitorR3F';

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

/** Game entities that only render when not on title screen. */
function GameEntities() {
  const phase = useGameStore((s) => s.phase);
  if (phase === 'title') return null;

  return (
    <>
      <PlayerBoat />
      <EnemyFleet />
      <ProjectilePool />
      <BuoyancySystemR3F />
      <MovementSystemR3F />
      <WeaponSystemR3F />
      <ProjectileSystemR3F />
      <AISystemR3F />
      <DamageSystemR3F />
      <WaveSystemR3F />
      <TrajectoryPreview />
    </>
  );
}

export function App() {
  const keyMap = useMemo(() => KEY_MAP, []);

  return (
    <KeyboardControls map={keyMap}>
      <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
        <Canvas
          camera={{ position: [0, 8, 25], fov: 60 }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <color attach="background" args={['#1a2a3a']} />
          <WaterProvider>
            <Suspense fallback={null}>
              <Physics
                gravity={[0, -9.81, 0]}
                timeStep="vary"
                interpolate={false}
                updatePriority={-50}
              >
                <PhysicsSyncSystem />
                <GameEntities />
                <Rocks />
              </Physics>
            </Suspense>
            <Water />
            <SkySetup />
            <CameraSystemR3F />
            <ParticleManager />
            <PostProcessing />
            {(import.meta.env.DEV || import.meta.env.VITE_E2E === '1') && <PerfMonitorR3F />}
            <ambientLight intensity={0.5} />
            <directionalLight position={[100, 40, -100]} intensity={1.5} castShadow />
          </WaterProvider>
        </Canvas>

        {/* HTML overlay UI -- sibling div outside Canvas */}
        <HUD />
        <TitleScreen />
        <GameOverScreen />
      </div>
    </KeyboardControls>
  );
}
