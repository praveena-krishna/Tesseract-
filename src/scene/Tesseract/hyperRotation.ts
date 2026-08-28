import * as THREE from 'three';
import { cubeVertices } from './frameGeometry';
import { HYPER_TURN, SHELLS } from '../../config/dimensions';

/**
 * Where a shell's eight corners sit part way through a four-dimensional turn.
 *
 * The three nested cubes are one object seen in projection: each is the same
 * hypercube at a different depth along the fourth axis, which is why they are
 * nested rather than merely stacked. Turning in a plane that involves that axis
 * therefore moves every corner by a different amount — a corner swung toward
 * the viewer in the fourth dimension projects larger, one swung away projects
 * smaller — and that uneven scaling is what makes the figure appear to turn
 * itself inside out rather than merely spin.
 *
 * Normalised so that at an angle of zero every corner lands exactly where the
 * static geometry put it. The resting structure is therefore untouched: the
 * turn departs from the shape that was approved and returns to it, and the
 * projection is doing nothing at all in between month changes.
 */

const scratch = new THREE.Vector3();

/**
 * The framing correction applied to the whole figure at the current angle.
 *
 * A four-dimensional rotation projects to something that wanders: the figure
 * slides along the first axis, because a shell's own depth contributes a fixed
 * offset there, and it breathes in size, because the shells are authored at
 * three chosen sizes rather than being one true hypercube, so they do not trade
 * places evenly. Left alone that reads as the camera pulling back and drifting,
 * which is the one thing the turn must not look like.
 *
 * So the turn is measured, then re-framed: one uniform shift and one uniform
 * scale, applied identically to every shell. Because both are uniform they
 * cannot change the figure's shape or the relationship between the shells — the
 * rotation is untouched — they only hold it centred and the size it rests at,
 * so what is left to see is the turning itself.
 */
const framing = { angle: Number.NaN, scale: 1, shift: 0 };

/** Half the diagonal of the outermost shell — the figure's resting reach. */
const REST_REACH = SHELLS[0].half * Math.sqrt(3);

/** The corners of one shell before the figure is re-framed. */
function turnedCorners(
  half: number,
  layer: number,
  angle: number,
  out: THREE.Vector3[],
): THREE.Vector3[] {
  const unit = cubeVertices(1);
  // Outermost sits nearest the eye, innermost furthest, so the resting order of
  // the three is the order the projection would give them anyway.
  const w = HYPER_TURN.DEPTH - layer * HYPER_TURN.DEPTH;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // What this shell projects to at rest, so the turn can be measured against it
  // and the resting structure comes out unchanged.
  const restScale = HYPER_TURN.EYE / (HYPER_TURN.EYE - w);

  for (let i = 0; i < unit.length; i++) {
    const v = unit[i];

    // A rotation in the plane of the first and fourth axes. Only x and w move;
    // y and z are carried through untouched, which is what keeps the figure
    // recognisable as the same object rather than a tumbling mess.
    const x = v.x * cos - w * sin;
    const turnedW = v.x * sin + w * cos;

    const scale = HYPER_TURN.EYE / (HYPER_TURN.EYE - turnedW);
    scratch.set(x * scale, v.y * scale, v.z * scale);
    // Back into the shell's own units.
    scratch.multiplyScalar(half / restScale);

    if (!out[i]) out[i] = new THREE.Vector3();
    out[i].copy(scratch);
  }

  return out;
}

const measured: THREE.Vector3[][] = SHELLS.map(() => []);

/** Works out the shift and scale that hold the figure still at this angle. */
function reframe(angle: number): void {
  if (angle === framing.angle) return;
  framing.angle = angle;

  let sum = 0;
  let count = 0;
  for (let shell = 0; shell < SHELLS.length; shell++) {
    const corners = turnedCorners(SHELLS[shell].half, shell, angle, measured[shell]);
    for (const corner of corners) {
      sum += corner.x;
      count += 1;
    }
  }
  framing.shift = -sum / count;

  // Reach is taken after the shift, since sliding the figure back to centre is
  // itself what decides how far the furthest corner ends up from the middle.
  let reach = 0;
  for (const corners of measured) {
    for (const corner of corners) {
      const x = corner.x + framing.shift;
      reach = Math.max(reach, Math.sqrt(x * x + corner.y * corner.y + corner.z * corner.z));
    }
  }
  // Drawn in where the corners swing nearest the camera, since holding the
  // measured reach constant does not hold the projected size constant.
  const inset = 1 - HYPER_TURN.INSET * Math.sin(angle) * Math.sin(angle);
  framing.scale = (reach > 0 ? REST_REACH / reach : 1) * inset;
}

/**
 * The eight corners of one shell, projected from four dimensions.
 *
 * `layer` is which of the nested cubes this is, outermost first, and it is what
 * places the shell along the fourth axis. `half` is the size the shell rests
 * at, which the result is normalised back to.
 */
export function hyperCorners(
  half: number,
  layer: number,
  angle: number,
  out: THREE.Vector3[],
): THREE.Vector3[] {
  reframe(angle);
  turnedCorners(half, layer, angle, out);
  for (const corner of out) {
    corner.x += framing.shift;
    corner.multiplyScalar(framing.scale);
  }
  return out;
}

