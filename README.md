# 🏜️ Sa Mạc Ảo Giác — Desert Mirage v1.0

> **Bản phát hành chính thức** — Game sa mạc đa chế độ trên Android với 5 chế độ chơi hoàn toàn khác biệt, thư viện 30+ sound effects, và engine 3D tối ưu cao.

![Version](https://img.shields.io/badge/version-1.0-brightgreen)
![Platform](https://img.shields.io/badge/platform-Android_7.0+-green)
![Engine](https://img.shields.io/badge/engine-Three.js%20r160%20%2B%20NDK-blue)
![License](https://img.shields.io/badge/license-MIT-yellow)
![Modes](https://img.shields.io/badge/game_modes-5-orange)
![SFX](https://img.shields.io/badge/sound_effects-30%2B-9cf)
![Languages](https://img.shields.io/badge/technologies-15%2B-ff69b4)

---

## 📱 Tải về

Tải APK mới nhất từ [GitHub Releases](https://github.com/mhieuhonda/samacaogiac/releases/latest).

> ⚠️ **Lưu ý cài đặt**: Vì đây là APK phát hành qua GitHub (không qua Google Play), Android có thể hiển thị cảnh báo "ứng dụng này có thể gây hại". Đó là cảnh báo mặc định cho APK side-load. Phiên bản v1.0 đã ký v1 + v2 + v3 schemes, không yêu cầu quyền nhạy cảm, có `appCategory="game"` và `debuggable=false` để giảm thiểu cảnh báo. Bạn có thể an tâm chọn **"Install anyway"**.

---

## 🆕 Có gì mới trong v1.0 (Official Release)

### 🎮 5 CHẾ ĐỘ CHƠI hoàn chỉnh

| # | Chế độ | Mô tả | Đặc trưng |
|---|--------|-------|-----------|
| 1 | 🏜️ **Sa Mạc** | Đua xe trên sa mạc, tránh chướng ngại vật, thu coin, sống sót | Mode gốc, 30+ troll features, milestones |
| 2 | 🧟 **Zombie** | Bắn súng sinh tồn, sống sót qua từng đợt zombie | 3 loại zombie, wave system, HP/ammo/reload |
| 3 | 🎮 **FPS** *(mới)* | Bắn súng góc nhìn thứ nhất, tiêu diệt kẻ địch | Arena 3D với cover, jump, wave system |
| 4 | 🚙 **Simulator** *(mới)* | Lái xe tự do trong map lớn, NPC, hệ thống nhiệm vụ | Open world 200x200m, 8 NPC, 12 missions |
| 5 | ⏱️ **Time Attack** *(mới)* | Đua với thời gian, không chết, đạt kỷ lục | 120s countdown, +2s mỗi coin, bounce thay vì chết |

### 🔊 Thư viện âm thanh v1.0 — 30+ sound effects procedural

Toàn bộ sound effects được tạo procedural bằng Web Audio API (oscillators + noise buffers), không cần file âm thanh ngoài.

#### UI / Generic
- `click`, `tap`, `select`, `back`, `open`, `close`, `error`, `success`

#### Desert / Driving
- `coin` (arpeggio 3 nốt), `boost`, `brake`, `nearMiss`, `forkWarning`, `crash`, `offRoad`, `milestone`

#### Zombie Mode
- `gunshot`, `zombieGroan`, `zombieDeath`, `reloadClick`, `reloadDone`, `waveAlarm`, `damageThud`, `waveComplete`, `heal`

#### FPS Mode
- `rifleShot`, `shotgunShot`, `enemyHit`, `enemyDeath`, `playerHurt`, `jump`, `land`, `emptyClick`

#### Simulator Mode
- `engineStart`, `engineOff`, `horn`, `npcPass`, `missionNew`, `missionDone`

#### Time Attack
- `tick`, `countdown`, `timeUp`

#### Troll / Easter
- `trollPop`, `achievement`, `curse`

#### Pause / Resume
- `pauseSfx`, `resumeSfx`

#### Ambient Layer (looping background per mode)
- **Desert wind** (bandpass 600Hz) — cho Sa Mạc + Time Attack
- **Indoor rumble** (bandpass 200Hz) — cho Zombie + FPS
- **City ambience** (bandpass 1500Hz) — cho Simulator

### 🐛 FIX BUGS NGHIÊM TRỌNG (so với v0.9)

1. **Engine sound bleeding** — Fixed: oscillator không còn chạy khi thoát mode, audioCtx.suspend() khi về welcome screen, mỗi mode có cờ `engineEnabled` riêng.
2. **Engine sound trong zombie mode** — Fixed: `updateAudio()` kiểm tra `Modes[GameMode].engineEnabled`, set gain=0 cho mode không dùng engine.
3. **HUD overlap ở zombie mode** — Fixed: ẩn `hudEl` (desert HUD) khi vào zombie mode, không còn hiện stale "0 km/h" đè lên ammo HUD.
4. **Pause/Settings/Camera buttons đè HUD right column** — Fixed: di chuyển 3 nút lên `top:8px`, HUD right column xuống dưới, không overlap.
5. **`spawnZombieWave` setTimeout leak** — Fixed: track `zombieSpawnTimeout` và clear khi restart/quit, chỉ fire nếu `S.phase==='playing' && GameMode==='zombie'`.
6. **`curseTimeout` không clear khi death/quit** — Fixed: `clearAllTimeouts()` centralized, gọi từ restart + quit.
7. **`dstD` (death text) overflow** — Fixed: `.end-d` CSS có `max-width:520px; word-wrap:break-word; overflow-wrap:break-word; hyphens:auto`.
8. **`openSettings` không pause game** — Fixed: settings panel pause game khi mở, resume khi đóng.
9. **`S.timeAlive` không tăng ở zombie mode** — Fixed: thêm `S.timeAlive += dt` trong `updateZombieMode`.
10. **`S.musicPlaying` không reset khi quit** — Fixed: reset trong `startGameAfterMusic`.
11. **Settings panel overflow trên màn nhỏ** — Fixed: `padding:16px 16px 60px; overflow-y:auto`, max-width cho mọi element.
12. **End screen text dài gây overflow viewport** — Fixed: `.end-d` có `max-width` + word-wrap.

### 🏗️ REFACTOR KIẾN TRÚC v1.0

- **Mode Registry pattern**: Mỗi mode implement `enter()`, `exit()`, `update(dt)`, `showPlayingUI()`, `deathScreen`, `engineEnabled`, `ambient`. `gameLoop` dispatch qua `Modes[GameMode].update(dt)`.
- **Audio Engine object**: Tất cả audio gói trong `AudioEngine` object với `init/suspend/resume/setEngineGain/updateEngine/startAmbient/stopAmbient` + 30+ SFX methods.
- **Centralized timeout cleanup**: `clearAllTimeouts()` xóa 13 timeout refs (troll, achievement, fog, sandstorm, invert, rotate, battery, curse×2, waveAnnounce, mission, zombieSpawn, uiClick).

### 🖼️ Hình ảnh mới
- Thay `favicon.svg` → `Logo.png` (logo game trong + ngoài khi tải về)
- Thay `manhinhload.png` → `banner.png` (ảnh loading screen)
- Cả hai ảnh đã có sẵn trong repo, chỉ việc reference.

---

## 🎮 Chi tiết 5 chế độ chơi

### 1. 🏜️ Sa Mạc (Desert Racing)

Đua xe trên sa mạc vô tận, né chướng ngại vật (rock, dead camel), ăn coin, sống sót.

| Element | Chi tiết |
|---------|----------|
| **Tốc độ** | 6–52 m/s (22–187 km/h), boost ×1.3 |
| **Off-road** | 5s giới hạn, vignette đỏ |
| **Coins** | 15 coin pool, +1 boost meter 10% mỗi coin |
| **Near-miss** | +1 coin mỗi 5 lần |
| **Milestones** | 0.5, 1, 2, 5, 10, 20, 50, 100 km |
| **Troll features** | 30 loại (control reversal, gravity flip, invisible car, v.v.) |
| **Camera** | 3 chế độ: Follow / Far / Cockpit |

### 2. 🧟 Zombie Survival

Bắn zombie sinh tồn qua từng đợt, có HP/ammo/reload.

| Loại Zombie | Màu | HP | Tốc độ | Sát thương | Đặc điểm |
|-------------|-----|-----|--------|------------|----------|
| **Normal** | Xanh lá | 2 | Chậm | 10 | Cơ bản |
| **Mutant** | Tím | 5 | Trung bình | 20 | Đột biến, to hơn |
| **Horror** | Đỏ đen | 10 | Nhanh | 35 | Có gai, cực nguy hiểm |

| Cơ chế | Chi tiết |
|--------|----------|
| **HP** | 100, +15 HP mỗi wave hoàn thành |
| **Ammo** | 30/băng, 120 dự trữ, reload 1.5s |
| **Shoot cooldown** | 150ms |
| **Zombie attack range** | 2.5m, cooldown 1s |

### 3. 🎮 FPS (First-Person Shooter) — MỚI

Bắn súng góc nhìn thứ nhất trong arena 3D với crates, cover, walls, enemies.

| Cơ chế | Chi tiết |
|--------|----------|
| **HP** | 100, +25 HP mỗi wave |
| **Ammo** | 30/băng, 90 dự trữ, reload 2s |
| **Shoot cooldown** | 120ms (rifle) |
| **Movement** | WASD relative to yaw, 5 m/s |
| **Jump** | 6 m/s initial vel, gravity 18 m/s² |
| **Enemy HP** | 4 (2 bullet để giết) |
| **Enemy damage** | 15 HP/attack, cooldown 1.2s |
| **Arena** | 80×80m, walls 6m, 20 crates làm cover, ceiling lights |

### 4. 🚙 Simulator — MỚI

Lái xe tự do trong open world 200×200m, NPC traffic, 12 nhiệm vụ.

| Cơ chế | Chi tiết |
|--------|----------|
| **Map size** | 200×200m |
| **Buildings** | 24 tòa nhà ngẫu nhiên |
| **NPC cars** | 8 xe với màu khác nhau, tự di chuyển |
| **Missions** | 12 pillar targets đặt theo vòng tròn |
| **Speed** | Tối đa 45 m/s (162 km/h) |
| **Steering** | Proportional to speed (realistic) |
| **Camera** | 3rd person follow |

### 5. ⏱️ Time Attack — MỚI

Đua với đồng hồ 120s, không chết, ăn coin để thêm thời gian.

| Cơ chế | Chi tiết |
|--------|----------|
| **Thời gian** | 120s ban đầu |
| **Coin bonus** | +2s mỗi coin ăn được |
| **No death** | Off-road chỉ slow, va chạm chỉ bounce |
| **Countdown** | 10s cuối có tick sound mỗi giây |
| **Goal** | Đi được quãng đường dài nhất |

---

## 🎮 Điều khiển

### Chế độ Sa Mạc / Time Attack
| Điều khiển | Nút | Bàn phím |
|---|---|---|
| Rẽ trái | ◀ | ← / A |
| Rẽ phải | ▶ | → / D |
| Tăng tốc | ▲ | ↑ / W |
| Phanh | ▼ | ↓ / S |
| Boost | ⚡ (hoặc tap màn hình) | Shift |
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

### Chế độ FPS
| Điều khiển | Nút | Bàn phím |
|---|---|---|
| Tiến lên | 🎯 (hold) | ↑ / W |
| Lùi | — | ↓ / S |
| Strafe trái | ◀ | ← / A |
| Strafe phải | ▶ | → / D |
| Quay trái/phải | — | ← / → (yaw) |
| Bắn | 🔫 | Space |
| Nạp đạn | 🔄 | R |
| Nhảy | ⤴ | — |

### Chế độ Simulator
| Điều khiển | Nút | Bàn phím |
|---|---|---|
| Rẽ trái | ◀ | ← / A |
| Rẽ phải | ▶ | → / D |
| Tăng tốc | ▲ | ↑ / W |
| Phanh/Đùi | ▼ | ↓ / S |

---

## ⚙️ Cài đặt đồ họa & âm thanh

- **Quality**: Low / Auto / High
- **FPS Limit**: Không / 30 / 60
- **Shadow**: On/Off (auto-disable if FPS < 30)
- **Particle**: Low / Medium / High
- **SFX Volume**: 0–100%
- **Engine Volume**: 0–100%
- **Music Volume**: 0–100%
- **Camera**: Follow / Far / Cockpit
- **Troll Level**: Off / Normal / Chaos

---

## 🎭 150+ Tính năng (30 Troll + 120+ Useful)

### 30 Troll Features (đã có từ v0.5–v0.6, giữ nguyên v1.0)
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
29. 30+ troll messages random
30. 12+ fake notifications random

### Cheat Codes (v1.0)
- `ghost` — Xe tàng hình 30s
- `fly` — Anti-gravity 30s
- `big` — Xe to ×2
- `small` — Xe nhỏ ×0.7
- `reset` — Reset kích thước
- `coin` — +100 coins
- `speed` — Tốc độ max
- `god` — Bất tử + full health (mọi mode)
- `ammo` — Đạn vô hạn (Zombie + FPS)
- `heal` — Hồi full máu (Zombie + FPS)
- `wave` — Skip wave tiếp (Zombie + FPS)
- `zombie` — +50 kills (Zombie + FPS)
- Konami code (↑↑↓↓←→←→ba) — GOD MODE
- `iddqd` — IDDQD immortal
- `trololol` — TROLL OVERDRIVE (3 troll liên tiếp)
- `boost` — Boost full

---

## 🏗️ Kiến trúc kỹ thuật (v1.0)

```
samacaogiac/
├── .github/workflows/              # CI: build + sign + validate APK
├── app/
│   ├── build.gradle                # v1.0 (versionCode=10, versionName="1.0")
│   ├── proguard-rules.pro          # R8 rules
│   └── src/main/
│       ├── AndroidManifest.xml     # appCategory="game"
│       ├── cpp/                    # NDK module
│       │   ├── CMakeLists.txt
│       │   ├── native_audio.cpp    # JNI bridge
│       │   ├── audio_mixer.c
│       │   ├── audio_mixer.h
│       │   ├── fast_math.h
│       │   └── fast_distance_arm.S
│       ├── assets/
│       │   ├── game/
│       │   │   ├── index.html      # v1.0: 5 mode cards, mode-specific HUDs
│       │   │   ├── game.js         # v1.0: Mode Registry + 5 modes + Audio Engine
│       │   │   ├── three.min.js
│       │   │   └── shaders/
│       │   ├── lua/
│       │   │   ├── config.lua
│       │   │   ├── on_achievement.lua
│       │   │   ├── on_death.lua
│       │   │   └── on_troll_event.lua
│       │   ├── Logo.png            # v1.0: thay favicon.svg
│       │   └── banner.png          # v1.0: thay manhinhload.png
│       ├── java/com/samacaogiac/game/
│       │   ├── GameActivity.java
│       │   ├── LoadingActivity.java  # v1.0: load Logo.png + banner.png
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
├── Logo.png                         # v1.0: root copy
├── banner.png                       # v1.0: root copy
└── README.md
```

### 🌐 Đa ngôn ngữ (15+ technologies)

| # | Công nghệ | Vai trò |
|---|---|---|
| 1 | **JavaScript** | Game engine (Three.js WebGL) — 3380 dòng |
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
| 14 | **HTML/CSS** | UI và styles — 5 mode cards responsive |
| 15 | **XML** | AndroidManifest, layouts, resources |

### 🎯 Mode Registry Pattern (v1.0)

```javascript
const Modes = {
    desert: { name, engineEnabled: true,  ambient: 'desert', enter, exit, update, showPlayingUI, deathScreen },
    zombie: { name, engineEnabled: false, ambient: 'indoor', enter, exit, update, showPlayingUI, deathScreen },
    fps:    { name, engineEnabled: false, ambient: 'indoor', enter, exit, update, showPlayingUI, deathScreen },
    sim:    { name, engineEnabled: true,  ambient: 'city',   enter, exit, update, showPlayingUI, deathScreen },
    time:   { name, engineEnabled: true,  ambient: 'desert', enter, exit, update, showPlayingUI, deathScreen },
};

// Game loop dispatch:
if(Modes[GameMode] && Modes[GameMode].update){
    Modes[GameMode].update(dt);
}
```

### 🔊 Audio Engine v1.0

```javascript
const AudioEngine = {
    init(), suspend(), resume(),
    setEngineGain(v), updateEngine(),
    _env(type, freq, dur, vol, freqEnd),  // generic envelope
    _noise(dur, vol, filterFreq, filterType),  // generic noise
    // 30+ SFX methods (click, coin, gunshot, rifleShot, etc.)
    startAmbient(type), stopAmbient(),
};
```

---

## 🔧 Lịch sử phiên bản

### v1.0 — Official Release (2026-07-30)
- **5 CHẾ ĐỘ CHƠI**: Desert + Zombie + **FPS (mới)** + **Simulator (mới)** + **Time Attack (mới)**
- **Mode Registry pattern**: kiến trúc abstraction cho mode switching
- **Audio Engine rewrite**: fix 4 structural bugs gây engine sound bleeding
- **30+ procedural SFX**: UI, driving, zombie, FPS, sim, time, troll
- **Ambient layer per mode**: desert wind, indoor rumble, city ambience
- **Fix 12 bugs nghiêm trọng**: HUD overlap, audio cleanup, setTimeout leaks, dstD overflow, openSettings không pause, v.v.
- **Thay ảnh**: favicon.svg → Logo.png, manhinhload.png → banner.png
- **HUD layout fix**: không còn overlap giữa control buttons và HUD right column
- **Settings panel**: scrollable, pause khi mở, music volume slider mới
- **End screens**: text wrap, không overflow trên màn nhỏ
- **Cheat codes mới**: god, ammo, heal, wave, zombie (mode-aware)
- **Loading screen**: hiển thị Logo.png + banner.png
- 150+ tính năng (30 troll + 120+ useful)

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

### v0.8 — Fix lỗi freeze thật + UI visibility
### v0.7 — Critical Bug Fixes
### v0.6 — Performance + Music + Multi-language
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

## 📊 Thống kê v1.0

| Metric | Value |
|--------|-------|
| Game modes | 5 |
| Total LOC (game.js) | 3380 |
| Sound effects | 30+ procedural |
| Ambient layers | 3 (desert, indoor, city) |
| Troll features | 30 |
| Useful features | 120+ |
| Cheat codes | 14+ |
| Languages/Technologies | 15+ |
| Bug fixes from v0.9 | 12 |
| Min Android | 7.0 (API 24) |
| Target Android | 14 (API 34) |

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<div align="center">
  <b>Sa Mạc Ảo Giác v1.0 — Official Release</b><br>
  Made with ❤️ by Hieu Louis<br>
  <sub>C · C++ · Java · Kotlin · JavaScript · GLSL · Lua · Python · Shell · Makefile · ARM Assembly · Groovy · YAML · HTML/CSS · XML</sub>
</div>
