// ============================================================
// native_audio.cpp — JNI bridge between Java/Kotlin and the C
// audio mixer. Loaded by NativeAudioBridge.java at startup.
//
// The mixer is a singleton per game session. It is *intentionally*
// simple: it does not try to replace Web Audio. Instead, it provides
//   1. A fast, hardware-accelerated ducking volume calculator
//      (used by JS every frame to set the Web Audio GainNode).
//   2. A fast 2D distance function (used by JS collision checks).
//   3. A fallback PCM gain node for environments without Web Audio.
//
// The ARM-optimized routines in fast_math.h are used here so the
// hot path stays in native code instead of bouncing through JNI.
// ============================================================
#include <jni.h>
#include <string>
#include <android/log.h>
#include "audio_mixer.h"

#define TAG "samacaogiac-native"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN,  TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

namespace {
    audio_mixer_t g_mixer;
    bool g_initialized = false;

    void ensure_init() {
        if (!g_initialized) {
            audio_mixer_init(&g_mixer, 0.03f);
            g_initialized = true;
            LOGI("native audio mixer initialized (base_vol=%.3f)", g_mixer.engine_base_vol);
        }
    }
}

extern "C" {

// ---- Lifecycle ----
JNIEXPORT void JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeInit(JNIEnv* env, jobject thiz) {
    ensure_init();
}

// ---- Ducking control ----
JNIEXPORT void JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeSetMusicPlaying(JNIEnv* env, jobject thiz, jboolean playing) {
    ensure_init();
    audio_mixer_set_music_playing(&g_mixer, playing ? 1 : 0);
}

JNIEXPORT jfloat JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeTickDucking(JNIEnv* env, jobject thiz) {
    ensure_init();
    return audio_mixer_tick(&g_mixer);
}

JNIEXPORT jfloat JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeCalcDuckVol(JNIEnv* env, jobject thiz) {
    ensure_init();
    return audio_mixer_calc_duck_vol(&g_mixer);
}

JNIEXPORT jfloat JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeGetEngineVolume(JNIEnv* env, jobject thiz) {
    ensure_init();
    return g_mixer.current_engine_vol;
}

JNIEXPORT void JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeSetBaseVolume(JNIEnv* env, jobject thiz, jfloat v) {
    ensure_init();
    g_mixer.engine_base_vol = v > 0.0f ? v : 0.03f;
}

JNIEXPORT void JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeSetDuckFactor(JNIEnv* env, jobject thiz, jfloat f) {
    ensure_init();
    g_mixer.music_duck_factor = clampf(f, 0.0f, 1.0f);
}

// ---- Fast math (exposed to JS via JS bridge) ----
JNIEXPORT jfloat JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeDistance2D(JNIEnv* env, jobject thiz, jfloat dx, jfloat dz) {
    return fast_distance_2d(dx, dz);
}

JNIEXPORT jfloat JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeSqrt(JNIEnv* env, jobject thiz, jfloat x) {
    return fast_sqrt(x);
}

JNIEXPORT jfloat JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeInvSqrt(JNIEnv* env, jobject thiz, jfloat x) {
    return fast_inv_sqrt(x);
}

// ---- Fallback PCM gain (for environments without Web Audio) ----
JNIEXPORT void JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeApplyGainS16(JNIEnv* env, jobject thiz,
                                                                  jshortArray buf_) {
    ensure_init();
    jsize n = env->GetArrayLength(buf_);
    if (n <= 0) return;
    jshort* buf = env->GetShortArrayElements(buf_, nullptr);
    if (!buf) return;
    audio_mixer_apply_gain_s16(&g_mixer, reinterpret_cast<int16_t*>(buf), (size_t)n);
    env->ReleaseShortArrayElements(buf_, buf, 0);
}

// ---- Build info (for diagnostics) ----
JNIEXPORT jstring JNICALL
Java_com_samacaogiac_game_NativeAudioBridge_nativeBuildInfo(JNIEnv* env, jobject thiz) {
    std::string info = "samacaogiac native audio v0.6 | arm-optimized | built " __DATE__ " " __TIME__;
    return env->NewStringUTF(info.c_str());
}

}  // extern "C"
