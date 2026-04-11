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
import { EnemyProjectilePool } from './entities/EnemyProjectilePool';
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
import { MainMenuScene } from './ui/MainMenuScene';
import { LevelBriefingModal } from './ui/LevelBriefingModal';
import { GameOverScreen } from './ui/GameOverScreen';
import { PerfMonitorR3F } from './components/PerfMonitorR3F';
import { ShowcaseScene } from './scenes/ShowcaseScene';

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

/**
 * Game entities that render during every phase except `mainMenu`.
 *
 * When the phase is `mainMenu` the sibling `<ShowcaseScene />` takes
 * this slot (see `SceneRoot` below) so the canvas shows nothing but
 * water, sky, and the cinematic showcase boat.
 */
function GameEntities() {
  return (
    <>
      <PlayerBoat />
      <EnemyFleet />
      <ProjectilePool />
      <EnemyProjectilePool />
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

/**
 * Swap between the cinematic `ShowcaseScene` (main menu backdrop) and
 * the regular `GameEntities` tree (everything else). Kept as its own
 * component so the phase subscription stays a sibling of `<Physics>`
 * — re-renders here do not reach the `Physics` provider itself.
 */
function SceneRoot() {
  const phase = useGameStore((s) => s.phase);
  return phase === 'mainMenu' ? <ShowcaseScene /> : <GameEntities />;
}

export function App() {
  const keyMap = useMemo(() => KEY_MAP, []);
  // R4: physics must halt while paused. The `paused` prop on `@react-three/rapier`
  // `<Physics>` short-circuits `step(delta)` and freezes the interpolation alpha
  // (verified against the v2.2.0 source), so bodies stop moving without any
  // fallback velocity-zeroing. Re-reading through a selector keeps this reactive:
  // any phase change re-renders App and re-evaluates `isPaused`.
  const isPaused = useGameStore((s) => s.phase === 'paused');

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
                paused={isPaused}
              >
                <PhysicsSyncSystem />
                <SceneRoot />
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
            <directionalLight position={[100, 40, -100]} intensity={1.5} />
          </WaterProvider>
        </Canvas>

        {/* HTML overlay UI -- sibling div outside Canvas */}
        <HUD />
        <MainMenuScene />
        <LevelBriefingModal />
        <GameOverScreen />
      </div>
    </KeyboardControls>
  );
}
