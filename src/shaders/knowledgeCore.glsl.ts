/**
 * One shell of the knowledge core.
 *
 * Three of these sit inside each other, and the whole difficulty of the thing
 * is that they must read as three distinct concentric surfaces rather than as
 * one glowing ball. So none of them is a solid: each is a lattice — meridians
 * and parallels drawn on the surface with clear space between them — and what
 * makes a shell legible is its grid catching light, not its body being filled.
 * You can see through the gold to the silver, and through the silver to the
 * bronze, because there is genuinely nothing in between.
 *
 * The second requirement is that it must not read as a wormhole, a portal or a
 * vortex. Those are all things with an axis and a direction of travel, so this
 * has neither: the grid is symmetric about every axis, nothing rotates about a
 * privileged one, and there is no opening anywhere in any shell. It is a solid
 * of revolution seen from outside, which is what a physical layered core is.
 *
 * Energy passing through shows as a band travelling out through the latitudes,
 * scaled by how much is flowing. At rest the shells still breathe faintly, so
 * the structure is never dead, but nothing sweeps.
 */

export const CORE_VERT = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vLocal = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const CORE_FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3 uTint;
  uniform float uPresence;
  uniform float uFlow;
  uniform float uMeridians;
  uniform float uParallels;

  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    if (uPresence < 0.01) discard;

    vec3 normal = normalize(vNormal);
    float facing = abs(dot(normal, normalize(vViewDir)));

    // Bright where the surface turns away, which is what gives a transparent
    // shell its edge and lets three of them be counted.
    float rim = pow(1.0 - facing, 2.2);

    // The lattice. Spherical coordinates taken from the local position, so the
    // grid belongs to the shell and does not swim as the camera moves.
    float theta = atan(vLocal.z, vLocal.x);
    float phi = acos(clamp(vLocal.y, -1.0, 1.0));

    float meridian = abs(fract(theta / 6.2831853 * uMeridians) - 0.5) * 2.0;
    float parallel = abs(fract(phi / 3.1415927 * uParallels) - 0.5) * 2.0;
    // Thin lines, and thinner still where the surface faces us — a lattice seen
    // face on should be mostly gap, or three shells stack into a solid.
    float width = 0.035 + facing * 0.02;
    float grid =
      (1.0 - smoothstep(0.0, width, 1.0 - meridian)) +
      (1.0 - smoothstep(0.0, width, 1.0 - parallel));
    grid = clamp(grid, 0.0, 1.0);

    // Data passing through, as a band travelling out through the latitudes.
    // Out through, not around: nothing here may read as a vortex.
    float band =
      (1.0 - smoothstep(0.0, 0.16, abs(fract(phi / 3.1415927 - uTime * 0.09) - 0.5))) *
      uFlow;

    // A faint breath so the structure is never quite dead at rest.
    float breath = 0.9 + 0.1 * sin(uTime * 0.5);

    vec3 colour = uTint * (grid * 0.85 + rim * 0.7 + band * 1.1) * breath;
    float alpha = (grid * 0.55 + rim * 0.32 + band * 0.4) * uPresence;

    gl_FragColor = vec4(colour, clamp(alpha, 0.0, 0.9));
  }
`;
