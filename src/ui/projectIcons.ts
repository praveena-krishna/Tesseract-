import * as THREE from 'three';
import { buildProjectForm } from '../scene/Teams/projectForms';

/**
 * A small rendered portrait of each team's constellation, for the key.
 *
 * The same reasoning as the other two keys: what a viewer is hunting for in the
 * world is a figure in a colour, so the key shows the figure. These are line
 * drawings rather than solids, so the portrait is drawn the same way the world
 * draws them — segments and vertices, not a shaded object, which would be a
 * different thing wearing the same colour.
 *
 * Rendered once and cached; the renderer and its context are disposed straight
 * away rather than left sitting beside the scene's own.
 */
const cache = new Map<string, string>();

export function projectIcon(projectId: string, size = 112): string {
  const cached = cache.get(projectId);
  if (cached) return cached;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const form = buildProjectForm(projectId);
  const colour = new THREE.Color(form.colour);

  const lines = new THREE.LineSegments(
    form.lines,
    new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.95 }),
  );
  const points = new THREE.Points(
    form.points,
    new THREE.PointsMaterial({ color: 0xf2f7ff, size: 0.05, sizeAttenuation: true }),
  );
  scene.add(lines);
  scene.add(points);

  // Framed from the figure's own extent, so a wide form and a tall one each
  // fill their portrait instead of the largest setting the scale for all five.
  form.lines.computeBoundingSphere();
  const radius = form.lines.boundingSphere?.radius ?? 1;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  camera.position.set(radius * 0.6, radius * 0.75, radius * 3.1);
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');

  form.lines.dispose();
  form.points.dispose();
  form.mover.dispose();
  lines.material.dispose();
  points.material.dispose();
  renderer.dispose();
  renderer.forceContextLoss();

  cache.set(projectId, url);
  return url;
}
