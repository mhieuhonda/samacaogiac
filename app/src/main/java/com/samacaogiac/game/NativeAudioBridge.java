package com.samacaogiac.game;

import android.util.Log;

/**
 * Native audio bridge — loads libsamacaogiac_audio.so and exposes
 * its JNI methods to the rest of the app and to the WebView JS layer.
 *
 * The native library provides:
 *   - Hardware-accelerated 2D distance calculation (ARM vsqrt.f32).
 *   - One-pole-low-pass gain ramping for engine-volume ducking.
 *   - A fallback PCM gain node for environments without Web Audio.
 *
 * Thread-safety: the native side is single-instance and guarded by
 * the JNI thread attached state. The methods below are safe to call
 * from the JS thread (which is the WebView's JavaBridge thread).
 */
public final class NativeAudioBridge {
    private static final String TAG = "NativeAudioBridge";
    private static final String LIB_NAME = "samacaogiac_audio";
    private static volatile boolean loaded = false;

    private NativeAudioBridge() {}

    /** Load the native library. Safe to call multiple times. */
    public static void ensureLoaded() {
        if (loaded) return;
        synchronized (NativeAudioBridge.class) {
            if (loaded) return;
            try {
                System.loadLibrary(LIB_NAME);
                nativeInit();
                loaded = true;
                Log.i(TAG, "Native library loaded: " + nativeBuildInfo());
            } catch (UnsatisfiedLinkError | SecurityException e) {
                Log.w(TAG, "Native library not available, falling back to pure-JS audio: " + e.getMessage());
                loaded = false;
            }
        }
    }

    public static boolean isLoaded() { return loaded; }

    // ----- Native methods -----
    public static native void   nativeInit();
    public static native void   nativeSetMusicPlaying(boolean playing);
    public static native float  nativeTickDucking();
    public static native float  nativeCalcDuckVol();
    public static native float  nativeGetEngineVolume();
    public static native void   nativeSetBaseVolume(float v);
    public static native void   nativeSetDuckFactor(float f);
    public static native float  nativeDistance2D(float dx, float dz);
    public static native float  nativeSqrt(float x);
    public static native float  nativeInvSqrt(float x);
    public static native void   nativeApplyGainS16(short[] buf);
    public static native String nativeBuildInfo();
}
