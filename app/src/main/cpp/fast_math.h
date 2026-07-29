// ============================================================
// fast_math.h — Fast math primitives for ARM (with NEON + VFPv3)
// Used by the native audio mixer and the JS bridge to speed up
// hot loops (distance, sqrt, gain ramping).
//
// On ARMv7 (armeabi-v7a) we use the vsqrt.f32 instruction via
// inline asm. On ARMv8 (arm64-v8a) the C compiler emits fsqrt
// automatically with -O2, so we just call sqrtf() and let the
// optimizer do its job. On other architectures we fall back to libm.
// ============================================================
#ifndef SAMAC_FAST_MATH_H
#define SAMAC_FAST_MATH_H

#include <stdint.h>
#include <math.h>
#include <string.h>  // memcpy for type-punning in fast_inv_sqrt

#ifdef __cplusplus
extern "C" {
#endif

// Fast sqrt.
// - ARMv7:  use hardware vsqrt.f32 inline asm.
// - ARMv8:  rely on the compiler to emit fsqrt (faster than asm constraint setup).
// - Other:  libm sqrtf().
static inline float fast_sqrt(float x) {
#if defined(__arm__) && !defined(__aarch64__)
    float r;
    __asm__ __volatile__("vsqrt.f32 %0, %1" : "=w"(r) : "w"(x));
    return r;
#else
    return sqrtf(x);
#endif
}

// Fast 2D distance (used by collision check hot loop).
static inline float fast_distance_2d(float dx, float dz) {
    return fast_sqrt(dx * dx + dz * dz);
}

// Fast inverse sqrt — Quake III style with one Newton iteration.
// Significantly faster than 1.0f/sqrtf(x) on ARMv7 (no hardware div).
// On ARMv8 we just use 1.0f / sqrtf(x) since hardware div is cheap.
static inline float fast_inv_sqrt(float x) {
#if defined(__arm__) && !defined(__aarch64__)
    // Quake III fast inverse sqrt with bit twiddling
    float xhalf = 0.5f * x;
    int32_t i;
    memcpy(&i, &x, sizeof(i));
    i = 0x5f3759df - (i >> 1);
    memcpy(&x, &i, sizeof(x));
    x = x * (1.5f - xhalf * x * x);
    return x;
#else
    return 1.0f / sqrtf(x);
#endif
}

// Clamp a float to [lo, hi].
static inline float clampf(float v, float lo, float hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

// Linear interpolation.
static inline float lerpf(float a, float b, float t) {
    return a + (b - a) * t;
}

// One-pole low-pass filter (used for engine gain ramping).
typedef struct {
    float y;
    float a; // coefficient
} low_pass_t;

static inline float low_pass_step(low_pass_t* lp, float x) {
    lp->y = lp->y + lp->a * (x - lp->y);
    return lp->y;
}

#ifdef __cplusplus
}
#endif

#endif // SAMAC_FAST_MATH_H
