import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { SHELL_FADE } from '../config/dimensions';

/**
 * Uniforms injected into a patched MeshStandardMaterial. The material keeps its
 * full physically based lighting; we add a view-dependent rim on top of the
 * emissive term and a proximity dissolve on its coverage.
 */
export interface FrameUniforms {
  uPulse: THREE.IUniform<number>;
  uFresnelColor: THREE.IUniform<THREE.Color>;
  uFresnelPower: THREE.IUniform<number>;
  uFresnelIntensity: THREE.IUniform<number>;
  uFadeGone: THREE.IUniform<number>;
  uFadeSolid: THREE.IUniform<number>;
}

/** Materials carry their injected uniforms here once the shader has compiled. */
export interface PatchedMaterial extends THREE.MeshStandardMaterial {
  userData: { fresnel?: FrameUniforms };
}

const CACHE_KEY = 'tesseract-frame';

/**
 * Patches a MeshStandardMaterial with a breathing Fresnel rim and a proximity
 * dissolve.
 *
 * **The rim.** Grazing angles pick up a cool edge light that pulses with the
 * shell's own rhythm. Combined with the bevelled strut profile this is what
 * separates the frame from a line drawing: the silhouette glows, the faces stay
 * dark, and reflections slide across the chamfers as the camera orbits.
 *
 * **The dissolve.** Members within reach of the lens withdraw, so the camera
 * can travel inside the structure to observe a person instead of being held
 * outside it by a beam it would otherwise be embedded in. It is computed per
 * fragment from that fragment's own distance to the camera, which is the whole
 * point — fading a shell as a single object would take its far side with it,
 * and the far side is exactly what makes being inside the tesseract legible.
 *
 * It dissolves by dithering rather than by blending, so the material stays
 * opaque and keeps writing depth. A partially transparent frame would either
 * occlude the orbs behind it while being see-through, or stop occluding them
 * entirely — both worse than a member that visibly disperses as it clears.
 *
 * A custom program cache key is essential: without it three may hand back an
 * unpatched program compiled for an identically configured material.
 */
export function applyFrameMaterial(
  material: THREE.MeshStandardMaterial,
  fresnelIntensity: number,
): PatchedMaterial {
  const patched = material as PatchedMaterial;

  patched.onBeforeCompile = (shader) => {
    const uniforms: FrameUniforms = {
      uPulse: { value: 1 },
      uFresnelColor: { value: new THREE.Color(PALETTE.FRESNEL_RIM) },
      uFresnelPower: { value: 3.0 },
      uFresnelIntensity: { value: fresnelIntensity },
      uFadeGone: { value: SHELL_FADE.GONE },
      uFadeSolid: { value: SHELL_FADE.SOLID },
    };

    Object.assign(shader.uniforms, uniforms);
    patched.userData.fresnel = uniforms;

    shader.fragmentShader =
      `uniform float uPulse;
       uniform vec3 uFresnelColor;
       uniform float uFresnelPower;
       uniform float uFresnelIntensity;
       uniform float uFadeGone;
       uniform float uFadeSolid;

       float frameDither(vec2 co) {
         return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
       }
      ` + shader.fragmentShader;

    // vViewPosition runs from the fragment toward the camera in view space, so
    // its length is this fragment's own distance from the lens.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float framePresence = smoothstep(uFadeGone, uFadeSolid, length(vViewPosition));
       if (framePresence < frameDither(gl_FragCoord.xy)) discard;
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float fresnelFacing = abs(dot(normalize(vViewPosition), normal));
       float fresnelTerm = pow(clamp(1.0 - fresnelFacing, 0.0, 1.0), uFresnelPower);
       totalEmissiveRadiance += uFresnelColor * fresnelTerm * uFresnelIntensity * uPulse;
      `,
    );
  };

  patched.customProgramCacheKey = () => `${CACHE_KEY}-${fresnelIntensity.toFixed(3)}`;

  return patched;
}
