import * as THREE from 'three';
import { buildShard } from '../scene/Trainees/shardGeometry';
import { TYPE_COLOUR, TYPE_CUT } from '../data/challenges';
import type { ChallengeType } from '../data/challenges';

/**
 * A small rendered portrait of each kind of fragment, for the key.
 *
 * The same reasoning as the classes key: the thing a viewer is hunting for in
 * the world is a shape in a colour, so the key has to show both rather than
 * reducing it to a dot. Each kind is cut from a different number of points, so
 * a splintered fragment and a blunt one are genuinely different objects and the
 * portrait says which is which.
 *
 * Rendered once to an image and cached. Eight live WebGL views beside a scene
 * already carrying a lit core, sixteen vessels and four hundred sparkles would
 * cost far more than a key is worth.
 */
const cache = new Map<string, string>();

export function challengeIcon(type: ChallengeType, size = 96): string {
  const cached = cache.get(type);
  if (cached) return cached;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  // Seeded from the kind, so the key shows the same cut every time it is drawn.
  const geometry = buildShard(TYPE_CUT[type].points, TYPE_CUT[type].points);
  const colour = new THREE.Color(TYPE_COLOUR[type]);

  const material = new THREE.MeshStandardMaterial({
    color: colour,
    emissive: colour,
    emissiveIntensity: 0.5,
    metalness: 0.1,
    roughness: 0.18,
  });

  const mesh = new THREE.Mesh(geometry, material);
  // Turned off square: a sliver seen edge on is a line, and the whole point of
  // a portrait is that the form can be seen.
  mesh.rotation.set(0.4, 0.75, 0.2);
  scene.add(mesh);

  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(6, 8, 4);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));

  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius ?? 1;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(radius * 1.9, radius * 1.4, radius * 2.5);
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');

  geometry.dispose();
  material.dispose();
  key.dispose();
  renderer.dispose();
  renderer.forceContextLoss();

  cache.set(type, url);
  return url;
}
