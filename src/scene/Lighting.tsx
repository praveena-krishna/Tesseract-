import { Environment, Lightformer } from '@react-three/drei';
import { PALETTE } from '../config/palette';

/**
 * The lighting rig.
 *
 * The reflective environment is built procedurally from lightformers rather
 * than loaded from an HDR preset — drei's presets fetch from a CDN at runtime,
 * which would make the experience fail offline and stall first paint. Three
 * emitters are enough to give the metal frames something to reflect: an
 * overhead strip that travels along the bevels as the camera orbits, a cool
 * side rim that separates the silhouette from the void, and a dim floor bounce
 * that keeps the undersides from going completely black.
 *
 * `frames={1}` bakes the cube map once; nothing in the scene moves enough to
 * justify re-rendering it per frame.
 */
export function Lighting() {
  return (
    <>
      {/* Kept low deliberately. Ambient light is what makes a dark scene turn
          uniformly grey; the shadowed faces of the frame should fall away into
          the void rather than being lifted to a readable mid-tone. */}
      <ambientLight color={PALETTE.LIGHT_AMBIENT} intensity={0.1} />

      <directionalLight
        color={PALETTE.LIGHT_KEY}
        intensity={2.1}
        position={[6, 8, 4]}
      />
      <directionalLight
        color={PALETTE.LIGHT_RIM}
        intensity={0.9}
        position={[-6, 3, -8]}
      />

      <Environment resolution={256} frames={1}>
        <Lightformer
          form="rect"
          intensity={2}
          color={PALETTE.LIGHTFORMER_TOP}
          scale={[8, 2, 1]}
          position={[0, 6, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          color={PALETTE.LIGHTFORMER_SIDE}
          scale={[2, 6, 1]}
          position={[-6, 1, 2]}
          rotation={[0, Math.PI / 2, 0]}
        />
        {/* A trace of bounce, no more. Enough that the undersides are not
            pure black, not enough to flatten the tonal range. */}
        <Lightformer
          form="rect"
          intensity={0.3}
          color={PALETTE.LIGHTFORMER_FILL}
          scale={[10, 4, 1]}
          position={[0, -4, -2]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      </Environment>
    </>
  );
}
