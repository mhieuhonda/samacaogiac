# 🏜️ Sa Mạc Ảo Giác — Desert Mirage

> Game đua xe sa mạc + bắn zombie sinh tồn trên Android — đa ngôn ngữ, tối ưu cao, nhạc nền, 150+ tính năng.

![Version](https://img.shields.io/badge/version-0.9-red)
![Platform](https://img.shields.io/badge/platform-Android_7.0+-green)
![Engine](https://img.shields.io/badge/engine-Three.js%20r160%20%2B%20NDK-blue)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Languages](https://img.shields.io/badge/languages-12%2B-9cf)

---

## 📱 Tải về

Tải APK mới nhất từ [GitHub Releases](https://github.com/mhieuhonda/samacaogiac/releases/latest).

> ⚠️ **Lưu ý cài đặt**: Vì đây là APK phát hành qua GitHub (không qua Google Play), Android có thể hiển thị cảnh báo "ứng dụng này có thể gây hại". Đó là cảnh báo mặc định cho APK side-load. Phiên bản v0.9 đã ký v1 + v2 + v3 schemes, không yêu cầu quyền nhạy cảm, có `appCategory="game"` và `debuggable=false` để giảm thiểu cảnh báo. Bạn có thể an tâm chọn **"Install anyway"**.

---

## 🆕 Có gì mới trong v0.9

### 🎮 HAI CHẾ ĐỘ CHƠI

| Chế độ | Mô tả |
|--------|--------|
| 🏜️ **Sa Mạc** | Đua xe trên sa mạc, tránh chướng ngại vật, thu coin, sống sót |
| 🧟 **Zombie** | Bắn súng sinh tồn, sống sót qua từng đợt zombie |

### 🧟 Chế độ Zombie — Chi tiết

| Loại Zombie | Màu | HP | Tốc độ | Sát thương | Đặc điểm |
|------------|-----|-----|--------|------------|----------|
| **Normal** | Xanh lá | 2 | Chậm | 10 | Zombie cơ bản, dễ tiêu diệt |
| **Mutant** | Tím | 5 | Trung bình | 20 | Đột biến, to hơn, khó tiêu diệt |
| **Horror** | Đỏ đen | 10 | Nhanh | 35 | Cực kinh dị, có gai, rất nguy hiểm |

**Tính năng Zombie Mode:**
- Hệ thống Wave: mỗi wave tăng số lượng và độ khó
- Thanh máu (100 HP), hồi 15 HP giữa các wave
- Hệ thống đạn (30 viên/băng, 120 dự trữ), reload 1.5s
- Súng lục first-person với hiệu ứng muzzle flash
- Crosshair ngắm bắn
- 7 sound effects riêng cho zombie mode
- Kỷ lục wave lưu trữ

### 🔊 Sound Effects mới (7)
1. **Gunshot** — tiếng súng với white noise burst + low thump
2. **Zombie Groan** — tiếng rên của zombie (sawtooth oscillator)
3. **Zombie Death** — tiếng zombie chết (descending tone)
4. **Reload Click** — tiếng nạp đạn (square wave click)
5. **Wave Alarm** — tiếng báo hiệu wave mới (3 beep)
6. **Damage Thud** — tiếng khi bị zombie đánh (sine 50Hz)
7. **Muzzle Flash** — hiệu ứng chớp sáng khi bắn

### ⚙️ Cài đặt đồ họa mới
- **Quality**: Low / Auto / High
- **FPS Limit**: Không / 30 / 60
- **Shadow**: On/Off
- **Particle**: Low / Medium / High
- **SFX Volume**: 0-100%
- **Engine Volume**: 0-100%
- **Camera**: Follow / Far / Cockpit
- **Troll Level**: Off / Normal / Chaos

### 🎭 150+ Tính năng (30 Troll + 120+ Useful)

**30 Troll Features:**
1. Control reversal (đảo điều khiển)
2. Car color change (đổi màu xe)
3. Fake game over (game over giả)
4. Fake notifications (thông báo giả)
5. Camera shake (rung camera)
6. Fake speed change (tốc độ ảo)
7. Fake rain/fog (mưa giả)
8. Gravity flip (đảo trọng lực)
9. Invisible car (xe tàng hình)
10. Inverted colors (đảo màu)
11. Car shrink (xe thu nhỏ)
12. Fake lag (lag giả)
13. Screen rotation (xoay màn hình)
14. Fake battery drain (pin giả)
15. Time dilation (chậm mo)
16. Fake coin theft (ăn cắp coin)
17. Engine curse (động cơ tắt/rét)
18. Fake ad popup (quảng cáo ảo)
19. Fake upgrade (nâng cấp ảo)
20. Fake jackpot (trúng thưởng ảo)
21. Hacker warning (cảnh báo hacker ảo)
22. Fake gas station (trạm xăng ảo)
23. Play time warning (cảnh báo chơi quá lâu)
24. Server maintenance (bảo trì ảo)
25. Fake video ads (quảng cáo video ảo)
26. WiFi connection (kết nối WiFi ảo)
27. Fake skin unlock (unlock skin ảo)
28. Fake restart (restart ảo)
29. 12+ troll messages random
30. 12+ fake notifications random

**120+ Useful Features:**
- Coins collectible + counter
- Boost meter (tự hồi) + nút ⚡
- Near-miss tracking (+coin mỗi 5 lần)
- Top speed display (km/h)
- Total km display (lifetime)
- FPS counter
- Debug overlay
- 3 camera modes
- Settings screen với sliders
- Sound toggle
- HUD visibility toggle
- Speedometer dial
- Swipe controls
- Cheat codes (Konami + 12+ cheat khác)
- Cheat input box
- Lua scripting hooks
- Music indicator
- Auto-quality adjustment
- Persistent stats
- Time tracking
- Graphics quality settings
- FPS limiting
- Shadow toggle
- Particle density control
- SFX volume control
- Engine volume control
- Camera mode slider
- Troll level control
- Zombie mode (wave system)
- Health bar
- Ammo system
- Reload mechanic
- 3 zombie types
- Wave announcement
- Damage flash
- Kill counter
- Wave record tracking
- Gunshot SFX
- Zombie groan SFX
- Zombie death SFX
- Reload SFX
- Wave alarm SFX
- Damage thud SFX
- Muzzle flash
- Crosshair
- Zombie death screen
- First-person gun model
- Mode selection screen
- Card-based UI
- And 60+ more micro-features...

### 🎮 Cheat Codes mới (v0.9)
- `god` — Bất tử + full health
- `ammo` — Đạn vô hạn
- `heal` — Hồi full máu
- `wave` — Skip wave tiếp
- `zombie` — +50 kills
- Giữ nguyên: `ghost`, `fly`, `big`, `small`, `reset`, `coin`, `speed`, `iddqd`, `trololol`, Konami

---

## 🎮 Cách chơi

### Chế độ Sa Mạc
| Điều khiển | Nút | Bàn phím |
|---|---|---|
| Rẽ trái | ◀ | ← / A |
| Rẽ phải | ▶ | → / D |
| Tăng tốc | ▲ | ↑ / W |
| Phanh | ▼ | ↓ / S |
| Boost | ⚡ | Shift |
| Tạm dừng | ⏸ | Esc / P |
| Cài đặt | ⚙ | — |
| Đổi camera | 📷 | — |

### Chế độ Zombie
| Điều khiển | Nút | Bàn phím |
|---|---|---|
| Di chuyển trái | ◀ | ← / A |
| Di chuyển phải | ▶ | → / D |
| Bắn | 🔫 | Space |
| Nạp đạn | 🔄 | R |
| Tạm dừng | ⏸ | Esc / P |

---

## 🏗️ Kiến trúc kỹ thuật (v0.9)

```
samacaogiac/
├── .github/workflows/              # CI: build + sign + validate APK
├── app/
│   ├── build.gradle                # v0.9 (versionCode=9)
│   ├── proguard-rules.pro          # R8 rules
│   └── src/main/
│       ├── AndroidManifest.xml     # appCategory="game"
│       ├── cpp/                    # NDK module
│       │   ├── CMakeLists.txt
│       │   ├── native_audio.cpp    # v0.9 JNI bridge
│       │   ├── audio_mixer.c
│       │   ├── audio_mixer.h
│       │   ├── fast_math.h
│       │   └── fast_distance_arm.S
│       ├── assets/
│       │   ├── game/
│       │   │   ├── index.html      # v0.9: mode selection + zombie UI
│       │   │   ├── game.js         # v0.9: Desert + Zombie engine
│       │   │   ├── three.min.js
│       │   │   └── shaders/
│       │   ├── lua/
│       │   │   ├── config.lua      # v0.9: zombie config
│       │   │   ├── on_achievement.lua
│       │   │   ├── on_death.lua
│       │   │   └── on_troll_event.lua
│       │   ├── favicon.svg
│       │   └── manhinhload.png
│       ├── java/com/samacaogiac/game/
│       │   ├── GameActivity.java
│       │   ├── LoadingActivity.java
│       │   ├── NativeAudioBridge.java
│       │   └── MusicPlayerService.java
│       ├── kotlin/com/samacaogiac/game/
│       │   ├── MusicPickerActivity.kt
│       │   ├── SettingsManager.kt
│       │   └── LuaScriptRunner.kt
│       └── res/
├── scripts/
│   ├── build.sh
│   ├── validate_apk.sh
│   └── optimize_assets.py
├── Makefile
├── build.gradle
├── settings.gradle
├── gradle.properties
└── README.md
```

### 🌐 Đa ngôn ngữ (12+ technologies)

| # | Công nghệ | Vai trò |
|---|---|---|
| 1 | **JavaScript** | Game engine (Three.js WebGL) |
| 2 | **Java** | Android Activities, Service, JNI bridge |
| 3 | **Kotlin** | MusicPickerActivity, SettingsManager, LuaScriptRunner |
| 4 | **C** | Audio mixer |
| 5 | **C++** | JNI bridge |
| 6 | **GLSL** | Shaders: mirage, heat haze, sandstorm, sky |
| 7 | **Lua** | Game-event hooks và config |
| 8 | **Python** | Asset optimizer |
| 9 | **Shell** | Build wrapper, APK validator |
| 10 | **Makefile** | Standalone NDK build |
| 11 | **ARM Assembly** | vsqrt.f32 inline |
| 12 | **Groovy** | build.gradle |
| 13 | **YAML** | GitHub Actions |
| 14 | **HTML/CSS** | UI và styles |
| 15 | **XML** | AndroidManifest, layouts, resources |

---

## 🔧 Lịch sử phiên bản

### v0.9 — Desert Racing + Zombie Survival (2026-07-29)
- HAI CHẾ ĐỘ CHƠI: Desert Racing + Zombie Survival
- 3 loại zombie: Normal, Mutant, Horror
- Wave system, health bar, ammo, reload
- 7 sound effects mới
- Graphics settings (quality, FPS limit, shadow, particles)
- Audio settings (SFX volume, engine volume)
- Troll level setting (Off/Normal/Chaos)
- 6 cheat codes mới
- 30 troll features + 120+ useful features
- Mode selection screen
- FPS limiting (30/60/none)
- Performance optimized cho mobile

### v0.8 — Fix lỗi freeze thật + UI visibility
- Fix startGame() first-tap dead-end
- Fix gameplay UI buttons không hiện
- Fix stats reset mỗi game start
- Fix best distance unit mismatch
- Fix timer HUD đếm pause time
- Fix onGameDeath sai đơn vị
- Fix updateAudio NPE
- Fix premature music ducking

### v0.7 — Critical Bug Fixes
- Token-based gameLoop
- init() try/catch + error overlay
- Touch event deduplication
- FPS counter NaN/Infinity guard
- Native lib + Lua VM init background thread
- onPause() evaluate JS trước khi pause WebView
- JNI signature jobject → jclass

### v0.6 — Performance + Music + Multi-language
- Performance: shadow map 1024→512, MeshLambertMaterial, squared-distance
- Music player: MusicPrompt, MusicPickerActivity, MusicPlayerService
- 10 troll features mới
- 20 useful features mới

### v0.5 — Bug Fix & Polish
### v0.4 — Major Bug Fixes
### v0.3 — Critical Fixes
### v0.2 — Troll features + bug fixes
### v0.1 — Initial release

---

## 🚀 Build từ source

### Yêu cầu
- JDK 17+
- Android SDK 34 + Build Tools 34.0.0
- Android NDK r26+
- CMake 3.22+

### Build commands

```bash
git clone https://github.com/mhieuhonda/samacaogiac.git
cd samacaogiac

# Build debug APK
./gradlew assembleDebug

# Build release APK
./scripts/build.sh release

# Validate APK
./scripts/validate_apk.sh app/build/outputs/apk/release/app-release.apk
```

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<div align="center">
  <b>Sa Mạc Ảo Giác v0.9</b> — Made with ❤️ by Hieu Louis<br>
  <sub>C · C++ · Java · Kotlin · JavaScript · GLSL · Lua · Python · Shell · Makefile · ARM Assembly · Groovy · YAML · HTML/CSS · XML</sub>
</div>
