# 🏜️ Sa Mạc Ảo Giác — Desert Mirage

> Game đua xe sa mạc trên Android — đa ngôn ngữ, tối ưu cao, có nhạc nền và nhiều tính năng troll.

![Version](https://img.shields.io/badge/version-0.7-red)
![Platform](https://img.shields.io/badge/platform-Android_7.0+-green)
![Engine](https://img.shields.io/badge/engine-Three.js%20r160%20%2B%20NDK-blue)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Languages](https://img.shields.io/badge/languages-12%2B-9cf)

---

## 📱 Tải về

Tải APK mới nhất từ [GitHub Releases](https://github.com/mhieuhonda/samacaogiac/releases/latest).

> ⚠️ **Lưu ý cài đặt**: Vì đây là APK phát hành qua GitHub (không qua Google Play), Android có thể hiển thị cảnh báo "ứng dụng này có thể gây hại". Đó là cảnh báo mặc định cho APK side-load. Phiên bản v0.7 đã ký v1 + v2 + v3 schemes, không yêu cầu quyền nhạy cảm, có `appCategory="game"` và `debuggable=false` để giảm thiểu cảnh báo. Bạn có thể an tâm chọn **"Install anyway"**.

---

## 🆕 Có gì mới trong v0.7

### 🚨 Sửa lỗi "ấn CHƠI NGAY bị đứng" (CRITICAL)

Đây là lỗi nghiêm trọng nhất mà người dùng báo cáo: khi ấn nút **CHƠI NGAY**, game đứng im không vào được. Nguyên nhân được xác định và sửa:

| # | Nguyên nhân gốc | Sửa |
|---|---|---|
| 1 | **Duplicate gameLoop chains** — `stopLoop()` + `startLoop()` (gọi khi restart/quit) không hủy callback rAF cũ. Callback cũ fire → thấy `loopRunning=true` → schedule thêm callback mới → số callback tăng theo cấp số nhân → **freeze sau 2-3 lần restart** | Token-based loop management: mỗi stop/start tăng `loopToken`, callback cũ thấy token mismatch → no-op |
| 2 | **init() fail âm thầm** — Three.js r160 yêu cầu WebGL2. Trên thiết bị có Android System WebView cũ (không có WebGL2), `new THREE.WebGLRenderer()` throw → IIFE exit → `carGroup`/`cam` undefined → `startGameAfterMusic()` throw ở `carGroup.rotation.y` → **canvas trắng, không vào được game** | Wrap `init()` trong try/catch. Nếu fail, hiện overlay lỗi tiếng Việt bảo người dùng cập nhật Android System WebView |
| 3 | **Touch event double-fire** — `addClick()` register cả `click` và `touchstart`. Trên Android WebView cả hai đều fire per tap → `fn()` chạy 2 lần. Với `playBtn` thì safe (guard), nhưng với `musicYes`/`musicNo` gây double `openMusicPicker()` và double `startGameAfterMusic()` | Track `lastTouch` time, suppress click event trong 600ms sau touchstart |
| 4 | **FPS counter Infinity** — frame đầu có `dt=0` → `1000/0 = Infinity` → HUD hiện "Infinity FPS" | Guard `isFinite()` + clamp về 60 |

### 🔧 Sửa lỗi quan trọng khác

| # | Lỗi | Sửa |
|---|---|---|
| 5 | **Native lib + Lua init block main thread** — `System.loadLibrary()` + LuaJ bootstrap chạy synchronously trên main thread trong `onCreate()`, delay WebView load 200-500ms | Move sang background thread, JS bridge vẫn dùng được vì có `isLoaded()`/`isAvailable()` guard |
| 6 | **onPause() evaluate JS sau khi pause WebView** — JS engine đã pause, `pauseGame()` không chạy cho đến `onResume()` tiếp theo → player vẫn "lái xe" trong background | Đảo thứ tự: evaluate `pauseGame()` TRƯỚC khi gọi `webView.onPause()` |
| 7 | **onDestroy() NPE** — `webView.getParent()` có thể null sau config change → cast throw NPE | `instanceof ViewGroup` check trước khi `removeView()` |
| 8 | **Back button không hoạt động API 33+** — Override `onBackPressed()` là no-op vì `OnBackPressedDispatcher` nuốt event | Dùng `OnBackPressedDispatcher.addCallback()` để toggle pause |
| 9 | **MusicPickerActivity dùng `Intent.createChooser`** — Google docs cảnh báo rõ: không wrap `ACTION_OPEN_DOCUMENT` trong chooser. Trên một số OEM ROM (Xiaomi/Huawei) → "no app can handle" error → user bounce lại game, tưởng nút play hỏng | Bỏ `createChooser`, gọi `startActivityForResult(intent, ...)` trực tiếp |
| 10 | **Audio focus denied → service treo** — Nếu focus bị denied (đang có cuộc gọi), service vẫn alive, hiển thị notification nhưng không phát nhạc. JS poll `isMusicPlaying()` = false forever → user tưởng nút nhạc hỏng | Stop service sạch sẽ khi focus denied |
| 11 | **MediaPlayer IllegalStateException** — `mp.isPlaying()` throw nếu player chưa prepared hoặc đang ở error state | Wrap trong try/catch |
| 12 | **Lua scripts set duck factor không restore** — `on_achievement.lua` set `engine.setDuckFactor(0.05)` không bao giờ restore → engine im tiệt rest of run sau achievement đầu | Lưu `prev` value + schedule restore qua `game._duck_restore_at` timestamp |
| 13 | **Lua VM không bao giờ nhận game state mới** — `updateLuaGameState` declared trong Java nhưng không bao giờ được gọi từ JS → scripts Lua luôn thấy `dist_km=0` | JS push state mỗi 30 frame qua `AndroidBridge.updateLuaGameState()` |
| 14 | **JNI signature sai** — Java methods là `static` nhưng JNI dùng `jobject thiz` thay vì `jclass`. Work trên hầu hết ART, nhưng fail trên strict JNI validators | Đổi tất cả sang `jclass clazz` |
| 15 | **Duplicate `cameraModeBtn` ID** — HTML có 2 element cùng ID (floating button + settings button). `getElementById` chỉ trả element đầu, button trong settings là dead code | Rename settings button thành `cameraModeSettingsBtn` |
| 16 | **LoadingActivity null bitmap** — `BitmapFactory.decodeStream` có thể trả null (OOM/corrupt PNG), `setImageBitmap(null)` để lại ImageView trong suốt | Check `if (bitmap != null)` trước khi set |
| 17 | **WebView cache disabled** — `LOAD_NO_CACHE` ép re-parse three.min.js (1MB+) mỗi cold start, mất ~300ms | Đổi sang `LOAD_DEFAULT` cho phép in-memory cache |

---

## 🎮 Cách chơi

| Điều khiển | Nút | Bàn phím |
|---|---|---|
| Rẽ trái | ◀ | ← / A |
| Rẽ phải | ▶ | → / D |
| Tăng tốc | ▲ | ↑ / W |
| Phanh | ▼ | ↓ / S |
| Boost (năng lượng đầy) | ⚡ | Shift |
| Tạm dừng | ⏸ | Esc / P |
| Cài đặt | ⚙ | — |
| Đổi camera | 📷 | — |

**Mục tiêu**: Lái xe qua sa mạc, tránh chướng ngại vật, chọn đúng ngã rẽ, thu thập coin, sống sót càng lâu càng tốt!

### Cheat codes

Gõ trực tiếp trong ô cài đặt (hoặc gõ phím liên tục trong game):
- `ghost` — Xe tàng hình 30s
- `fly` — Trọng lực đảo 30s
- `big` / `small` — Đổi kích thước xe
- `reset` — Khôi phục kích thước mặc định
- `coin` — +100 coin
- `speed` — Tăng tốc tối đa
- `iddqd` — Bất tử (1 lần)
- `trololol` — Triple troll event
- `↑↑↓↓←→←→ba` (Konami) — God mode

---

## ✨ Tính năng (v0.7)

### 🎵 Âm nhạc & Âm thanh
- **Music player** — Khi vào game, hiện prompt hỏi "Bạn có muốn phát nhạc không?". Nếu có, mở picker chọn bài từ điện thoại → nhạc phát nền qua `MusicPlayerService` (foreground service).
- **Engine ducking** — Khi nhạc đang phát, tiếng động cơ tự động nhỏ lại (qua C++ native mixer với one-pole low-pass gain ramping).
- **Audio focus** — Tự pause nhạc khi có cuộc gọi đến hoặc app khác cần âm thanh. Nếu focus bị denied, service tự stop sạch.

### 🏎️ Tối ưu hiệu năng
- Shadow map 1024 → 512 (`PCFSoftShadowMap` → `PCFShadowMap`)
- `MeshPhongMaterial` → `MeshLambertMaterial` cho thân xe (bỏ specular calculation đắt trên mobile GPU)
- Squared-distance collision (không `Math.sqrt` mỗi cặp object)
- Throttle dust particle update 60Hz → 30Hz
- Cache `array.length` trong hot loop
- Debounce resize handler 100ms
- `setTargetAtTime` chỉ khi target thực sự thay đổi
- **Auto-quality**: nếu FPS < 30 trong 3 giây liên tiếp, tự tắt shadow map
- WebGL precision: `mediump` trên thiết bị yếu
- `physicallyCorrectLights: false`
- **v0.7**: Native lib + Lua VM init chạy trên background thread, không block main thread
- **v0.7**: WebView cho phép in-memory cache (giảm ~300ms cold start)

### 🛡️ Khởi tạo an toàn (v0.7)
- **init() try/catch**: Nếu WebGL2 không hỗ trợ, hiện overlay lỗi tiếng Việt thay vì blank canvas
- **Token-based loop**: Không bao giờ duplicate gameLoop chains, kể cả sau nhiều lần restart/quit
- **Touch event dedup**: Một tap = một event, không bao giờ double-fire
- **Null-safe teardown**: WebView destroy không NPE kể cả khi parent đã detached

### 🎭 10 TROLL FEATURES
1. **Gravity flip** — Xe nảy ngược đầu 6-10s
2. **Invisible car** — Xe chớp ẩn/hiện 5s
3. **Inverted colors** — Đảo màu màn hình (CSS filter invert)
4. **Car shrink** — Xe thu nhỏ lại 5s
5. **Fake lag** — Lag giả (random pause)
6. **Screen rotation** — Màn hình xiên góc ngẫu nhiên
7. **Fake battery drain** — Thông báo pin sập (giả)
8. **Time dilation** — Slow motion tạm thời
9. **Fake coin theft** — Lạc đà ma ăn cắp coin
10. **Engine curse** — Động cơ im lặng rồi đột ngột rất to

### 🛠️ 20 USEFUL FEATURES
1. **Coins collectible** + counter — thu thập để nạp boost
2. **Boost meter** (tự hồi) + nút ⚡ để kích hoạt
3. **Near-miss tracking** — suýt đụng chướng ngại vật → +coin mỗi 5 lần
4. **Top speed display** (km/h)
5. **Total km display** (lifetime)
6. **FPS counter** (debug overlay)
7. **Debug overlay** (bật/tắt trong settings)
8. **3 camera modes** (follow / far / cockpit)
9. **Settings screen** với các toggle
10. **Sound toggle** (mute)
11. **HUD visibility toggle**
12. **Speedometer dial** (kim quay theo tốc độ)
13. **Swipe controls** (vuốt để lái — thay cho nút)
14. **Cheat codes** (Konami + 7 cheat khác)
15. **Cheat input box** (gõ cheat trực tiếp)
16. **Lua scripting hooks** — events fire Lua scripts trong `assets/lua/`
17. **Music indicator** (Now Playing)
18. **Auto-quality adjustment**
19. **Persistent stats** (lưu qua `SettingsManager` → SharedPreferences)
20. **Time tracking** (theo dõi thời gian sống sót)

### 🌟 Tính năng cũ (giữ nguyên từ v0.5)
- Xe 3D chi tiết, đường vô tận (segment recycling)
- Ngã rẽ với rào chắn đỏ
- Cảnh quan sa mạc (xương rồng, đá, cồn cát, lạc đà chết)
- Troll features cũ (đảo điều khiển, đổi màu xe, fake game over, fake notif)
- Hệ thống thành tích (8 mốc)
- Pause system, kỷ lục, sương mù, screen shake, vignette off-road
- Easter egg (chơi 1 tiếng)

---

## 🏗️ Kiến trúc kỹ thuật (v0.7)

```
samacaogiac/
├── .github/workflows/
│   ├── build-release.yml          # CI: build + sign + validate APK
│   └── retroactive-release.yml    # Build APK cho release cũ
├── app/
│   ├── build.gradle               # Module config: v0.7 (versionCode=7)
│   ├── proguard-rules.pro         # R8 rules (LuaJ, JNI, Kotlin metadata)
│   └── src/main/
│       ├── AndroidManifest.xml    # appCategory="game", FOREGROUND_SERVICE_MEDIA_PLAYBACK
│       ├── cpp/                   # NDK module (v0.7: jclass signature fix)
│       │   ├── CMakeLists.txt     # CMake config
│       │   ├── native_audio.cpp   # C++ JNI bridge
│       │   ├── audio_mixer.c      # C implementation (one-pole LP ducking)
│       │   ├── audio_mixer.h
│       │   ├── fast_math.h        # ARM-optimized sqrt/inv_sqrt
│       │   └── fast_distance_arm.S  # ARMv7-A assembly (vsqrt.f32)
│       ├── assets/
│       │   ├── game/
│       │   │   ├── index.html     # UI + CSS (v0.7: fixed duplicate ID)
│       │   │   ├── game.js        # Game engine v0.7 (token-based loop)
│       │   │   ├── three.min.js   # Three.js r160
│       │   │   └── shaders/       # GLSL shaders
│       │   │       ├── mirage.glsl
│       │   │       ├── heat_haze.glsl
│       │   │       ├── sandstorm.glsl
│       │   │       └── sky_vertex.glsl
│       │   ├── lua/               # Lua scripts (v0.7: duck factor restore)
│       │   │   ├── config.lua
│       │   │   ├── on_achievement.lua
│       │   │   ├── on_death.lua
│       │   │   └── on_troll_event.lua
│       │   ├── favicon.svg
│       │   └── manhinhload.png
│       ├── java/com/samacaogiac/game/
│       │   ├── GameActivity.java          # v0.7: lazy init, OnBackPressedDispatcher
│       │   ├── LoadingActivity.java       # v0.7: null bitmap handling
│       │   ├── NativeAudioBridge.java
│       │   └── MusicPlayerService.java    # v0.7: audio focus denied → stop
│       ├── kotlin/com/samacaogiac/game/
│       │   ├── MusicPickerActivity.kt     # v0.7: removed createChooser
│       │   ├── SettingsManager.kt
│       │   └── LuaScriptRunner.kt
│       └── res/
│           ├── layout/
│           ├── mipmap-*/
│           ├── values/
│           └── xml/
├── scripts/
│   ├── build.sh                   # Build wrapper (debug/release/native/check)
│   ├── validate_apk.sh            # Post-build APK validator (v2/v3, alignment, perms)
│   └── optimize_assets.py         # Asset optimizer (PNG, JS, GLSL)
├── Makefile                       # Standalone NDK build
├── build.gradle                   # Kotlin plugin
├── settings.gradle
├── gradle.properties
└── README.md
```

### 🌐 Đa ngôn ngữ (12+ technologies)

| # | Công nghệ | Vai trò trong project |
|---|---|---|
| 1 | **JavaScript** | Game engine (Three.js WebGL trong WebView) |
| 2 | **Java** | Android Activities, Service, JNI bridge |
| 3 | **Kotlin** | MusicPickerActivity, SettingsManager, LuaScriptRunner |
| 4 | **C** | Audio mixer (`audio_mixer.c`) |
| 5 | **C++** | JNI bridge (`native_audio.cpp`) |
| 6 | **GLSL** | Shaders: mirage, heat haze, sandstorm, sky |
| 7 | **Lua** | Game-event hooks và config (`assets/lua/*.lua`) |
| 8 | **Python** | Asset optimizer (`scripts/optimize_assets.py`) |
| 9 | **Shell (Bash)** | Build wrapper, APK validator |
| 10 | **Makefile** | Standalone NDK build |
| 11 | **ARM Assembly** | `fast_distance_arm.S` — vsqrt.f32 inline |
| 12 | **Groovy (Gradle DSL)** | `build.gradle`, `settings.gradle` |
| 13 | **YAML** | GitHub Actions workflows |
| 14 | **HTML/CSS** | UI và styles |
| 15 | **XML** | AndroidManifest, layouts, resources |

### Tech Stack chi tiết

| Layer | Công nghệ |
|---|---|
| Game Engine | Three.js r160 (WebGL2) |
| Native Audio | C/C++ NDK với ARM-optimized fast math |
| Scripting | Lua 5.1 (LuaJ 3.0.1) |
| Platform | Android 7.0+ (API 24) |
| Build | Gradle 8.4 + AGP 8.1.4 + CMake 3.22.1 + NDK r26d |
| CI/CD | GitHub Actions (auto-build + sign + validate APK) |
| Audio | Web Audio API + Native C++ mixer (ducking) |
| Rendering | Three.js WebGL in WebView (hardware accelerated) |
| Signing | APK Signature Scheme v1 + v2 + v3 |

---

## 🔧 Lịch sử phiên bản

### v0.7 — Critical Bug Fixes (2026-07-29)

**Sửa lỗi freeze khi ấn CHƠI NGAY** (4 critical fixes):
1. Token-based gameLoop management (ngăn duplicate callback chains)
2. init() try/catch với error overlay (WebGL2 fail không còn blank canvas)
3. Touch event deduplication (1 tap = 1 event)
4. FPS counter NaN/Infinity guard

**Sửa lỗi quan trọng khác** (13 fixes):
5. Native lib + Lua VM init chuyển sang background thread
6. onPause() evaluate JS trước khi pause WebView
7. onDestroy() null-check parent
8. Back button dùng OnBackPressedDispatcher (API 33+)
9. MusicPickerActivity bỏ `Intent.createChooser`
10. Audio focus denied → stop service sạch
11. MediaPlayer IllegalStateException try/catch
12. Lua scripts restore duck factor
13. Lua VM nhận game state updates từ JS
14. JNI signature `jobject` → `jclass` (static methods)
15. Fix duplicate `cameraModeBtn` ID
16. LoadingActivity null bitmap handling
17. WebView cache `LOAD_NO_CACHE` → `LOAD_DEFAULT`

### v0.6 — Performance + Music + Multi-language
- Performance: shadow map 1024→512, MeshLambertMaterial, squared-distance, throttled dust, auto-quality
- Music player: MusicPrompt, MusicPickerActivity, MusicPlayerService, native audio mixer
- 10 troll features mới (gravity flip, invisible car, inverted colors, ...)
- 20 useful features mới (coins, boost, near-miss, FPS counter, cheat codes, Lua hooks, ...)
- Fix "app harmful" warning: v1+v2+v3 signing, appCategory="game", debuggable=false
- Đa ngôn ngữ: C, C++, Java, Kotlin, GLSL, Lua, Python, Shell, Makefile, ARM asm, Groovy, YAML

### v0.5 — Bug Fix & Polish
- Fix 20 bugs: CI/CD Kotlin duplicate class, fork collision, obstacle recycling, speed steering, audio, pause, ProGuard, security, memory.
- Thêm sound FX, kỷ lục, pause button, âm thanh engine, v.v.

### v0.4 — Major Bug Fixes
- Troll timeout leak, double death, keyboard controls, vibration bridge, camera snap, memory leak, ProGuard JS interface, accessibility.

### v0.3 — Critical Fixes
- Black screen, car size, road width, off-road, reverse, forks, UI.

### v0.2 — Troll features + bug fixes

### v0.1 — Initial release

---

## 🚀 Build từ source

### Yêu cầu
- JDK 17+
- Android SDK 34 + Build Tools 34.0.0
- Android NDK r26+
- CMake 3.22+
- (Tùy chọn) Python 3.8+ với Pillow để tối ưu asset

### Build commands

```bash
# Clone repo
git clone https://github.com/mhieuhonda/samacaogiac.git
cd samacaogiac

# Build debug APK
./scripts/build.sh debug
# hoặc
./gradlew assembleDebug

# Build release APK (cần keystore.properties hoặc env vars)
./scripts/build.sh release

# Chỉ build native library (cần ANDROID_NDK_HOME)
./scripts/build.sh native

# Validate APK sau build
./scripts/validate_apk.sh app/build/outputs/apk/release/app-release.apk

# Syntax check
./scripts/build.sh check

# Tối ưu assets (PNG, JS, GLSL)
python3 scripts/optimize_assets.py

# APK output
ls app/build/outputs/apk/
```

### Keystore (cho release build)

Tạo file `keystore.properties` ở repo root:
```properties
storeFile=release.keystore
storePassword=your_store_password
keyAlias=your_key_alias
keyPassword=your_key_password
```

Hoặc đặt env vars (cho CI):
```bash
export KEYSTORE_FILE=release.keystore
export KEYSTORE_PASSWORD=...
export KEY_ALIAS=...
export KEY_PASSWORD=...
```

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<div align="center">
  <b>Sa Mạc Ảo Giác v0.7</b> — Made with ❤️ by Hieu Louis<br>
  <sub>C · C++ · Java · Kotlin · JavaScript · GLSL · Lua · Python · Shell · Makefile · ARM Assembly · Groovy · YAML · HTML/CSS · XML</sub>
</div>
