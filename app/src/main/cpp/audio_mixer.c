// ============================================================
// audio_mixer.c — Implementation of the native audio mixer.
// Pure C (no C++ runtime dependency) for minimal binary size.
// ============================================================
#include "audio_mixer.h"

void audio_mixer_init(audio_mixer_t* m, float engine_base_vol) {
    m->engine_base_vol     = engine_base_vol > 0.0f ? engine_base_vol : 0.03f;
    m->music_duck_factor   = 0.15f;   // engine drops to 15% when music plays
    m->current_engine_vol  = 0.0f;
    m->music_playing       = 0;
    m->vol_smoother.y      = 0.0f;
    m->vol_smoother.a      = 0.08f;   // ~12 frame time-constant at 60fps
    m->frames_processed    = 0;
}

void audio_mixer_set_music_playing(audio_mixer_t* m, int playing) {
    m->music_playing = playing ? 1 : 0;
}

float audio_mixer_calc_duck_vol(audio_mixer_t* m) {
    float target = m->music_playing
        ? m->engine_base_vol * m->music_duck_factor
        : m->engine_base_vol;
    return target;
}

float audio_mixer_tick(audio_mixer_t* m) {
    float target = audio_mixer_calc_duck_vol(m);
    float v = low_pass_step(&m->vol_smoother, target);
    m->current_engine_vol = v;
    m->frames_processed++;
    return v;
}

void audio_mixer_apply_gain_s16(audio_mixer_t* m,
                                 int16_t* buf,
                                 size_t samples) {
    // We compute a per-frame gain from the smoother and apply it.
    // Stereo interleaved: 2 samples = 1 frame.
    const float gain = audio_mixer_tick(m);
    const int g_int = (int)(gain * 65536.0f); // 16.16 fixed point
    for (size_t i = 0; i < samples; i++) {
        int s = buf[i];
        s = (s * g_int) >> 16;
        if (s > 32767)  s = 32767;
        if (s < -32768) s = -32768;
        buf[i] = (int16_t)s;
    }
}

float audio_mixer_distance_2d(float dx, float dz) {
    return fast_distance_2d(dx, dz);
}
