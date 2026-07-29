// ============================================================
// sandstorm.glsl — Sandstorm overlay fragment shader.
//
// Renders a procedural sandstorm with swirling noise patterns.
// Used as a fullscreen overlay when a sandstorm troll event
// triggers, fading in/out smoothly.
//
// Uniforms:
//   uTime     (float) elapsed time in seconds
//   uOpacity  (float) 0..1, overall opacity
//   uTint     (vec3)  sand color (default #D2B48C)
// ============================================================
precision mediump float;

varying vec2 vUv;

uniform float uTime;
uniform float uOpacity;
uniform vec3  uTint;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = vUv;

    // Swirl: rotate UVs based on time and position
    float ang = uTime * 0.5 + uv.y * 3.0;
    float c = cos(ang), s = sin(ang);
    mat2 rot = mat2(c, -s, s, c);
    vec2 suv = rot * (uv - 0.5) + 0.5;

    // Animated noise
    float n = fbm(suv * 4.0 + vec2(uTime * 0.8, uTime * 0.5));
    n = pow(n, 1.4);

    // Streaks: horizontal motion-blur look
    float streaks = sin(uv.x * 80.0 + n * 10.0 + uTime * 4.0) * 0.5 + 0.5;
    streaks = pow(streaks, 4.0) * 0.3;

    vec3 col = uTint * (n * 0.8 + 0.2) + streaks * uTint;
    float alpha = uOpacity * (n * 0.7 + streaks);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
}
