package com.samacaogiac.game

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * MusicPickerActivity — asks the user "do you want music?" and if yes,
 * opens the system file picker to choose an audio track.
 *
 * The selected track URI is persisted across app restarts using
 * `takePersistableUriPermission` so the user doesn't have to re-pick
 * every time.
 *
 * Result: returns an Intent extra `MusicPlayerService.EXTRA_TRACK_URI`
 * containing the chosen URI (as string), or null if the user declined.
 *
 * Written in Kotlin because:
 *  - Coroutines make the persistence logic cleaner.
 *  - New Android features (photo picker, scoped storage) are Kotlin-first.
 *  - Demonstrates the multi-language nature of the project.
 */
class MusicPickerActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MusicPicker"
        const val EXTRA_TRACK_URI = "track_uri"
        const val EXTRA_TRACK_NAME = "track_name"
        private const val REQ_OPEN_DOC = 0x4d41 // "MA"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        hideSystemUI()
        buildUi()
    }

    /** Build a minimal native UI (no XML layout needed — keeps APK small). */
    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 64, 48, 64)
            background = null
            gravity = android.view.Gravity.CENTER
            layoutParams = android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        // Apply gradient background via code
        root.background = android.graphics.drawable.GradientDrawable(
            android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(0xFF0f0c29.toInt(), 0xFF302b63.toInt(), 0xFF24243e.toInt())
        )

        val title = TextView(this).apply {
            text = "🎵 PHÁT NHẠC KHI CHƠI?"
            setTextColor(0xFFF59E0B.toInt())
            textSize = 22f
            setPadding(0, 0, 0, 16)
            letterSpacing = 0.1f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            textAlignment = View.TEXT_ALIGNMENT_CENTER
        }
        val subtitle = TextView(this).apply {
            text = "Chọn nhạc từ điện thoại — tiếng động cơ sẽ tự nhỏ lại"
            setTextColor(0xFFB0FFFFFF.toInt())
            textSize = 14f
            setPadding(0, 0, 0, 32)
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            setLineSpacing(4f, 1f)
        }
        val yesBtn = makeButton("✓ CÓ, MỞ NHẠC", 0xFF22C55E.toInt()) { openPicker() }
        val noBtn = makeButton("✗ KHÔNG, CẢM ƠN", 0xFF6B7280.toInt()) { decline() }

        root.addView(title)
        root.addView(subtitle)
        root.addView(yesBtn)
        root.addView(noBtn)
        setContentView(root)
    }

    private fun makeButton(text: String, color: Int, onClick: () -> Unit): Button {
        return Button(this).apply {
            this.text = text
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 15f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            isAllCaps = false
            letterSpacing = 0.08f
            background = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                cornerRadius = 28f
                setColor(color)
            }
            setPadding(64, 32, 64, 32)
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 16 }
            layoutParams = lp
            setOnClickListener { onClick() }
        }
    }

    private fun openPicker() {
        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "audio/*"
                // Persistable permission so we can re-open after restart
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    addFlags(
                        Intent.FLAG_GRANT_READ_URI_PERMISSION or
                        Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                    )
                }
            }
            // v0.7 FIX: do NOT wrap ACTION_OPEN_DOCUMENT in Intent.createChooser.
            // The Android docs explicitly warn against this: ACTION_OPEN_DOCUMENT
            // already shows the system file picker, and wrapping it in a chooser
            // either shows a redundant chooser dialog (annoying) or, on some
            // OEM ROMs (Xiaomi / Huawei), surfaces a broken "no app can handle"
            // error and bounces the user back to the game without ever opening
            // the picker — which looked exactly like the "play button freezes"
            // bug the user reported.
            @Suppress("DEPRECATION")
            startActivityForResult(intent, REQ_OPEN_DOC)
        } catch (e: Exception) {
            Log.e(TAG, "No file picker available", e)
            decline()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_OPEN_DOC) return
        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            decline()
            return
        }
        val uri = data.data ?: run { decline(); return }
        try {
            // Take persistable permission for future restarts
            contentResolver.takePersistableUriPermission(
                uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        } catch (e: SecurityException) {
            Log.w(TAG, "Could not take persistable permission", e)
        }
        val name = queryDisplayName(uri) ?: "Unknown track"

        // Start the music service so playback continues across activities
        val svc = Intent(this, MusicPlayerService::class.java).apply {
            putExtra(MusicPlayerService.EXTRA_TRACK_URI, uri.toString())
            putExtra(MusicPlayerService.EXTRA_TRACK_NAME, name)
            action = MusicPlayerService.ACTION_PLAY
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(svc)
        } else {
            startService(svc)
        }

        // Return result to caller (the WebView/JS bridge can read it)
        val result = Intent().apply {
            putExtra(EXTRA_TRACK_URI, uri.toString())
            putExtra(EXTRA_TRACK_NAME, name)
        }
        setResult(Activity.RESULT_OK, result)
        finish()
    }

    private fun decline() {
        setResult(Activity.RESULT_CANCELED)
        finish()
    }

    private fun queryDisplayName(uri: Uri): String? {
        var cursor: Cursor? = null
        return try {
            cursor = contentResolver.query(uri, null, null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0) cursor.getString(idx) else null
            } else null
        } catch (e: Exception) {
            null
        } finally {
            cursor?.close()
        }
    }

    private fun hideSystemUI() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            WindowInsetsControllerCompat(window, window.decorView).apply {
                hide(WindowInsetsCompat.Type.systemBars())
                systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            )
        }
    }
}
