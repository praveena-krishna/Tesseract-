import * as THREE from 'three';
import { ORBS } from '../config/orbs';
import { teams } from '../data/world';

/**
 * The gravitational system.
 *
 * Team bonding is modelled as actual attraction rather than as an animation
 * between two authored layouts. Each orb is pulled toward its team's centre by
 * a force scaled by how strongly that person rated their team, held apart from
 * its neighbours by repulsion, and kept inside the structure by a restoring
 * pull toward its own resting position.
 *
 * Simulating it matters: collaboration has to be seen *forming*, and
 * interpolating between two fixed layouts would arrive at the same picture
 * without ever showing people drawn together. Here the movement itself carries
 * the meaning, and because every body is solving the same forces at once, a
 * change anywhere propagates through the whole field the way it would in a real
 * system. It is also why no lines are needed to say who is on a team: the
 * answer is visible in where people end up and how they got there.
 *
 * One copy of the system runs per layer, over the same sixteen people in the
 * same resting places. Nothing but the strength of the collaboration term
 * differs between them, which is what makes the layers states of one world
 * rather than separately authored scenes: the first month is what this
 * simulation does when nobody is working together, and the second is what it
 * does when they are.
 */

export interface GravityBody {
  id: string;
  /** Where this person sits when working alone. */
  home: THREE.Vector3;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  teamId: string | null;
  present: boolean;
  /** 0–1 pull toward teammates. */
  bonding: number;
  /** 0–1 instability; scatters the orb around its solution. */
  turbulence: number;
}

/** Where a team gathers, and where each of its members stands within it. */
export interface TeamFormation {
  centre: THREE.Vector3;
  /**
   * A place for each member, relative to the centre.
   *
   * Explicit rather than emergent. Letting bodies find their own arrangement
   * around an attractor produced a different clump every time and, more often
   * than not, two people occupying nearly the same point — which is the one
   * thing a picture of a team must never do. A named slot per member means the
   * ring is always legible, while the pull, the damping and the jitter still do
   * the travelling, so the formation is watched rather than cut to.
   */
  slots: Map<string, THREE.Vector3>;
}

/**
 * Where each team stands inside its layer.
 *
 * Five zones with wide space between them, arranged on the plane the camera
 * faces when it enters the month. Assigned rather than derived: five teams laid
 * out by a rule end up evenly spaced on a sphere, and evenly spaced on a sphere
 * means several of them stacked behind each other from any one viewpoint. A
 * fixed arrangement can be read at a glance and stays where the viewer left it.
 */
const TEAM_ZONES: Record<string, [number, number, number]> = {
  // top left
  'ar-robot': [-1.05, 1.35, 0.18],
  // top right
  'ai-companion': [1.05, 1.35, -0.18],
  // middle left
  'vivid-echo': [-1.5, -0.15, -0.12],
  // middle right
  'twinz-360': [1.5, -0.15, 0.12],
  // bottom centre — the four-person team, given the widest berth
  vibesync: [0, -1.62, 0],
};

/**
 * Where a member stands in their team's ring.
 *
 * On the same plane as the zones, so a team reads as the diagram it is: one
 * above and two below for a team of three, four at the corners for a team of
 * four. The small depth offset keeps them from flattening into a decal.
 */
function memberSlot(index: number, total: number, standoff: number): THREE.Vector3 {
  // Three start at the top; four start off-axis so no member sits directly
  // above the project and hides it.
  const offset = total === 4 ? Math.PI / 4 : Math.PI / 2;
  const angle = offset + (index / total) * Math.PI * 2;
  return new THREE.Vector3(
    Math.cos(angle) * standoff,
    Math.sin(angle) * standoff,
    // Alternating, and small: enough that the ring has depth, not so much that
    // a member drifts behind their own project.
    (index % 2 === 0 ? 1 : -1) * standoff * 0.18,
  );
}

/**
 * Every team's zone and every member's place within it, scaled to the layer.
 *
 * Fixed rather than emergent, so a team the viewer has learned to find in the
 * upper left is still there next time.
 */
export function buildTeamFormations(
  scale: number,
  standoff: number,
): Map<string, TeamFormation> {
  const formations = new Map<string, TeamFormation>();

  for (const team of teams) {
    const zone = TEAM_ZONES[team.id];
    if (!zone) continue;

    const slots = new Map<string, THREE.Vector3>();
    team.memberIds.forEach((memberId, i) => {
      slots.set(memberId, memberSlot(i, team.memberIds.length, standoff));
    });

    formations.set(team.id, {
      centre: new THREE.Vector3(...zone).multiplyScalar(scale),
      slots,
    });
  }

  return formations;
}

const toNeighbour = new THREE.Vector3();
const force = new THREE.Vector3();

/**
 * Advances the simulation by one step.
 *
 * Semi-implicit integration with heavy damping: the field settles rather than
 * oscillating, because this is visual storytelling and an orb that overshoots
 * and rings looks like a physics bug, not like a person joining a team.
 */
export function stepGravity(
  bodies: GravityBody[],
  formations: Map<string, TeamFormation>,
  delta: number,
  collaboration: number,
  /**
   * Size of the layer this simulation is running in, relative to the smallest.
   *
   * The layers are nested and differ in scale, so the distances at which people
   * crowd each other differ too. The spring constants need no adjustment — a
   * spring's acceleration already scales with the displacement — but the
   * separation the repulsion defends, and the absolute jitter that difficulty
   * adds, are lengths and have to be scaled explicitly.
   */
  scale: number,
  time: number,
): void {
  const step = Math.min(delta, 1 / 30);
  const separation = ORBS.SEPARATION * scale;

  for (const body of bodies) {
    force.set(0, 0, 0);

    // Restoring pull toward where this person sits when working alone. This is
    // what the first month looks like, and what the field relaxes back to when
    // collaboration is taken away.
    // Collaboration releases a person from where they stand alone. At three
    // quarters it never let go hard enough: members stayed strung between their
    // home and their team, so the five formations overlapped into one lumpy
    // mass and the team structure was there in the numbers but not on screen.
    // What is left keeps the settling organic rather than letting every team
    // collapse onto a point.
    force.addScaledVector(
      toNeighbour.subVectors(body.home, body.position),
      ORBS.HOME_PULL * (1 - collaboration * body.bonding * 0.92),
    );

    // Attraction toward where this person's team gathers.
    const formation = body.teamId ? formations.get(body.teamId) : undefined;
    if (formation && body.present) {
      const pull = ORBS.TEAM_PULL * collaboration * body.bonding;

      // Aim at this person's own place in the ring, not at the team's centre.
      // Everybody pulling toward one point ends with everybody on that point,
      // and the project they built buried underneath them.
      const slot = formation.slots.get(body.id);
      if (slot) {
        toNeighbour
          .copy(formation.centre)
          .add(slot)
          .sub(body.position);
        force.addScaledVector(toNeighbour, pull);
      }
    }

    // Mutual repulsion, so orbs crowd together without ever interpenetrating.
    for (const other of bodies) {
      if (other === body || !other.present) continue;
      toNeighbour.subVectors(body.position, other.position);
      const distance = toNeighbour.length();
      if (distance >= separation || distance < 1e-4) continue;

      force.addScaledVector(
        toNeighbour.divideScalar(distance),
        ORBS.REPULSION * (separation - distance),
      );
    }

    // Difficulty as physical instability: a person under strain does not sit
    // still in their solution, they jitter around it.
    if (body.turbulence > 0) {
      const seed = body.position.lengthSq();
      const jitter = body.turbulence * ORBS.TURBULENCE * scale;
      force.x += Math.sin(time * 2.3 + seed) * jitter;
      force.y += Math.sin(time * 1.9 + seed * 1.7) * jitter;
      force.z += Math.cos(time * 2.1 + seed * 0.7) * jitter;
    }

    body.velocity.addScaledVector(force, step);
    body.velocity.multiplyScalar(Math.pow(ORBS.DAMPING, step * 60));
    body.position.addScaledVector(body.velocity, step);
  }
}
