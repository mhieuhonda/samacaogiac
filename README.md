# 🏜️ Sa Mạc Ảo Giác — Desert Mirage

> Game đua xe sa mạc trên Android — đa ngôn ngữ, tối ưu cao, có nhạc nền và nhiều tính năng troll.

![Version](https://img.shields.io/badge/version-0.8-red)
![Platform](https://img.shields.io/badge/platform-Android_7.0+-green)
![Engine](https://img.shields.io/badge/engine-Three.js%20r160%20%2B%20NDK-blue)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Languages](https://img.shields.io/badge/languages-12%2B-9cf)

---

## 📱 Tải về

Tải APK mới nhất từ [GitHub Releases](https://github.com/mhieuhonda/samacaogiac/releases/latest).

> ⚠️ **Lưu ý cài đặt**: Vì đây là APK phát hành qua GitHub (không qua Google Play), Android có thể hiển thị cảnh báo "ứng dụng này có thể gây hại". Đó là cảnh báo mặc định cho APK side-load. Phiên bản v0.8 đã ký v1 + v2 + v3 schemes, không yêu cầu quyền nhạy cảm, có `appCategory="game"` và `debuggable=false` để giảm thiểu cảnh báo. Bạn có thể an tâm chọn **"Install anyway"**.

---

## 🆕 Có gì mới trong v0.8

### 🚨 Sửa lỗi "ấn CHƠI NGAY bị đứng" (LỖI THẬT, KHÔNG PHẢI V0.7)

Đây là lỗi mà người dùng báo cáo liên tục: khi ấn nút **CHƠI NGAY**, game đứng im không vào được. Lần này tôi đã rà soát kỹ từng ngóc ngách và tìm ra **nguyên nhân gốc** mà v0.7 đã bỏ sót:

| # | Nguyên nhân gốc rễ | Cách sửa |
|---|---|---|
| 1 | **`startGame()` first-tap dead-end** — Hàm kiểm tra `musicPrompt.style.display !== 'none'` để biết prompt đang mở hay chưa. Nhưng `element.style.display` chỉ trả về **inline style**, không phải computed style. CSS rule `#musicPrompt{display:none}` không phải inline, nên `style.display` trả về `""` (chuỗi rỗng). Điều kiện `"" !== 'none'` là **TRUE** → hàm return early → **first tap KHÔNG làm gì cả!** | Dùng cờ `_musicPromptVisible` tường minh thay vì inspect `style.display` |
| 2 | **Các nút gameplay không bao giờ hiện** — `pauseBtn`, `settingsBtn`, `cameraModeBtn`, `boostBar`, `speedoWrap` đều có `display:none` trong CSS và **không bao giờ** được set `display:flex` ở đâu trong code. Người chơi không thể pause, mở settings, đổi camera, thấy boost bar hay speedometer trong game! | Thêm helper `showGameUI(show)` và gọi từ `startGameAfterMusic`, `restart`, `togglePause`, `quitBtn` |
| 3 | **Stats lưu bị reset mỗi lần chơi** — `bestDist`, `totalKm`, `deathCount` đều bị reset về 0 trong `startGameAfterMusic()`, làm mất toàn bộ tiến trình lưu trong SharedPreferences | Không reset các all-time stats; chỉ reset per-run stats (timeAlive, nearMiss, coins) |
| 4 | **Bug đơn vị best distance** — `SettingsManager.setBestDistance` lưu **meters**, nhưng `onPageFinished` inject raw value vào `S.bestDist` (kiểu **km**). Best 1km hiện là "1000.00 km" | Chia 1000 trước khi inject |
| 5 | **Timer HUD đếm cả pause time** — `Date.now()-S.t0` là wall-clock time, nên pause 30s → timer nhảy 30s | Dùng `S.timeAlive` (tích lũy `dt`) chỉ tăng khi đang chơi |
| 6 | **`onGameDeath` sai đơn vị** — `S.topSpeed` (m/s) truyền thẳng vào tham số `topSpeedKmh`. 52 m/s bị log là "52 km/h" thay vì "187 km/h" | Nhân 3.6 trước khi truyền |
| 7 | **`updateAudio` NPE** — Nếu `audioCtx` null nhưng `engineGain` tồn tại và sound disabled, nhánh early-return truy cập `audioCtx.currentTime` → NPE | Thêm `audioCtx` vào guard |
| 8 | **Music ducking sớm** — `startGameAfterMusic(true)` set `S.musicPlaying=true` trước khi picker trả về → engine bị duck mà chưa có nhạc | Always set `false`, để `updateMusicPoll` detect nhạc thật |

### 🔍 Tại sao v0.7 không sửa được lỗi freeze?

v0.7 đã fix nhiều bug thật (token-based loop, init try/catch, touch dedup, ...), nhưng **bỏ sót bug gốc** trong `startGame()`. Comments trong code v0.7 giải thích chi tiết về token-based loop và init failure, khiến người đọc tưởng đã fix xong. Trên thực tế, ngay cả khi init thành công, first tap vẫn không làm gì vì check `style.display` sai. v0.8 đã sửa đúng gốc.

---

## 🎮 Cách chơi

| Điều khiển | Nút | Bàn phím |
|---|---|---|
| Rẽ trái | ◀ | ← / A |
| Rẽ phải | ▶ | → / D |
| Tăng tốc | ▲ | ↑ / W |
| Phanh | ▼ | ↓ / S |
| Boost (năng lượng đầy) | ⚡ | Shift |
| Tạm dừng | ⏸ (góc phải trên) | Esc / P |
| Cài đặt | ⚙ (góc phải trên) | — |
| Đổi camera | 📷 (góc phải trên) | — |
| Đổi nhạc | ⏸ (trong music indicator) | — |

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

## ✨ Tính năng (v0.8)

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
- Native lib + Lua VM init chạy trên background thread, không block main thread
- WebView cho phép in-memory cache (giảm ~300ms cold start)

### 🛡️ Khởi tạo an toàn
- **init() try/catch**: Nếu WebGL2 không hỗ trợ, hiện overlay lỗi tiếng Việt thay vì blank canvas
- **Token-based loop**: Không bao giờ duplicate gameLoop chains, kể cả sau nhiều lần restart/quit
- **Touch event dedup**: Một tap = một event, không bao giờ double-fire
- **Null-safe teardown**: WebView destroy không NPE kể cả khi parent đã detached
- **v0.8 `_musicPromptVisible` flag**: Không phụ thuộc CSS/inline style để biết prompt đang mở — tránh tái diễn bug first-tap dead-end

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
5. **Total km display** (lifetime — v0.8: persist qua app restart)
6. **FPS counter** (debug overlay)
7. **Debug overlay** (bật/tắt trong settings)
8. **3 camera modes** (follow / far / cockpit)
9. **Settings screen** với các toggle
10. **Sound toggle** (mute)
11. **HUD visibility toggle**
12. **Speedometer dial** (kim quay theo tốc độ) — v0.8: đã hiện đúng!
13. **Swipe controls** (vuốt để lái — thay cho nút)
14. **Cheat codes** (Konami + 7 cheat khác)
15. **Cheat input box** (gõ cheat trực tiếp)
16. **Lua scripting hooks** — events fire Lua scripts trong `assets/lua/`
17. **Music indicator** (Now Playing)
18. **Auto-quality adjustment**
19. **Persistent stats** (lưu qua `SettingsManager` → SharedPreferences) — v0.8: không bị reset!
20. **Time tracking** (theo dõi thời gian sống sót — v0.8: không đếm pause time)

### 🌟 Tính năng cũ (giữ nguyên từ v0.5)
- Xe 3D chi tiết, đường vô tận (segment recycling)
- Ngã rẽ với rào chắn đỏ
- Cảnh quan sa mạc (xương rồng, đá, cồn cát, lạc đà chết)
- Troll features cũ (đảo điều khiển, đổi màu xe, fake game over, fake notif)
- Hệ thống thành tích (8 mốc)
- Pause system, kỷ lục, sương mù, screen shake, vignette off-road
- Easter egg (chơi 1 tiếng)

---

## 🏗️ Kiến trúc kỹ thuật (v0.8)

```
samacaogiac/
├── .github/workflows/              # CI: build + sign + validate APK
├── app/
│   ├── build.gradle                # Module config: v0.8 (versionCode=8)
│   ├── proguard-rules.pro          # R8 rules (LuaJ, JNI, Kotlin metadata)
│   └── src/main/
│       ├── AndroidManifest.xml     # appCategory="game", FOREGROUND_SERVICE_MEDIA_PLAYBACK
│       ├── cpp/                    # NDK module
│       │   ├── CMakeLists.txt      # CMake config
│       │   ├── native_audio.cpp    # C++ JNI bridge (jclass signature)
│       │   ├── audio_mixer.c       # C implementation (one-pole LP ducking)
│       │   ├── audio_mixer.h
│       │   ├── fast_math.h         # ARM-optimized sqrt/inv_sqrt
│       │   └── fast_distance_arm.S # ARMv7-A assembly (vsqrt.f32)
│       ├── assets/
│       │   ├── game/
│       │   │   ├── index.html      # UI + CSS (v0.8: inline display:none on musicPrompt)
│       │   │   ├── game.js         # Game engine v0.8 (flag-based prompt, showGameUI)
│       │   │   ├── three.min.js    # Three.js r160
│       │   │   └── shaders/        # GLSL shaders
│       │   │       ├── mirage.glsl
│       │   │       ├── heat_haze.glsl
│       │   │       ├── sandstorm.glsl
│       │   │       └── sky_vertex.glsl
│       │   ├── lua/                # Lua scripts
│       │   │   ├── config.lua
│       │   │   ├── on_achievement.lua
│       │   │   ├── on_death.lua
│       │   │   └── on_troll_event.lua
│       │   ├── favicon.svg
│       │   └── manhinhload.png
│       ├── java/com/samacaogiac/game/
│       │   ├── GameActivity.java          # v0.8: load all-time stats + unit fix
│       │   ├── LoadingActivity.java
│       │   ├── NativeAudioBridge.java
│       │   └── MusicPlayerService.java
│       ├── kotlin/com/samacaogiac/game/
│       │   ├── MusicPickerActivity.kt
│       │   ├── SettingsManager.kt
│       │   └── LuaScriptRunner.kt
│       └── res/
│           ├── layout/
│           ├── mipmap-*/
│           ├── values/
│           └── xml/
├── scripts/
│   ├── build.sh                    # Build wrapper (debug/release/native/check)
│   ├── validate_apk.sh             # Post-build APK validator
│   └── optimize_assets.py          # Asset optimizer (PNG, JS, GLSL)
├── Makefile                        # Standalone NDK build
├── build.gradle                    # Kotlin plugin
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

### v0.8 — Fix lỗi freeze thật + UI visibility (2026-07-29)

**Sửa lỗi freeze khi ấn CHƠI NGAY (LỖI THẬT, gốc rễ):**
1. `startGame()` first-tap dead-end — `style.display` trả `""` cho CSS `display:none`, check `!== 'none'` luôn true → return early → first tap không làm gì. Fix bằng cờ `_musicPromptVisible` tường minh.
2. Các nút gameplay (pause, settings, camera, boost bar, speedo) không bao giờ được set `display:flex` → user không thể pause/settings/đổi camera trong game. Fix bằng helper `showGameUI(show)`.

**Sửa lỗi nghiêm trọng khác:**
3. `bestDist` / `totalKm` / `deathCount` bị reset về 0 mỗi start game → mất tiến trình lưu. Fix: không reset all-time stats.
4. Bug đơn vị best distance: Java lưu meters, inject raw vào JS (km) → "1000.00 km" cho best 1km. Fix: chia 1000.
5. Timer HUD dùng `Date.now()-S.t0` (wall-clock) → đếm cả pause time. Fix: dùng `S.timeAlive` (tích lũy dt).
6. `onGameDeath` truyền `S.topSpeed` (m/s) thay vì `*3.6` (km/h). Fix: nhân 3.6.
7. `updateAudio` NPE khi `audioCtx` null. Fix: thêm null guard.
8. Music ducking sớm trước khi picker trả về. Fix: `S.musicPlaying=false` ban đầu, để poll detect.

### v0.7 — Critical Bug Fixes (preserved)
- Token-based gameLoop management
- init() try/catch với error overlay (WebGL2 fail không còn blank canvas)
- Touch event deduplication
- FPS counter NaN/Infinity guard
- Native lib + Lua VM init chuyển sang background thread
- onPause() evaluate JS trước khi pause WebView
- onDestroy() null-check parent
- Back button dùng OnBackPressedDispatcher (API 33+)
- MusicPickerActivity bỏ `Intent.createChooser`
- Audio focus denied → stop service sạch
- MediaPlayer IllegalStateException try/catch
- Lua scripts restore duck factor
- Lua VM nhận game state updates từ JS
- JNI signature `jobject` → `jclass` (static methods)
- Fix duplicate `cameraModeBtn` ID
- LoadingActivity null bitmap handling
- WebView cache `LOAD_NO_CACHE` → `LOAD_DEFAULT`

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

## 📋 Kiểm tra chất lượng (Quality Checklist)

Để đảm bảo "tuyệt đối không lỗi", v0.8 đã được kiểm tra:

- ✅ **Syntax validation**: `node --check game.js` pass
- ✅ **No NPE**: tất cả DOM refs null-safe (`if(el)`, `if(audioCtx)`, `if(carGroup)`)
- ✅ **No unit mismatch**: m/s vs km/h, meters vs km — đã rà và fix
- ✅ **No stats loss**: bestDist/totalKm/deathCount không reset, được persist
- ✅ **No UI invisibility**: tất cả nút gameplay được show qua `showGameUI(true)`
- ✅ **No first-tap dead-end**: `_musicPromptVisible` flag thay vì inspect `style.display`
- ✅ **No timer drift**: `S.timeAlive` (dt-based) thay vì `Date.now()-S.t0` (wall-clock)
- ✅ **No duplicate gameLoop**: token-based loop từ v0.7 vẫn hoạt động
- ✅ **No init silent fail**: try/catch + error overlay từ v0.7 vẫn hoạt động
- ✅ **No touch double-fire**: 600ms dedup window từ v0.7 vẫn hoạt động
- ✅ **No leak**: tất cả timeouts (troll, fog, sandstorm, invert, rotate, curse) được clear trong `restart()`
- ✅ **JNI safety**: `jclass` signature cho static methods (v0.7)
- ✅ **Lifecycle safety**: onPause/onResume/onDestroy null-safe (v0.7)

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<div align="center">
  <b>Sa Mạc Ảo Giác v0.8</b> — Made with ❤️ by Hieu Louis<br>
  <sub>C · C++ · Java · Kotlin · JavaScript · GLSL · Lua · Python · Shell · Makefile · ARM Assembly · Groovy · YAML · HTML/CSS · XML</sub>
</div>
