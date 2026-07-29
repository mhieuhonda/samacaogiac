# ── WebView JavaScript Bridge ──
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep the game's JS interface class (ProGuard may strip it)
-keep class com.samacaogiac.game.GameActivity$GameJSInterface { *; }

# Keep WebViewClient subclass (used by the game)
-keep class com.samacaogiac.game.GameActivity$* { *; }

# ── AndroidX / WebView ──
-dontwarn android.webkit.WebView
-dontwarn android.webkit.WebSettings

# ── Three.js assets (loaded via WebView, not Java) ──
-keep class com.samacaogiac.game.LoadingActivity { *; }

# ── General optimizations ──
-optimizationpasses 3
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# ── Suppress warnings for Kotlin stdlib ──
-dontwarn org.jetbrains.kotlin.**
