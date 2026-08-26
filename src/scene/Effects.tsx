import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import type { BloomEffect, ChromaticAberrationEffect } from 'postprocessing';
import { DIMENSION } from '../config/dimensions';
import { transitionSurge } from '../sim/dimensionalTransition';
import { useWorldStore } from '../store/useWorldStore';

/** Bloom's resting intensity. The passage adds to it and returns here. */
const BLOOM_BASE = 0.55;

/**
 * The post chain, deliberately short.
 *
 * Bloom is tuned so that only the corner nodes and the travelling signal points
 * visibly bleed; the struts should get a whisper at their fresnel edges and
 * nothing more. In an ACES-tonemapped near-black scene the threshold has to sit
 * low to catch anything at all, so the restraint has to come from intensity
 * instead. If the frames start to halo, lower intensity — never compensate for
 * weak bloom by raising emissive values, which blows out the material response.
 *
 * Grain is present at a level that is felt rather than seen: it gives the void
 * a photographic texture and hides gradient banding.
 *
 * The chromatic aberration is the passage into a dimensional layer, and it sits
 * at exactly zero the rest of the time — at zero offset every channel samples
 * the same texel, so the resting image is untouched and the pass costs a
 * blit. It is mounted permanently rather than added when the passage starts,
 * because mounting an effect mid-transition recompiles the composer's shader
 * and drops frames at the one moment the whole thing has to stay smooth.
 *
 * Depth of field was tried here and removed, which is worth recording so it is
 * not reattempted blind. This scene's atmosphere — the particle field, the orb
 * halos, the volumetric core, the dimensional links — is built from additively
 * blended layers that deliberately write no depth. A depth-of-field pass reads
 * the depth buffer *behind* those layers, finds the far plane, and applies
 * maximum blur to all of them, turning the particulate into exactly the lens
 * bokeh the composition was designed to avoid. Any future attempt has to solve
 * that first, most likely by compositing the atmosphere after the blur.
 */
export function Effects() {
  const reducedMotion = useWorldStore((state) => state.reducedMotion);
  const bloomRef = useRef<BloomEffect>(null);
  const aberrationRef = useRef<ChromaticAberrationEffect>(null);

  useFrame(() => {
    // Reduced motion arrives instantly, so the surge is never anything but
    // zero — but the guard is explicit, because a full-frame colour fringe is
    // precisely what that preference asks us not to do.
    const surge = reducedMotion ? 0 : transitionSurge();

    const bloom = bloomRef.current;
    if (bloom) bloom.intensity = BLOOM_BASE + surge * DIMENSION.SURGE_BLOOM;

    const aberration = aberrationRef.current;
    if (aberration) {
      // Vertical offset is deliberately smaller. Splitting the channels evenly
      // reads as a broken display; weighting it toward the direction of travel
      // reads as light being pulled out of line by the passage.
      const amount = surge * DIMENSION.SURGE_ABERRATION;
      aberration.offset.set(amount, amount * 0.45);
    }
  });

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        ref={bloomRef}
        mipmapBlur
        intensity={BLOOM_BASE}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.3}
        radius={0.7}
      />
      {/*
        Only `offset` is passed. The library's prop type omits the rest of the
        constructor options, and the defaults are what we want anyway: no radial
        modulation, so the fringe is uniform across the frame rather than
        weighted toward the edges.
      */}
      <ChromaticAberration ref={aberrationRef} offset={new THREE.Vector2(0, 0)} />
      {/* Grain resamples every frame, so however subtle it is, it is still
          full-frame flicker — precisely what a reduced-motion preference asks
          us to stop. The scene loses a little texture and nothing else. */}
      {reducedMotion ? (
        <></>
      ) : (
        <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.025} />
      )}
      <Vignette offset={0.28} darkness={0.75} />
    </EffectComposer>
  );
}
