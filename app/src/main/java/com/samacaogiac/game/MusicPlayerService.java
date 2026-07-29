package com.samacaogiac.game;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;

/**
 * MusicPlayerService — plays user-selected music in the background while
 * the game runs. The engine sound (in WebView via Web Audio) is ducked
 * by the JS layer when this service reports it is playing.
 *
 * Why a Service instead of WebView <audio>?
 *  - The user can pick a content:// URI that WebView cannot directly play
 *    due to scoped storage permission restrictions.
 *  - A foreground service survives activity recreation and keeps the
 *    Android media framework's audio focus correctly managed.
 *  - We can integrate AudioManager.OnAudioFocusChangeListener to duck
 *    further when phone calls or other apps request focus.
 *
 * Communication with JS is one-way: JS polls
 * {@code AndroidBridge.isMusicPlaying()} each frame and adjusts the engine
 * GainNode accordingly.
 */
public class MusicPlayerService extends Service
        implements AudioManager.OnAudioFocusChangeListener {

    private static final String TAG = "MusicPlayerService";
    private static final String CHANNEL_ID = "samacaogiac_music";
    private static final int NOTIF_ID = 0x5AC1C;

    public static final String EXTRA_TRACK_URI  = "track_uri";
    public static final String EXTRA_TRACK_NAME = "track_name";
    public static final String ACTION_PLAY   = "com.samacaogiac.game.PLAY";
    public static final String ACTION_PAUSE  = "com.samacaogiac.game.PAUSE";
    public static final String ACTION_STOP   = "com.samacaogiac.game.STOP";
    public static final String ACTION_RESUME = "com.samacaogiac.game.RESUME";

    private static volatile boolean sPlaying = false;
    private static volatile String  sTrackName = "";

    private MediaPlayer mp;
    private AudioManager audioManager;

    /** Polled by the WebView JS bridge each frame. */
    public static boolean isPlaying() { return sPlaying; }
    public static String currentTrackName() { return sTrackName; }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_PLAY;
        if (action == null) action = ACTION_PLAY;

        switch (action) {
            case ACTION_PLAY: {
                String uriStr = intent != null ? intent.getStringExtra(EXTRA_TRACK_URI) : null;
                String name   = intent != null ? intent.getStringExtra(EXTRA_TRACK_NAME) : null;
                if (uriStr == null) {
                    stopSelf();
                    return START_NOT_STICKY;
                }
                startForeground(NOTIF_ID, buildNotification(name != null ? name : "Sa Mạc Ảo Giác"));
                play(Uri.parse(uriStr), name);
                break;
            }
            case ACTION_PAUSE:
                pause();
                stopForeground(false);
                break;
            case ACTION_RESUME:
                resume();
                break;
            case ACTION_STOP:
            default:
                stop();
                stopSelf();
                break;
        }
        return START_NOT_STICKY;
    }

    private void play(Uri uri, String name) {
        stopInternal();
        try {
            mp = new MediaPlayer();
            mp.setDataSource(this, uri);
            mp.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            );
            mp.setLooping(true);
            mp.setOnPreparedListener(m -> {
                int r = audioManager.requestAudioFocus(
                    MusicPlayerService.this,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN
                );
                if (r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    m.start();
                    sPlaying = true;
                    sTrackName = name != null ? name : "";
                    notifyNative(true);
                }
            });
            mp.setOnErrorListener((m, what, extra) -> {
                Log.e(TAG, "MediaPlayer error: what=" + what + " extra=" + extra);
                stop();
                return true;
            });
            mp.prepareAsync();
        } catch (Exception e) {
            Log.e(TAG, "play() failed", e);
            stopSelf();
        }
    }

    private void pause() {
        if (mp != null && mp.isPlaying()) {
            mp.pause();
            sPlaying = false;
            notifyNative(false);
        }
    }

    private void resume() {
        if (mp != null && !mp.isPlaying()) {
            mp.start();
            sPlaying = true;
            notifyNative(true);
        }
    }

    private void stop() {
        stopInternal();
        if (audioManager != null) {
            audioManager.abandonAudioFocus(this);
        }
        stopForeground(true);
    }

    private void stopInternal() {
        if (mp != null) {
            try {
                if (mp.isPlaying()) mp.stop();
                mp.reset();
                mp.release();
            } catch (Exception ignored) {}
            mp = null;
        }
        sPlaying = false;
        notifyNative(false);
    }

    private void notifyNative(boolean playing) {
        try {
            if (NativeAudioBridge.isLoaded()) {
                NativeAudioBridge.nativeSetMusicPlaying(playing);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onAudioFocusChange(int focus) {
        if (mp == null) return;
        switch (focus) {
            case AudioManager.AUDIOFOCUS_LOSS:
                stop();
                stopSelf();
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                pause();
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                resume();
                break;
        }
    }

    @Override
    public void onDestroy() {
        stopInternal();
        if (audioManager != null) audioManager.abandonAudioFocus(this);
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID,
                "Sa Mạc Ảo Giác Music",
                NotificationManager.IMPORTANCE_LOW
            );
            ch.setDescription("Background music player");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String trackName) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sa Mạc Ảo Giác")
            .setContentText("♪ " + trackName)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
}
