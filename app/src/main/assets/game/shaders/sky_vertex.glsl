// ============================================================
// sky_vertex.glsl — Vertex shader for the gradient sky dome.
//
// Passes the world-space Y to the fragment shader so we can
// render a smooth vertical gradient without baking it into a
// texture (saves a texture upload and a Canvas allocation).
// ============================================================
precision mediump float;

attribute vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

varying float vHeight;

void main() {
    vHeight = normalize(position).y * 0.5 + 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
