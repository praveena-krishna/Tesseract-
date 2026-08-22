import { useEffect, useRef } from 'react';
import type CameraControlsImpl from 'camera-controls';

/**
 * Keys the camera responds to. Held keys accumulate, so pressing two at once
 * orbits diagonally rather than one input cancelling the other.
 */
const ROTATE_KEYS: Record<string, [azimuth: number, polar: number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const DOLLY_KEYS: Record<string, number> = {
  Equal: -1,
  NumpadAdd: -1,
  Minus: 1,
  NumpadSubtract: 1,
  PageUp: -1,
  PageDown: 1,
};

interface CameraKeysOptions {
  rotateSpeed: number;
  dollySpeed: number;
  /** Always returns the camera to the opening view. */
  onHome: () => void;
  /** Steps out one layer: releases a selection first, resets the view otherwise. */
  onEscape: () => void;
  onInput: () => void;
}

/**
 * Keyboard navigation for the camera.
 *
 * The experience is spatial, and without this it would be reachable only by
 * dragging — which excludes anyone navigating by keyboard entirely. Rates are
 * expressed per second and applied against frame delta so the camera travels at
 * the same speed regardless of frame rate, and the input is fed through the
 * same damped solver as dragging so held keys glide rather than step.
 */
export function useCameraKeys(
  controlsRef: React.RefObject<CameraControlsImpl | null>,
  options: CameraKeysOptions,
): (delta: number) => void {
  const pressed = useRef(new Set<string>());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Never swallow keys meant for the browser's own navigation.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.code === 'Home' || event.code === 'Escape') {
        if (event.code === 'Home') optionsRef.current.onHome();
        else optionsRef.current.onEscape();
        optionsRef.current.onInput();
        event.preventDefault();
        return;
      }

      if (!(event.code in ROTATE_KEYS) && !(event.code in DOLLY_KEYS)) return;

      pressed.current.add(event.code);
      optionsRef.current.onInput();
      // Arrow keys and PageUp/PageDown would otherwise scroll the document.
      event.preventDefault();
    };

    const onKeyUp = (event: KeyboardEvent) => pressed.current.delete(event.code);
    // A window that loses focus never delivers the matching keyup, which would
    // leave the camera orbiting on its own until the key is pressed again.
    const onBlur = () => pressed.current.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  /** Applies whatever is currently held. Call once per frame. */
  return (delta: number) => {
    const controls = controlsRef.current;
    if (!controls || pressed.current.size === 0) return;

    const { rotateSpeed, dollySpeed } = optionsRef.current;
    let azimuth = 0;
    let polar = 0;
    let dolly = 0;

    for (const code of pressed.current) {
      const rotation = ROTATE_KEYS[code];
      if (rotation) {
        azimuth += rotation[0];
        polar += rotation[1];
      }
      const direction = DOLLY_KEYS[code];
      if (direction) dolly += direction;
    }

    if (azimuth !== 0 || polar !== 0) {
      controls.rotate(azimuth * rotateSpeed * delta, polar * rotateSpeed * delta, true);
    }
    if (dolly !== 0) {
      controls.dolly(-dolly * dollySpeed * delta, true);
    }
  };
}
