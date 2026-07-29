# 🏜️ Sa Mạc Ảo Giác

> **Desert Mirage** — Game đua xe sa mạc góc nhìn thứ ba cho Android, với tính năng troll

[![Version](https://img.shields.io/badge/version-0.3-orange.svg)](https://github.com/mhieuhonda/samacaogiac/releases)
[![Platform](https://img.shields.io/badge/platform-Android%207.0%2B-green.svg)](https://developer.android.com)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 📖 Giới thiệu

**Sa Mạc Ảo Giác** là game mobile Android góc nhìn thứ ba, nơi bạn điều khiển một chiếc xe ô tô chạy trên con đường xuyên sa mạc. Game được tối ưu cho điện thoại yếu, với hệ thống đường đi lặp lại (loop) giúp game nhẹ và mượt.

### ✨ Tính năng chính

#### 🎮 Gameplay
- 🚗 **Xe ô tô 3D** — Model chi tiết (body, cabin, windshield, spoiler, exhaust, grille, racing stripe, license plate, door lines, fog lights...) — **Scale 1.3x lớn hơn v0.2**
- 🛣️ **Đường rộng hơn** — ROAD_W: 14 (tăng từ 8), dễ điều khiển hơn
- 🏜️ **Sa mạc chân thực** — Cây xương rồng, đá, đồi cát, cây chết, lạc đà ma trên đường
- 🔀 **Ngã rẽ thật** — Fork road có barrier collision! Đi thẳng = đâm barrier = chết, phải rẽ trái/phải
- 💀 **Obstacle collision** — Đá trên đường + lạc đà chết, va chạm = game over
- 🚧 **Biên giới đường** — Soft boundary (đẩy xe về) + hard boundary (không đi quá xa), off-road recovery
- 🔄 **Road looping** — Terrain loop (recycling), không xây tiếp → game nhẹ
- 🏎️ **Car physics** — Tilt on steering, bounce, smooth camera follow, không quay ngược được

#### 🎭 Troll Features
- 🔀 **Đảo ngược điều khiển** — Random 4-7s: ◀ = ▶, ▶ = ◀!
- 🎨 **Đổi màu xe** — Xe tự đổi màu random (8s), bán xe cũ không?
- 💬 **Pop-up troll** — 15+ tin nhắn sarcastic random (hiện ở góc dưới, không che tầm nhìn)
- 📱 **Fake notification** — Pin hết, GPS lỗi, mẹ gọi, virus... toàn ảo!
- 🏆 **Achievement sarcastic** — "0.5km = khoảng cách con gián", "1km = lãng phí thời gian"
- 🌧️ **Mưa sa mạc** — Fog burst ảo (4s rồi hết)
- ⚡ **Turbo/slow ảo** — Speed boost hoặc kẹt cát random
- 📊 **Screen shake** — "Sóng sa mạc" hoặc random shake
- 💀 **Fake death flash** — "GAME OVER! ...À, chỉ là ảo giác"
- 🔢 **Death counter** — Chết nhiều → message càng sarcastic

#### ⚙️ Engine & Performance
- ⚡ **Adaptive quality** — Auto-detect low-end devices → giảm poly, shadows, particles
- 📱 **Pixel ratio cap** — `Math.min(devicePixelRatio, 1.5)` → giảm GPU load
- 🌫️ **FogExp2** — Object culling xa → giảm draw calls
- 🔄 **Segment recycling** — Road loop, không tạo objects mới
- 🎯 **Single animation loop** — Loop chỉ bắt đầu khi người chơi bấm "CHƠI NGAY"
- ⏱️ **dt-based physics** — Tất cả physics đều dùng dt, không bị lệch frame rate

---

## 🎮 Cách chơi

| Nút | Chức năng |
|-----|-----------|
| ◀ Left | Rẽ trái |
| ▶ Right | Rẽ phải |
| ▲ Gas | Tăng tốc |
| ▼ Brake | Giảm tốc |

- **Xe tự chạy** — Bạn chỉ cần rẽ + điều chỉnh tốc độ
- **Ngã rẽ** — Phải rẽ trái/phải, đi thẳng = đâm barrier = chết
- **Off-road** — Ra đường quá 5s → xe hỏng → game over (có soft boundary đẩy xe về)
- **Obstacle** — Va chạm đá/lạc đà = game over
- **Troll** — Random events đảo điều khiển, đổi màu, pop-up ảo...
- **Xe không quay ngược** — Rotation được giới hạn ±51°, tự động trở về thẳng

---

## 🐛 Bug Fixes (v0.2 → v0.3)

| Bug | Mô tả | Fix |
|-----|-------|-----|
| Màn hình đen khi vào game | Camera bắt đầu ở (0,0,0) — nằm TRONG xe, lerp 0.06 quá chậm | Set camera position ngay lập tức trong `startGame()` + `restart()`, tăng lerp lên 0.08 |
| Xe quá bé, đường quá bé | ROAD_W=8, car body 2.5×4.6, CAM_DIST=12 | ROAD_W=14, CAR_SCALE=1.3, CAM_DIST=16, CAM_H=7.5 |
| Xe đi ra khỏi đường | Không có hard boundary, chỉ check soft boundary | Thêm soft boundary (đẩy xe về) + hard boundary (clamp position) |
| Xe quay ngược | rotation.y không giới hạn, xe có thể quay 180° | Giới hạn MAX_STEER_Y=PI/3.5 (~51°), tự động trở về thẳng |
| Ngã rẽ không hoạt động | Barrier chỉ là visual, không có collision | Thêm `checkForkBarrier()` — đâm barrier = chết |
| Cảnh báo che tầm nhìn | Troll popup ở chính giữa màn hình | Di chuyển popup xuống bottom:100px, milestone lên top:50px |
| `state.speed` trong updateDust | Tham chiếu sai biến `state.speed` | Đổi thành `S.speed` |
| Duplicate id trên fakeNotif | `<div id="fakeNotif" id="fakeNotifText">` | Tách thành `<div id="fakeNotif"><span id="fakeNotifText"></span></div>` |
| Shoulder creation bug | Dùng `Object.assign` sai cho Three.js mesh | Tạo shoulder mesh riêng biệt, set position/rotation đúng |
| Fog reset sai device type | Dùng `C.PR_CAP > 1` thay vì `isLowDevice` | Lưu `isLowDevice` flag, dùng để reset fog density đúng |
| Off-road timer không recover | offRoadT chỉ tăng, không giảm khi về đường | Thêm `S.offRoadT=Math.max(0, S.offRoadT-dt*0.5)` khi on-road |
| Boot loop chạy khi chưa chơi | `startLoop()` gọi ngay khi boot,浪费 CPU | Chỉ render 1 frame khi boot, loop bắt đầu khi bấm "CHƠI NGAY" |

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
│   │       ├── game.js           # Engine v0.3 (all bugs fixed)
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

### v0.3 (Current)
- 🐛 **Fix 12 bugs** from v0.2 (critical: black screen, no forks, off-road, reverse)
- 🛣️ **Đường rộng hơn** — ROAD_W: 8 → 14, dễ điều khiển
- 🚗 **Xe lớn hơn** — CAR_SCALE: 1.3x, nhìn rõ hơn
- 📷 **Camera tốt hơn** — CAM_DIST: 16, CAM_H: 7.5, lerp: 0.08, init ngay lập tức
- 🔀 **Ngã rẽ thật** — Barrier collision check, đi thẳng = chết
- 🚧 **Biên giới đường** — Soft boundary + hard boundary + off-road recovery
- 🔒 **Xe không quay ngược** — MAX_STEER_Y: ~51°, auto-center
- 👁️ **UI không che tầm nhìn** — Troll popup → bottom, milestone → top
- 📱 **Off-road timer recover** — Về đường → timer giảm dần

### v0.2
- 🐛 Fix 8 bugs from v0.1
- 🎭 Add troll features: control reversal, car color change, fake notifications, sarcastic achievements, fake death flash, screen shake, fog burst, speed illusion
- 🚗 Improved car model: grille chrome strips, racing stripe, fog lights, license plate, door lines
- 🏜️ More decorations: dead trees, dead camels on road
- 🎯 Fork road geometry + dead-end barrier
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
