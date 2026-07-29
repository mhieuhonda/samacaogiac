# 🏜️ Sa Mạc Ảo Giác

> **Desert Mirage** — Game đua xe sa mạc góc nhìn thứ ba cho Android, với tính năng troll

[![Version](https://img.shields.io/badge/version-0.4-orange.svg)](https://github.com/mhieuhonda/samacaogiac/releases)
[![Platform](https://img.shields.io/badge/platform-Android%207.0%2B-green.svg)](https://developer.android.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 📖 Giới thiệu

**Sa Mạc Ảo Giác** là game mobile Android góc nhìn thứ ba, nơi bạn điều khiển một chiếc xe ô tô chạy trên con đường xuyên sa mạc. Game được tối ưu cho điện thoại yếu, với hệ thống đường đi lặp lại (loop) giúp game nhẹ và mượt.

### ✨ Tính năng chính

#### 🎮 Gameplay
- 🚗 **Xe ô tô 3D** — Model chi tiết, scale 1.3x, nhìn rõ ràng
- 🛣️ **Đường rộng** — ROAD_W: 14, dễ điều khiển hơn
- 🔀 **Ngã rẽ thật** — Barrier collision! Đi thẳng = đâm barrier = chết
- 💀 **Obstacle collision** — Đá trên đường + lạc đà chết, va chạm = game over
- 🚧 **Biên giới đường** — Soft boundary + hard boundary + off-road recovery
- 🔄 **Road looping** — Terrain loop (recycling), game nhẹ
- 🏎️ **Car physics** — Tilt on steering, bounce, không quay ngược
- ⌨️ **Keyboard controls** — WASD + Arrow keys cho desktop testing

#### 🎭 Troll Features
- 🔀 **Đảo ngược điều khiển** — Random 4-7s: ◀ = ▶, ▶ = ◀!
- 🎨 **Đổi màu xe** — Random (8s), bán xe cũ không?
- 💬 **Pop-up troll** — 15+ tin nhắn sarcastic (không che tầm nhìn)
- 📱 **Fake notification** — Pin hết, GPS lỗi, mẹ gọi, virus... toàn ảo!
- 🏆 **Achievement sarcastic** — "0.5km = khoảng cách con gián"
- 🌧️ **Mưa sa mạc** — Fog burst ảo (4s rồi hết)
- ⚡ **Turbo/slow ảo** — Speed boost hoặc kẹt cát random
- 📊 **Screen shake** — "Sóng sa mạc" hoặc random shake
- 💀 **Fake death flash** — "GAME OVER! ...À, chỉ là ảo giác"
- 🔢 **Death counter** — Chết nhiều → message càng sarcastic
- 📳 **Haptic feedback** — Rung khi chết và khi troll đảo điều khiển

#### ⚙️ Engine & Performance
- ⚡ **Adaptive quality** — Auto-detect low-end devices
- 📱 **Pixel ratio cap** — Giảm GPU load
- 🌫️ **FogExp2** — Object culling xa → giảm draw calls
- 🔄 **Segment recycling** — Road loop, không tạo objects mới
- 🎯 **Single animation loop** — Loop chỉ bắt đầu khi bấm "CHƠI NGAY"
- ⏱️ **dt-based physics** — Không lệch frame rate
- 🧹 **Timeout management** — Track và clear tất cả setTimeout, không leak
- 🛡️ **Double-death prevention** — S.dead flag ngăn triggerDeath() gọi nhiều lần

---

## 🎮 Cách chơi

| Nút | Chức năng | Keyboard |
|-----|-----------|----------|
| ◀ Left | Rẽ trái | A / ← |
| ▶ Right | Rẽ phải | D / → |
| ▲ Gas | Tăng tốc | W / ↑ |
| ▼ Brake | Giảm tốc | S / ↓ |
| Space/Enter | Bắt đầu/Chơi lại | Space/Enter |

- **Xe tự chạy** — Bạn chỉ cần rẽ + điều chỉnh tốc độ
- **Ngã rẽ** — Phải rẽ trái/phải, đi thẳng = đâm barrier = chết
- **Off-road** — Ra đường quá 5s → xe hỏng → game over
- **Obstacle** — Va chạm đá/lạc đà = game over
- **Troll** — Random events đảo điều khiển, đổi màu, pop-up ảo...
- **Xe không quay ngược** — Rotation giới hạn ±51°, tự trở về thẳng

---

## 🐛 Bug Fixes History

### v0.3 → v0.4 (25+ bugs fixed)

| # | Bug | Fix |
|---|-----|-----|
| 1 | **GitHub Actions: Gradle build fail** — KEYSTORE_FILE env var không set | Thêm env vars cho Gradle build step |
| 2 | **GitHub Actions: APK find wrong** — find command có thể pick sai APK | Check if already signed before re-signing |
| 3 | **GitHub Actions: zipalign verbose** — -v flag gây issue | Dùng -f flag thay vì -v |
| 4 | **GitHub Actions: Wrapper jar missing** — Retroactive workflow không copy jar | Copy wrapper jar + properties riêng |
| 5 | **Troll popup timeout leak** — setTimeout không clear khi gọi lại | Track trollTimeout, clear trước khi set mới |
| 6 | **Achievement timeout leak** — setTimeout không clear | Track achievementTimeout, clear trước |
| 7 | **Fog reset timeout leak** — setTimeout không clear | Track fogTimeout, clear trước |
| 8 | **Double death** — triggerDeath() gọi nhiều lần trong 1 frame | Thêm S.dead flag |
| 9 | **No keyboard controls** — Không test được trên desktop | Thêm WASD + Arrow keys |
| 10 | **No vibration** — Game không rung khi chết | Thêm vibrate() bridge + navigator.vibrate |
| 11 | **reverseIndicator overlap** — Trùng vị trí với troll popup | Di chuyển lên top:50px |
| 12 | **No cursor pointer** — Buttons không có cursor | Thêm cursor:pointer |
| 13 | **No accessibility** — Không có aria-label, role | Thêm aria-label, role=dialog |
| 14 | **No reduced motion** — Animation không tắt được | Thêm prefers-reduced-motion |
| 15 | **WebView memory leak** — Không destroy WebView | Thêm destroy() trong onDestroy() |
| 16 | **WebView CPU waste** — Không pause WebView khi onPause | Thêm onPause/onResume lifecycle |
| 17 | **Deprecated hideSystemUI** — SYSTEM_UI_FLAG_* deprecated API 30+ | Dùng WindowInsetsControllerCompat |
| 18 | **Deprecated WebSettings** — setEnableSmoothTransition, setRenderPriority | Xóa deprecated APIs |
| 19 | **InputStream leak** — LoadingActivity không close InputStream | Dùng try-with-resources |
| 20 | **Unused constraintlayout** — Không dùng trong layouts | Xóa dependency |
| 21 | **Unused viewBinding** — Enabled nhưng không dùng | Tắt viewBinding |
| 22 | **Overly broad ProGuard** — -keep class android.webkit.WebView | Keep chỉ GameJSInterface |
| 23 | **Missing VIBRATE permission** — Haptic feedback không chạy | Thêm permission |
| 24 | **No largeHeap** — WebGL có thể OOM | Thêm android:largeHeap=true |
| 25 | **Missing ACCESS_NETWORK_STATE** — Không cần nhưng có | Xóa permission |

### v0.2 → v0.3 (12 bugs)
See [v0.3 release](https://github.com/mhieuhonda/samacaogiac/releases/tag/v0.3)

### v0.1 → v0.2 (8 bugs)
See [v0.2 release](https://github.com/mhieuhonda/samacaogiac/releases/tag/v0.2)

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
./gradlew assembleRelease  # Release APK (requires keystore)
```

### CI/CD (GitHub Actions)

Push a release tag → automatic build + signed APK upload:
```bash
git tag -a v0.5 -m "Release v0.5"
git push origin v0.5
```

Required secrets: `KEYSTORE_BASE64`, `KEY_ALIAS`, `KEY_PASSWORD`, `KEYSTORE_PASSWORD`

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
│   │       ├── game.js           # Engine v0.4 (all bugs fixed)
│   │       └── three.min.js      # Three.js r160
│   ├── java/com/samacaogiac/game/
│   │   ├── LoadingActivity.java  # Loading (troll messages)
│   │   └── GameActivity.java     # WebView + vibration bridge + lifecycle
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
| Android | WebView + Hardware Accel + Vibration Bridge + Lifecycle |
| Language | JavaScript (game), Java (Android) |
| Build | Gradle 8.4 + AGP 8.1.4 |
| Target | Android 7.0+ (API 24) |
| CI/CD | GitHub Actions (auto-build + sign APK) |

---

## 🎯 Changelog

### v0.4 (Current)
- 🔧 **Fix 25+ bugs** — GitHub Actions, game engine, Android lifecycle, ProGuard, a11y
- 🚀 **GitHub Actions CI** — Proper env vars, APK signing, wrapper check
- 🧹 **Timeout management** — Track + clear all setTimeout, no memory leak
- 🛡️ **Double-death prevention** — S.dead flag
- ⌨️ **Keyboard controls** — WASD + Arrow keys
- 📳 **Haptic feedback** — Vibration on death + troll events
- ♿ **Accessibility** — aria-label, role=dialog, prefers-reduced-motion
- 🤖 **Android lifecycle** — WebView onPause/onResume/destroy
- 📦 **Build optimization** — Remove unused deps, fix ProGuard, add largeHeap

### v0.3
- 🐛 Fix 12 bugs from v0.2 (black screen, car size, road width, off-road, reverse, forks, UI blocking)
- 🛣️ Đường rộng hơn 75%
- 🚗 Xe lớn hơn 30%
- 🔀 Ngã rẽ thật — barrier collision
- 🚧 Biên giới đường

### v0.2
- 🐛 Fix 8 bugs from v0.1
- 🎭 Add troll features
- 🎮 Car tilt + body bounce
- 📊 Death counter

### v0.1
- Initial release

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
