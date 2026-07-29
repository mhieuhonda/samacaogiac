package com.samacaogiac.game;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
        "Đang trồng cây xương rồng...",
        "Đang đặt lạc đà ma...",
        "Đang tạo ảo giác...",
        "Đang thêm tính năng troll...",
        "Đang sinh dead camel...",
        "Đang cài đặt bug...",
        "Đang kiểm tra patience...",
        "Sắp sẵn sàng..."
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_loading);

        hideSystemUI();

        // Set loading background image from assets
        ImageView loadingBg = findViewById(R.id.loadingBackground);
        try {
            InputStream is = getAssets().open("manhinhload.png");
            Bitmap bitmap = BitmapFactory.decodeStream(is);
            loadingBg.setImageBitmap(bitmap);
            is.close();
        } catch (Exception e) {
            e.printStackTrace();
        }

        progressBar = findViewById(R.id.loadingProgressBar);
        loadingText = findViewById(R.id.loadingText);
        handler = new Handler(Looper.getMainLooper());

        startLoading();
    }

    private void startLoading() {
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                // Random progress increment (not always smooth - more natural)
                progress += (int)(Math.random() * 10) + 1;
                if (progress > 100) progress = 100;

                progressBar.setProgress(progress);

                // Update loading message based on progress
                int msgIndex = Math.min(
                    (progress * loadingMessages.length) / 100,
                    loadingMessages.length - 1
                );
                loadingText.setText(loadingMessages[msgIndex]);

                if (progress >= 100) {
                    loadingText.setText("Hoàn tất! Chúc may mắn...");
                    handler.postDelayed(() -> {
                        Intent intent = new Intent(LoadingActivity.this, GameActivity.class);
                        startActivity(intent);
                        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
                        finish();
                    }, 600);
                } else {
                    // Variable delay for realistic loading feel
                    int delay = progress < 30 ? 80 : (progress < 70 ? 50 : 30);
                    delay += (int)(Math.random() * 40);
                    handler.postDelayed(this, delay);
                }
            }
        }, 300);
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
