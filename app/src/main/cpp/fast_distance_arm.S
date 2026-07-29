// ============================================================
// fast_distance_arm.S — ARMv7-A assembly implementation of a
// branch-free 2D distance function using the hardware vsqrt.f32
// instruction.
//
// This file is compiled ONLY when targeting armeabi-v7a. On
// arm64-v8a the inline asm in fast_math.h is used instead, so
// this file is excluded from the arm64 build via CMake.
//
// Equivalent C:
//   float fast_distance_2d_arm(float dx, float dz) {
//       return __builtin_sqrtf(dx*dx + dz*dz);
//   }
// ============================================================
    .syntax unified
    .arch armv7-a
    .fpu vfpv3-d16
    .text
    .thumb
    .align 2

    .global fast_distance_2d_arm
    .type   fast_distance_2d_arm, %function

// float fast_distance_2d_arm(float dx, float dz)
//   s0 = dx (input)
//   s1 = dz (input)
//   s0 = result (output)
fast_distance_2d_arm:
    vmul.f32    s2, s0, s0      @ s2 = dx*dx
    vfma.f32    s2, s1, s1      @ s2 = dx*dx + dz*dz  (fused multiply-add)
    vsqrt.f32   s0, s2          @ s0 = sqrt(s2)
    bx          lr

    .size   fast_distance_2d_arm, .-fast_distance_2d_arm
