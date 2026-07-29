// ============================================================
// audio_mixer.h — Native audio mixer for engine-ducking.
//
// When background music plays, the engine sound is attenuated
// (ducked) by a configurable amount. This module performs:
//   * gain ramping (one-pole LP) to avoid clicks
//   * buffer mixing (when running in fallback mode)
//   * exposure to JS via JNI through NativeAudioBridge.java
//
// All math uses fast_math.h to keep the inner loop branch-free
// and to use the hardware vsqrt.f32 on ARM.
// ============================================================
#ifndef SAMAC_AUDIO_MIXER_H
#define SAMAC_AUDIO_MIXER_H

#include <stdint.h>
#include <stddef.h>
#include "fast_math.h"

#ifdef __cplusplus
extern "C" {
#endif

// State of the ducking engine. One instance per game session.
typedef struct {
    float   engine_base_vol;   // nominal engine volume (e.g. 0.03)
    float   music_duck_factor; // 0.0..1.0, multiplier when music plays
    float   current_engine_vol;
    int     music_playing;     // 0 or 1
    low_pass_t vol_smoother;   // smooths gain changes
    uint64_t frames_processed;
} audio_mixer_t;

// Initialize a mixer with default ducking (engine drops to 15%).
void audio_mixer_init(audio_mixer_t* m, float engine_base_vol);

// Set whether music is currently playing. Triggers a smooth ramp
// to the new target volume over the next few frames.
void audio_mixer_set_music_playing(audio_mixer_t* m, int playing);

// Update the engine volume target. Called every frame from JS.
// Returns the smoothed volume that JS should apply to the Web Audio
// GainNode.
float audio_mixer_tick(audio_mixer_t* m);

// Mix a 16-bit PCM buffer in-place with a constant gain.
// Used by the fallback path when Web Audio is unavailable.
void audio_mixer_apply_gain_s16(audio_mixer_t* m,
                                 int16_t* buf,
                                 size_t samples);

// Compute a fast 2D collision distance (used by JS via JNI).
float audio_mixer_distance_2d(float dx, float dz);

// Calculate the ducking volume for a given frame.
// Exposed to JS via NativeAudioBridge.nativeCalculateDuckingVolume.
float audio_mixer_calc_duck_vol(audio_mixer_t* m);

#ifdef __cplusplus
}
#endif

#endif // SAMAC_AUDIO_MIXER_H
