# Add project specific ProGuard rules here.

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

# ── Three.js assets ──
-keep class * extends java.lang.Object { *; }
-keepclassmembers class * {
    *** *(...);
}
