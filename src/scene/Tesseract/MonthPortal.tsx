import { useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { DIMENSION, SHELLS } from '../../config/dimensions';
import type { MonthIndex } from '../../data/world';
import { useWorldStore } from '../../store/useWorldStore';

interface MonthPortalProps {
  /** Which month this shell stands for. */
  month: MonthIndex;
}

/**
 * What the pointer actually hits when reaching for a dimensional layer.
 *
 * The layer itself is twelve thin members and eight joints — a target you would
 * have to aim at rather than one that meets you, and asking someone to hit a
 * beam before they know the beam is interactive is the wrong way round. This is
 * an invisible volume filling the shell, so the whole layer answers.
 *
 * It exists only while the viewer is outside. Once they have passed into the
 * layer the volume is around them and would swallow every pointer event meant
 * for what is inside, so it is unmounted rather than left to be worked around.
 *
 * The layers are nested, which makes precedence the whole problem. Month 2's
 * volume completely encloses Month 1's, so a ray aimed at the innermost box
 * passes through the outer one first and the outer one would claim every click
 * — leaving the inner months permanently unreachable. Each portal therefore
 * checks whether a smaller one is also under the pointer and stands aside for
 * it. Pointing anywhere inside the innermost box reaches the innermost month;
 * pointing at the shell between two reaches the outer of them.
 *
 * It writes no colour, so it costs a draw call and nothing else — and it stays
 * a real object rather than an invisible one, because an object marked
 * invisible is skipped by the raycaster and would never be hit at all.
 */
export function MonthPortal({ month }: MonthPortalProps) {
  const hoverMonth = useWorldStore((state) => state.hoverMonth);
  const enterMonth = useWorldStore((state) => state.enterMonth);
  const enteredMonth = useWorldStore((state) => state.enteredMonth);

  /**
   * A little larger than the box itself.
   *
   * Month 1 is the innermost shell, so from the opening view it is a small
   * target a long way off — about a tenth of the frame's height. A volume that
   * stops exactly at the members would demand precision the viewer has no
   * reason to expect, and the generosity is invisible: there is nothing else in
   * there to hit by mistake.
   */
  const half = SHELLS[DIMENSION.SHELL_OF_MONTH[month]].half * 1.18;
  const geometry = useMemo(
    () => new THREE.BoxGeometry(half * 2, half * 2, half * 2),
    [half],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  /**
   * True when a deeper layer's portal is also under the pointer.
   *
   * Compared by size rather than by month, so the rule holds however the months
   * are mapped onto the shells: the smallest volume under the pointer is the
   * one being aimed at.
   */
  const deeperUnderPointer = useCallback(
    (event: ThreeEvent<PointerEvent | MouseEvent>) =>
      event.intersections.some((hit) => {
        const other = hit.object.userData?.portalHalf;
        return typeof other === 'number' && other < half - 1e-6;
      }),
    [half],
  );

  const onPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (deeperUnderPointer(event)) return;
      event.stopPropagation();
      hoverMonth(month);
    },
    [deeperUnderPointer, hoverMonth, month],
  );

  const onPointerOut = useCallback(() => hoverMonth(null), [hoverMonth]);

  const onClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (deeperUnderPointer(event)) return;
      event.stopPropagation();
      enterMonth(month);
    },
    [deeperUnderPointer, enterMonth, month],
  );

  useEffect(() => {
    // Leaving the layer must not leave a stale hover behind it, or the shell
    // stays lit for a pointer that is no longer anywhere near it.
    if (enteredMonth !== null) hoverMonth(null);
  }, [enteredMonth, hoverMonth]);

  if (enteredMonth !== null) return null;

  return (
    <mesh
      geometry={geometry}
      // Its own size, so nested portals can work out which of them is being
      // aimed at without knowing anything about months.
      userData={{ portalHalf: half }}
      onPointerMove={onPointerMove}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <meshBasicMaterial
        side={THREE.FrontSide}
        colorWrite={false}
        depthWrite={false}
        transparent
        opacity={0}
      />
    </mesh>
  );
}
