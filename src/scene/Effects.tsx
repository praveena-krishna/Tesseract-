import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useWorldStore } from '../store/useWorldStore';

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

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        mipmapBlur
        intensity={0.55}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.3}
        radius={0.7}
      />
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
