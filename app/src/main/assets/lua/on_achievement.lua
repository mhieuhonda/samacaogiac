-- ============================================================
-- on_achievement.lua — Hook fired when the player crosses an
-- achievement threshold. The current distance is in game.dist_km.
--
-- This script can:
--   * Adjust the engine volume (e.g., victory fanfare = quieter engine).
--   * Log analytics for the designer.
--   * Suggest the next achievement to display.
-- ============================================================

-- Example: brief victory fanfare — duck engine harder for 2 seconds
if engine and engine.setDuckFactor then
    engine.setDuckFactor(0.05)  -- almost mute engine
    -- Schedule a restore (LuaJ doesn't have native timers, but
    -- the Java side will restore the duck factor after 2 seconds).
end

-- Log analytics
if log and log.info then
    log.info(string.format(
        "Achievement unlocked at %.2f km, speed %.1f km/h, deaths %d",
        game.dist_km, game.speed_kmh, game.deaths
    ))
end

-- Print a Lua-side commentary
local tier = "bronze"
if game.dist_km >= 100 then tier = "mythic"
elseif game.dist_km >= 50 then tier = "legendary"
elseif game.dist_km >= 20 then tier = "epic"
elseif game.dist_km >= 10 then tier = "rare"
elseif game.dist_km >= 5  then tier = "silver"
end
log.info("Achievement tier: " .. tier)
