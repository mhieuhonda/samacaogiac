# Add project specific ProGuard rules here.

# WebView related
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebView class for JavaScript bridge
-keep class android.webkit.WebView { *; }
-keep class * extends android.webkit.WebViewClient { *; }

# Keep game activity and view classes
-keep class com.samacaogiac.game.** { *; }
