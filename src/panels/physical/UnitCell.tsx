// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The rotatable unit cell (SPEC §10.4), drawn with @react-three/fiber in its own lazily loaded chunk:
// the cell's twelve edges and every atom in or on it, as spheres drawn smaller than the atoms so that
// the cell can be seen through. Drag to turn it; the panel's buttons turn it too, for keyboards. Frames
// are drawn on demand only, so an idle cell costs nothing.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AmbientLight, BufferGeometry, DirectionalLight, Float32BufferAttribute, type PerspectiveCamera, Spherical, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BALL_SHARE, type CellModel, relative } from "./cell";

export interface CellTurn {
  /** Incremented to request a turn: azimuth and elevation steps in radians. */
  seq: number;
  dAzimuth: number;
  dElevation: number;
  reset?: boolean;
}

const VIEW = new Vector3(2.4, -3.4, 1.6).normalize();

function cssColour(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function place(camera: PerspectiveCamera, radius: number) {
  const distance = (radius * 1.08) / Math.sin(((camera.fov / 2) * Math.PI) / 180);
  camera.up.set(0, 0, 1);
  camera.position.copy(VIEW).multiplyScalar(distance);
  camera.near = distance / 50;
  camera.far = distance * 4;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function Scene({ model, accent, turn, onDrawn }: { model: CellModel; accent: string; turn: CellTurn; onDrawn: () => void }) {
  const { camera, gl, scene, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const drawn = useRef(false);

  // Scene units: the longest cell edge is 1.
  const scale = useMemo(() => 1 / Math.max(...model.vectors.map((v) => Math.hypot(...v))), [model]);
  const radius = model.radius * scale;
  const edges = useMemo(() => {
    const g = new BufferGeometry();
    const xyz = model.edges.flatMap(([p, q]) => [...relative(p, model.centre, scale), ...relative(q, model.centre, scale)]);
    g.setAttribute("position", new Float32BufferAttribute(xyz, 3));
    return g;
  }, [model, scale]);
  const ink = useMemo(() => ({ edge: cssColour("--text-muted", "#a7afb8"), atom: cssColour(accent, "#8b9099") }), [accent]);

  useEffect(() => {
    const key = new DirectionalLight(0xffffff, 1.5);
    key.position.set(3, -4, 6);
    const rim = new DirectionalLight(0xffffff, 0.45);
    rim.position.set(-4, 3, -2);
    const lights = [new AmbientLight(0xffffff, 0.6), key, rim];
    for (const l of lights) scene.add(l);
    return () => {
      for (const l of lights) scene.remove(l);
    };
  }, [scene]);

  useEffect(() => {
    place(camera as PerspectiveCamera, radius);
    const c = new OrbitControls(camera, gl.domElement);
    c.enablePan = false;
    c.enableDamping = false;
    c.minDistance = radius * 1.5;
    c.maxDistance = radius * 10;
    c.addEventListener("change", () => invalidate());
    controls.current = c;
    invalidate();
    return () => c.dispose();
  }, [camera, gl, invalidate, radius]);

  useEffect(() => {
    const c = controls.current;
    if (!c || turn.seq === 0) return;
    if (turn.reset) {
      place(camera as PerspectiveCamera, radius);
    } else {
      const offset = new Vector3().subVectors(camera.position, c.target);
      const yUp = new Vector3(offset.x, offset.z, -offset.y);
      const s = new Spherical().setFromVector3(yUp);
      s.theta += turn.dAzimuth;
      s.phi = Math.min(Math.PI - 0.05, Math.max(0.05, s.phi - turn.dElevation));
      yUp.setFromSpherical(s);
      camera.position.set(yUp.x, -yUp.z, yUp.y).add(c.target);
      camera.lookAt(c.target);
    }
    c.update();
    invalidate();
  }, [turn, camera, invalidate, radius]);

  useEffect(() => () => edges.dispose(), [edges]);

  useFrame(() => {
    if (!drawn.current) {
      drawn.current = true;
      onDrawn();
    }
  });

  const r = BALL_SHARE * model.nearest * scale;
  return (
    <>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={ink.edge} />
      </lineSegments>
      {model.atoms.map((atom, i) => (
        <mesh key={i} position={relative(atom.pos, model.centre, scale)}>
          <sphereGeometry args={[r, 24, 16]} />
          <meshStandardMaterial color={ink.atom} roughness={0.45} metalness={0.1} />
        </mesh>
      ))}
    </>
  );
}

export default function UnitCell({
  model,
  accent,
  turn,
  label,
  size,
  onDrawn,
}: {
  model: CellModel;
  /** CSS custom property that holds the atom colour (the element's category accent). */
  accent: string;
  turn: CellTurn;
  label: string;
  size: number;
  onDrawn: () => void;
}) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      style={{ width: size, height: size }}
      camera={{ fov: 22, up: [0, 0, 1], position: [3, -4, 2] }}
      gl={{ antialias: true, alpha: true }}
      aria-label={label}
      role="img"
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <Scene model={model} accent={accent} turn={turn} onDrawn={onDrawn} />
    </Canvas>
  );
}
