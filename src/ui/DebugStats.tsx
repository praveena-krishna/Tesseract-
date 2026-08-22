import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { useWorldStore } from '../store/useWorldStore';

/**
 * Development readout, mounted only behind `?debug`.
 *
 * Draw-call count is the number worth watching in this scene: the design
 * depends on each shell staying merged into single meshes and the particle
 * field staying a single points object, so a creeping count means something has
 * quietly stopped being merged.
 *
 * Automatic reset has to be disabled to measure it. The effect composer renders
 * several passes per frame and three clears its counters on each one, so the
 * default behaviour would only ever report the final fullscreen quad — one call,
 * one triangle, which looks like a suspiciously good result. Instead the totals
 * are read at the top of the next frame and reset manually.
 */
export function DebugStats() {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    gl.info.autoReset = false;

    const node = document.createElement('div');
    node.style.cssText = [
      'position:fixed',
      'left:8px',
      'bottom:8px',
      'z-index:50',
      'font:10px/1.6 ui-monospace,monospace',
      'letter-spacing:0.08em',
      'color:#5a6472',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(node);
    elementRef.current = node;

    return () => {
      gl.info.autoReset = true;
      node.remove();
      elementRef.current = null;
    };
  }, [gl]);

  useFrame(() => {
    const { render, memory, programs } = gl.info;

    // Sampled every few frames to keep DOM writes off the critical path, but
    // often enough to stay current on a slow renderer — at a longer interval a
    // struggling machine reports its very first frame indefinitely, which reads
    // as an impossibly good result.
    if (frameRef.current++ % 5 === 0 && elementRef.current) {
      // Camera state alongside the render counters: framing decisions are made
      // by reading these numbers back out of the running scene, which is far
      // more reliable than judging a position from a screenshot.
      const controls = useWorldStore.getState().controls;
      const cameraInfo = controls
        ? `  cam d${controls.distance.toFixed(2)} orig${camera.position.length().toFixed(2)} ` +
          `az${THREE.MathUtils.radToDeg(controls.azimuthAngle).toFixed(1)} ` +
          `pol${THREE.MathUtils.radToDeg(controls.polarAngle).toFixed(1)}`
        : '';

      elementRef.current.textContent =
        `calls ${render.calls}  tris ${render.triangles}  ` +
        `geo ${memory.geometries}  tex ${memory.textures}  ` +
        `prog ${programs?.length ?? 0}${cameraInfo}`;
    }

    gl.info.reset();
  });

  return <Stats />;
}
