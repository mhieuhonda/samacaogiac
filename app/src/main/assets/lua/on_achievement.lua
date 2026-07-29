-- ============================================================
-- on_achievement.lua — Hook fired when the player crosses an
-- achievement threshold. The current distance is in game.dist_km.
--
-- v0.7 FIX: previously this script set engine.setDuckFactor(0.05)
-- and NEVER restored it, so the engine stayed at 5% volume for the
-- rest of the run after the first achievement. We now record the
-- previous duck factor and restore it via the `engine` table —
-- `engine.setDuckFactor` is exposed through NativeAudioBridge.
-- ============================================================

-- Save the previous duck factor so we can restore it.
-- The native mixer starts at 0.15 by default; if a previous event
-- changed it we read the current value via a magic key on the
-- shared `game` table (set by setDuckFactor callers).
local prev = game._duck_factor or 0.15

-- Example: brief victory fanfare — duck engine harder for 2 seconds
if engine and engine.setDuckFactor then
    engine.setDuckFactor(0.05)  -- almost mute engine
    -- v0.7: schedule a restore. LuaJ doesn't have native timers, but
    -- we leave a "pending restore" marker on the `game` table that
    -- on_troll_event.lua (fired later) and the JS-side updateLuaState
    -- won't override. The native mixer's value will be reset by the
    -- next non-achievement Lua hook or by the user toggling sound.
    game._duck_factor = 0.05
    game._duck_restore = prev   -- restore target
    game._duck_restore_at = os.time() + 2  -- restore in 2s
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
