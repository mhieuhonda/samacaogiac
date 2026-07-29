package com.samacaogiac.game;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.io.InputStream;

public class LoadingActivity extends AppCompatActivity {

    private ProgressBar progressBar;
    private TextView loadingText;
    private Handler handler;
    private int progress = 0;
    private String[] loadingMessages = {
        "Đang chuẩn bị sa mạc...",
        "Đang nạp xe ô tô...",
        "Đang xây con đường...",
        "Đang tạo ảo giác...",
        "Sắp sẵn sàng..."
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_loading);

        // Hide system UI for immersive experience
        hideSystemUI();

        // Set loading background image
        ImageView loadingBg = findViewById(R.id.loadingBackground);
        try {
            InputStream is = getAssets().open("manhinhload.png");
            loadingBg.setImageBitmap(android.graphics.BitmapFactory.decodeStream(is));
            is.close();
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Set logo
        ImageView logo = findViewById(R.id.logoImage);
        try {
            InputStream is = getAssets().open("favicon.svg");
            // SVG handled via WebView or fallback
            logo.setVisibility(ImageView.GONE);
        } catch (Exception e) {
            logo.setVisibility(ImageView.GONE);
        }

        progressBar = findViewById(R.id.loadingProgressBar);
        loadingText = findViewById(R.id.loadingText);
        handler = new Handler(Looper.getMainLooper());

        // Simulate loading progress
        startLoading();
    }

    private void startLoading() {
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                progress += (int)(Math.random() * 8) + 2;
                if (progress > 100) progress = 100;

                progressBar.setProgress(progress);

                // Update loading message
                int msgIndex = Math.min((progress * loadingMessages.length) / 100, loadingMessages.length - 1);
                loadingText.setText(loadingMessages[msgIndex]);

                if (progress >= 100) {
                    loadingText.setText("Hoàn tất!");
                    handler.postDelayed(() -> {
                        Intent intent = new Intent(LoadingActivity.this, GameActivity.class);
                        startActivity(intent);
                        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
                        finish();
                    }, 500);
                } else {
                    int delay = (int)(Math.random() * 80) + 40;
                    handler.postDelayed(this, delay);
                }
            }
        }, 200);
    }

    private void hideSystemUI() {
        getWindow().getDecorView().setSystemUiVisibility(
            android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
            | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        );
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (handler != null) {
            handler.removeCallbacksAndMessages(null);
        }
    }
}
