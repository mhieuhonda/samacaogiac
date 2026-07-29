// ============================================================
// fast_math.h — Fast math primitives for ARM (with NEON + VFPv3)
// Used by the native audio mixer and the JS bridge to speed up
// hot loops (distance, sqrt, gain ramping).
//
// On ARMv7+ we use the vsqrt.f32 instruction via inline asm.
// On other architectures we fall back to libm sqrtf().
// ============================================================
#ifndef SAMAC_FAST_MATH_H
#define SAMAC_FAST_MATH_H

#include <stdint.h>
#include <math.h>

#ifdef __cplusplus
extern "C" {
#endif

// Fast inverse sqrt (Quake III style, refined with one Newton step).
// Approximately 3-4x faster than 1.0f/sqrtf(x) on ARM Cortex-A series.
static inline float fast_inv_sqrt(float x) {
#if defined(__arm__) || defined(__aarch64__)
    float xhalf = 0.5f * x;
    int32_t i;
    __asm__ __volatile__(
        "vmov    s15, %[val]\n"
        "vcvtm.s32.f32 s15, s15\n"
        "vmov    %[out], s15\n"
        : [out] "=r" (i)
        : [val] "r" (x)
        : "s15"
    );
    // Magic constant for float (Quake III)
    i = 0x5f3759df - (i >> 1);
    __asm__ __volatile__(
        "vmov    s15, %[val]\n"
        "vcvt.f32.s32 s15, s15\n"
        "vmov    %[out], s15\n"
        : [out] "=r" (x)
        : [val] "r" (i)
        : "s15"
    );
    x = x * (1.5f - xhalf * x * x);
    return x;
#else
    return 1.0f / sqrtf(x);
#endif
}

// Fast sqrt — uses hardware vsqrt.f32 on ARM if available, else libm.
static inline float fast_sqrt(float x) {
#if defined(__arm__) || defined(__aarch64__)
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
