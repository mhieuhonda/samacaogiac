-- ============================================================
-- config.lua — Game balance config tunable at runtime.
-- v0.9: Updated for dual-mode (Desert + Zombie)
-- ============================================================

-- Audio ducking: when music plays, engine drops to this fraction
config = {
    duck_factor      = 0.15,
    base_engine_vol  = 0.03,
    music_priority   = "high",
}

-- Achievement thresholds (km)
achievements = {
    { km = 0.5,  title = "KHỞI HÀNH",   msg = "Bạn đã đi 0.5km! ...Đó là khoảng cách của 1 con gián" },
    { km = 1.0,  title = "KM ĐẦU TIÊN", msg = "1km! Bố mẹ bạn rất tự hào... về việc bạn lãng phí thời gian" },
    { km = 2.0,  title = "NGƯỜI LÀM",   msg = "2km! Bạn đã đi xa hơn... xe tải chở rác" },
    { km = 5.0,  title = "SA MẠC EXPERT", msg = "5km! Bạn có thể ứng tuyển làm hướng dẫn viên sa mạc... ảo" },
    { km = 10.0, title = "PRO PLAYER",   msg = "10km! Bạn đã chơi lâu hơn thời gian đọc README" },
    { km = 20.0, title = "MASTER",       msg = "20km! 20km trong sa mạc? Người thật việc thật... ảo" },
    { km = 50.0, title = "LEGEND",       msg = "50km! Bạn là legend... của sự lãng phí" },
    { km = 100.0,title = "GOD",          msg = "100km! Bạn đã đi xa hơn... cuộc đời của 1 số người" },
}

-- Zombie mode wave config
zombie = {
    normal_hp = 2,
    mutant_hp = 5,
    horror_hp = 10,
    normal_speed = 3,
    mutant_speed = 5,
    horror_speed = 7,
    wave_scale = 2,
}

-- Troll frequency (seconds between events)
troll = {
    min_interval = 12.0,
    max_interval = 37.0,
    cooldown     = 3.0,
}

-- Apply config to native mixer
if engine and engine.setDuckFactor and engine.setBaseVolume then
    engine.setDuckFactor(config.duck_factor)
    engine.setBaseVolume(config.base_engine_vol)
end

log.info("config.lua v0.9 loaded: " .. #achievements .. " achievements configured")
