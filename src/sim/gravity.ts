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
 * Simulating it matters: the brief asks for collaboration the viewer can *see
 * forming*, and interpolating between two fixed layouts would arrive at the
 * same picture without ever showing people drawn together. Here the movement
 * itself carries the meaning, and because every orb is solving the same forces
 * at once, a change anywhere — a person removed, collaboration weakened —
 * propagates through the whole field the way it would in a real system.
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

const TEAM_CENTRE = new Map<string, THREE.Vector3>();

/**
 * Resting positions for each team's centre, spread deliberately around the
 * structure rather than averaged from where its members happen to start.
 *
 * Averaging the members' individual positions was the obvious approach and the
 * wrong one: the five averages land close to the origin and close to each
 * other, so every team converges into a single central mass and the projects
 * stop being distinguishable. Distributing the centres on a golden-angle spiral
 * guarantees five clearly separated regions, so each project reads as its own
 * formation with its own place in the world.
 *
 * Fixed rather than emergent, so a project the viewer has learned to find in
 * the upper left is still there next time.
 */
export function initialiseTeamCentres(_homes: Map<string, THREE.Vector3>): void {
  TEAM_CENTRE.clear();

  const golden = Math.PI * (3 - Math.sqrt(5));
  const count = teams.length;

  teams.forEach((team, i) => {
    const y = count === 1 ? 0 : 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;

    TEAM_CENTRE.set(
      team.id,
      new THREE.Vector3(
        Math.cos(theta) * ring,
        y,
        Math.sin(theta) * ring,
      ).multiplyScalar(TEAM_ORBIT),
    );
  });
}

/**
 * Radius the team centres sit at.
 *
 * Just inside the band the orbs rest in, so binding to a team draws people
 * inward to a shared centre without collapsing the whole field into the middle
 * of the tesseract. Pulled any further in, the five formations overlap and stop
 * being separately readable; left any further out, they never visibly gather.
 */
const TEAM_ORBIT = 3.9;

export function teamCentre(teamId: string): THREE.Vector3 | undefined {
  return TEAM_CENTRE.get(teamId);
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
  delta: number,
  collaboration: number,
  time: number,
): void {
  const step = Math.min(delta, 1 / 30);

  for (const body of bodies) {
    force.set(0, 0, 0);

    // Restoring pull toward where this person sits when working alone. This is
    // what the first month looks like, and what the field relaxes back to when
    // collaboration is taken away.
    force.addScaledVector(
      toNeighbour.subVectors(body.home, body.position),
      ORBS.HOME_PULL * (1 - collaboration * body.bonding * 0.75),
    );

    // Attraction toward the team's centre of mass.
    const centre = body.teamId ? TEAM_CENTRE.get(body.teamId) : undefined;
    if (centre && body.present) {
      const pull = ORBS.TEAM_PULL * collaboration * body.bonding;
      force.addScaledVector(toNeighbour.subVectors(centre, body.position), pull);
    }

    // Mutual repulsion, so orbs crowd together without ever interpenetrating.
    for (const other of bodies) {
      if (other === body || !other.present) continue;
      toNeighbour.subVectors(body.position, other.position);
      const distance = toNeighbour.length();
      if (distance >= ORBS.SEPARATION || distance < 1e-4) continue;

      force.addScaledVector(
        toNeighbour.divideScalar(distance),
        ORBS.REPULSION * (ORBS.SEPARATION - distance),
      );
    }

    // Difficulty as physical instability: a person under strain does not sit
    // still in their solution, they jitter around it.
    if (body.turbulence > 0) {
      const seed = body.position.lengthSq();
      force.x += Math.sin(time * 2.3 + seed) * body.turbulence * ORBS.TURBULENCE;
      force.y += Math.sin(time * 1.9 + seed * 1.7) * body.turbulence * ORBS.TURBULENCE;
      force.z += Math.cos(time * 2.1 + seed * 0.7) * body.turbulence * ORBS.TURBULENCE;
    }

    body.velocity.addScaledVector(force, step);
    body.velocity.multiplyScalar(Math.pow(ORBS.DAMPING, step * 60));
    body.position.addScaledVector(body.velocity, step);
  }
}
