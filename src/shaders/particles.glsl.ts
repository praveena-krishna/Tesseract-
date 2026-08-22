/**
 * Environmental particulate.
 *
 * All drift happens in the vertex shader from a per-particle seed, so the CPU
 * does no per-frame work and the whole field costs one draw call. The motion is
 * a pseudo-curl: three sines on different axes at different rates, which reads
 * as gently turbulent rather than as a uniform scroll.
 */

export const PARTICLES_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uDrift;
  uniform float uPixelRatio;
  uniform float uMaxSize;

  attribute vec3 aSeed;
  attribute float aScale;
  attribute float aOpacity;

  varying float vOpacity;

  void main() {
    vec3 pos = position;

    // Each axis advances at its own rate against its own seed, so no two
    // particles share a trajectory and the field never pulses in unison.
    pos.x += sin(uTime * 0.06 + aSeed.x * 6.283) * uDrift;
    pos.y += sin(uTime * 0.045 + aSeed.y * 6.283) * uDrift * 1.3;
    pos.z += cos(uTime * 0.052 + aSeed.z * 6.283) * uDrift;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Perspective attenuation, clamped hard at the top. Particles are motes
    // establishing the volume the structure hangs in; the moment one grows into
    // a soft disc it reads as lens bokeh and cheapens the whole frame.
    float size = uSize * aScale * uPixelRatio * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(size, 0.4, uMaxSize * uPixelRatio);

    // Fade at both ends of the field so nothing pops in at the far plane or
    // looms as the camera dollies out toward the shell's inner radius.
    float depth = -mvPosition.z;
    float depthFade = smoothstep(110.0, 70.0, depth) * smoothstep(12.0, 26.0, depth);
    vOpacity = aOpacity * depthFade;
  }
`;

export const PARTICLES_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vOpacity;

  void main() {
    float dist = length(gl_PointCoord - 0.5);
    // A tight core with a short falloff. Widening this turns motes into bokeh.
    float alpha = smoothstep(0.5, 0.28, dist);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha * vOpacity);
  }
`;
