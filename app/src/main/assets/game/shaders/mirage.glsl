// ============================================================
// mirage.glsl — Procedural desert mirage fragment shader.
//
// Renders a horizontal heat-haze band near the horizon that
// distorts the background and shifts colors toward blue/cyan,
// mimicking the "lake in the distance" optical illusion common
// in deserts.
//
// Used by Three.js as a ShaderMaterial on a fullscreen quad
// positioned just above the horizon line.
//
// Uniforms:
//   uTime      (float)  elapsed time in seconds
//   uIntensity (float)  0..1, scales the distortion amount
//   uHorizon   (float)  screen-space Y of the horizon (0..1)
//   uTint      (vec3)   tint color of the mirage (default cyan)
// ============================================================
precision mediump float;

varying vec2 vUv;

uniform float uTime;
uniform float uIntensity;
uniform float uHorizon;
uniform vec3  uTint;
uniform sampler2D uBackground;

// 1D hash for noise
float hash(float n) { return fract(sin(n) * 43758.5453123); }

float noise1(float x) {
    float i = floor(x);
    float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), u);
}

void main() {
    vec2 uv = vUv;

    // Distance from the horizon line, in screen space
    float d = uv.y - uHorizon;
    float ad = abs(d);

    // Distortion strength: maximum near horizon, fades out within 0.15
    float strength = exp(-ad * 12.0) * uIntensity;
    // Flicker: only below the horizon line (where the "lake" appears)
    if (d < 0.0) strength *= 1.4;

    // Time-varying horizontal wobble
    float wobble = (noise1(uv.x * 30.0 + uTime * 2.0) - 0.5) * 0.02 * strength;
    float wobble2 = (noise1(uv.x * 60.0 - uTime * 3.0) - 0.5) * 0.01 * strength;

    vec2 sampleUv = vec2(uv.x + wobble + wobble2, uv.y + wobble * 0.5);

    vec3 bg = texture2D(uBackground, sampleUv).rgb;

    // Add the cyan tint proportional to strength
    vec3 mirage = mix(bg, uTint, strength * 0.6);

    // Slight vertical compression near horizon (reflection-like)
    float reflectFactor = smoothstep(0.15, 0.0, ad) * (d < 0.0 ? 1.0 : 0.0);
    mirage = mix(mirage, mirage.gbr, reflectFactor * 0.2);

    gl_FragColor = vec4(mirage, 1.0);
}
