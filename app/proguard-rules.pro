# Add project specific ProGuard rules here.

# WebView related
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Three.js and game code
-keepassets assets/game/**
