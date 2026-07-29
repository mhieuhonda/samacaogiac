# 🏜️ Sa Mạc Ảo Giác

> **Desert Mirage** — Game đua xe sa mạc góc nhìn thứ ba cho Android

[![Version](https://img.shields.io/badge/version-0.1-orange.svg)](https://github.com/mhieuhonda/samacaogiac/releases)
[![Platform](https://img.shields.io/badge/platform-Android%207.0%2B-green.svg)](https://developer.android.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 📖 Giới thiệu

**Sa Mạc Ảo Giác** là game mobile Android góc nhìn thứ ba, nơi bạn điều khiển một chiếc xe ô tô chạy trên con đường xuyên sa mạc. Game được tối ưu cho điện thoại yếu, với hệ thống đường đi lặp lại (loop) giúp game nhẹ và mượt mà.

### Tính năng chính

- 🚗 **Xe ô tô 3D** — Model xe đẹp mắt với chi tiết phong phú (đèn, gương, spoiler...)
- 🏜️ **Bối cảnh sa mạc** — Cảnh sa mạc chân thực với cây xương rồng, đá, đồi cát
- 🎮 **Điều khiển đơn giản** — Nút điều khiển ở hai bên màn hình, dễ chơi
- ⚡ **Tối ưu điện thoại yếu** — Low-poly models, fog, pixel ratio cap, adaptive quality
- 🔁 **Đường đi lặp lại** — Terrain loop (không xây tiếp) → game nhẹ, không tăng RAM
- 🎯 **Ngã rẽ chống AFK** — Cứ đi 1 đoạn sẽ có ngã rẽ, phải chọn hướng đi
- 💀 **Màn hình chết** — Hiện km đã đi + nút "Chơi lại"
- 🎉 **Easter egg** — Chơi 1 tiếng liên tục → "Chúc mừng bạn đã lãng phí 1 tiếng của cuộc đời"
- 📱 **Màn hình loading** — Professional loading screen với progress bar

---

## 🎮 Cách chơi

| Nút trái | Nút phải | Chức năng |
|----------|----------|-----------|
| ◀ Left   | ▶ Right  | Rẽ trái / Rẽ phái |
| ▲ Gas    | ▼ Brake  | Tăng tốc / Giảm tốc |

- **Xe tự chạy前进** — Bạn chỉ cần rẽ trái/phái và điều chỉnh tốc độ
- **Ngã rẽ** — Khi thấy biển báo, phải rẽ trái hoặc phái để tránh chết
- **Off-road** — Ra khỏi đường quá lâu (3.5s) → xe hỏng → chết

---

## 📱 Yêu cầu hệ thống

| Item | Minimum | Recommended |
|------|---------|-------------|
| Android | 7.0 (API 24) | 8.0+ (API 26+) |
| RAM | 1 GB | 2 GB+ |
| GPU | OpenGL ES 2.0 | OpenGL ES 3.0 |
| Storage | ~30 MB | ~30 MB |

---

## 🔨 Cách build (Developers)

### Yêu cầu build

- **Android Studio** 2023.1+ (Hedgehog hoặc mới hơn)
- **JDK** 17
- **Android SDK** — compileSdk 34, minSdk 24
- **Gradle** 8.4

### Build steps

```bash
# 1. Clone repo
git clone https://github.com/mhieuhonda/samacaogiac.git
cd samacaogiac

# 2. Open in Android Studio
# File → Open → select samacaogiac folder

# 3. Build APK
# Build → Build Bundle(s) / APK(s) → Build APK(s)

# 4. Find APK
# app/build/outputs/apk/debug/app-debug.apk
# hoặc app/build/outputs/apk/release/app-release.apk
```

### Build từ terminal

```bash
# Debug APK
./gradlew assembleDebug

# Release APK
./gradlew assembleRelease
```

---

## 📁 Cấu trúc project

```
samacaogiac/
├── app/
│   ├── build.gradle                  # App build config
│   ├── proguard-rules.pro            # ProGuard rules
│   └── src/main/
│       ├── AndroidManifest.xml       # Manifest (landscape, activities)
│       ├── assets/
│       │   ├── manhinhload.png       # Loading screen background
│       │   ├── favicon.svg           # Game logo
│       │   └── game/
│       │       ├── index.html        # Game UI (screens + canvas)
│       │       ├── game.js           # Game engine (Three.js)
│       │       └── three.min.js      # Three.js 3D library
│       ├── java/com/samacaogiac/game/
│       │   ├── LoadingActivity.java  # Loading screen (progress bar)
│       │   └── GameActivity.java     # WebView game container
│       └── res/
│           ├── layout/               # Activity layouts
│           ├── values/               # Strings, colors, styles
│           └── mipmap-*/             # Launcher icons
├── build.gradle                      # Root build config
├── settings.gradle                   # Gradle settings
├── gradle/wrapper/                   # Gradle wrapper
├── .github/workflows/                # CI/CD (auto build on tag)
├── .gitignore
├── favicon.svg                       # Original game logo
├── manhinhload.png                   # Original loading image
└── README.md                         # This file
```

---

## 🛠️ Công nghệ

| Component | Technology |
|-----------|------------|
| 3D Engine | Three.js (WebGL) |
| Android Wrapper | WebView + Hardware Acceleration |
| Language | JavaScript (game), Java (Android) |
| Build | Gradle 8.4 + Android Gradle Plugin 8.1.4 |
| Target | Android 7.0+ (API 24) |

### Tối ưu hóa cho điện thoại yếu

- **Adaptive quality**: `navigator.hardwareConcurrency` auto-detect → giảm poly count, fog, shadows
- **Pixel ratio cap**: `Math.min(devicePixelRatio, 1.5)` → giảm GPU load
- **FogExp2**: Culling objects xa → giảm draw calls
- **FlatShading**: Low-end devices → không tính smooth normals
- **No shadow maps**: Low-end → skip shadow rendering
- **Segment recycling**: Road loop → không tạo mới objects, chỉ recycle
- **Particle skip**: Low-end → bỏ dust particles

---

## 🎯 Roadmap

- [ ] v0.1 — Base game (xe + đường + sa mạc + ngã rẽ + chết)
- [ ] v0.2 — Sound effects + music
- [ ] v0.3 — Leaderboard (local)
- [ ] v0.4 — More car models
- [ ] v0.5 — Night mode
- [ ] v1.0 — Full release

---

## 👤 Credits

- **Developer**: Hieu Louis (mhieuhonda)
- **3D Models**: Procedural (Three.js primitives)
- **3D Engine**: [Three.js](https://threejs.org/) r160
- **Android Framework**: WebView + native Activities

---

## 📜 License

MIT License — See [LICENSE](LICENSE) file for details.

---

> *"Chúc mừng bạn đã lãng phí 1 tiếng của cuộc đời"* 🎉
