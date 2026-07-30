package com.samacaogiac.game;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

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

        // v1.0: Set loading background image from assets (was manhinhload.png,
        // now banner.png per user request).
        ImageView loadingBg = findViewById(R.id.loadingBackground);
        loadAssetBitmap(loadingBg, "banner.png", 720, 1280);

        // v1.0: Load game logo from assets (Logo.png). The ImageView is
        // already declared in activity_loading.xml but was never set.
        ImageView logoImage = findViewById(R.id.logoImage);
        loadAssetBitmap(logoImage, "Logo.png", 240, 240);

        progressBar = findViewById(R.id.loadingProgressBar);
        loadingText = findViewById(R.id.loadingText);
        handler = new Handler(Looper.getMainLooper());

        startLoading();
    }

    // FIX: calculate bitmap sampling to save memory
    private static int calculateInSampleSize(BitmapFactory.Options options, int reqWidth, int reqHeight) {
        final int height = options.outHeight;
        final int width = options.outWidth;
        int inSampleSize = 1;
        if (height > reqHeight || width > reqWidth) {
            final int halfHeight = height / 2;
            final int halfWidth = width / 2;
            while ((halfHeight / inSampleSize) >= reqHeight && (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2;
            }
        }
        return inSampleSize;
    }

    /**
     * v1.0: Helper to load a bitmap from the assets folder with proper
     * downsampling. Sets the bitmap on the ImageView if decoding succeeds,
     * logs a warning otherwise (the underlying background color shows).
     */
    private void loadAssetBitmap(ImageView target, String assetName, int reqW, int reqH) {
        if (target == null) return;
        try (InputStream is = getAssets().open(assetName)) {
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            BitmapFactory.decodeStream(is, null, opts);
            opts.inSampleSize = calculateInSampleSize(opts, reqW, reqH);
            opts.inJustDecodeBounds = false;
            try (InputStream is2 = getAssets().open(assetName)) {
                Bitmap bitmap = BitmapFactory.decodeStream(is2, null, opts);
                if (bitmap != null) {
                    target.setImageBitmap(bitmap);
                } else {
                    Log.w("LoadingActivity", assetName + " decoded to null");
                }
            }
        } catch (Exception e) {
            Log.w("LoadingActivity", "Could not load " + assetName, e);
        }
    }

    private void startLoading() {
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                progress += (int)(Math.random() * 10) + 1;
                if (progress > 100) progress = 100;

                progressBar.setProgress(progress);

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
                    int delay = progress < 30 ? 80 : (progress < 70 ? 50 : 30);
                    delay += (int)(Math.random() * 40);
                    handler.postDelayed(this, delay);
                }
            }
        }, 300);
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
                android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (handler != null) {
            handler.removeCallbacksAndMessages(null);
        }
    }
}
