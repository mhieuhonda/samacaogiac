-- ============================================================
-- on_troll_event.lua — Hook fired when a troll event triggers.
--
-- Lets designers override or extend troll behavior. The variable
-- `event_type` (string) is injected by the caller before running.
-- We don't have it here, so we use a default.
-- ============================================================

local event = event_type or "unknown"

if log and log.info then
    log.info(string.format(
        "Troll event '%s' fired at dist=%.2f km, troll_level=%d",
        event, game.dist_km, game.troll_level
    ))
end

-- Example: at troll_level 2 (chaos), make events more aggressive
if game.troll_level >= 2 then
    if engine and engine.setDuckFactor then
        -- During chaos mode, briefly mute engine for dramatic effect
        engine.setDuckFactor(0.0)
    end
end

-- Schedule a restore (handled by Java side after the event ends)
return true
