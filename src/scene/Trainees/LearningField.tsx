import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { SESSION_MOTION, buildSessionGeometry } from './sessionForms';
import { orbKey } from './orbKey';
import { learningByPerson, SESSIONS_IN_USE } from '../../data/classes';
import { trainees } from '../../data/world';
import { classColour } from '../../data/classColours';
import { ORBS } from '../../config/orbs';
import { RENDER_ORDER } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * Which layer holds the learning interiors.
 *
 * Month 1 only. The sessions are that month's subject — sixteen individuals and
 * what each of them responded to — and Month 2 is about something else
 * entirely. Repeating them there would say the interiors are a property of the
 * vessel rather than of the month, which is not the claim being made.
 */
const SESSION_MONTH = 0;

/** One person's copy of one session form. */
interface Carrier {
  personId: string;
  personIndex: number;
  classId: string;
  primary: boolean;
  /** 0–1 relative to this person's strongest liked session. */
  strength: number;
  /** Fixed direction from the orb's centre, so a session keeps its place. */
  direction: THREE.Vector3;
}

/** Composite identity for one person's one session. */
export function sessionKey(personId: string, classId: string): string {
  return `${personId}:${classId}`;
}

/**
 * Where the object being pointed at or opened currently is.
 *
 * The objects revolve, so a label anchored to the person would drift off its
 * subject. Published here rather than through the store because it changes
 * every frame and routing that through React would re-render the tree sixty
 * times a second. Whoever draws the label reads it on demand.
 */
const anchor = { position: new THREE.Vector3(), live: false };

export function sessionAnchor(): { position: THREE.Vector3; live: boolean } {
  return anchor;
}

/**
 * Where each object of the attended person currently projects on screen.
 *
 * Development only, and it exists for one reason: these objects are a few
 * dozen pixels across inside a sphere, and a behavioural check that hunts for
 * them by sweeping a grid of pixels is a coin toss that fails for reasons
 * having nothing to do with the code. Publishing the projected centres lets a
 * check aim at one instead of searching for it.
 */
const projected = new Map<string, { x: number; y: number }>();

/**
 * The sessions each person liked, suspended inside their vessel.
 *
 * This replaces a field of identical particles standing for individual skills.
 * That treatment had two problems and only one of them was that it looked
 * repetitive: sixteen people each surrounded by the same beads invited a
 * comparison of counts, and a count of topics attended is not a meaningful
 * thing to rank people by. What each person actually responded to is.
 *
 * They live *within* the glass, not around it. An object orbiting outside reads
 * as a decoration attached to a sphere and belongs to nobody in particular;
 * suspended inside, the same object reads as something the person contains, and
 * the vessel becomes what it was always meant to be — one person's learning
 * world, with its own interior.
 *
 * The forms differ by shape, structure and behaviour — never by colour. Fifteen
 * hues would be a legend the viewer has to memorise; fifteen forms are simply
 * recognised, and stay recognisable in silhouette and to somebody who arrived
 * halfway through.
 *
 * Hierarchy is spatial rather than chromatic. The session a person responded to
 * most sits nearer the front of the interior and is close to twice the size of
 * the rest, which carries at a glance and survives being seen from any angle.
 *
 * One instanced draw per form, so the whole layer is fifteen calls whatever
 * happens — and each form's geometry is built once and shared across everyone
 * who liked it.
 */
export function LearningField({
  positions,
}: {
  /** Live world positions of the orbs, keyed by trainee id. */
  positions: Map<string, THREE.Vector3>;
}) {
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  /**
   * Who carries which form, grouped so each form is one draw.
   *
   * Directions are fixed per person at build time rather than solved each
   * frame: a session that moves house between frames is not an object, and a
   * person's learning world should look the same every time it is visited.
   */
  const carriersByForm = useMemo(() => {
    const groups = new Map<string, Carrier[]>();
    for (const id of SESSIONS_IN_USE) groups.set(id, []);

    const golden = Math.PI * (3 - Math.sqrt(5));

    trainees.forEach((trainee, personIndex) => {
      const profile = learningByPerson.get(trainee.id);
      if (!profile) return;
      const total = profile.sessions.length;

      profile.sessions.forEach((session, i) => {
        // A golden-angle spiral spreads however many sessions a person has
        // evenly over a sphere, so five objects are as well separated as two
        // and nothing ends up hidden directly behind another.
        const y = total === 1 ? 0.35 : 1 - (2 * (i + 0.5)) / total;
        const ring = Math.sqrt(Math.max(0, 1 - y * y));
        // Offset per person so two neighbours never present the same
        // arrangement and the field never looks stamped.
        const theta = golden * i + personIndex * 1.31;

        groups.get(session.classId)?.push({
          personId: trainee.id,
          personIndex,
          classId: session.classId,
          primary: session.primary,
          strength: session.strength,
          direction: new THREE.Vector3(
            Math.cos(theta) * ring,
            y,
            Math.sin(theta) * ring,
          ).normalize(),
        });
      });
    });

    return groups;
  }, []);

  return (
    <group renderOrder={RENDER_ORDER.SESSIONS}>
      {SESSIONS_IN_USE.map((classId) => (
        <SessionForm
          key={classId}
          classId={classId}
          carriers={carriersByForm.get(classId) ?? []}
          positions={positions}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}

interface SessionFormProps {
  classId: string;
  carriers: Carrier[];
  positions: Map<string, THREE.Vector3>;
  reducedMotion: boolean;
}

/** Everyone who liked the same session, as one instanced draw. */
function SessionForm({
  classId,
  carriers,
  positions,
  reducedMotion,
}: SessionFormProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hoverSession = useWorldStore((state) => state.hoverSession);
  const openSession = useWorldStore((state) => state.openSession);

  const geometry = useMemo(() => buildSessionGeometry(classId), [classId]);

  // One material per class, so each carries its own colour. Shape alone could
  // not separate fifteen of these at the size they are drawn.
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(classColour(classId)),
        // Not metal. The people are glass and the structure is machined steel;
        // these have to belong to the same universe without being mistaken for
        // either, so they take a bright dielectric with a strong emissive floor
        // — objects lit from within, like the things they stand for.
        metalness: 0.18,
        roughness: 0.3,
        emissive: new THREE.Color(classColour(classId)),
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    [classId],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  /** Eased per-carrier presence, so an object arrives rather than appears. */
  const levels = useMemo(() => new Float32Array(carriers.length), [carriers.length]);
  /** Eased 0–1 "this ring is being examined", which slows its revolution. */
  const settle = useMemo(() => new Float32Array(carriers.length), [carriers.length]);
  /**
   * Accumulated revolution per object.
   *
   * Integrated rather than derived from the clock, because the rate changes:
   * multiplying elapsed time by a varying rate would make the ring jump
   * backwards the instant it slowed.
   */
  const revolved = useMemo(() => new Float32Array(carriers.length), [carriers.length]);

  /** Scratch for the development-only screen projection. */
  const screen = useMemo(() => new THREE.Vector3(), []);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      offset: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      revolve: new THREE.Quaternion(),
      up: new THREE.Vector3(0, 1, 0),
      scale: new THREE.Vector3(),
      axis: new THREE.Vector3(...SESSION_MOTION[classId].axis).normalize(),
    }),
    [classId],
  );

  useFrame(({ clock, camera, size: viewport }, delta) => {
    const mesh = meshRef.current;
    if (!mesh || carriers.length === 0) return;

    const time = clock.elapsedTime;
    const step = Math.min(delta, 0.1);
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / ORBS.SESSION_EASE);
    const motion = SESSION_MOTION[classId];

    const {
      enteredMonth,
      focusedTraineeId,
      hoveredTraineeId,
      hoveredSession,
      openedSession,
      lens,
    } = useWorldStore.getState();

    // Cleared each frame by whichever form owns the subject; if none does, the
    // label has nothing to anchor to and hides itself.
    if (hoveredSession === null && openedSession === null) anchor.live = false;

    // Whose interior is being examined.
    //
    // A chosen person's interior nearly stops turning, and so does one whose
    // object is under the pointer. Both matter: a target that keeps moving is a
    // target you have to chase, and these objects are meant to be the interface
    // rather than things to catch. It runs down rather than freezing, so the
    // volume stays legibly alive while you read it.
    const examined = (openedSession ?? hoveredSession)?.split(':')[0] ?? null;
    const settledPerson = examined ?? focusedTraineeId;

    // Brightness is a material property, shared by every instance of this form.
    // Only geometry can vary per person, so presence rides the scale and the
    // material follows whichever carrier is most attended to.
    let brightest = 0;

    for (let i = 0; i < carriers.length; i++) {
      const carrier = carriers[i];
      const key = sessionKey(carrier.personId, carrier.classId);

      // The sessions belong inside a month. Outside, there is no person to
      // attend to and nothing to show.
      const live = enteredMonth === SESSION_MONTH;
      const attendedPerson =
        live &&
        (carrier.personId === focusedTraineeId ||
          carrier.personId === hoveredTraineeId);
      const isHovered = hoveredSession === key;
      const isOpen = openedSession === key;

      // A session in focus holds full presence; its siblings step back so the
      // one being examined is unambiguous.
      const someoneElseFocused =
        (hoveredSession !== null || openedSession !== null) && !isHovered && !isOpen;

      // The classes are shown when the classes are asked for, and at no other
      // time. Pointing at somebody is not asking — under any other lens the
      // question is about the people themselves, and filling their vessels
      // with objects the moment the pointer crosses them answers a question
      // nobody put. Nothing here appears on hover alone.
      let target = 0;
      if (live && lens === 'classes') {
        if (isHovered || isOpen) target = 1;
        // Within the lens, pointing at somebody does bring their own forward —
        // the question has already been asked, and this only says whose.
        else if (attendedPerson) target = someoneElseFocused ? ORBS.SESSION_RECEDED : 0.85;
        // Once a person has been chosen, everybody else's sessions withdraw
        // completely rather than merely dimming. The claim being made is "this
        // is *their* learning experience", and sixteen half-lit rings behind
        // the subject contradict it.
        else if (focusedTraineeId !== null) target = 0;
        // Otherwise the whole cohort's interiors come up at once, because the
        // question the lens asks is what the group responded to rather than
        // what one person did.
        else target = 0.7;
      }

      levels[i] += (target - levels[i]) * ease;
      brightest = Math.max(brightest, levels[i]);

      const centre = positions.get(orbKey(SESSION_MONTH, carrier.personId));
      if (!centre || levels[i] < 0.01) {
        // Collapsed rather than left in place: an object that shrinks away has
        // left, one that lingers at a pixel is a speck.
        scratch.matrix.makeScale(0.0001, 0.0001, 0.0001);
        mesh.setMatrixAt(i, scratch.matrix);
        continue;
      }

      // Attention opens the ring out. The reorganisation is the reveal: at rest
      // the objects sit close in and read as part of the vessel's silhouette,
      // and separating them is what makes each individually legible.
      const opened = attendedPerson || isHovered || isOpen ? levels[i] : 0;
      const spread = 1 + (ORBS.SESSION_SPREAD_ON_ATTENTION - 1) * opened;

      // Depth within the vessel, never beyond it. The clearance keeps the
      // person's own core free, and the per-object jitter means no two sit on
      // the same shell, so the interior parallaxes as the camera moves.
      const tier = carrier.primary
        ? ORBS.SESSION_DEPTH_PRIMARY
        : ORBS.SESSION_DEPTH_SECONDARY;
      const jitter = ((carrier.personIndex * 7 + i * 13) % 100) / 100;
      const depth = Math.min(
        0.86,
        Math.max(ORBS.SESSION_CORE_CLEARANCE, tier + (jitter - 0.5) * 0.16) * spread,
      );
      const orbit = ORBS.BASE_RADIUS * depth;

      // The whole set revolves slowly around its person, so the arrangement
      // presents every object to the camera in turn rather than hiding the ones
      // that happen to start behind.
      // Held still rather than frozen dead: `settled` runs the ring down to a
      // fraction of its rate, so the arrangement is legibly alive without the
      // object sliding out from under the pointer.
      settle[i] +=
        ((carrier.personId === settledPerson ? 1 : 0) - settle[i]) * ease;
      revolved[i] +=
        (reducedMotion ? 0 : step) *
        Math.PI *
        2 *
        ORBS.SESSION_REVOLVE *
        (1 - settle[i] * ORBS.SESSION_SETTLE);

      const revolution = reducedMotion ? 0 : revolved[i] + carrier.personIndex;
      scratch.revolve.setFromAxisAngle(scratch.up, revolution);
      scratch.offset.copy(carrier.direction).applyQuaternion(scratch.revolve);

      const bob = reducedMotion
        ? 0
        : Math.sin(time * 0.45 + carrier.personIndex + i * 1.7) * 0.05;
      scratch.position.copy(centre).addScaledVector(scratch.offset, orbit + bob * ORBS.BASE_RADIUS);

      if (import.meta.env.DEV) {
        if (attendedPerson) {
          screen.copy(scratch.position).project(camera);
          projected.set(key, {
            x: Math.round(((screen.x + 1) / 2) * viewport.width),
            y: Math.round(((1 - screen.y) / 2) * viewport.height),
          });
        } else {
          projected.delete(key);
        }
        (window as unknown as Record<string, unknown>).__sessions =
          Object.fromEntries(projected);
      }

      // The subject of the label is whichever object is open, or failing that
      // whichever is under the pointer.
      if (isOpen || (isHovered && openedSession === null)) {
        anchor.position.copy(scratch.position);
        anchor.live = true;
      }

      // The form's own rotation. Rate and axis are part of its identity: the
      // strata barely shift, the cycle runs, the emitters turn as they
      // broadcast. Attention quickens it without changing its character.
      const quicken = 1 + opened * 0.9;
      const spin = reducedMotion
        ? carrier.personIndex
        : time * motion.rate * quicken + carrier.personIndex;
      scratch.quaternion.setFromAxisAngle(scratch.axis, spin);

      // Size carries the hierarchy, and how strongly the person endorsed this
      // session modulates it within its tier. Expressed against the orb's own
      // radius so an object stays contained however the vessel is scaled.
      const base =
        ORBS.BASE_RADIUS *
        (carrier.primary
          ? ORBS.SESSION_SIZE_PRIMARY
          : ORBS.SESSION_SIZE_SECONDARY * (0.72 + carrier.strength * 0.28));
      const size = base * (0.5 + levels[i] * 0.5) * levels[i];

      scratch.scale.setScalar(Math.max(0.0001, size));
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    // Recomputed every frame, and it has to be.
    //
    // InstancedMesh caches its bounding sphere the first time anything asks for
    // one and never refreshes it. These objects begin the session collapsed to
    // nothing at the origin, so the cached sphere is a speck at the world's
    // centre — and the raycaster tests that sphere before it tests any
    // instance, so every pointer event was being rejected before it reached
    // them. Sixteen instances is nothing to recompute.
    mesh.computeBoundingSphere();

    material.opacity = Math.min(1, 0.3 + brightest * 0.7);
    material.emissiveIntensity = 0.25 + brightest * 0.85;
    mesh.visible = brightest > 0.01;

  });

  const carrierAt = useCallback(
    (instanceId: number | undefined): Carrier | null => {
      if (instanceId === undefined) return null;
      const carrier = carriers[instanceId];
      if (!carrier) return null;
      // An object that has not finished arriving is not there to be pointed at.
      if (levels[instanceId] < 0.2) return null;
      return carrier;
    },
    [carriers, levels],
  );

  const onPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const carrier = carrierAt(event.instanceId);
      if (!carrier) return;
      // Claimed only when this object is genuinely reachable, so a faint one
      // never swallows a click meant for the vessel behind it.
      event.stopPropagation();
      hoverSession(sessionKey(carrier.personId, carrier.classId));
    },
    [carrierAt, hoverSession],
  );

  const onPointerOut = useCallback(() => hoverSession(null), [hoverSession]);

  const onClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const carrier = carrierAt(event.instanceId);
      if (!carrier) return;
      event.stopPropagation();
      const key = sessionKey(carrier.personId, carrier.classId);
      // Clicking the open object closes it, so one gesture both opens and
      // dismisses.
      const current = useWorldStore.getState().openedSession;
      openSession(current === key ? null : key);
    },
    [carrierAt, openSession],
  );

  if (carriers.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, carriers.length]}
      frustumCulled={false}
      // Marked so the vessel enclosing these knows not to swallow pointer
      // events meant for its own contents.
      userData={{ session: true }}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
      onClick={onClick}
    />
  );
}
