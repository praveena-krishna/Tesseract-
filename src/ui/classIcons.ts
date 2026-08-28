import * as THREE from 'three';
import { buildSessionGeometry } from '../scene/Trainees/sessionForms';
import { classColour } from '../data/classColours';

/**
 * A small rendered portrait of each class's own form, for the key.
 *
 * The key has to show the thing the viewer is actually looking for. A coloured
 * dot says which hue to hunt for and nothing about the shape, but shape is half
 * of how these are told apart inside a vessel — so the key renders the very
 * geometry the world draws, lit the same way and tinted the same colour.
 *
 * Rendered once to an image rather than kept live. Fifteen running WebGL views
 * beside a scene that is already asking a lot of the GPU would cost far more
 * than a key is worth, and a still portrait answers the question a key exists
 * to answer: which of these am I looking for.
 *
 * The renderer and everything it made are disposed immediately. A stray context
 * left behind here would sit alongside the scene's own for the life of the page.
 */
const cache = new Map<string, string>();

export function classIcon(classId: string, size = 96): string {
  const cached = cache.get(classId);
  if (cached) return cached;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const geometry = buildSessionGeometry(classId);
  const colour = new THREE.Color(classColour(classId));

  const material = new THREE.MeshStandardMaterial({
    color: colour,
    emissive: colour,
    emissiveIntensity: 0.45,
    metalness: 0.18,
    roughness: 0.3,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Lit from the same quarter as the scene's key light, so a form in the key is
  // shaded the way its twin in the world is.
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(6, 8, 4);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));

  // Framed from its own bounding sphere, so forms of very different sizes each
  // fill their portrait rather than the largest one setting the scale.
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius ?? 1;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(radius * 2.0, radius * 1.5, radius * 2.6);
  camera.lookAt(0, 0, 0);

  // Turned a little off square. Straight on, several of these read as flat
  // outlines and the whole point of showing the form is lost.
  mesh.rotation.set(0.35, 0.7, 0.12);

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');

  geometry.dispose();
  material.dispose();
  key.dispose();
  renderer.dispose();
  renderer.forceContextLoss();

  cache.set(classId, url);
  return url;
}
