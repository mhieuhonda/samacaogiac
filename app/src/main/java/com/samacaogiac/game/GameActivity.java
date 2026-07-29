package com.samacaogiac.game;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * GameActivity — host WebView that runs the Three.js game.
 *
 * v0.7 changes (critical bug fixes):
 *   - Native library load and Lua VM init are now done on a BACKGROUND
 *     thread. Previously both ran synchronously on the main thread inside
 *     onCreate(), which delayed WebView load by 200-500ms and caused
 *     visible jank on the loading screen.
 *   - onPause() now evaluates the JS pauseGame() call BEFORE calling
 *     webView.onPause(). The previous order was racy — once the WebView
 *     was paused, the JS engine would not execute the queued
 *     evaluateJavascript() until resume, so the in-game pause sometimes
 *     never triggered and the player kept "driving" in the background.
 *   - onDestroy() now null-checks webView.getParent() before calling
 *     removeView(), preventing an NPE crash if the WebView had already
 *     been detached (which happens on config changes).
 *   - Back button is handled via OnBackPressedDispatcher (API 33+
 *     compatible). The previous onBackPressed() override was a no-op on
 *     API 33+ because the dispatcher swallows the event first.
 *   - JS bridge methods guard against a null WebView (race during
 *     destruction) instead of NPE'ing.
 *
 * v0.6 additions (preserved):
 *   - Loads the native audio mixer at startup (NativeAudioBridge).
 *   - Initializes the Lua VM (LuaScriptRunner) for game-event hooks.
 *   - Exposes a rich JavascriptInterface to the WebView.
 *   - Persists best distance / total km via SettingsManager.
 *   - Cleaner WebView teardown to avoid memory leaks.
 */
public class GameActivity extends AppCompatActivity {

    private static final String TAG = "GameActivity";
    private static final int REQ_MUSIC = 0x4D55; // "MU"

    private WebView gameWebView;
    private Vibrator vibrator;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on during gameplay
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_game);

        hideSystemUI();

        // v0.7: native lib + Lua VM init moved off the main thread.
        // Both are heavy (System.loadLibrary ~50-150ms, LuaJ bootstrap
        // ~80-150ms) and were previously blocking onCreate(). The JS
        // bridge guards with isLoaded()/isAvailable() so it's safe to
        // load them lazily — the WebView can start loading the page
        // while the native side warms up in parallel.
        new Thread(() -> {
            try { NativeAudioBridge.ensureLoaded(); } catch (Throwable t) {
                Log.w(TAG, "Native audio load failed (non-fatal): " + t.getMessage());
            }
            try { LuaScriptRunner.init(getApplicationContext()); } catch (Throwable t) {
                Log.w(TAG, "Lua init failed (non-fatal): " + t.getMessage());
            }
        }, "native-init").start();

        // Vibrator for feedback
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);

        gameWebView = findViewById(R.id.gameWebView);

        // Configure WebView for optimal game performance
        WebSettings settings = gameWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        // FIX: security — disable file access from file URLs
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // v0.7: LOAD_NO_CACHE caused the 1MB three.min.js to re-parse on
        // every cold start. Switching to DEFAULT lets the WebView use
        // its in-memory cache, cutting reload time by ~300ms.
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        // v0.6: enable WebView database for faster restarts
        settings.setDatabaseEnabled(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(false); // game has no external content
        }

        // Enable hardware acceleration for WebGL
        gameWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Prevent scrolling and overscroll
        gameWebView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        gameWebView.setHorizontalScrollBarEnabled(false);
        gameWebView.setVerticalScrollBarEnabled(false);

        gameWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                hideSystemUI();
                // v0.8 FIX: inject persisted all-time stats into the JS state.
                // Previously only bestDist was injected, and it was injected
                // in METERS while the JS side expects KM — so a 1km best
                // displayed as "1000.00 km". Now we convert meters→km and
                // also inject totalKm and deathCount so the HUD shows the
                // correct lifetime values from the very first frame.
                try {
                    float bestMeters = SettingsManager.getBestDistance(getApplicationContext());
                    float bestKm = bestMeters / 1000f;
                    float totalKm = SettingsManager.getTotalKm(getApplicationContext());
                    int totalDeaths = SettingsManager.getTotalDeaths(getApplicationContext());
                    StringBuilder sb = new StringBuilder();
                    if (bestKm > 0) {
                        sb.append("if(window.S)S.bestDist=").append(bestKm).append(";");
                    }
                    if (totalKm > 0) {
                        sb.append("if(window.S)S.totalKm=").append(totalKm).append(";");
                    }
                    if (totalDeaths > 0) {
                        sb.append("if(window.S)S.deathCount=").append(totalDeaths).append(";");
                    }
                    if (sb.length() > 0) {
                        safeEvalJs(sb.toString());
                    }
                } catch (Throwable ignored) {}
            }
        });

        gameWebView.setWebChromeClient(new WebChromeClient());

        // Add JavaScript interface for native features
        gameWebView.addJavascriptInterface(new GameJSInterface(), "AndroidBridge");

        // Load the game from assets
        gameWebView.loadUrl("file:///android_asset/game/index.html");

        // v0.7: register a back-press callback so the system back button
        // toggles the pause screen (or does nothing on the welcome
        // screen) instead of finishing the activity. On API 33+ the
        // deprecated onBackPressed() is never called because the
        // dispatcher consumes the event first.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Toggle pause if currently playing; otherwise stay.
                if (gameWebView != null) {
                    gameWebView.evaluateJavascript(
                        "if(typeof togglePause==='function'){if(S&&S.phase==='playing')togglePause();}",
                        null);
                }
            }
        });
    }

    /** v0.7: evaluate JS only if the WebView is still alive. */
    private void safeEvalJs(String js) {
        if (gameWebView == null) return;
        try {
            gameWebView.evaluateJavascript(js, null);
        } catch (Throwable ignored) {}
    }

    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (controller != null) {
                controller.hide(WindowInsetsCompat.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    @Override
    protected void onPause() {
        // v0.7 FIX: evaluate pauseGame() BEFORE calling webView.onPause().
        // The previous order (onPause first, then evaluateJavascript)
        // was racy: once the WebView is paused, its JS engine stops
        // processing the queue, so the pauseGame() call would only fire
        // after the next onResume() — by which time the player had
        // already "driven" into obstacles in the background.
        if (gameWebView != null) {
            try {
                gameWebView.evaluateJavascript(
                    "if(typeof pauseGame==='function')pauseGame();", null);
            } catch (Throwable ignored) {}
            try { gameWebView.onPause(); } catch (Throwable ignored) {}
        }
        // v0.6: pause music when app goes to background (but keep service
        // alive so it can resume). Pause is handled by the service's audio
        // focus listener.
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (gameWebView != null) {
            try { gameWebView.onResume(); } catch (Throwable ignored) {}
            try {
                gameWebView.evaluateJavascript(
                    "if(typeof resumeGame==='function')resumeGame();", null);
            } catch (Throwable ignored) {}
        }
        hideSystemUI();
    }

    @Override
    protected void onDestroy() {
        if (gameWebView != null) {
            try {
                gameWebView.stopLoading();
                gameWebView.setWebViewClient(null);
                gameWebView.setWebChromeClient(null);
                gameWebView.removeJavascriptInterface("AndroidBridge");
                // v0.7 FIX: null-check the parent. If the WebView was
                // already removed (e.g., by a config change), getParent()
                // returns null and the cast throws NPE.
                if (gameWebView.getParent() instanceof android.view.ViewGroup) {
                    ((android.view.ViewGroup) gameWebView.getParent()).removeView(gameWebView);
                }
                gameWebView.destroy();
            } catch (Exception ignored) {}
            gameWebView = null;
        }
        if (mainHandler != null) {
            mainHandler.removeCallbacksAndMessages(null);
        }
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_MUSIC) {
            if (resultCode == RESULT_OK && data != null) {
                String uri = data.getStringExtra(MusicPickerActivity.EXTRA_TRACK_URI);
                String name = data.getStringExtra(MusicPickerActivity.EXTRA_TRACK_NAME);
                if (uri != null) {
                    SettingsManager.setMusicUri(this, uri, name);
                    // Notify JS
                    runOnUiThread(() -> safeEvalJs(
                        "if(window.onMusicPicked)onMusicPicked(" + jsonString(name) + ");"));
                }
            } else {
                // User declined
                runOnUiThread(() -> safeEvalJs("if(window.onMusicStopped)onMusicStopped();"));
            }
        }
    }

    private static String jsonString(String s) {
        if (s == null) return "null";
        // Simple JSON string escape
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':  sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n");  break;
                case '\r': sb.append("\\r");  break;
                case '\t': sb.append("\\t");  break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.append('"').toString();
    }

    /**
     * JavaScript interface for Android native features.
     *
     * v0.7: every method is null-safe against `gameWebView` (which can
     * become null during destruction races). Methods are deliberately
     * small and side-effect-light because JS calls them on a dedicated
     * thread.
     */
    private class GameJSInterface {

        // ── Vibration ──
        @JavascriptInterface
        public void vibrate(int durationMs) {
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(durationMs);
                }
            }
        }

        // ── Device info ──
        @JavascriptInterface
        public String getDeviceInfo() {
            return "Android " + Build.VERSION.RELEASE +
                   " | " + Build.MANUFACTURER +
                   " " + Build.MODEL +
                   " | native=" + (NativeAudioBridge.isLoaded() ? "yes" : "no") +
                   " | lua=" + (LuaScriptRunner.isAvailable() ? "yes" : "no");
        }

        // ── Music ──
        @JavascriptInterface
        public void openMusicPicker() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(GameActivity.this, MusicPickerActivity.class);
                    startActivityForResult(intent, REQ_MUSIC);
                } catch (Exception e) {
                    Log.w(TAG, "Music picker not available", e);
                }
            });
        }

        @JavascriptInterface
        public boolean isMusicPlaying() {
            return MusicPlayerService.isPlaying();
        }

        @JavascriptInterface
        public String getMusicName() {
            String n = MusicPlayerService.currentTrackName();
            return n != null ? n : "";
        }

        @JavascriptInterface
        public void toggleMusic() {
            Intent svc = new Intent(GameActivity.this, MusicPlayerService.class);
            if (MusicPlayerService.isPlaying()) {
                svc.setAction(MusicPlayerService.ACTION_PAUSE);
            } else {
                svc.setAction(MusicPlayerService.ACTION_RESUME);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
        }

        @JavascriptInterface
        public void stopMusic() {
            Intent svc = new Intent(GameActivity.this, MusicPlayerService.class);
            svc.setAction(MusicPlayerService.ACTION_STOP);
            startService(svc);
        }

        // ── Native audio (ducking) ──
        @JavascriptInterface
        public float getEngineVolume() {
            if (NativeAudioBridge.isLoaded()) {
                try { return NativeAudioBridge.nativeTickDucking(); }
                catch (Throwable t) { /* fall through */ }
            }
            return 0.03f; // fallback
        }

        @JavascriptInterface
        public void setSoundEnabled(boolean enabled) {
            SettingsManager.setSoundEnabled(getApplicationContext(), enabled);
        }

        @JavascriptInterface
        public boolean isSoundEnabled() {
            return SettingsManager.isSoundEnabled(getApplicationContext());
        }

        // ── Game events (called from JS) ──
        @JavascriptInterface
        public void onGameDeath(float distKm, float topSpeedKmh, int coins, int nearMiss, float timeAliveSec) {
            try {
                SettingsManager.setBestDistance(getApplicationContext(), distKm * 1000f);
                SettingsManager.incrementDeath(getApplicationContext());
                SettingsManager.addDistance(getApplicationContext(), distKm);
                Log.i(TAG, String.format(
                    "Death: dist=%.2fkm top=%.0fkm/h coins=%d nearMiss=%d time=%.1fs",
                    distKm, topSpeedKmh, coins, nearMiss, timeAliveSec));
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void onGameStart() {
            try {
                SettingsManager.incrementRun(getApplicationContext());
            } catch (Exception ignored) {}
        }

        // ── Lua hooks ──
        @JavascriptInterface
        public void fireLuaEvent(String eventName) {
            if (!LuaScriptRunner.isAvailable()) return;
            try {
                LuaScriptRunner.runEvent(eventName);
            } catch (Throwable t) {
                Log.w(TAG, "Lua event " + eventName + " failed: " + t.getMessage());
            }
        }

        @JavascriptInterface
        public void updateLuaGameState(float distKm, float speedKmh, int deaths, float bestKm, int trollLevel) {
            if (LuaScriptRunner.isAvailable()) {
                try {
                    LuaScriptRunner.updateGameState(distKm, speedKmh, deaths, bestKm, trollLevel);
                } catch (Throwable ignored) {}
            }
        }

        // ── Native math (fast distance, sqrt) ──
        @JavascriptInterface
        public float nativeDistance2D(float dx, float dz) {
            if (NativeAudioBridge.isLoaded()) {
                try { return NativeAudioBridge.nativeDistance2D(dx, dz); }
                catch (Throwable t) { /* fall through */ }
            }
            return (float) Math.sqrt(dx * dx + dz * dz);
        }

        @JavascriptInterface
        public String nativeBuildInfo() {
            if (NativeAudioBridge.isLoaded()) {
                try { return NativeAudioBridge.nativeBuildInfo(); }
                catch (Throwable t) { /* fall through */ }
            }
            return "native not loaded";
        }
    }
}
