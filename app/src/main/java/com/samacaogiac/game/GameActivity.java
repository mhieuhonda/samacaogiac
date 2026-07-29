package com.samacaogiac.game;

import android.annotation.SuppressLint;
import android.content.Context;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

public class GameActivity extends AppCompatActivity {

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

        // Vibrator for feedback
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);

        gameWebView = findViewById(R.id.gameWebView);

        // Configure WebView for optimal game performance
        WebSettings settings = gameWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDatabaseEnabled(true);
        settings.setEnableSmoothTransition(true);
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

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
            }
        });

        gameWebView.setWebChromeClient(new WebChromeClient());

        // Add JavaScript interface for vibration feedback
        gameWebView.addJavascriptInterface(new GameJSInterface(), "AndroidBridge");

        // Load the game from assets
        gameWebView.loadUrl("file:///android_asset/game/index.html");
    }

    private void hideSystemUI() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
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
            gameWebView.evaluateJavascript("if(typeof pauseGame==='function')pauseGame();", null);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (gameWebView != null) {
            gameWebView.evaluateJavascript("if(typeof resumeGame==='function')resumeGame();", null);
        }
        hideSystemUI();
    }

    @Override
    public void onBackPressed() {
        // Prevent accidental exit during gameplay
    }

    // JavaScript interface for Android native features
    private class GameJSInterface {
        @android.webkit.JavascriptInterface
        public void vibrate(int durationMs) {
            if (vibrator != null && vibrator.hasVibrator()) {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(durationMs);
                }
            }
        }

        @android.webkit.JavascriptInterface
        public void vibratePattern(long[] pattern) {
            if (vibrator != null && vibrator.hasVibrator()) {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        }

        @android.webkit.JavascriptInterface
        public String getDeviceInfo() {
            return "Android " + android.os.Build.VERSION.RELEASE +
                   " | " + android.os.Build.MANUFACTURER +
                   " " + android.os.Build.MODEL;
        }
    }
}
