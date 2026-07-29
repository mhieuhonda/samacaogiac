-- ============================================================
-- on_troll_event.lua — Hook fired when a troll event triggers.
--
-- v0.7 FIX: previously this script set engine.setDuckFactor(0.0)
-- at troll_level >= 2 and never restored it, so once chaos mode
-- triggered the engine stayed silent for the rest of the run.
-- We now record the previous value and restore it.
-- ============================================================

-- Restore any pending duck-factor restore from a previous event.
-- This lets on_achievement.lua's 2-second fanfare expire naturally
-- when the next troll event fires.
if game._duck_restore and game._duck_restore_at and os.time() >= game._duck_restore_at then
    if engine and engine.setDuckFactor then
        engine.setDuckFactor(game._duck_restore)
        game._duck_factor = game._duck_restore
    end
    game._duck_restore = nil
    game._duck_restore_at = nil
end

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
        -- Record previous so the next non-chaos event can restore it.
        local prev = game._duck_factor or 0.15
        engine.setDuckFactor(0.05)  -- quieter, not fully silent
        game._duck_factor = 0.05
        game._duck_restore = prev
        game._duck_restore_at = os.time() + 3  -- restore in 3s
    end
end

return true
