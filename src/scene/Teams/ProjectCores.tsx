import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { PROJECT_ASSEMBLY, buildProjectForm } from './projectForms';
import type { MotionKind, ProjectForm } from './projectForms';
import {
  CONSTELLATION_LINE_FRAG,
  CONSTELLATION_LINE_VERT,
  CONSTELLATION_POINT_FRAG,
  CONSTELLATION_POINT_VERT,
} from '../../shaders/constellation.glsl';
import { orbKey } from '../Trainees/orbKey';
import { teams } from '../../data/world';
import { BONDS, PROJECTS_CONFIG, RENDER_ORDER } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * What each team built, standing at the centre of the team that built it.
 *
 * A project has no independent existence here. It appears because its team has
 * gathered, it assembles at the pace that team came together, and it would come
 * apart again if they scattered — which is the whole claim: this thing is a
 * consequence of those people being in one place.
 *
 * The five look nothing like each other, and that is the point. Five teams
 * built five different things, so five identical cores with five different
 * labels would throw away the only thing that distinguishes them. Every form
 * and every movement is derived from what the project actually does.
 */
export function ProjectCores() {
  const setTeamCentres = useWorldStore((state) => state.setTeamCentres);

  /** Live centroid of each team, published for the camera and the label. */
  const centres = useMemo(
    () => new Map(teams.map((team) => [team.id, new THREE.Vector3()])),
    [],
  );

  useEffect(() => {
    setTeamCentres(centres);
    return () => setTeamCentres(null);
  }, [centres, setTeamCentres]);

  return (
    <group renderOrder={RENDER_ORDER.PROJECTS}>
      {teams.map((team) => (
        <ProjectCore key={team.id} teamId={team.id} centre={centres.get(team.id)!} />
      ))}
    </group>
  );
}

/**
 * How gathered a team is, from where its members actually are.
 *
 * The same measure the bonds use, so the project cannot appear before the
 * relationships that build it are visible. Returns 0 while the team is spread
 * and 1 once it has closed.
 */
function gatheredness(
  memberIds: string[],
  positions: Map<string, THREE.Vector3> | null,
  month: number,
  centre: THREE.Vector3,
): number {
  if (!positions) return 0;

  centre.set(0, 0, 0);
  let counted = 0;
  for (const id of memberIds) {
    const position = positions.get(orbKey(month, id));
    if (!position) continue;
    centre.add(position);
    counted += 1;
  }
  if (counted === 0) return 0;
  centre.divideScalar(counted);

  let spread = 0;
  for (const id of memberIds) {
    const position = positions.get(orbKey(month, id));
    if (!position) continue;
    spread = Math.max(spread, position.distanceTo(centre));
  }
  return 1 - THREE.MathUtils.smoothstep(spread, BONDS.NEAR * 0.7, BONDS.FAR * 0.7);
}

interface ProjectCoreProps {
  teamId: string;
  /** Shared vector this core writes its team's live centroid into. */
  centre: THREE.Vector3;
}

function ProjectCore({ teamId, centre }: ProjectCoreProps) {
  const linesRef = useRef<THREE.LineSegments>(null);
  const moversRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const hoverTeam = useWorldStore((state) => state.hoverTeam);
  const focusTeam = useWorldStore((state) => state.focusTeam);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  const team = useMemo(() => teams.find((t) => t.id === teamId)!, [teamId]);
  const form = useMemo<ProjectForm>(() => buildProjectForm(teamId), [teamId]);
  const assembly = PROJECT_ASSEMBLY[teamId];

  const colour = useMemo(() => new THREE.Color(form.colour), [form.colour]);

  /**
   * One material per role, sharing the figure's colour and its build progress.
   *
   * Additive and depth-blind: a constellation is light drawn on the dark, and
   * the moment it starts occluding what is behind it the figure reads as a
   * solid object again — which is the thing this replaced.
   */
  const lineMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CONSTELLATION_LINE_VERT,
        fragmentShader: CONSTELLATION_LINE_FRAG,
        uniforms: {
          uColor: { value: colour },
          uOpacity: { value: 1 },
          uBuilt: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colour],
  );

  const pointMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CONSTELLATION_POINT_VERT,
        fragmentShader: CONSTELLATION_POINT_FRAG,
        uniforms: {
          uColor: { value: colour },
          uOpacity: { value: 1 },
          uBuilt: { value: 0 },
          uSize: { value: PROJECTS_CONFIG.POINT_SIZE },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colour],
  );

  /** The core itself: the one solid thing, and what everything else radiates from. */
  const coreMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: colour,
        emissive: colour,
        emissiveIntensity: PROJECTS_CONFIG.EMISSIVE,
        metalness: 0.2,
        roughness: 0.35,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    [colour],
  );

  /**
   * The moving parts share the figure's colour but not its material.
   *
   * The constellation shader reads a per-vertex `aOrder` to sweep itself into
   * being, and the mover geometries have no such attribute — handing them that
   * material links a program against an attribute that does not exist, which
   * fails at compile time on some drivers and reads garbage on others.
   */
  const moverMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [colour],
  );

  const coreGeometry = useMemo(
    () => new THREE.IcosahedronGeometry(PROJECTS_CONFIG.CORE_RADIUS, 2),
    [],
  );

  useEffect(
    () => () => {
      form.points.dispose();
      form.lines.dispose();
      form.mover.dispose();
      coreGeometry.dispose();
      lineMaterial.dispose();
      pointMaterial.dispose();
      coreMaterial.dispose();
      moverMaterial.dispose();
    },
    [form, coreGeometry, lineMaterial, pointMaterial, coreMaterial, moverMaterial],
  );

  const state = useRef({ built: 0, attention: 0 });
  /** Scratch for the development-only screen projection. */
  const screen = useMemo(() => new THREE.Vector3(), []);
  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      axis: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );

  useFrame(({ clock, camera, size: viewport }, delta) => {
    const group = groupRef.current;
    const movers = moversRef.current;
    if (!group || !movers) return;

    const time = clock.elapsedTime;
    const step = Math.min(delta, 0.1);
    const store = useWorldStore.getState();
    const live = store.enteredMonth === BONDS.MONTH;

    // A project is only drawn when the viewer has asked for projects. It still
    // needs its team gathered first — the artifact is a consequence of those
    // people being in one place, and that has to remain true.
    const wanted = live && store.lens === 'projects';
    const gathered = wanted
      ? gatheredness(team.memberIds, store.traineePositions, BONDS.MONTH, centre)
      : 0;

    // The project assembles at the pace its team came together, and each takes
    // its own time: a building cannot arrive whole, an adaptive environment has
    // no assembled state to arrive at.
    const rate = step / assembly;
    state.current.built = THREE.MathUtils.clamp(
      state.current.built + (gathered > 0.35 ? rate : -rate * 2.5),
      0,
      1,
    );
    const built = reducedMotion ? (gathered > 0.35 ? 1 : 0) : state.current.built;

    const attended = live && (store.hoveredTeamId === teamId || store.focusedTeamId === teamId);
    // The projects lens brings all five forward at once and lets the rest of
    // the world sit back, so the question "what did they build" can be asked of
    // the whole month rather than one team at a time.
    const foreground = store.lens === 'projects' ? 1 : store.lens === 'teams' ? 0.55 : 0.32;
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / 0.3);
    state.current.attention += ((attended ? 1 : 0) - state.current.attention) * ease;

    // Kept current even while nothing is drawn: the camera and the label read
    // this, and a stale centroid sends both to where the team used to be.
    if (live && !wanted) {
      gatheredness(team.memberIds, store.traineePositions, BONDS.MONTH, centre);
    }

    if (import.meta.env.DEV) {
      // Where this core projects on screen. These are small figures inside a
      // crowd of glass, and a check that hunts for one by sweeping pixels is a
      // coin toss that fails for reasons unrelated to the code.
      const probe = ((window as unknown as Record<string, unknown>).__projects ??=
        {}) as Record<string, unknown>;
      screen.copy(centre).project(camera);
      probe[teamId] = {
        x: Math.round(((screen.x + 1) / 2) * viewport.width),
        y: Math.round(((1 - screen.y) / 2) * viewport.height),
        built: +built.toFixed(2),
      };
    }

    group.position.copy(centre);
    group.visible = built > 0.01;
    if (!group.visible) return;

    // Attention swells the whole figure a little and brightens it. Nothing is
    // outlined: the drawing itself responds.
    const swell =
      1 +
      state.current.attention * PROJECTS_CONFIG.HOVER_SWELL +
      foreground * PROJECTS_CONFIG.LENS_SWELL;
    group.scale.setScalar(PROJECTS_CONFIG.SCALE * swell);

    // The figure draws itself outward from the core rather than fading up
    // whole, which is what makes it read as something that was built.
    lineMaterial.uniforms.uBuilt.value = built;
    pointMaterial.uniforms.uBuilt.value = built;

    // Subtle even at its brightest. The people are the subject of this month
    // and the figure is the structure behind them; anything approaching full
    // strength here competes with the very thing it is supposed to belong to.
    const presence = 0.2 + foreground * 0.3 + state.current.attention * 0.22;
    lineMaterial.uniforms.uOpacity.value = presence;
    pointMaterial.uniforms.uOpacity.value = presence;
    moverMaterial.opacity = built * presence;

    coreMaterial.opacity = Math.min(1, built * presence * 1.3);
    coreMaterial.emissiveIntensity =
      PROJECTS_CONFIG.EMISSIVE * (0.5 + foreground * 0.5) +
      state.current.attention * PROJECTS_CONFIG.HOVER_EMISSIVE;

    // The whole figure turns slowly, so it is never quite a diagram.
    const lines = linesRef.current;
    if (lines) lines.rotation.y = reducedMotion ? 0 : time * PROJECTS_CONFIG.DRIFT;

    placeMovers(
      movers,
      form.kind,
      form.movers,
      built,
      reducedMotion ? 0 : time,
      scratch,
    );
    movers.instanceMatrix.needsUpdate = true;
    // InstancedMesh caches its bounding sphere on first use and never refreshes
    // it, and these begin collapsed at the origin — the raycaster would reject
    // every pointer event before reaching an instance.
    movers.computeBoundingSphere();
  });

  const onPointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (useWorldStore.getState().enteredMonth !== BONDS.MONTH) return;
      event.stopPropagation();
      hoverTeam(teamId);
    },
    [hoverTeam, teamId],
  );

  const onPointerOut = useCallback(() => hoverTeam(null), [hoverTeam]);

  const onClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const store = useWorldStore.getState();
      if (store.enteredMonth !== BONDS.MONTH) return;
      event.stopPropagation();
      // Clicking the open project closes it, so one gesture both opens and
      // dismisses.
      focusTeam(store.focusedTeamId === teamId ? null : teamId);
    },
    [focusTeam, teamId],
  );

  return (
    <group ref={groupRef}>
      {/* The core: the one solid thing, and what the figure grows out of. */}
      <mesh
        geometry={coreGeometry}
        material={coreMaterial}
        frustumCulled={false}
        // Marked so the people ringing this artifact know not to swallow
        // pointer events aimed at what they built.
        userData={{ project: true }}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
      />

      <lineSegments
        ref={linesRef}
        geometry={form.lines}
        material={lineMaterial}
        frustumCulled={false}
      />

      <points geometry={form.points} material={pointMaterial} frustumCulled={false} />

      <instancedMesh
        ref={moversRef}
        args={[form.mover, moverMaterial, form.movers]}
        frustumCulled={false}
        userData={{ project: true }}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
      />
    </group>
  );
}

interface Scratch {
  matrix: THREE.Matrix4;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  axis: THREE.Vector3;
}

/**
 * Where a project's moving parts are, this frame.
 *
 * Each kind moves the way its project works. A rover's pings leave along its
 * heading and die out; a companion's exchange circles it; a memory's echoes
 * expand and fade wherever they were left; a drone surveys a perimeter; an
 * adaptive environment never settles at all.
 */
function placeMovers(
  mesh: THREE.InstancedMesh,
  kind: MotionKind,
  count: number,
  built: number,
  time: number,
  s: Scratch,
): void {
  for (let i = 0; i < count; i++) {
    s.position.set(0, 0, 0);
    s.quaternion.identity();
    let scale = built;

    switch (kind) {
      case 'ping': {
        // Wavefronts leaving the sensor along the rover's heading, staggered so
        // it reads as a repeating pulse rather than one expanding shell.
        const t = ((time * 0.55 + i / count) % 1 + 1) % 1;
        s.position.set(0.34 + t * 0.55, 0.05, 0);
        s.axis.set(0, 0, 1);
        s.quaternion.setFromAxisAngle(s.axis, Math.PI / 2);
        scale = built * (1 - t) * (0.5 + t);
        break;
      }
      case 'orbit': {
        // The exchange circling the intelligence, on a tilted ring so it reads
        // as around rather than beside.
        const a = time * 0.5 + (i / count) * Math.PI * 2;
        const r = 0.36;
        s.position.set(Math.cos(a) * r, Math.sin(a * 1.6) * 0.12, Math.sin(a) * r);
        s.quaternion.setFromAxisAngle(s.axis.set(0.3, 1, 0.2).normalize(), a * 2);
        break;
      }
      case 'echo': {
        // Shells leaving the memory and fading — the return, not the event.
        const t = ((time * 0.22 + i / count) % 1 + 1) % 1;
        scale = built * (0.4 + t * 1.9);
        s.quaternion.setFromAxisAngle(s.axis.set(0.4, 1, 0.2).normalize(), t * 1.2 + i);
        break;
      }
      case 'survey': {
        // One drone, circling the site it is watching, tilted into its turn.
        const a = time * 0.42;
        s.position.set(Math.cos(a) * 0.42, 0.46 + Math.sin(a * 2) * 0.04, Math.sin(a) * 0.42);
        s.quaternion.setFromAxisAngle(s.axis.set(0, 1, 0), -a);
        break;
      }
      case 'morph': {
        // Bands riding a travelling wave, each on its own phase, so the surface
        // is always reforming and never arrives anywhere.
        const t = i / count;
        const a = t * Math.PI * 2;
        const wave = Math.sin(time * 1.1 + t * 6.2);
        const r = 0.3 + wave * 0.14;
        s.position.set(Math.cos(a) * r, wave * 0.22, Math.sin(a) * r);
        s.quaternion.setFromAxisAngle(
          s.axis.set(0, 1, 0),
          a + Math.PI / 2 + wave * 0.4,
        );
        scale = built * (0.7 + Math.abs(wave) * 0.6);
        break;
      }
    }

    s.scale.setScalar(Math.max(0.0001, scale));
    s.matrix.compose(s.position, s.quaternion, s.scale);
    mesh.setMatrixAt(i, s.matrix);
  }
}
