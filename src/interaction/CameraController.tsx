import { useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { CAMERA } from '../config/dimensions';
import { ORBS } from '../config/orbs';
import { TIMINGS } from '../config/timings';
import { useWorldStore } from '../store/useWorldStore';
import { useCameraKeys } from './useCameraKeys';
import { applyFraming, ENTRY, focusOn, frameOverview, OVERVIEW } from './cameraMoves';

const DEG = THREE.MathUtils.degToRad;

/**
 * Radius the camera frames a project against.
 *
 * Larger than an orb because the subject of a project is the whole formation —
 * the core and the people gathered around it — and framing it as tightly as one
 * person would put the collaborators outside the shot.
 */
const TEAM_FRAMING_RADIUS = 1.5;

/**
 * The camera rig.
 *
 * Built on camera-controls rather than OrbitControls because every later phase
 * needs to move the camera programmatically — approaching an orb, framing a
 * team, returning to equilibrium — and camera-controls animates through the
 * same damped solver that handles user input. A scripted move and a dragged one
 * therefore feel identical, and there is no disable/re-enable dance that makes
 * the view snap when control is handed back.
 *
 * The instance is registered into the store so future systems drive the camera
 * through one seam instead of reaching for the camera object directly.
 */
export function CameraController() {
  const controlsRef = useRef<CameraControlsImpl>(null);
  const lastInputRef = useRef(0);
  /**
   * True while a scripted move owns the camera, so idle drift cannot push
   * against a transition that is still settling.
   *
   * Held until the move's own promise resolves rather than for an estimated
   * duration: these transitions ease exponentially and step per frame, so on a
   * slow renderer they take far longer in wall-clock time than their smoothing
   * constant suggests, and a timed guess would release the drift mid-move.
   */
  const scriptedRef = useRef(false);
  const enteredRef = useRef(false);

  const setControls = useWorldStore((state) => state.setControls);
  const markInteracted = useWorldStore((state) => state.markInteracted);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);
  const phase = useWorldStore((state) => state.phase);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);

  const noteInput = useCallback(() => {
    lastInputRef.current = performance.now();
    // A deliberate input ends any scripted move's claim on the camera; the
    // viewer's intent always outranks the choreography.
    scriptedRef.current = false;
    markInteracted();
  }, [markInteracted]);

  /** Runs a scripted move, holding off the idle drift until it has settled. */
  const runScripted = useCallback(async (move: Promise<void>) => {
    scriptedRef.current = true;
    try {
      await move;
    } finally {
      // Treat the arrival as a fresh moment of stillness, so the drift waits a
      // full idle delay before resuming rather than starting the instant the
      // camera lands.
      lastInputRef.current = performance.now();
      scriptedRef.current = false;
    }
  }, []);

  /**
   * Return to equilibrium.
   *
   * Selection is released first when there is one: the viewer's mental model is
   * a stack, and the escape gesture should step out one layer — back to the
   * whole field — rather than dropping every layer at once.
   */
  const returnToRest = useCallback(() => {
    const store = useWorldStore.getState();
    // Clearing the selection is itself what sends the camera back.
    if (store.focusedTeamId) {
      store.focusTeam(null);
      return;
    }
    if (store.focusedTraineeId) {
      store.focusTrainee(null);
      return;
    }
    resetViewRef.current();
  }, []);

  const resetView = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    // Restore the clamp that keeps the camera outside the whole structure; it
    // is relaxed only while a person is being observed from within.
    controls.minDistance = CAMERA.MIN_DISTANCE;
    void runScripted(frameOverview(controls, !reducedMotion));
  }, [reducedMotion, runScripted]);

  // Lets returnToRest reach the reset without either callback depending on the
  // other's identity, which would rebuild both on every render.
  const resetViewRef = useRef(resetView);
  resetViewRef.current = resetView;

  const applyKeys = useCameraKeys(controlsRef, {
    rotateSpeed: CAMERA.KEY_ROTATE_SPEED,
    dollySpeed: CAMERA.KEY_DOLLY_SPEED,
    onHome: resetView,
    onEscape: returnToRest,
    onInput: noteInput,
  });

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    controls.minDistance = CAMERA.MIN_DISTANCE;
    controls.maxDistance = CAMERA.MAX_DISTANCE;
    controls.minPolarAngle = DEG(CAMERA.MIN_POLAR_DEG);
    controls.maxPolarAngle = DEG(CAMERA.MAX_POLAR_DEG);
    controls.smoothTime = CAMERA.SMOOTH_TIME;
    controls.draggingSmoothTime = CAMERA.DRAGGING_SMOOTH_TIME;
    controls.dollySpeed = CAMERA.DOLLY_SPEED;
    controls.azimuthRotateSpeed = CAMERA.ROTATE_SPEED;
    controls.polarRotateSpeed = CAMERA.ROTATE_SPEED;
    controls.restThreshold = CAMERA.REST_THRESHOLD;

    // Dollying toward the pointer would slide the structure off-centre; the
    // tesseract is the subject and stays framed.
    controls.dollyToCursor = false;
    controls.infinityDolly = false;

    // The tesseract is the world; its centre is the only target in this phase,
    // so panning is disabled rather than left to drift off-axis. Pinch is bound
    // to dolly alone so two fingers zoom without also trucking.
    const { ACTION } = CameraControlsImpl;
    controls.mouseButtons.right = ACTION.NONE;
    controls.mouseButtons.middle = ACTION.NONE;
    controls.touches.two = ACTION.TOUCH_DOLLY;

    // Begin wide, held still, until the world is ready to be entered.
    void applyFraming(controls, ENTRY, 0, false);

    setControls(controls);
    return () => setControls(null);
  }, [setControls]);

  /**
   * The opening move.
   *
   * The camera settles from the wide entry framing into the resting view as the
   * veil clears, so the first thing the viewer sees is the world resolving
   * rather than a static image that was already there. It runs once.
   */
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || phase !== 'ready' || enteredRef.current) return;
    enteredRef.current = true;

    if (reducedMotion) {
      void applyFraming(controls, OVERVIEW, 0, false);
      return;
    }

    void runScripted(applyFraming(controls, OVERVIEW, CAMERA.ENTRY_SMOOTH_TIME, true));
  }, [phase, reducedMotion, runScripted]);

  /**
   * The camera answers to selection.
   *
   * Choosing a person moves the camera in to observe them; releasing the
   * selection returns it to the whole structure. This lives in the camera rig
   * rather than in the selection code so that everything which moves the camera
   * shares one owner — and one definition of when a scripted move is running.
   */
  const focusedTraineeId = useWorldStore((state) => state.focusedTraineeId);
  const focusedTeamId = useWorldStore((state) => state.focusedTeamId);

  useEffect(() => {
    const controls = controlsRef.current;
    // Nothing to do until the world has actually opened.
    if (!controls || phase !== 'ready') return;

    if (!focusedTraineeId && !focusedTeamId) {
      // Only pull the camera back if it had been sent in; otherwise clearing a
      // selection would yank a viewer out of a view they set up themselves.
      if (controls.minDistance !== CAMERA.MIN_DISTANCE) resetView();
      return;
    }

    const store = useWorldStore.getState();
    // A project is framed wider than a person: the subject is the formation and
    // the members around it, so the shot has to hold the group.
    const target = focusedTeamId
      ? store.teamCentres?.get(focusedTeamId)
      : focusedTraineeId
        ? store.traineePositions?.get(focusedTraineeId)
        : undefined;
    if (!target) return;

    const subjectRadius = focusedTeamId
      ? TEAM_FRAMING_RADIUS
      : ORBS.BASE_RADIUS + ORBS.RADIUS_VARIANCE;

    controls.minDistance = CAMERA.FOCUS_MIN_DISTANCE;
    void runScripted(
      focusOn(
        controls,
        camera as THREE.PerspectiveCamera,
        target.clone(),
        subjectRadius,
        store.traineePositions?.values(),
      ),
    );
  }, [focusedTraineeId, focusedTeamId, phase, camera, resetView, runScripted]);

  useEffect(() => {
    const element = gl.domElement;

    // Make the canvas focusable so keyboard navigation has somewhere to land,
    // and describe it for assistive technology, which cannot read the scene.
    element.tabIndex = 0;
    element.setAttribute('role', 'application');
    element.setAttribute(
      'aria-label',
      'The Tesseract: a dimensional structure containing sixteen trainees. ' +
        'Drag or use the arrow keys to orbit, plus and minus to move closer or ' +
        'further. Click an orb to select that person, or step through them with ' +
        'the left and right bracket keys. Escape releases the selection, and ' +
        'Home returns to the opening view.',
    );
    element.style.outline = 'none';

    const onDoubleClick = () => {
      resetView();
      markInteracted();
    };

    element.addEventListener('pointerdown', noteInput);
    element.addEventListener('wheel', noteInput, { passive: true });
    element.addEventListener('dblclick', onDoubleClick);

    return () => {
      element.removeEventListener('pointerdown', noteInput);
      element.removeEventListener('wheel', noteInput);
      element.removeEventListener('dblclick', onDoubleClick);
    };
  }, [gl, noteInput, resetView, markInteracted]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Clamp so a backgrounded tab does not deliver one enormous step on return.
    const step = Math.min(delta, 0.1);
    applyKeys(step);

    if (reducedMotion || scriptedRef.current) return;

    const now = performance.now();

    // After a period of stillness the world resumes a slow orbit — roughly one
    // revolution every seven minutes. Incrementing the azimuth lets the
    // control damping absorb it; touching the camera directly would fight the
    // solver and show up as jitter.
    const idleFor = (now - lastInputRef.current) / 1000;
    if (idleFor < TIMINGS.IDLE_DELAY) return;

    // Eased in over two seconds so the drift never starts with a visible jolt.
    const ramp = THREE.MathUtils.smoothstep(
      idleFor,
      TIMINGS.IDLE_DELAY,
      TIMINGS.IDLE_DELAY + 2,
    );
    controls.azimuthAngle += TIMINGS.IDLE_ORBIT_SPEED * ramp * step;
  });

  return <CameraControls ref={controlsRef} makeDefault />;
}
