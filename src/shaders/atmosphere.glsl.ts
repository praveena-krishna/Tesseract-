/**
 * Backdrop sphere rendered from the inside.
 *
 * A flat black background reads as an empty canvas; a subtly graded one reads
 * as space with depth. The gradient is deliberately shallow — a few percent of
 * lift toward the horizon plus a trace of noise to defeat banding on the wide
 * gradients that 8-bit output would otherwise stripe.
 */

export const ATMOSPHERE_VERT = /* glsl */ `
  varying vec3 vWorldDirection;

  void main() {
    vWorldDirection = normalize((modelMatrix * vec4(position, 1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ATMOSPHERE_FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uLift;
  uniform float uTime;
  varying vec3 vWorldDirection;

  // Cheap hash-based dither; breaks up banding without reading as film grain.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    // Vertical gradient: marginally brighter below the horizon line so the
    // structure appears to sit within a volume rather than float in a void.
    float elevation = vWorldDirection.y * 0.5 + 0.5;
    float gradient = pow(1.0 - elevation, 2.0) * 0.6 + 0.08;

    // A very broad, very slow lateral variation keeps the void from feeling
    // like a solid fill when the camera pans across it.
    float drift = sin(vWorldDirection.x * 1.4 + uTime * 0.02) *
                  cos(vWorldDirection.z * 1.1 - uTime * 0.015);
    gradient += drift * 0.03;

    vec3 color = uBase + uLift * gradient;
    color += (hash(gl_FragCoord.xy) - 0.5) * 0.004;

    gl_FragColor = vec4(color, 1.0);
  }
`;
