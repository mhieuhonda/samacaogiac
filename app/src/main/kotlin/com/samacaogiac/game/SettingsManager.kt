package com.samacaogiac.game

import android.content.Context
import android.content.SharedPreferences
import android.util.Log

/**
 * SettingsManager — persists user preferences (best distance, sound on/off,
 * music track URI, control scheme, etc.) using SharedPreferences.
 *
 * Written in Kotlin for concise property access. The Java side accesses these
 * via the [get] / [set] static helpers (annotated with @JvmStatic so Java
 * sees them as true static methods, not INSTANCE.method()).
 *
 * Keys are versioned so we can migrate settings between releases.
 */
object SettingsManager {
    private const val TAG = "Settings"
    private const val PREFS_NAME = "samacaogiac_prefs_v1"

    private const val KEY_BEST_DIST      = "best_dist_meters"
    private const val KEY_TOTAL_DEATHS   = "total_deaths"
    private const val KEY_TOTAL_RUNS     = "total_runs"
    private const val KEY_TOTAL_KM       = "total_km"
    private const val KEY_SOUND_ENABLED  = "sound_enabled"
    private const val KEY_MUSIC_URI      = "music_uri"
    private const val KEY_MUSIC_NAME     = "music_name"
    private const val KEY_MUSIC_DUCK     = "music_duck_factor"
    private const val KEY_CONTROL_SCHEME = "control_scheme" // 0 = buttons, 1 = tilt, 2 = auto
    private const val KEY_QUALITY        = "quality"        // 0 = low, 1 = auto, 2 = high
    private const val KEY_TROLL_SEED     = "troll_seed"
    private const val KEY_TROLL_LEVEL    = "troll_level"    // 0 = off, 1 = normal, 2 = chaos

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // ----- Best distance -----
    @JvmStatic
    fun setBestDistance(ctx: Context, meters: Float) {
        val cur = getBestDistance(ctx)
        if (meters > cur) {
            prefs(ctx).edit().putFloat(KEY_BEST_DIST, meters).apply()
        }
    }
    @JvmStatic
    fun getBestDistance(ctx: Context): Float =
        prefs(ctx).getFloat(KEY_BEST_DIST, 0f)

    // ----- Lifetime stats -----
    @JvmStatic
    fun incrementDeath(ctx: Context) {
        val p = prefs(ctx)
        p.edit().putInt(KEY_TOTAL_DEATHS, p.getInt(KEY_TOTAL_DEATHS, 0) + 1).apply()
    }
    @JvmStatic
    fun getTotalDeaths(ctx: Context): Int = prefs(ctx).getInt(KEY_TOTAL_DEATHS, 0)

    @JvmStatic
    fun incrementRun(ctx: Context) {
        val p = prefs(ctx)
        p.edit().putInt(KEY_TOTAL_RUNS, p.getInt(KEY_TOTAL_RUNS, 0) + 1).apply()
    }
    @JvmStatic
    fun getTotalRuns(ctx: Context): Int = prefs(ctx).getInt(KEY_TOTAL_RUNS, 0)

    @JvmStatic
    fun addDistance(ctx: Context, km: Float) {
        val p = prefs(ctx)
        p.edit().putFloat(KEY_TOTAL_KM, p.getFloat(KEY_TOTAL_KM, 0f) + km).apply()
    }
    @JvmStatic
    fun getTotalKm(ctx: Context): Float = prefs(ctx).getFloat(KEY_TOTAL_KM, 0f)

    // ----- Sound -----
    @JvmStatic
    fun setSoundEnabled(ctx: Context, on: Boolean) =
        prefs(ctx).edit().putBoolean(KEY_SOUND_ENABLED, on).apply()
    @JvmStatic
    fun isSoundEnabled(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_SOUND_ENABLED, true)

    // ----- Music -----
    @JvmStatic
    fun setMusicUri(ctx: Context, uri: String?, name: String?) {
        prefs(ctx).edit()
            .putString(KEY_MUSIC_URI, uri)
            .putString(KEY_MUSIC_NAME, name)
            .apply()
    }
    @JvmStatic
    fun getMusicUri(ctx: Context): String? = prefs(ctx).getString(KEY_MUSIC_URI, null)
    @JvmStatic
    fun getMusicName(ctx: Context): String? = prefs(ctx).getString(KEY_MUSIC_NAME, null)

    @JvmStatic
    fun setMusicDuckFactor(ctx: Context, factor: Float) {
        // Clamp to [0.05, 1.0] — never fully kill the engine sound
        val clamped = factor.coerceIn(0.05f, 1.0f)
        prefs(ctx).edit().putFloat(KEY_MUSIC_DUCK, clamped).apply()
        // Update the native mixer
        if (NativeAudioBridge.isLoaded()) {
            NativeAudioBridge.nativeSetDuckFactor(clamped)
        }
    }
    @JvmStatic
    fun getMusicDuckFactor(ctx: Context): Float =
        prefs(ctx).getFloat(KEY_MUSIC_DUCK, 0.15f)

    // ----- Controls -----
    @JvmStatic
    fun setControlScheme(ctx: Context, scheme: Int) =
        prefs(ctx).edit().putInt(KEY_CONTROL_SCHEME, scheme.coerceIn(0, 2)).apply()
    @JvmStatic
    fun getControlScheme(ctx: Context): Int =
        prefs(ctx).getInt(KEY_CONTROL_SCHEME, 0)

    // ----- Quality -----
    @JvmStatic
    fun setQuality(ctx: Context, q: Int) =
        prefs(ctx).edit().putInt(KEY_QUALITY, q.coerceIn(0, 2)).apply()
    @JvmStatic
    fun getQuality(ctx: Context): Int =
        prefs(ctx).getInt(KEY_QUALITY, 1)

    // ----- Troll level -----
    @JvmStatic
    fun setTrollLevel(ctx: Context, level: Int) =
        prefs(ctx).edit().putInt(KEY_TROLL_LEVEL, level.coerceIn(0, 2)).apply()
    @JvmStatic
    fun getTrollLevel(ctx: Context): Int =
        prefs(ctx).getInt(KEY_TROLL_LEVEL, 1)

    @JvmStatic
    fun setTrollSeed(ctx: Context, seed: Long) =
        prefs(ctx).edit().putLong(KEY_TROLL_SEED, seed).apply()
    @JvmStatic
    fun getTrollSeed(ctx: Context): Long =
        prefs(ctx).getLong(KEY_TROLL_SEED, 0L)

    /** Dump all settings to logcat for debugging. */
    @JvmStatic
    fun dump(ctx: Context) {
        val p = prefs(ctx)
        Log.i(TAG, "Settings dump: best=${p.getFloat(KEY_BEST_DIST,0f)}m " +
            "deaths=${p.getInt(KEY_TOTAL_DEATHS,0)} " +
            "runs=${p.getInt(KEY_TOTAL_RUNS,0)} " +
            "totalKm=${p.getFloat(KEY_TOTAL_KM,0f)} " +
            "sound=${p.getBoolean(KEY_SOUND_ENABLED,true)} " +
            "music=${p.getString(KEY_MUSIC_URI,null)} " +
            "duck=${p.getFloat(KEY_MUSIC_DUCK,0.15f)} " +
            "controls=${p.getInt(KEY_CONTROL_SCHEME,0)} " +
            "quality=${p.getInt(KEY_QUALITY,1)} " +
            "trollLvl=${p.getInt(KEY_TROLL_LEVEL,1)}")
    }
}
