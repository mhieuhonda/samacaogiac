// ============================================================
// heat_haze.glsl — Vertex-displacement heat haze shader.
//
// Displaces vertices upward by a small sin wave so distant
// objects appear to shimmer. Combined with the mirage fragment
// shader for the full desert-illusion effect.
//
// Uniforms:
//   uTime   (float) elapsed time in seconds
//   uAmount (float) displacement strength (try 0.02..0.05)
// ============================================================
precision mediump float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uAmount;

varying vec2 vUv;
varying float vDist;

void main() {
    vUv = uv;

    // Displacement decreases with distance from camera
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDist = -mv.z;

    float falloff = clamp(40.0 / max(vDist, 1.0), 0.0, 1.0);
    float wave = sin(position.x * 4.0 + uTime * 3.0) * 0.5
               + sin(position.z * 3.0 + uTime * 2.3) * 0.5;
    vec3 displaced = position + vec3(0.0, wave * uAmount * falloff, 0.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
