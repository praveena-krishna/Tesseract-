/**
 * The trainee orb: a vessel of indigo-violet glass holding a person's learning.
 *
 * Every term here is data, not decoration. The interior is raymarched along a
 * refracted ray so the internal structure sits at real depth and swims as the
 * camera moves; how dense that structure is comes from how much the person has
 * learned by the current month. Difficulty distorts the vessel physically.
 * Attention brightens it. Absence fades it out.
 *
 * All sixteen are instances of one mesh, so identity and state travel in
 * per-instance attributes rather than uniforms.
 */

export const ORB_VERT = /* glsl */ `
  uniform float uTime;

  attribute float aSeed;
  attribute float aComplexity;
  attribute float aTempo;
  attribute float aEmphasis;
  attribute float aTurbulence;
  attribute float aPresence;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  varying vec3 vLocalView;
  varying float vSeed;
  varying float vComplexity;
  varying float vEmphasis;
  varying float vTurbulence;
  varying float vPresence;

  void main() {
    vSeed = aSeed;
    vComplexity = aComplexity;
    vEmphasis = aEmphasis;
    vTurbulence = aTurbulence;
    vPresence = aPresence;

    vec3 pos = position;

    // A slow, shallow swell. Its rate differs per orb via aTempo, so the field
    // never breathes in unison — sixteen individuals, not a chorus.
    float swell = sin(uTime * aTempo + aSeed * 6.283) * 0.012;

    // Difficulty deforms the vessel. Three sines on different axes and rates
    // beat against each other into a shape that never settles, which reads as
    // strain rather than as a wobble on a timer.
    float strain =
      sin(pos.x * 7.0 + uTime * 3.1 + aSeed * 12.0) *
      sin(pos.y * 6.0 - uTime * 2.2) *
      sin(pos.z * 8.0 + uTime * 1.7);

    pos += normal * (swell + strain * aTurbulence * 0.075);

    vec4 instancePosition = instanceMatrix * vec4(pos, 1.0);
    vec4 mvPosition = modelViewMatrix * instancePosition;

    // instanceMatrix carries uniform scale only, so the normal survives it.
    vNormal = normalize(mat3(instanceMatrix) * normal);
    vViewDir = normalize(cameraPosition - (modelMatrix * instancePosition).xyz);

    // The camera in this instance's own space, which lets the fragment stage
    // walk a ray through the orb's interior on the unit sphere. Valid because
    // the field carries no transform and each instance is translation plus
    // uniform scale.
    vec3 instanceCenter = vec3(instanceMatrix[3]);
    float instanceScale = length(vec3(instanceMatrix[0]));
    vec3 localCamera = (cameraPosition - instanceCenter) / max(instanceScale, 1e-5);

    vLocalPos = pos;
    vLocalView = normalize(localCamera - pos);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const ORB_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uGlass;
  uniform vec3 uGlow;
  uniform vec3 uRim;
  uniform vec3 uDispersion;
  uniform vec3 uSpecular;
  uniform vec3 uLightDir;
  uniform float uIor;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vLocalPos;
  varying vec3 vLocalView;
  varying float vSeed;
  varying float vComplexity;
  varying float vEmphasis;
  varying float vTurbulence;
  varying float vPresence;

  // Multiply-and-fract hash rather than the usual fract(sin(dot(...))).
  //
  // This is the innermost loop of the whole frame — evaluated at eight lattice
  // corners, per octave, per raymarch step, per fragment — so a trigonometric
  // hash would cost hundreds of sin calls per orb pixel for a result that is
  // indistinguishable once folded through the octaves.
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  // Ridged turbulence. Plain fbm sums to soft blobs, which is why an orb built
  // on it looks like cotton however it is exposed; folding each octave about
  // its midpoint turns the zero crossings into sharp ridges, so the field
  // becomes a network of bright veins with dark space between.
  float ridged(vec3 p) {
    float total = 0.0;
    float amplitude = 0.58;
    for (int i = 0; i < 3; i++) {
      float n = noise(p);
      n = 1.0 - abs(n * 2.0 - 1.0);
      total += n * n * amplitude;
      p *= 2.07;
      amplitude *= 0.5;
    }
    return total;
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDir);
    float facing = clamp(dot(normal, viewDir), 0.0, 1.0);

    // Schlick's approximation for a dielectric. Glass is nearly transparent
    // head-on and nearly a mirror at grazing angles, and that ramp — not any
    // amount of added glow — is what the eye reads as "this is glass".
    float f0 = pow((1.0 - uIor) / (1.0 + uIor), 2.0);
    float fresnel = f0 + (1.0 - f0) * pow(1.0 - facing, 5.0);
    float rim = pow(1.0 - facing, 2.4);

    // Optical path length through the sphere: longest through the centre.
    float thickness = facing;

    // Bend the interior ray on entry. This is the refraction that matters: the
    // internal structure genuinely sits behind a curved interface, so it
    // displaces as the camera moves, exactly as objects seen through a lens do.
    vec3 localNormal = normalize(vLocalPos);
    vec3 localView = normalize(vLocalView);
    vec3 rayDir = refract(-localView, localNormal, 1.0 / uIor);
    if (dot(rayDir, rayDir) < 0.0001) rayDir = -localView;

    vec3 samplePoint = vLocalPos;
    // Difficulty agitates the interior as well as the shell, so a person under
    // strain has visibly churning energy rather than a steady one.
    float churn = 1.0 + vTurbulence * 3.0;
    vec3 drift = vec3(0.0, uTime * 0.08 * churn, uTime * 0.05 * churn)
               + vec3(vSeed * 31.0);

    float density = 0.0;
    float weight = 1.0;
    for (int i = 0; i < 5; i++) {
      samplePoint += rayDir * 0.32;

      // Fade toward the far shell so density does not pile up against the back.
      float inside = 1.0 - smoothstep(0.82, 1.0, length(samplePoint));

      // Learning raises the frequency of the internal structure. Someone who
      // has learned more has a visibly finer, more intricate interior — the
      // orb becomes more complex rather than merely brighter, which is what
      // makes growth legible without reading a number.
      float scale = 1.9 + vComplexity * 2.6;
      float sampled = ridged(samplePoint * scale + drift);

      // A high threshold keeps only the sharpest ridges; the emptiness between
      // the veins is what makes the rest read as energy rather than as cloud.
      density += smoothstep(0.58, 0.88, sampled) * inside * weight;
      weight *= 0.78;
    }
    density /= 1.9;

    // Density itself also rises with learning, so a fuller interior means a
    // fuller record — but only within a narrow band, because the vessel has to
    // stay transparent at every level.
    float interior = density * (0.35 + vComplexity * 0.75);

    // Cheap dispersion: electric violet through the body where we look deepest
    // into it, picking up a cool cyan only near the silhouette — the direction
    // real dispersion runs, since refraction is steepest at grazing angles.
    vec3 glowColor = mix(uGlow, uDispersion, clamp(rim * 0.65, 0.0, 1.0));
    // Strain pulls the light toward that cold edge across the whole vessel.
    glowColor = mix(glowColor, uDispersion, vTurbulence * 0.35);

    // Emphasis carries hover and selection: it modulates how much light the
    // vessel gives off, so attention reads as the orb waking up rather than as
    // a highlight applied on top of it.
    float energyGain = 0.4 + vEmphasis * 1.2;
    float edgeGain = 0.7 + vEmphasis * 0.6;

    // Sharp dielectric glint. One tight highlight does more to sell glass than
    // any amount of interior detail.
    vec3 halfVector = normalize(uLightDir + viewDir);
    float specular = pow(max(dot(normal, halfVector), 0.0), 96.0);

    // Beer–Lambert style absorption: the indigo body darkens and tints what
    // lies behind it. This is why the material cannot be additive.
    vec3 absorbed = uGlass * (0.8 + 0.6 * thickness);

    // The inner glow is an accent, not the subject. Driving it harder fills the
    // sphere with saturated violet, which reads as a solid neon ball at viewing
    // distance and throws away the transparency the metaphor rests on.
    vec3 color =
      absorbed +
      glowColor * interior * 0.95 * energyGain +
      uRim * rim * 0.5 * edgeGain +
      uSpecular * specular * 0.9;

    // Coverage stays low through the middle so the vessel remains genuinely
    // see-through, and climbs at the silhouette where real glass turns opaque.
    // A receded orb thins out, so it withdraws rather than merely dimming.
    float alpha =
      clamp(0.17 + fresnel * 0.72 + interior * 0.24 * energyGain + specular * 0.6,
            0.0, 0.9) *
      (0.55 + vEmphasis * 0.9);

    // Absence: a person removed from the training leaves a trace of their
    // vessel rather than a hole, so the viewer can see who is missing.
    alpha *= vPresence;

    gl_FragColor = vec4(color, alpha * uOpacity);
  }
`;

/**
 * The halo: the atmospheric field around each orb.
 *
 * Billboarded in the vertex shader from a per-instance centre so the whole set
 * stays one instanced draw call — orienting sixteen quads on the CPU would cost
 * sixteen matrix updates a frame for no visual gain.
 */
export const HALO_VERT = /* glsl */ `
  attribute float aComplexity;
  attribute float aEmphasis;
  attribute float aPresence;

  varying vec2 vUv;
  varying float vIntensity;

  void main() {
    vUv = uv;

    // The halo answers to attention more strongly than the glass does, which
    // is what makes hover register from across the structure — but only within
    // a bounded range. The halo is additive and unattenuated, so an attended
    // orb seen from close up is otherwise bright enough to bloom across the
    // entire frame and bury the subject it was meant to pick out.
    vIntensity = (0.3 + aComplexity * 0.5) * (0.3 + aEmphasis * 0.65) * aPresence;

    // Instance translation and scale, orientation discarded: the quad is
    // rebuilt facing the camera in view space.
    vec3 center = vec3(instanceMatrix[3]);
    float scale = length(vec3(instanceMatrix[0]));

    vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
    mvCenter.xy += position.xy * scale;

    gl_Position = projectionMatrix * mvCenter;
  }
`;

export const HALO_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;
  varying float vIntensity;

  void main() {
    float dist = length(vUv - 0.5) * 2.0;

    // Must reach zero well inside the quad, or the halo reveals itself as a
    // square — the fastest way to make a glow look cheap.
    float falloff = 1.0 - smoothstep(0.0, 0.9, dist);
    falloff = falloff * falloff * falloff;

    if (falloff < 0.002) discard;
    gl_FragColor = vec4(uColor, falloff * uOpacity * vIntensity);
  }
`;
