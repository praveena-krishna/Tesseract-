/**
 * Radial falloff used by the volumetric core layers.
 *
 * Three of these billboards at different scales, additively blended, stand in
 * for a volumetric integral at a fraction of the cost. The falloff is squared
 * so the centre stays soft rather than forming a hard disc edge.
 */

export const GLOW_VERT = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const GLOW_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float dist = length(vUv - 0.5) * 2.0;

    // Reach zero well inside the quad's edge. If any energy survives to the
    // boundary the billboard reveals itself as a square, which is the single
    // most common way a glow like this looks cheap.
    float falloff = 1.0 - smoothstep(0.0, 0.82, dist);
    // Cubed rather than squared: a tighter, more luminous centre that decays
    // faster, so the layers read as a volume instead of as flat washes.
    falloff = falloff * falloff * falloff;

    if (falloff < 0.002) discard;
    gl_FragColor = vec4(uColor, falloff * uOpacity);
  }
`;
