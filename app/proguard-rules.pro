# ============================================================
# ProGuard / R8 rules — Sa Mạc Ảo Giác v0.6
# ============================================================

# ── WebView JavaScript Bridge ──
# Keep all @JavascriptInterface annotated methods (required by WebView).
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep the game's JS interface class (ProGuard may strip it).
-keep class com.samacaogiac.game.GameActivity$GameJSInterface { *; }
-keep class com.samacaogiac.game.GameActivity$* { *; }

# ── Native Bridge ──
# Native methods are called from C++ via JNI — must keep their names.
-keep class com.samacaogiac.game.NativeAudioBridge {
    native <methods>;
    public static *;
}

# ── LuaJ (v0.6) ──
# LuaJ uses reflection to expose Lua closures to Java. Without these
# rules, R8 strips the bridge classes and Lua scripts fail silently.
-keep class org.luaj.** { *; }
-keepclassmembers class org.luaj.** { *; }
-dontwarn org.luaj.**

# ── Kotlin metadata ──
# Keep Kotlin metadata so reflection-based libraries still work.
-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.Metadata { *; }

# ── MusicPickerActivity / SettingsManager (Kotlin) ──
-keep class com.samacaogiac.game.MusicPickerActivity { *; }
-keep class com.samacaogiac.game.MusicPickerActivity$* { *; }
-keep class com.samacaogiac.game.SettingsManager { *; }
-keep class com.samacaogiac.game.SettingsManager$* { *; }
-keep class com.samacaogiac.game.LuaScriptRunner { *; }
-keep class com.samacaogiac.game.LuaScriptRunner$* { *; }

# ── MusicPlayerService (Java) ──
-keep class com.samacaogiac.game.MusicPlayerService { *; }

# ── WebView / WebSettings ──
-dontwarn android.webkit.WebView
-dontwarn android.webkit.WebSettings

# ── Three.js assets (loaded via WebView, not Java) ──
-keep class com.samacaogiac.game.LoadingActivity { *; }

# ── General optimizations ──
-optimizationpasses 3
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# v0.6: more aggressive optimizations
-allowaccessmodification
-mergeinterfacesaggressively
-overloadaggressively

# ── Suppress warnings for Kotlin stdlib ──
-dontwarn org.jetbrains.kotlin.**

# ── Suppress warnings for AndroidX ──
-dontwarn androidx.**

# v0.6: keep all Activity classes (manifest references them by name)
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service

# v0.6: keep BuildConfig for runtime version checks
-keep class com.samacaogiac.game.BuildConfig { *; }
