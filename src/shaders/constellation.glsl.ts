/**
 * The constellation material.
 *
 * A figure has to draw *itself*, outward from the project at its centre, rather
 * than fading up whole — the growth is what says the team built this. Every
 * vertex therefore carries how far from the core it sits, and a single uniform
 * sweeps outward through those values.
 *
 * Done on the GPU because the alternative is rewriting a colour buffer for
 * every vertex of every figure on every frame, on the CPU, for an effect that
 * is one comparison per vertex.
 */

const REVEAL = /* glsl */ `
  // How much of this vertex has been reached. The soft edge is what makes the
  // sweep read as a stroke being drawn rather than a row of switches flipping.
  float reveal(float order, float built) {
    return smoothstep(order - 0.22, order + 0.04, built);
  }
`;

export const CONSTELLATION_LINE_VERT = /* glsl */ `
  attribute float aOrder;
  uniform float uBuilt;

  varying float vReveal;

  ${REVEAL}

  void main() {
    vReveal = reveal(aOrder, uBuilt);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const CONSTELLATION_LINE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vReveal;

  void main() {
    if (vReveal < 0.01) discard;
    gl_FragColor = vec4(uColor, vReveal * uOpacity);
  }
`;

export const CONSTELLATION_POINT_VERT = /* glsl */ `
  attribute float aOrder;
  uniform float uBuilt;
  uniform float uSize;

  varying float vReveal;

  ${REVEAL}

  void main() {
    vReveal = reveal(aOrder, uBuilt);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Attenuated with distance, so a figure's points stay the same size
    // relative to the figure however near the camera stands.
    gl_PointSize = uSize * vReveal * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const CONSTELLATION_POINT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vReveal;

  void main() {
    // A soft disc with a hot centre: a star, not a square.
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0 || vReveal < 0.01) discard;

    float core = 1.0 - smoothstep(0.0, 0.55, d);
    float halo = 1.0 - smoothstep(0.0, 1.0, d);
    gl_FragColor = vec4(uColor, (core * 0.85 + halo * 0.35) * vReveal * uOpacity);
  }
`;
