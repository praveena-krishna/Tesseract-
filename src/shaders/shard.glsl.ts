/**
 * A difficulty, as a fragment of glass caught inside the person it happened to.
 *
 * The brief this answers is "realistic glass", and realism here is mostly about
 * what the material refuses to do. It does not glow, it is not additive, and it
 * has no colour of its own to give off. What it has is the behaviour of a
 * transparent solid: it is nearly clear when you look straight through it,
 * turns to a mirror at grazing angles, tints whatever is behind it in
 * proportion to how much glass the light had to cross, and throws a hard white
 * highlight off whichever facet happens to face the lamp.
 *
 * Tint therefore arrives by absorption rather than by emission — the fragment
 * takes colour *out* of what is behind it, the way real coloured glass does.
 * That is what keeps eight subtle hues legible as glass rather than as eight
 * neon markers, and it is the whole difference between this and an icon.
 */

export const SHARD_VERT = /* glsl */ `
  uniform float uTime;

  uniform float uCharge;
  uniform float uAttention;

  attribute vec3 aBary;

  varying vec3 vBary;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocal;
  varying float vCharge;
  varying float vAttention;

  void main() {
    vBary = aBary;
    vLocal = position;
    vCharge = uCharge;
    vAttention = uAttention;

    // Worked through, a fragment draws back and out rather than winking off.
    vec3 pos = position * mix(0.1, 1.0, uCharge);

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const SHARD_FRAG = /* glsl */ `
  precision highp float;

  uniform vec3 uLightDir;
  uniform vec3 uAmbient;
  uniform vec3 uTint;

  varying vec3 vBary;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocal;
  varying float vCharge;
  varying float vAttention;

  void main() {
    if (vCharge < 0.02) discard;

    vec3 normal = normalize(vNormal);
    vec3 view = normalize(vViewDir);
    float facing = abs(dot(normal, view));

    // Schlick for a dielectric at about the index of glass. Clear head-on,
    // mirror-bright edge-on — the ramp the eye actually reads as "transparent
    // solid", and the reason none of this needs to be made to glow.
    float f0 = 0.04;
    float fresnel = f0 + (1.0 - f0) * pow(1.0 - facing, 5.0);

    // How much glass the light had to cross. Longest through the middle of the
    // fragment, nothing at all at a grazing edge.
    float thickness = facing;

    // Beer–Lambert absorption: the fragment takes colour out of what is behind
    // it rather than adding any. This is what makes it read as coloured glass
    // instead of a coloured light.
    vec3 absorbed = mix(vec3(1.0), uTint, clamp(thickness * 0.85, 0.0, 1.0));

    // One hard specular per facet, so a turning fragment flashes face by face.
    // Named halfVector, not half: half is a reserved word in GLSL and naming a
    // variable that silently fails the whole program to compile, which draws
    // nothing at all.
    vec3 halfVector = normalize(uLightDir + view);
    float spec = pow(max(dot(normal, halfVector), 0.0), 68.0);
    // And a broader sheen, which is the soft reflection of everything else.
    float sheen = pow(max(dot(normal, halfVector), 0.0), 8.0) * 0.16;

    // The cut. The narrowest barycentric is the distance to the nearest facet
    // edge; a real broken edge catches light along a hairline, so this stays
    // narrow and white rather than becoming a coloured outline.
    // Narrower than before, and harder. A wide soft seam reads as a bevel —
    // something finished and handled. A hairline that goes almost straight from
    // dark to white reads as a fracture, which is what these actually are.
    float edge = min(min(vBary.x, vBary.y), vBary.z);
    float seam = 1.0 - smoothstep(0.0, 0.016, edge);
    // A second, wider band under it, so an edge has a hot line and a falloff
    // rather than being a single stripe laid on the surface.
    float bleed = 1.0 - smoothstep(0.0, 0.09, edge);

    // Absorption alone leaves almost nothing to see: the scene behind a
    // fragment is near-black, so taking colour out of it takes colour out of
    // nothing. Real tinted glass in a dark room reads by the light it catches
    // at its edges and faces, so the tint is carried there too — on the
    // fresnel and along the cut — while the specular stays white and keeps it
    // reading as a hard transparent solid rather than a coloured lamp.
    vec3 colour =
      absorbed * uAmbient * (0.32 + fresnel * 0.8) +
      uTint * (fresnel * 1.5 + bleed * 0.9 + seam * 1.8 + 0.2) +
      vec3(1.0) * (spec * 1.25 + sheen + seam * 0.55);

    // Coverage: nearly clear through the body so the violet of the vessel and
    // the person's own interior read straight through the glass, closing up at
    // the silhouette where real glass turns opaque.
    // A higher floor than glass strictly wants. These are read through a lit
    // violet vessel, and a fragment that is honest about how transparent it is
    // simply is not there.
    float alpha =
      (0.34 + fresnel * 0.78 + bleed * 0.3 + seam * 0.6 + spec * 0.5) *
      vCharge *
      (0.86 + vAttention * 0.14);

    gl_FragColor = vec4(colour, clamp(alpha, 0.0, 0.9));
  }
`;
