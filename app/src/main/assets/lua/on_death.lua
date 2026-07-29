-- ============================================================
-- on_death.lua — Hook fired when the player dies.
--
-- Uses the current game state to pick a snarky death message
-- and to log the run for analytics.
-- ============================================================

local msg = "Bạn đã chết!"

-- Pick a death message based on distance
if game.dist_km < 0.1 then
    msg = "Chưa đi nổi 100m?! Bạn đang đỗ xe à?"
elseif game.dist_km < 1.0 then
    msg = "Hơi non. Con gián đi nhanh hơn."
elseif game.dist_km < 5.0 then
    msg = "Tạm được. Tập thêm đi."
elseif game.dist_km < 20.0 then
    msg = "Khá lắm! Sa mạc bắt đầu thích bạn."
elseif game.dist_km < 50.0 then
    msg = "Pro! Bạn có thể làm hướng dẫn viên sa mạc."
else
    msg = "LEGEND! Game tôn vinh sự kiên trì của bạn."
end

-- Speed at moment of death
if game.speed_kmh > 180 then
    msg = msg .. " (chết vì đua слишком nhanh)"
end

if log and log.info then
    log.info("=== DEATH ===")
    log.info(string.format("dist=%.2f km  speed=%.1f km/h  deaths=%d  best=%.2f km",
        game.dist_km, game.speed_kmh, game.deaths, game.best_km))
    log.info("Death message: " .. msg)
end

-- Briefly increase troll level for the next run as a "revenge" mechanic
if game.deaths > 0 and game.deaths % 5 == 0 then
    log.warn("Player has died " .. game.deaths .. " times — escalating troll level")
end
