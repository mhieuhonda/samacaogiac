package com.samacaogiac.game;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

public class GameActivity extends AppCompatActivity {

    private WebView gameWebView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on during gameplay
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        setContentView(R.layout.activity_game);

        hideSystemUI();

        gameWebView = findViewById(R.id.gameWebView);

        // Configure WebView for optimal game performance
        WebSettings settings = gameWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDatabaseEnabled(true);

        // Performance optimizations
        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
        settings.setEnableSmoothTransition(true);

        // Enable hardware acceleration for WebGL
        gameWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        gameWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return false;
            }
        });

        gameWebView.setWebChromeClient(new WebChromeClient());

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
        if (hasFocus) {
            hideSystemUI();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (gameWebView != null) {
            gameWebView.evaluateJavascript("if(typeof pauseGame === 'function') pauseGame();", null);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (gameWebView != null) {
            gameWebView.evaluateJavascript("if(typeof resumeGame === 'function') resumeGame();", null);
        }
        hideSystemUI();
    }

    @Override
    public void onBackPressed() {
        // Prevent accidental exit during gameplay
        // Do nothing - user must use in-game controls
    }
}
