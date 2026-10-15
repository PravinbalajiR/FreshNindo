// FreshRoute — 3D warehouse view: one stack of crates per batch.
// Stack height = quantity (1 crate ≈ 100 kg), colour = freshness
// (green ready, amber time-sensitive, red at risk). Click a stack to select it.

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Edges, OrbitControls, RoundedBox } from '@react-three/drei';
import { Label } from './Label';
import type { Group } from 'three';
import type { InventoryBatch } from '../../data/dataset';
import type { Plan } from '../../types';
import { batchFreshness, FRESHNESS_COLOR } from '../../engine/supplyChain';

const KG_PER_CRATE = 100;
const CRATE = 0.55;
const GAP = 0.06;
const MAX_CRATES = 24;

interface StackProps {
  batch: InventoryBatch;
  color: string;
  x: number;
  index: number;
  selected: boolean;
  onSelect: () => void;
}

const Stack: React.FC<StackProps> = ({ batch, color, x, index, selected, onSelect }) => {
  const group = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const crates = Math.max(1, Math.min(MAX_CRATES, Math.ceil(batch.quantity_kg / KG_PER_CRATE)));
  const layers = Math.ceil(crates / 4);
  const born = useRef(performance.now() + index * 120);

  useFrame(() => {
    if (!group.current) return;
    // Drop-in on mount, then lift slightly when selected/hovered
    const t = Math.min(1, Math.max(0, (performance.now() - born.current) / 600));
    const ease = 1 - Math.pow(1 - t, 3);
    const lift = selected ? 0.25 : hover ? 0.1 : 0;
    group.current.position.y += ((1 - ease) * 4 + lift - group.current.position.y) * 0.2;
  });

  const cells = useMemo(
    () =>
      Array.from({ length: crates }, (_, i) => {
        const layer = Math.floor(i / 4);
        const slot = i % 4;
        return [
          (slot % 2 === 0 ? -1 : 1) * (CRATE + GAP) * 0.5,
          CRATE / 2 + layer * (CRATE + GAP),
          (slot < 2 ? -1 : 1) * (CRATE + GAP) * 0.5,
        ] as [number, number, number];
      }),
    [crates]
  );

  return (
    <group
      ref={group}
      position={[x, 4, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
    >
      {cells.map((p, i) => (
        <RoundedBox key={i} args={[CRATE, CRATE, CRATE]} radius={0.05} smoothness={2} position={p} castShadow>
          <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
          <Edges color={selected ? '#0071e3' : '#ffffff'} threshold={15} />
        </RoundedBox>
      ))}
      {/* Pallet */}
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[CRATE * 2 + GAP * 3, 0.08, CRATE * 2 + GAP * 3]} />
        <meshStandardMaterial color={selected ? '#0071e3' : '#c8b28a'} />
      </mesh>
      <Label
        position={[0, layers * (CRATE + GAP) + 0.45, 0]}
        accent={color}
        size={0.3}
        lines={[`${batch.batch_id} · ${batch.commodity}`, `${batch.quantity_kg} kg · ${batch.remaining_shelf_life_hours}h left`]}
      />
    </group>
  );
};

interface CrateStack3DProps {
  batches: InventoryBatch[];
  plan: Plan | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  height?: number;
}

export const CrateStack3D: React.FC<CrateStack3DProps> = ({ batches, plan, selectedId = null, onSelect, height = 380 }) => {
  const spacing = 2.4;
  const offset = ((batches.length - 1) * spacing) / 2;
  const counts = { READY: 0, TIME_SENSITIVE: 0, INFEASIBLE: 0 };
  const colored = batches.map((b) => {
    const f = batchFreshness(b, plan);
    counts[f] += 1;
    return { b, color: FRESHNESS_COLOR[f] };
  });
  const camDist = Math.max(6, batches.length * 1.25);

  return (
    <div className="scene-frame" style={{ height }}>
      <div className="scene-overlay">
        <span className="scene-chip"><span className="dot" style={{ background: FRESHNESS_COLOR.READY }} />Fresh · {counts.READY}</span>
        <span className="scene-chip"><span className="dot" style={{ background: FRESHNESS_COLOR.TIME_SENSITIVE }} />Sell soon · {counts.TIME_SENSITIVE}</span>
        <span className="scene-chip"><span className="dot" style={{ background: FRESHNESS_COLOR.INFEASIBLE }} />At risk · {counts.INFEASIBLE}</span>
        <span className="scene-chip">1 crate ≈ {KG_PER_CRATE} kg</span>
      </div>
      <Canvas flat shadows dpr={[1, 2]} camera={{ position: [camDist * 0.55, camDist * 0.55, camDist], fov: 40 }} onPointerMissed={() => onSelect?.(null)}>
        <ambientLight intensity={1.0} />
        <directionalLight position={[6, 10, 6]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
        <hemisphereLight args={['#ffffff', '#dfe7ef', 0.4]} />
        {colored.map(({ b, color }, i) => (
          <Stack
            key={b.batch_id}
            batch={b}
            color={color}
            x={i * spacing - offset}
            index={i}
            selected={selectedId === b.batch_id}
            onSelect={() => onSelect?.(selectedId === b.batch_id ? null : b.batch_id)}
          />
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <meshBasicMaterial color="#f4f6f9" />
        </mesh>
        <gridHelper args={[40, 40, '#d7dee6', '#e4e9ef']} position={[0, -0.08, 0]} />
        <ContactShadows position={[0, -0.07, 0]} opacity={0.35} scale={30} blur={2.4} far={6} />
        <OrbitControls enablePan={false} minDistance={4} maxDistance={30} maxPolarAngle={Math.PI / 2.15} autoRotate autoRotateSpeed={0.4} />
      </Canvas>
      <div className="scene-hint">Drag to rotate · scroll to zoom · click a stack</div>
    </div>
  );
};

export default CrateStack3D;
