-- ============================================================
-- config.lua — Game balance config tunable at runtime.
--
-- Designers can edit these values WITHOUT rebuilding the APK.
-- Just push a new commit with updated values and repackage.
-- The Lua VM is initialized at app startup by LuaScriptRunner.
-- ============================================================

-- Audio ducking: when music plays, engine drops to this fraction
-- of its base volume. Lower = quieter engine.
config = {
    duck_factor      = 0.15,    -- 15% of base volume
    base_engine_vol  = 0.03,    -- nominal engine volume
    music_priority   = "high",  -- "high" | "normal"
}

-- Achievement thresholds (km). Edit to make the game harder/easier.
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

-- Troll frequency (seconds between events)
troll = {
    min_interval = 12.0,
    max_interval = 37.0,
    cooldown     = 3.0,
}

-- Apply config to native mixer (best-effort)
if engine and engine.setDuckFactor and engine.setBaseVolume then
    engine.setDuckFactor(config.duck_factor)
    engine.setBaseVolume(config.base_engine_vol)
end

log.info("config.lua loaded: " .. #achievements .. " achievements configured")
