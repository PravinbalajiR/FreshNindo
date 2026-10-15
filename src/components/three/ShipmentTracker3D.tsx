// FreshRoute — 3D shipment tracker.
// The real road path (from OSRM) is flattened onto a ground plane; a low-poly
// truck drives along it at `progress` (0 → 1). Travelled road turns blue.

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Line, OrbitControls, RoundedBox } from '@react-three/drei';
import { Label } from './Label';
import { Vector3, type Group } from 'three';

type V3 = [number, number, number];

interface ShipmentTracker3DProps {
  /** [lat, lng] pairs along the road */
  path: [number, number][];
  progress: number;
  originLabel: string;
  destLabel: string;
  freshColor: string;
  follow?: boolean;
  height?: number;
  children?: React.ReactNode; // overlay chips
}

const SIZE = 12;

function project(path: [number, number][]): V3[] {
  if (path.length === 0) return [[0, 0, 0]];
  // Downsample long OSRM geometries
  const step = Math.max(1, Math.floor(path.length / 400));
  const pts = path.filter((_, i) => i % step === 0 || i === path.length - 1);
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const minX = Math.min(...lngs) * kx, maxX = Math.max(...lngs) * kx;
  const minZ = Math.min(...lats), maxZ = Math.max(...lats);
  const span = Math.max(maxX - minX, maxZ - minZ, 1e-6);
  const s = SIZE / span;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  // North = -z so the map isn't mirrored
  return pts.map(([lat, lng]) => [(lng * kx - cx) * s, 0.02, -(lat - cz) * s]);
}

function cumulative(points: V3[]) {
  const d = [0];
  for (let i = 1; i < points.length; i++) {
    const [ax, , az] = points[i - 1];
    const [bx, , bz] = points[i];
    d.push(d[i - 1] + Math.hypot(bx - ax, bz - az));
  }
  return d;
}

function sample(points: V3[], cum: number[], t: number): { pos: V3; heading: number; index: number } {
  const total = cum[cum.length - 1] || 1;
  const target = Math.max(0, Math.min(1, t)) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const a = points[i - 1] ?? points[0];
  const b = points[i] ?? a;
  const seg = cum[i] - cum[i - 1] || 1;
  const f = Math.max(0, Math.min(1, (target - cum[i - 1]) / seg));
  const pos: V3 = [a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f];
  return { pos, heading: Math.atan2(b[0] - a[0], b[2] - a[2]), index: i };
}

const Truck: React.FC<{ target: { pos: V3; heading: number } }> = ({ target }) => {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    g.position.x += (target.pos[0] - g.position.x) * 0.15;
    g.position.z += (target.pos[2] - g.position.z) * 0.15;
    g.position.y = 0.02 + Math.sin(state.clock.elapsedTime * 12) * 0.006;
    let dh = target.heading - g.rotation.y;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    g.rotation.y += dh * 0.15;
  });
  const wheel = (x: number, z: number) => (
    <mesh position={[x, 0.07, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.07, 0.07, 0.05, 16]} />
      <meshStandardMaterial color="#1d1d1f" />
    </mesh>
  );
  return (
    <group ref={ref} position={target.pos} scale={2.2}>
      {/* cargo box (refrigerated) */}
      <RoundedBox args={[0.32, 0.26, 0.52]} radius={0.03} position={[0, 0.24, -0.08]} castShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </RoundedBox>
      {/* cab */}
      <RoundedBox args={[0.3, 0.2, 0.16]} radius={0.03} position={[0, 0.19, 0.27]} castShadow>
        <meshStandardMaterial color="#0071e3" roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.23, 0.351]}>
        <boxGeometry args={[0.24, 0.08, 0.005]} />
        <meshStandardMaterial color="#9fd0ff" metalness={0.3} roughness={0.1} />
      </mesh>
      {/* chassis + wheels */}
      <mesh position={[0, 0.09, 0.02]} castShadow>
        <boxGeometry args={[0.28, 0.04, 0.72]} />
        <meshStandardMaterial color="#3a3a3c" />
      </mesh>
      {wheel(-0.15, 0.24)}
      {wheel(0.15, 0.24)}
      {wheel(-0.15, -0.2)}
      {wheel(0.15, -0.2)}
    </group>
  );
};

const Pin: React.FC<{ at: V3; color: string; label: string }> = ({ at, color, label }) => (
  <group position={at}>
    <mesh position={[0, 0.35, 0]} castShadow>
      <cylinderGeometry args={[0.03, 0.03, 0.7, 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
    <mesh position={[0, 0.75, 0]} castShadow>
      <sphereGeometry args={[0.13, 24, 24]} />
      <meshStandardMaterial color={color} />
    </mesh>
    <Label position={[0, 1.25, 0]} lines={[label]} accent={color} size={0.5} />
  </group>
);

const FollowCam: React.FC<{ target: V3; heading: number; enabled: boolean }> = ({ target, heading, enabled }) => {
  const { camera } = useThree();
  const want = useMemo(() => new Vector3(), []);
  const look = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    if (!enabled) return;
    want.set(target[0] - Math.sin(heading) * 4, 2.6, target[2] - Math.cos(heading) * 4);
    camera.position.lerp(want, Math.min(1, dt * 2.5));
    look.set(target[0], 0.2, target[2]);
    camera.lookAt(look);
  });
  return null;
};

export const ShipmentTracker3D: React.FC<ShipmentTracker3DProps> = ({
  path,
  progress,
  originLabel,
  destLabel,
  freshColor,
  follow = false,
  height = 400,
  children,
}) => {
  const points = useMemo(() => project(path), [path]);
  const cum = useMemo(() => cumulative(points), [points]);
  const s = sample(points, cum, progress);
  const travelled = useMemo(() => [...points.slice(0, s.index), [s.pos[0], 0.03, s.pos[2]] as V3], [points, s.index, s.pos[0], s.pos[2]]);
  const raised = useMemo(() => points.map((p) => [p[0], 0.025, p[2]] as V3), [points]);

  return (
    <div className="scene-frame" style={{ height }}>
      <div className="scene-overlay">{children}</div>
      <Canvas flat shadows dpr={[1, 2]} camera={{ position: [0, 12, 10], fov: 45 }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[8, 14, 6]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
        {/* round "terrain" disc with a subtle grid */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[SIZE * 0.85, 96]} />
          <meshBasicMaterial color="#eef6ea" />
        </mesh>
        <gridHelper args={[SIZE * 1.6, 16, '#cfe0c6', '#d8e6d0']} position={[0, 0.005, 0]} />
        {/* full road, then the travelled part in blue */}
        {raised.length > 1 && <Line points={raised} color="#8d98a3" lineWidth={6} />}
        {travelled.length > 1 && <Line points={travelled} color="#0071e3" lineWidth={7} />}
        <Pin at={points[0]} color="#1d1d1f" label={`🏭 ${originLabel}`} />
        <Pin at={points[points.length - 1]} color={freshColor} label={`🏪 ${destLabel}`} />
        <Truck target={s} />
        <ContactShadows position={[0, 0.01, 0]} opacity={0.3} scale={SIZE * 2} blur={2} far={3} />
        <FollowCam target={s.pos} heading={s.heading} enabled={follow} />
        {!follow && <OrbitControls enablePan={false} minDistance={4} maxDistance={28} maxPolarAngle={Math.PI / 2.2} />}
      </Canvas>
      <div className="scene-hint">{follow ? 'Camera following truck' : 'Drag to rotate · scroll to zoom'}</div>
    </div>
  );
};

export default ShipmentTracker3D;
