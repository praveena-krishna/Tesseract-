import * as THREE from 'three';
import type CameraControlsImpl from 'camera-controls';
import { CAMERA } from '../config/dimensions';

const DEG = THREE.MathUtils.degToRad;

/**
 * Camera choreography.
 *
 * Every scripted move in the experience goes through here rather than being
 * written at its call site, so that transitions share one easing character.
 * A camera that eases differently depending on which system moved it reads as
 * unreliable, and the whole point of this rig is that the viewer never notices
 * the machinery — only that the world is being observed deliberately.
 */

/** A spherical framing around the world's origin. */
export interface Framing {
  radius: number;
  polarDeg: number;
  azimuthDeg: number;
}

export const OVERVIEW: Framing = {
  radius: CAMERA.START_RADIUS,
  polarDeg: CAMERA.START_POLAR_DEG,
  azimuthDeg: CAMERA.START_AZIMUTH_DEG,
};

export const ENTRY: Framing = {
  radius: CAMERA.ENTRY_RADIUS,
  polarDeg: CAMERA.ENTRY_POLAR_DEG,
  azimuthDeg: CAMERA.ENTRY_AZIMUTH_DEG,
};

/**
 * Runs a move at a given smoothing time and restores the previous one after.
 *
 * The restore matters: leaving a cinematic smoothing time in place would make
 * the viewer's own dragging feel sluggish and disconnected immediately after
 * any scripted move.
 */
async function withSmoothing(
  controls: CameraControlsImpl,
  smoothTime: number,
  move: () => Promise<void>,
): Promise<void> {
  const previous = controls.smoothTime;
  controls.smoothTime = smoothTime;
  try {
    await move();
  } finally {
    controls.smoothTime = previous;
  }
}

/** Places the camera at a spherical framing around the origin. */
export async function applyFraming(
  controls: CameraControlsImpl,
  framing: Framing,
  smoothTime: number,
  animate = true,
): Promise<void> {
  const run = async () => {
    await controls.setTarget(0, 0, 0, animate);
    await Promise.all([
      controls.rotateTo(DEG(framing.azimuthDeg), DEG(framing.polarDeg), animate),
      controls.dollyTo(framing.radius, animate),
    ]);
  };

  if (!animate) return run();
  return withSmoothing(controls, smoothTime, run);
}

/** Returns the camera to the resting view of the whole structure. */
export function frameOverview(
  controls: CameraControlsImpl,
  animate = true,
): Promise<void> {
  return applyFraming(controls, OVERVIEW, CAMERA.RESET_SMOOTH_TIME, animate);
}

/**
 * The distance at which a sphere of the given radius fills `FOCUS_FILL` of the
 * frame's smaller dimension.
 *
 * Derived from the vertical field of view rather than guessed, so a subject
 * frames identically whatever its size — which is what lets later phases focus
 * orbs of differing radius without each one needing its own hand-tuned number.
 */
export function distanceToFrame(
  camera: THREE.PerspectiveCamera,
  radius: number,
): number {
  const vertical = DEG(camera.fov) / 2;
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  // The narrower of the two half-angles governs, so a subject frames the same
  // way on a tall window as on a wide one.
  const limiting = Math.min(vertical, horizontal);

  const distance = radius / Math.tan(limiting * CAMERA.FOCUS_FILL);
  return THREE.MathUtils.clamp(
    distance,
    CAMERA.FOCUS_MIN_DISTANCE,
    CAMERA.MAX_DISTANCE,
  );
}

/**
 * Moves the camera to observe a point in the world.
 *
 * The camera approaches along its current bearing rather than jumping to a
 * canonical angle: the viewer chose where they were looking from, and throwing
 * that away is the difference between the world turning to face you and being
 * teleported. Reserved for later phases; the plumbing lives here so that when
 * selection arrives it inherits this easing rather than inventing its own.
 */
export async function focusOn(
  controls: CameraControlsImpl,
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  subjectRadius: number,
  /** Other bodies in the world the shot should not end up inside. */
  avoid?: Iterable<THREE.Vector3>,
): Promise<void> {
  const distance = distanceToFrame(camera, subjectRadius);

  // Preserve the current viewing direction, re-anchored on the new target.
  const bearing = new THREE.Vector3();
  camera.getWorldDirection(bearing).negate();

  const position = target.clone().addScaledVector(bearing, distance);

  // Keep the lens out of the very centre, where the innermost shell and the
  // volumetric core occupy the same small volume.
  const fromOrigin = position.length();
  if (fromOrigin < CAMERA.FOCUS_MIN_ORIGIN_DISTANCE) {
    const direction =
      fromOrigin > 1e-4
        ? position.clone().divideScalar(fromOrigin)
        : bearing.clone().normalize();
    position.copy(direction.multiplyScalar(CAMERA.FOCUS_MIN_ORIGIN_DISTANCE));
  }

  // Keep the shot out of the other people.
  //
  // The structure now dissolves as the camera arrives, but the orbs do not —
  // they are the subject, and a vessel the camera has ended up inside fills the
  // frame with its own interior. Nudging outward along the line from whichever
  // orb was intruded on preserves the approach while clearing it.
  if (avoid) {
    const away = new THREE.Vector3();
    for (const other of avoid) {
      if (other === target) continue;
      const gap = position.distanceTo(other);
      if (gap >= CAMERA.FOCUS_ORB_CLEARANCE) continue;

      away.subVectors(position, other);
      if (away.lengthSq() < 1e-6) away.copy(bearing);
      position.copy(
        other.clone().addScaledVector(away.normalize(), CAMERA.FOCUS_ORB_CLEARANCE),
      );
    }
  }

  return withSmoothing(controls, CAMERA.FOCUS_SMOOTH_TIME, () =>
    controls.setLookAt(
      position.x,
      position.y,
      position.z,
      target.x,
      target.y,
      target.z,
      true,
    ),
  );
}
