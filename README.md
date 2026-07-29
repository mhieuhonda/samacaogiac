# 🏜️ Sa Mạc Ảo Giác — Desert Mirage

> Game đua xe sa mạc trên Android với Three.js WebGL, hiệu ứng troll, và hệ thống ngã rẽ.

![Version](https://img.shields.io/badge/version-0.5-orange)
![Platform](https://img.shields.io/badge/platform-Android-green)
![Engine](https://img.shields.io/badge/engine-Three.js%20r160-blue)
![License](https://img.shields.io/badge/license-MIT-yellow)

---

## 📱 Tải về

Tải APK mới nhất từ [GitHub Releases](https://github.com/mhieuhonda/samacaogiac/releases/latest).

---

## 🎮 Cách chơi

| Điều khiển | Nút | Bàn phím |
|---|---|---|
| Rẽ trái | ◀ | ← / A |
| Rẽ phải | ▶ | → / D |
| Tăng tốc | ▲ | ↑ / W |
| Phanh | ▼ | ↓ / S |
| Tạm dừng | ⏸ | Esc / P |

**Mục tiêu**: Lái xe qua sa mạc, tránh chướng ngại vật, chọn đúng ngã rẽ, và sống sót càng lâu càng tốt!

---

## ✨ Tính năng

- 🏎️ **Xe 3D chi tiết** — mô hình xe với thân, kính, lốp, đèn, ống xả
- 🛣️ **Đường vô tận** — hệ thống segment recycling, không bao giờ hết đường
- ↗️ **Ngã rẽ** — cứ mỗi 3 segment có ngã rẽ trái/phải với rào chắn đỏ
- 🌵 **Cảnh quan sa mạc** — xương rồng, đá, cồn cát, cây chết, lạc đà
- 🎭 **Troll features** — điều khiển đảo ngược, đổi màu xe, thông báo giả, fake game over
- 🏆 **Hệ thống thành tích** — 8 mốc từ 0.5km đến 100km
- 🎵 **Âm thanh** — engine sound, hiệu ứng chạm, SFX cho troll events
- ⏸️ **Pause system** — nút tạm dừng trong game, resume từ Android lifecycle
- 📊 **Kỷ lục** — theo dõi quãng đường xa nhất
- 🌫️ **Hiệu ứng** — sương mù, bụi cát, screen shake, vignette off-road
- 🎯 **Chất lượng thích ứng** — tự động giảm chất lượng trên thiết bị yếu
- 🐛 **Easter egg** — chơi 1 tiếng để mở khóa

---

## 🔧 Lịch sử phiên bản

### v0.5 — Bug Fix & Polish (2026-07-29)

| # | Lỗi | Sửa |
|---|---|---|
| 1 | **GitHub Actions CI/CD thất bại** — Duplicate Kotlin class | Thêm `resolutionStrategy` force Kotlin stdlib 1.8.22 |
| 2 | **ProGuard rules quá aggressive** — keep all classes | Viết lại ProGuard rules chỉ giữ những class cần thiết |
| 3 | **Fork barrier collision sai** — BARRIER_X_LIMIT=3.5 không khớp với barrier 0.7*W | Đổi thành BARRIER_HALF_W=4.9 + CAR_RADIUS |
| 4 | **Obstacle recycling X âm** — Math.random()*7-1 có thể âm | Sửa thành `1+Math.random()*(ROAD_W/2-3)` |
| 5 | **Decoration/obstacle không recycle khi quá xa phía trước** | Thêm recycle cho dz<-total+SEG_LEN |
| 6 | **Camera lerp quá chậm** — 0.08 gây lag | Tăng lên 0.10 |
| 7 | **Không có speed-dependent steering** — quay quá nhanh ở tốc độ cao | Thêm speedFactor giảm 35% steering ở max speed |
| 8 | **Car bank angle giật** — gán trực tiếp steer*0.08 | Chuyển sang lerp với targetBank |
| 9 | **Không có pause button** — chỉ pause khi app xuống background | Thêm nút ⏸ và màn hình pause |
| 10 | **Không có kỷ lục** — quãng đường xa nhất không được lưu | Thêm bestDist và hiển thị ở death screen |
| 11 | **Không có âm thanh** | Thêm Web Audio API engine sound + SFX |
| 12 | **setAllowFileAccessFromFileURLs(true)** — security risk | Đổi thành false |
| 13 | **setDatabaseEnabled(true)** — deprecated, no-op | Xóa |
| 14 | **INTERNET permission** — game không dùng mạng | Xóa |
| 15 | **LoadingActivity OOM** — load ảnh 2.3MB không downsample | Thêm calculateInSampleSize() |
| 16 | **android.enableJetifier=true** — không cần | Đổi thành false |
| 17 | **android.nonTransitiveRClass thiếu** | Thêm =true |
| 18 | **Thiếu backup_rules.xml** — Android 12+ yêu cầu | Thêm backup_rules.xml và data_extraction_rules.xml |
| 19 | **Retroactive workflow không patch Kotlin cho old tags** | Thêm sed để inject resolutionStrategy |
| 20 | **Retroactive workflow không xóa aggressive ProGuard** | Thêm sed xóa -keep class * extends Object |

### v0.4 — Major Bug Fixes (2026-07-29)

| # | Lỗi | Sửa |
|---|---|---|
| 1 | Troll timeout leak | Clear timeout trước khi set mới |
| 2 | Double death | Thêm S.dead flag |
| 3 | Keyboard controls thiếu | Thêm keydown/keyup handler |
| 4 | Vibration bridge | AndroidBridge.vibrate() |
| 5 | Camera snap on start | Set camera position ngay lập tức |
| 6 | Memory leak | Destroy WebView properly |
| 7 | ProGuard strip JS interface | Thêm -keep rules |
| 8 | Accessibility | Thêm aria-label, prefers-reduced-motion |

### v0.3 — Critical Fixes (2026-07-29)

| # | Lỗi | Sửa |
|---|---|---|
| 1 | Màn hình đen | Camera tại (0,0,0) + lerp quá chậm |
| 2 | Xe quá nhỏ | CAR_SCALE=1.3 |
| 3 | Đường quá hẹp | ROAD_W=14 |
| 4 | Xe đi ra khỏi đường | Soft/hard boundary |
| 5 | Xe quay ngược | MAX_STEER_Y clamp |
| 6 | Ngã rẽ không hoạt động | checkForkBarrier() |
| 7 | UI che tầm nhìn | Di chuyển popup/banners |
| 8 | Duplicate HTML id | Tái cấu trúc DOM |
| 9 | Shoulder creation hack | Tạo mesh đúng cách |
| 10 | Fog reset sai | Dùng isLowDevice flag |
| 11 | Off-road recovery | Giảm offRoadT khi trên đường |
| 12 | Boot loop waste | Chỉ render 1 frame đến khi user click |

---

## 🏗️ Kiến trúc kỹ thuật

```
samacaogiac/
├── .github/workflows/
│   ├── build-release.yml          # Auto-build APK khi tạo release
│   └── retroactive-release.yml    # Build APK cho release cũ
├── app/
│   ├── build.gradle               # Module config + Kotlin resolution
│   ├── proguard-rules.pro         # ProGuard rules (v0.5 fix)
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── assets/
│       │   ├── game/
│       │   │   ├── index.html     # UI + CSS
│       │   │   ├── game.js        # Game engine v0.5
│       │   │   └── three.min.js   # Three.js r160
│       │   ├── favicon.svg
│       │   └── manhinhload.png
│       ├── java/com/samacaogiac/game/
│       │   ├── GameActivity.java  # WebView + vibration bridge
│       │   └── LoadingActivity.java
│       └── res/
│           ├── layout/
│           ├── mipmap-*/
│           ├── values/
│           └── xml/
│               ├── backup_rules.xml
│               └── data_extraction_rules.xml
├── build.gradle
├── settings.gradle
├── gradle.properties
└── README.md
```

### Tech Stack

| Layer | Công nghệ |
|---|---|
| Game Engine | Three.js r160 (WebGL) |
| Platform | Android 7.0+ (API 24) |
| Language | JavaScript + Java |
| Build | Gradle 8.4 + AGP 8.1.4 |
| CI/CD | GitHub Actions (auto-build APK) |
| Audio | Web Audio API |
| Rendering | Three.js WebGL in WebView |

---

## 🚀 Build từ source

```bash
# Clone repo
git clone https://github.com/mhieuhonda/samacaogiac.git
cd samacaogiac

# Build debug APK
./gradlew assembleDebug

# Build release APK (cần keystore)
./gradlew assembleRelease

# APK output
ls app/build/outputs/apk/
```

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<div align="center">
  <b>Sa Mạc Ảo Giác</b> — Made with ❤️ by Hieu Louis
</div>
