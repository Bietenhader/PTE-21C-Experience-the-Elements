// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The interactive 3D view of one orbital (SPEC §10.1), drawn with @react-three/fiber. Drag to turn
// it; the buttons turn it too, for keyboards (the arrow keys already move between panels). Frames
// are drawn on demand only, so an idle view costs nothing.

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, type PerspectiveCamera, Spherical, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { OrbitalResult } from "./field";
import { addLights, orbitalGeometry, placeCamera } from "./render";

export interface ViewTurn {
  /** Incremented to request a turn: azimuth and elevation steps in radians. */
  seq: number;
  dAzimuth: number;
  dElevation: number;
  reset?: boolean;
}

function Scene({ orbital, nodal, phase, turn }: { orbital: OrbitalResult; nodal: boolean; phase: boolean; turn: ViewTurn }) {
  const { camera, gl, scene, invalidate } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const geometry = useMemo(() => orbitalGeometry(orbital), [orbital]);
  const nodalGeometry = useMemo(
    () => (orbital.nodal && orbital.nodal.positions.length ? orbitalGeometry(orbital.nodal) : null),
    [orbital],
  );

  useEffect(() => {
    addLights(scene);
  }, [scene]);

  useEffect(() => {
    invalidate();
  }, [phase, nodal, invalidate]);

  useEffect(() => {
    placeCamera(camera as PerspectiveCamera, orbital.half);
    const c = new OrbitControls(camera, gl.domElement);
    c.enablePan = false;
    c.enableDamping = false;
    c.minDistance = orbital.half * 0.8;
    c.maxDistance = orbital.half * 8;
    c.addEventListener("change", () => invalidate());
    controls.current = c;
    invalidate();
    return () => c.dispose();
  }, [camera, gl, invalidate, orbital.half]);

  useEffect(() => {
    const c = controls.current;
    if (!c || turn.seq === 0) return;
    if (turn.reset) {
      placeCamera(camera as PerspectiveCamera, orbital.half);
    } else {
      // Turn the camera around the target in spherical coordinates (z up).
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
  }, [turn, camera, invalidate, orbital.half]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => nodalGeometry?.dispose(), [nodalGeometry]);

  return (
    <>
      <mesh geometry={geometry}>
        {/* A new material when the colouring changes: three.js compiles vertex colours into the shader. */}
        <meshStandardMaterial
          key={phase ? "phase" : "plain"}
          vertexColors={phase}
          color={phase ? "#ffffff" : "#b9c3cf"}
          side={DoubleSide}
          roughness={0.55}
          metalness={0}
        />
      </mesh>
      {nodal && nodalGeometry && (
        <mesh geometry={nodalGeometry}>
          <meshStandardMaterial color="#c9ced6" side={DoubleSide} transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

export default function OrbitalViewer({
  orbital,
  nodal,
  phase,
  turn,
  label,
}: {
  orbital: OrbitalResult;
  nodal: boolean;
  /** Colour by the sign (real) or phase (complex) of ψ; otherwise one colour. */
  phase: boolean;
  turn: ViewTurn;
  label: string;
}) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 30, up: [0, 0, 1], position: [3, -4, 2] }}
      gl={{ antialias: true, alpha: true }}
      aria-label={label}
      role="img"
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <Scene orbital={orbital} nodal={nodal} phase={phase} turn={turn} />
    </Canvas>
  );
}
