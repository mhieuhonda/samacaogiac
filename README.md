# 🏜️ Sa Mạc Ảo Giác

> **Desert Mirage** — Game đua xe sa mạc góc nhìn thứ ba cho Android, với tính năng troll

[![Version](https://img.shields.io/badge/version-0.2-orange.svg)](https://github.com/mhieuhonda/samacaogiac/releases)
[![Platform](https://img.shields.io/badge/platform-Android%207.0%2B-green.svg)](https://developer.android.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 📖 Giới thiệu

**Sa Mạc Ảo Giác** là game mobile Android góc nhìn thứ ba, nơi bạn điều khiển một chiếc xe ô tô chạy trên con đường xuyên sa mạc. Game được tối ưu cho điện thoại yếu, với hệ thống đường đi lặp lại (loop) giúp game nhẹ và mượt.

**Đặc biệt v0.2**: Game có hệ thống **troll features** — pop-up ảo, đảo ngược điều khiển, đổi màu xe, fake notification, achievement sarcastic... Chơi càng lâu, troll càng nhiều!

### ✨ Tính năng chính

#### 🎮 Gameplay
- 🚗 **Xe ô tô 3D** — Model chi tiết (body, cabin, windshield, spoiler, exhaust, grille chrome strips, racing stripe, license plate, door lines, fog lights...)
- 🏜️ **Sa mạc chân thực** — Cây xương rồng, đá, đồi cát, cây chết, lạc đà ma trên đường
- 🎯 **Ngã rẽ thật** — Fork road có split geometry + barrier, đi thẳng = chết!
- 💀 **Obstacle collision** — Đá trên đường + lạc đà chết, va chạm = game over
- 🔁 **Road looping** — Terrain loop (recycling), không xây tiếp → game nhẹ
- 🏎️ **Car physics** — Tilt on steering, bounce, smooth camera follow

#### 🎭 Troll Features (v0.2 mới!)
- 🔀 **Đảo ngược điều khiển** — Random 4-7s: ◀ = ▶, ▶ = ◀!
- 🎨 **Đổi màu xe** — Xe tự đổi màu random (8s), bán xe cũ không?
- 💬 **Pop-up troll** — 15+ tin nhắn sarcastic random
- 📱 **Fake notification** — Pin hết, GPS lỗi, mẹ gọi, virus... toàn ảo!
- 🏆 **Achievement sarcastic** — "0.5km = khoảng cách con gián", "1km = lãng phí thời gian"
- 🌧️ **Mưa sa mạc** — Fog burst ảo (4s rồi hết)
- ⚡ **Turbo/slow ảo** — Speed boost hoặc kẹt cát random
- 📊 **Screen shake** — "Sóng sa mạc" hoặc random shake
- 💀 **Fake death flash** — "GAME OVER! ...À, chỉ là ảo giác 😏"
- 🔢 **Death counter** — Chết nhiều → message càng sarcastic

#### ⚙️ Engine & Performance
- ⚡ **Adaptive quality** — Auto-detect low-end devices → giảm poly, shadows, particles
- 📱 **Pixel ratio cap** — `Math.min(devicePixelRatio, 1.5)` → giảm GPU load
- 🌫️ **FogExp2** — Object culling xa → giảm draw calls
- 🔄 **Segment recycling** — Road loop, không tạo objects mới
- 🎯 **Single animation loop** — Fix bug v0.1 (double loop → CPU spike)
- ⏱️ **dt-based physics** — Fix bug v0.1 (offRoadT never accumulated)

---

## 🎮 Cách chơi

| Nút trái | Nút phải | Chức năng |
|----------|----------|-----------|
| ◀ Left   | ▶ Right  | Rẽ trái / Rẽ phải |
| ▲ Gas    | ▼ Brake  | Tăng tốc / Giảm tốc |

- **Xe tự chạy** — Bạn chỉ cần rẽ + điều chỉnh tốc độ
- **Ngã rẽ** — Phải rẽ trái/phải, đi thẳng = đâm barrier = chết
- **Off-road** — Ra đường quá 4s → xe hỏng → game over
- **Obstacle** — Va chạm đá/lạc đà = game over
- **Troll** — Random events đảo điều khiển, đổi màu, pop-up ảo...

---

## 🐛 Bug Fixes (v0.1 → v0.2)

| Bug | Mô tả | Fix |
|-----|-------|-----|
| Double animation loop | `loop()` gọi từ `startGame()` AND `requestAnimationFrame` → 2 loops chạy | Single loop với `loopRunning` flag |
| offRoadT never accumulated | `checkRoad()` gọi `clock.getDelta()` 2 lần → dt=0 ở lần 2 | Pass `dt` từ loop |
| Wheel spin axis wrong | Cylinder rotated z=PI/2, spin on wrong axis | Fix spin to `.rotation.x` |
| Sun sphere doesn't follow | Only DirectionalLight position updated | Sun mesh follows car too |
| Ground too small | 1 plane, only follows Z | 3 overlapping planes, follow X+Z |
| Forks decorative-only | Sign posts but no actual fork road | Real fork geometry + dead-end barrier |
| No off-road feedback | Silent death after 4s | Red vignette overlay + pulse animation |
| No car tilt | Car only rotates in Y | Lean into turns (`rotation.z`) + bounce |

---

## 📱 Yêu cầu hệ thống

| Item | Minimum | Recommended |
|------|---------|-------------|
| Android | 7.0 (API 24) | 8.0+ (API 26+) |
| RAM | 1 GB | 2 GB+ |
| GPU | OpenGL ES 2.0 | OpenGL ES 3.0 |
| Storage | ~35 MB | ~35 MB |

---

## 🔨 Build

```bash
# Clone
git clone https://github.com/mhieuhonda/samacaogiac.git
cd samacaogiac

# Android Studio: File → Open → select folder
# Build → Build APK

# Terminal:
./gradlew assembleDebug    # Debug APK
./gradlew assembleRelease  # Release APK
```

---

## 📁 Structure

```
samacaogiac/
├── app/src/main/
│   ├── assets/
│   │   ├── manhinhload.png       # Loading screen background
│   │   ├── favicon.svg           # Game logo
│   │   └── game/
│   │       ├── index.html        # UI screens + overlays + troll UI
│   │       ├── game.js           # Engine v0.2 (bugs fixed + trolls)
│   │       └── three.min.js      # Three.js r160
│   ├── java/com/samacaogiac/game/
│   │   ├── LoadingActivity.java  # Loading (troll messages)
│   │   └── GameActivity.java     # WebView + vibration bridge
│   └── res/                       # Layouts, icons, styles
├── .github/workflows/             # CI/CD auto-build
├── build.gradle / settings.gradle
├── LICENSE / .gitignore
└── README.md
```

---

## 🛠 Tech Stack

| Component | Tech |
|-----------|------|
| 3D Engine | Three.js (WebGL) |
| Android | WebView + Hardware Accel + Vibration Bridge |
| Language | JavaScript (game), Java (Android) |
| Build | Gradle 8.4 + AGP 8.1.4 |
| Target | Android 7.0+ (API 24) |

---

## 🎯 Changelog

### v0.2 (Current)
- 🐛 Fix 8 bugs from v0.1
- 🎭 Add troll features: control reversal, car color change, fake notifications, sarcastic achievements, fake death flash, screen shake, fog burst, speed illusion
- 🚗 Improved car model: grille chrome strips, racing stripe, fog lights, license plate, door lines
- 🏜️ More decorations: dead trees, dead camels on road
- 🎯 Real fork road geometry + dead-end barrier
- 💀 Obstacle collision system
- 📱 Off-road vignette overlay
- 🎮 Car tilt on steering + body bounce
- 📊 Death counter with sarcastic messages
- ⏱️ Play timer in HUD
- 🔔 Vibration feedback (Android bridge)

### v0.1
- Initial release: basic game with car + desert + road + death screen + 1-hour easter egg

---

## 👤 Credits

- **Developer**: Hieu Louis (mhieuhonda)
- **3D Engine**: [Three.js](https://threejs.org/) r160

---

## 📜 License

MIT License — See [LICENSE](LICENSE)

---

> *"Chúc mừng bạn đã lãng phí 1 tiếng của cuộc đời"* 🎉
> *"0.5km! ...Đó là khoảng cách của 1 con gián"* 🏆
