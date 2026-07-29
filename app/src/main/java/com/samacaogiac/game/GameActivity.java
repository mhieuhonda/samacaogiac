package com.samacaogiac.game;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
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

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * GameActivity — host WebView that runs the Three.js game.
 *
 * v0.6 additions:
 *   - Loads the native audio mixer at startup (NativeAudioBridge).
 *   - Initializes the Lua VM (LuaScriptRunner) for game-event hooks.
 *   - Exposes a richer JavascriptInterface to the WebView:
 *       * openMusicPicker()    — launches MusicPickerActivity
 *       * isMusicPlaying()     — polled by JS each frame
 *       * getMusicName()       — for the "Now Playing" indicator
 *       * toggleMusic()        — play/pause the music service
 *       * getEngineVolume()    — current ducked engine volume (native)
 *       * setSoundEnabled(b)   — persist sound toggle
 *       * onGameDeath(...)     — persist stats via SettingsManager
 *       * fireLuaEvent(name)   — invoke a Lua hook script
 *   - Persists best distance / total km via SettingsManager.
 *   - Cleaner WebView teardown to avoid memory leaks.
 */
public class GameActivity extends AppCompatActivity {

    private static final String TAG = "GameActivity";
    private static final int REQ_MUSIC = 0x4D55; // "MU"

    private WebView gameWebView;
    private Vibrator vibrator;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on during gameplay
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_game);

        hideSystemUI();

        // v0.6: load native audio mixer early
        NativeAudioBridge.ensureLoaded();
        // v0.6: init Lua VM with app context
        try {
            LuaScriptRunner.init(getApplicationContext());
        } catch (Throwable t) {
            Log.w(TAG, "Lua init failed (non-fatal): " + t.getMessage());
        }

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
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE); // v0.6: avoid disk cache for snappier load
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
                // v0.6: inject any persisted best distance into the JS state
                float best = SettingsManager.getBestDistance(getApplicationContext());
                if (best > 0) {
                    gameWebView.evaluateJavascript(
                        "if(window.S)S.bestDist=" + best + ";", null);
                }
            }
        });

        gameWebView.setWebChromeClient(new WebChromeClient());

        // Add JavaScript interface for native features
        gameWebView.addJavascriptInterface(new GameJSInterface(), "AndroidBridge");

        // Load the game from assets
        gameWebView.loadUrl("file:///android_asset/game/index.html");
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
        super.onPause();
        if (gameWebView != null) {
            gameWebView.onPause();
            gameWebView.evaluateJavascript("if(typeof pauseGame==='function')pauseGame();", null);
        }
        // v0.6: pause music when app goes to background (but keep service alive
        // so it can resume). Pause is handled by the service's audio focus listener.
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (gameWebView != null) {
            gameWebView.onResume();
            gameWebView.evaluateJavascript("if(typeof resumeGame==='function')resumeGame();", null);
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
                ((android.view.ViewGroup) gameWebView.getParent()).removeView(gameWebView);
                gameWebView.destroy();
            } catch (Exception ignored) {}
            gameWebView = null;
        }
        super.onDestroy();
    }

    // FIX: use OnBackPressedDispatcher for API 33+
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Prevent accidental exit during gameplay.
        // On API 33+, this is handled by the system back dispatcher,
        // but we still override to prevent exit.
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
                    runOnUiThread(() -> {
                        if (gameWebView != null) {
                            String js = "if(window.onMusicPicked)onMusicPicked(" +
                                jsonString(name) + ");";
                            gameWebView.evaluateJavascript(js, null);
                        }
                    });
                }
            } else {
                // User declined
                runOnUiThread(() -> {
                    if (gameWebView != null) {
                        gameWebView.evaluateJavascript(
                            "if(window.onMusicStopped)onMusicStopped();", null);
                    }
                });
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
     * v0.6: every method is annotated with @JavascriptInterface
     * (required since API 17). Methods are deliberately small and
     * side-effect-light because JS calls them on a dedicated thread.
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

        @JavascriptInterface
        public void vibratePattern(long[] pattern) {
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
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
                return NativeAudioBridge.nativeTickDucking();
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
                return NativeAudioBridge.nativeDistance2D(dx, dz);
            }
            return (float) Math.sqrt(dx * dx + dz * dz);
        }

        @JavascriptInterface
        public String nativeBuildInfo() {
            if (NativeAudioBridge.isLoaded()) {
                return NativeAudioBridge.nativeBuildInfo();
            }
            return "native not loaded";
        }
    }
}
