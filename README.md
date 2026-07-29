# 🏜️ Sa Mạc Ảo Giác — Desert Mirage

> Game đua xe sa mạc trên Android — đa ngôn ngữ, tối ưu cao, có nhạc nền và nhiều tính năng troll.

![Version](https://img.shields.io/badge/version-0.6-orange)
![Platform](https://img.shields.io/badge/platform-Android_7.0+-green)
![Engine](https://img.shields.io/badge/engine-Three.js%20r160%20%2B%20NDK-blue)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Languages](https://img.shields.io/badge/languages-12%2B-9cf)

---

## 📱 Tải về

Tải APK mới nhất từ [GitHub Releases](https://github.com/mhieuhonda/samacaogiac/releases/latest).

> ⚠️ **Lưu ý cài đặt**: Vì đây là APK phát hành qua GitHub (không qua Google Play), Android có thể hiển thị cảnh báo "ứng dụng này có thể gây hại". Đó là cảnh báo mặc định cho APK side-load. Phiên bản v0.6 đã ký v1 + v2 + v3 schemes, không yêu cầu quyền nhạy cảm, có `appCategory="game"` và `debuggable=false` để giảm thiểu cảnh báo. Bạn có thể an tâm chọn **"Install anyway"**.

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

## ✨ Tính năng (v0.6)

### 🎵 Âm nhạc & Âm thanh
- **Music player** — Khi vào game, hiện prompt hỏi "Bạn có muốn phát nhạc không?". Nếu có, mở picker chọn bài từ điện thoại → nhạc phát nền qua `MusicPlayerService` (foreground service).
- **Engine ducking** — Khi nhạc đang phát, tiếng động cơ tự động nhỏ lại (qua C++ native mixer với one-pole low-pass gain ramping).
- **Audio focus** — Tự pause nhạc khi có cuộc gọi đến hoặc app khác cần âm thanh.

### 🏎️ Tối ưu hiệu năng (giảm lag v0.6)
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

### 🎭 10 TROLL FEATURES (mới v0.6)
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

### 🛠️ 20 USEFUL FEATURES (mới v0.6)
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

### 🌟 Tính năng v0.5 (giữ nguyên)
- Xe 3D chi tiết, đường vô tận (segment recycling)
- Ngã rẽ với rào chắn đỏ
- Cảnh quan sa mạc (xương rồng, đá, cồn cát, lạc đà chết)
- Troll features cũ (đảo điều khiển, đổi màu xe, fake game over, fake notif)
- Hệ thống thành tích (8 mốc)
- Pause system, kỷ lục, sương mù, screen shake, vignette off-road
- Easter egg (chơi 1 tiếng)

---

## 🏗️ Kiến trúc kỹ thuật (v0.6)

```
samacaogiac/
├── .github/workflows/
│   ├── build-release.yml          # CI: build + sign + validate APK
│   └── retroactive-release.yml    # Build APK cho release cũ
├── app/
│   ├── build.gradle               # Module config: Kotlin, NDK, LuaJ, v1/v2/v3 signing
│   ├── proguard-rules.pro         # R8 rules (LuaJ, JNI, Kotlin metadata)
│   └── src/main/
│       ├── AndroidManifest.xml    # appCategory="game", FOREGROUND_SERVICE_MEDIA_PLAYBACK
│       ├── cpp/                   # v0.6 NDK module
│       │   ├── CMakeLists.txt     # CMake config
│       │   ├── native_audio.cpp   # C++ JNI bridge
│       │   ├── audio_mixer.c      # C implementation (one-pole LP ducking)
│       │   ├── audio_mixer.h
│       │   ├── fast_math.h        # ARM-optimized sqrt/inv_sqrt
│       │   └── fast_distance_arm.S  # ARMv7-A assembly (vsqrt.f32)
│       ├── assets/
│       │   ├── game/
│       │   │   ├── index.html     # UI + CSS (v0.6: music prompt, settings, debug)
│       │   │   ├── game.js        # Game engine v0.6
│       │   │   ├── three.min.js   # Three.js r160
│       │   │   └── shaders/       # v0.6 GLSL shaders
│       │   │       ├── mirage.glsl
│       │   │       ├── heat_haze.glsl
│       │   │       ├── sandstorm.glsl
│       │   │       └── sky_vertex.glsl
│       │   ├── lua/               # v0.6 Lua scripts (game balance + event hooks)
│       │   │   ├── config.lua
│       │   │   ├── on_achievement.lua
│       │   │   ├── on_death.lua
│       │   │   └── on_troll_event.lua
│       │   ├── favicon.svg
│       │   └── manhinhload.png
│       ├── java/com/samacaogiac/game/
│       │   ├── GameActivity.java          # WebView + JS bridge (v0.6: 12 bridge methods)
│       │   ├── LoadingActivity.java
│       │   ├── NativeAudioBridge.java     # v0.6 JNI wrapper
│       │   └── MusicPlayerService.java    # v0.6 foreground music service
│       ├── kotlin/com/samacaogiac/game/
│       │   ├── MusicPickerActivity.kt     # v0.6 Kotlin file picker
│       │   ├── SettingsManager.kt         # v0.6 Kotlin SharedPreferences
│       │   └── LuaScriptRunner.kt         # v0.6 Kotlin Lua VM (LuaJ)
│       └── res/
│           ├── layout/
│           ├── mipmap-*/
│           ├── values/
│           └── xml/
│               ├── backup_rules.xml
│               └── data_extraction_rules.xml
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
| Game Engine | Three.js r160 (WebGL) |
| Native Audio | C/C++ NDK với ARM-optimized fast math |
| Scripting | Lua 5.1 (LuaJ 3.0.1) |
| Platform | Android 7.0+ (API 24) |
| Language | JS + Java + Kotlin + C/C++ + Lua + Python + Shell + ARM asm |
| Build | Gradle 8.4 + AGP 8.1.4 + CMake 3.22.1 + NDK r26d |
| CI/CD | GitHub Actions (auto-build + sign + validate APK) |
| Audio | Web Audio API + Native C++ mixer (ducking) |
| Rendering | Three.js WebGL in WebView (hardware accelerated) |
| Signing | APK Signature Scheme v1 + v2 + v3 |

---

## 🔧 Lịch sử phiên bản

### v0.6 — Performance + Music + Multi-language (2026-07-29)

#### 🚀 Performance (giảm lag)
| # | Vấn đề | Sửa |
|---|---|---|
| 1 | Shadow map 1024×1024 tốn GPU | Giảm xuống 512×512 + `PCFShadowMap` |
| 2 | `MeshPhongMaterial` (specular expensive) | Chuyển sang `MeshLambertMaterial` cho car body |
| 3 | `Math.sqrt` mỗi cặp collision | Squared distance + precomputed combined radius |
| 4 | Dust particle update 60Hz | Throttle xuống 30Hz |
| 5 | `array.length` query mỗi iteration | Cache trong biến local |
| 6 | Resize event spam | Debounce 100ms |
| 7 | `setTargetAtTime` mỗi frame | Chỉ khi target thực sự thay đổi |
| 8 | Không có auto-quality | FPS < 30 → tự tắt shadow |
| 9 | WebGL high precision trên mobile | `mediump` trên thiết bị yếu |
| 10 | `physicallyCorrectLights` mặc định true | Tắt |

#### 🎵 Music player
| # | Tính năng | Chi tiết |
|---|---|---|
| 11 | Music prompt khi vào game | Hỏi "Bạn có muốn phát nhạc không?" |
| 12 | File picker | Mở system file picker chọn audio |
| 13 | Background service | `MusicPlayerService` foreground service |
| 14 | Engine ducking | C++ native mixer với LP gain ramping |
| 15 | Persistable URI | `takePersistableUriPermission` cho restart |
| 16 | Audio focus | Pause khi có cuộc gọi |

#### 🛡️ Fix "app harmful" warning
| # | Vấn đề | Sửa |
|---|---|---|
| 17 | Thiếu v2/v3 signing | `enableV2Signing=true`, `enableV3Signing=true` |
| 18 | `debuggable` không explicit | `android:debuggable="false"` trong manifest |
| 19 | Thiếu `appCategory` | `android:appCategory="game"` |
| 20 | Permission không cần thiết | Bỏ INTERNET, thêm `READ_MEDIA_AUDIO` (chỉ 13+) |
| 21 | `READ_EXTERNAL_STORAGE` không giới hạn | `maxSdkVersion=32` |
| 22 | Thiếu foreground service type | `foregroundServiceType="mediaPlayback"` |

#### 🎭 10 Troll mới
| # | Tên | Mô tả |
|---|---|---|
| 23 | Gravity flip | Xe nảy ngược đầu |
| 24 | Invisible car | Xe chớp ẩn/hiện |
| 25 | Inverted colors | Đảo màu màn hình |
| 26 | Car shrink | Xe thu nhỏ |
| 27 | Fake lag | Lag giả |
| 28 | Screen rotation | Màn hình xiên |
| 29 | Fake battery drain | Notif pin sập |
| 30 | Time dilation | Slow motion |
| 31 | Fake coin theft | Lạc đà ma ăn cắp coin |
| 32 | Engine curse | Động cơ silent rồi rất to |

#### 🛠️ 20 Useful features mới
| # | Tính năng |
|---|---|
| 33 | Coins collectible + counter |
| 34 | Boost meter + button |
| 35 | Near-miss tracking |
| 36 | Top speed display |
| 37 | Total km display |
| 38 | FPS counter |
| 39 | Debug overlay |
| 40 | 3 camera modes |
| 41 | Settings screen |
| 42 | Sound toggle |
| 43 | HUD toggle |
| 44 | Speedometer dial |
| 45 | Swipe controls |
| 46 | Cheat codes |
| 47 | Cheat input box |
| 48 | Lua scripting hooks |
| 49 | Music indicator |
| 50 | Auto-quality |
| 51 | Persistent stats |
| 52 | Time tracking |

#### 🌐 Đa ngôn ngữ
| # | Công nghệ | File |
|---|---|---|
| 53 | C | `audio_mixer.c` |
| 54 | C++ | `native_audio.cpp` |
| 55 | Java | `GameActivity.java`, `MusicPlayerService.java`, `NativeAudioBridge.java`, `LoadingActivity.java` |
| 56 | Kotlin | `MusicPickerActivity.kt`, `SettingsManager.kt`, `LuaScriptRunner.kt` |
| 57 | GLSL | 4 shader files trong `assets/game/shaders/` |
| 58 | Lua | 4 script files trong `assets/lua/` |
| 59 | Python | `scripts/optimize_assets.py` |
| 60 | Shell | `scripts/build.sh`, `scripts/validate_apk.sh` |
| 61 | Makefile | `Makefile` (repo root) |
| 62 | ARM Assembly | `fast_distance_arm.S` |

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
  <b>Sa Mạc Ảo Giác v0.6</b> — Made with ❤️ by Hieu Louis<br>
  <sub>C · C++ · Java · Kotlin · JavaScript · GLSL · Lua · Python · Shell · Makefile · ARM Assembly · Groovy · YAML · HTML/CSS · XML</sub>
</div>
