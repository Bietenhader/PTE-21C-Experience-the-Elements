// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// three.js pieces for the orbital gallery (SPEC §10.1). The gallery's thumbnails all come from one
// shared WebGL renderer (browsers allow only a handful of WebGL contexts per page, and oganesson has
// nineteen subshells); each picture is copied into the tile's own 2D canvas. z points up, as in
// chemistry texts.

import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import type { OrbitalResult } from "./field";

export function orbitalGeometry(o: Pick<OrbitalResult, "positions" | "normals"> & { colors?: Float32Array }): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(o.positions, 3));
  g.setAttribute("normal", new BufferAttribute(o.normals, 3));
  if (o.colors) g.setAttribute("color", new BufferAttribute(o.colors, 3));
  g.computeBoundingSphere();
  return g;
}

/** The camera direction shared by the thumbnails and the viewer: a three-quarter view from above. */
export const VIEW_DIRECTION = new Vector3(2.2, -3.0, 1.7).normalize();

export function placeCamera(camera: PerspectiveCamera, half: number): void {
  // Fit the grid's bounding sphere (radius √3 · half) into the field of view.
  const radius = half * 1.05;
  const distance = radius / Math.sin(((camera.fov / 2) * Math.PI) / 180);
  camera.up.set(0, 0, 1);
  camera.position.copy(VIEW_DIRECTION).multiplyScalar(distance);
  camera.near = distance / 50;
  camera.far = distance * 4;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

export function addLights(scene: Scene): void {
  scene.add(new AmbientLight(0xffffff, 0.55));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(3, -4, 6);
  scene.add(key);
  const rim = new DirectionalLight(0xffffff, 0.5);
  rim.position.set(-4, 3, -2);
  scene.add(rim);
}

export class ThumbnailRenderer {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(30, 1, 0.1, 100);
  private material = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.55, metalness: 0 });

  constructor(size: number) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.renderer.setClearColor(0x000000, 0);
    addLights(this.scene);
    // Compile the shader now, while the workers compute, rather than on the first picture.
    const warm = new Mesh(orbitalGeometry({ positions: new Float32Array(9), normals: new Float32Array(9), colors: new Float32Array(9) }), this.material);
    this.scene.add(warm);
    this.renderer.compile(this.scene, this.camera);
    this.scene.remove(warm);
    warm.geometry.dispose();
  }

  /** Renders the orbital and copies the picture into `target` (a 2D canvas of `size` × `size`). */
  draw(o: OrbitalResult, target: HTMLCanvasElement): void {
    const geometry = orbitalGeometry(o);
    const mesh = new Mesh(geometry, this.material);
    this.scene.add(mesh);
    placeCamera(this.camera, o.half);
    this.renderer.render(this.scene, this.camera);
    const ctx = target.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(this.renderer.domElement, 0, 0, target.width, target.height);
    }
    this.scene.remove(mesh);
    geometry.dispose();
  }

  dispose(): void {
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

let shared: ThumbnailRenderer | null | undefined;

/** The shared renderer, or null where WebGL is not available (the gallery then shows slices). */
export function thumbnailRenderer(size: number): ThumbnailRenderer | null {
  if (shared === undefined) {
    try {
      shared = new ThumbnailRenderer(size);
    } catch {
      shared = null;
    }
  }
  return shared;
}

/** Paints a slice image (RGBA bytes from the worker) into a canvas. */
export function drawSlice(image: Uint8ClampedArray, size: number, target: HTMLCanvasElement): void {
  const ctx = target.getContext("2d");
  if (!ctx) return;
  const data = new ImageData(new Uint8ClampedArray(image), size, size);
  if (target.width === size && target.height === size) {
    ctx.putImageData(data, 0, 0);
    return;
  }
  const tmp = document.createElement("canvas");
  tmp.width = size;
  tmp.height = size;
  tmp.getContext("2d")?.putImageData(data, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, target.width, target.height);
}
