package com.samacaogiac.game

import android.content.Context
import android.util.Log
import org.luaj.vm2.Globals
import org.luaj.vm2.LuaValue
import org.luaj.vm2.lib.jse.JsePlatform
import org.luaj.vm2.lib.OneArgFunction

/**
 * LuaScriptRunner — runs game-event Lua scripts from assets/lua/.
 *
 * Why Lua?
 *  - Game designers can tweak game balance (achievement thresholds, troll
 *    frequencies, item drops) without touching the JS engine or recompiling
 *    the APK. Just edit the .lua files in assets/lua/.
 *  - Lua is sandboxed: it cannot touch the Android API, only the values
 *    we explicitly inject via the [Globals] table.
 *
 * Implementation: LuaJ 3.0.1 (pure Java Lua 5.1 VM). ~250KB jar.
 *
 * Available globals inside the Lua sandbox:
 *   game.dist_km       (float)  current distance in km
 *   game.speed_kmh     (float)  current speed in km/h
 *   game.deaths        (int)    total deaths this session
 *   game.best_km       (float)  best distance ever
 *   game.troll_level   (int)    0=off, 1=normal, 2=chaos
 *
 *   log.info(msg)               prints to logcat
 *   log.warn(msg)
 *   log.error(msg)
 *   engine.setDuckFactor(f)     updates the native ducking factor
 *   engine.setBaseVolume(v)     updates the native engine base volume
 */
object LuaScriptRunner {
    private const val TAG = "LuaScript"
    private const val LUA_DIR = "lua"

    private var globals: Globals? = null
    private var ctxRef: Context? = null
    @Volatile private var initialized = false

    @Synchronized
    @JvmStatic
    fun init(ctx: Context) {
        if (initialized) return
        ctxRef = ctx.applicationContext
        try {
            val g = JsePlatform.standardGlobals()

            // Inject `game` table
            val game = LuaValue.tableOf()
            game.set("dist_km", LuaValue.valueOf(0.0))
            game.set("speed_kmh", LuaValue.valueOf(0.0))
            game.set("deaths", LuaValue.valueOf(0))
            game.set("best_km", LuaValue.valueOf(0.0))
            game.set("troll_level", LuaValue.valueOf(1))
            g.set("game", game)

            // Inject `log` table — LuaJ functions are objects, not lambdas.
            val log = LuaValue.tableOf()
            log.set("info", object : OneArgFunction() {
                override fun call(arg: LuaValue): LuaValue {
                    Log.i(TAG, "[lua] " + arg.tojstring()); return LuaValue.NIL
                }
            })
            log.set("warn", object : OneArgFunction() {
                override fun call(arg: LuaValue): LuaValue {
                    Log.w(TAG, "[lua] " + arg.tojstring()); return LuaValue.NIL
                }
            })
            log.set("error", object : OneArgFunction() {
                override fun call(arg: LuaValue): LuaValue {
                    Log.e(TAG, "[lua] " + arg.tojstring()); return LuaValue.NIL
                }
            })
            g.set("log", log)

            // Inject `engine` table (delegates to NativeAudioBridge)
            val engine = LuaValue.tableOf()
            engine.set("setDuckFactor", object : OneArgFunction() {
                override fun call(arg: LuaValue): LuaValue {
                    val f = arg.tofloat()
                    if (NativeAudioBridge.isLoaded()) NativeAudioBridge.nativeSetDuckFactor(f)
                    return LuaValue.NIL
                }
            })
            engine.set("setBaseVolume", object : OneArgFunction() {
                override fun call(arg: LuaValue): LuaValue {
                    val v = arg.tofloat()
                    if (NativeAudioBridge.isLoaded()) NativeAudioBridge.nativeSetBaseVolume(v)
                    return LuaValue.NIL
                }
            })
            g.set("engine", engine)

            // Run the bootstrap script (config.lua) if present
            runAsset(g, "$LUA_DIR/config.lua")
            globals = g
            initialized = true
            Log.i(TAG, "Lua VM initialized (LuaJ ${g.get("_VERSION").tojstring()})")
        } catch (e: Throwable) {
            Log.w(TAG, "Lua VM not available: ${e.message}")
            initialized = false
        }
    }

    /** Update the `game` table before invoking an event script. */
    @JvmStatic
    fun updateGameState(distKm: Float, speedKmh: Float, deaths: Int,
                        bestKm: Float, trollLevel: Int) {
        val g = globals ?: return
        val game = g.get("game")
        if (game.isnil()) return
        game.set("dist_km", LuaValue.valueOf(distKm.toDouble()))
        game.set("speed_kmh", LuaValue.valueOf(speedKmh.toDouble()))
        game.set("deaths", LuaValue.valueOf(deaths))
        game.set("best_km", LuaValue.valueOf(bestKm.toDouble()))
        game.set("troll_level", LuaValue.valueOf(trollLevel))
    }

    /** Run a Lua script from assets/lua/<name>.lua */
    @JvmStatic
    fun runEvent(name: String) {
        val g = globals ?: return
        runAsset(g, "$LUA_DIR/$name.lua")
    }

    private fun runAsset(g: Globals, path: String) {
        val ctx = ctxRef ?: return
        try {
            ctx.assets.open(path).use { input ->
                val src = input.bufferedReader().readText()
                g.load(src, path).call()
            }
        } catch (e: java.io.FileNotFoundException) {
            // Missing file is fine (event not implemented).
        } catch (e: Exception) {
            Log.w(TAG, "Lua script $path failed: ${e.message}")
        }
    }

    @JvmStatic
    fun isAvailable(): Boolean = initialized
}
