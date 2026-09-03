/**
 * The motes of light that hang around a person who has come away with
 * something.
 *
 * Two things make a sparkle rather than a dot. The first is that it does not
 * twinkle on a timer: each carries its own rate and its own phase, so no two
 * catch at the same moment and the field never pulses as one. The second is the
 * cross flare — a bright point in a dark frame throws a star, and without it
 * these read as a scattering of round pixels rather than as light.
 *
 * Brightness is carried per point rather than per material, so a sparkle can be
 * out entirely while its neighbour is at full without either needing a draw
 * call of its own.
 */

export const SPARKLE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  /**
   * How much the field is still catching the light: 1 twinkles, 0 holds steady.
   *
   * A blend rather than a switch, so the motes can be brought to rest over a
   * second instead of stopping between one frame and the next.
   */
  uniform float uTwinkling;
  uniform float uSteady;

  /** x: own rate, y: own phase, z: how lit this person is, w: spare. */
  attribute vec4 aSpark;

  varying float vTwinkle;
  varying float vLit;

  void main() {
    vLit = aSpark.z;

    // Its own rate and its own phase. Sixteen people's worth catching together
    // would read as a strobe rather than as scattered light.
    float t = sin(uTime * aSpark.x + aSpark.y * 6.2831853);
    // Sharpened, so a sparkle is mostly dark and briefly bright — the shape of
    // a catch of light rather than a sine fading up and down.
    //
    // Which is the right shape for scattered light and the wrong one for a
    // steady glow: sharpened this hard, a mote is off far more of the time than
    // it is on, and a field of them reads as flickering. Where the vessels are
    // asked to hold still, each mote settles on one brightness and keeps it.
    vTwinkle = mix(uSteady, pow(max(0.0, t), 4.0), uTwinkling);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (0.35 + vTwinkle) * aSpark.z * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const SPARKLE_FRAG = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform vec3 uCore;
  uniform float uOpacity;

  varying float vTwinkle;
  varying float vLit;

  void main() {
    if (vTwinkle < 0.01 || vLit < 0.01) discard;

    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    if (r > 1.0) discard;

    // A hot centre, a soft surround, and the cross flare a bright point throws
    // in a dark frame. The flare is the part that reads as a sparkle.
    float core = 1.0 - smoothstep(0.0, 0.3, r);
    float glow = 1.0 - smoothstep(0.0, 1.0, r);
    float flare = max(1.0 - abs(d.x) * 14.0, 1.0 - abs(d.y) * 14.0);
    flare = clamp(flare, 0.0, 1.0) * glow;

    vec3 colour = mix(uColor, uCore, core);
    float alpha = (core + glow * 0.45 + flare * 0.7) * vTwinkle * vLit * uOpacity;

    gl_FragColor = vec4(colour, clamp(alpha, 0.0, 1.0));
  }
`;
