// ============================================================
// SA MẠC ẢO GIÁC — Game Engine v1.0
// ============================================================
// Official release. Major changes from v0.9:
//   * MODE REGISTRY — 5 game modes via dispatch table, no more
//     if/else chains spread across 15+ places. Each mode owns its
//     own enter/exit/update/render/cleanup lifecycle.
//   * 3 NEW MODES:
//     - FPS (first-person shooter, 3D level, enemies, weapons)
//     - SIMULATOR (large open map, NPC traffic, mission system)
//     - TIME ATTACK (endless driving, no death, beat the clock)
//   * AUDIO OVERHAUL — the engine sound no longer bleeds across
//     modes or persists on the welcome screen. Single source of
//     truth: a per-mode `engineEnabled` flag, plus proper
//     suspend/resume/close on lifecycle events.
//   * SFX LIBRARY — 30+ procedural sound effects, all generated
//     from oscillators + buffers (no external assets). Each mode
//     has its own ambient layer + UI feedback sounds.
//   * UI FIXES — HUD no longer overlaps with control buttons;
//     zombie mode no longer shows stale desert HUD; settings
//     panel scrolls cleanly on small screens; end screens wrap
//     long text.
//   * All v0.6–v0.9 fixes preserved.
// ============================================================
(function(){
'use strict';

/* ── CONFIG ── */
const C = {
    ROAD_W: 14,
    SEG_LEN: 80,
    NUM_SEGS: 14,
    FORK_EVERY: 3,
    CAR_BASE_SPEED: 28,
    CAR_MAX_SPEED: 52,
    CAR_MIN_SPEED: 6,
    TURN_RATE: 2.2,
    CAM_DIST: 16,
    CAM_H: 7.5,
    CAM_LOOK_AHEAD: 12,
    CAM_LERP: 0.10,
    OFFROAD_LIMIT: 5,
    KM: 1000,
    EASTER_MS: 3600000,
    PR_CAP: 1.5,
    CAR_SCALE: 1.3,
    MAX_STEER_Y: Math.PI/3.5,
    ROAD_SOFT_EDGE: 3,
    OFFROAD_PUSH: 5,
    BARRIER_HALF_W: 4.9,
    CAR_RADIUS: 1.5,
    SHADOW_MAP_SIZE: 512,
    DUST_COUNT: 40,
    DUST_UPDATE_INTERVAL: 1/30,
    OBS_COLLISION_R: 1.5 * 1.3,
    MUSIC_POLL_FRAMES: 6,
    ENGINE_BASE_VOL: 0.03,
    LUA_UPDATE_FRAMES: 30,
    // v1.0: Time Attack duration (seconds)
    TIME_ATTACK_DURATION: 120,
};

/* ── STATE ── */
const S = {
    phase: 'welcome',     // welcome | prompt | playing | paused | dead | easter
    dist: 0,
    speed: C.CAR_BASE_SPEED,
    offRoadT: 0,
    onRoad: true,
    t0: 0,
    paused: false,
    forkShown: false,
    dead: false,
    controlsReversed: false,
    reverseTimer: 0,
    carColorTimer: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    nextTroll: 0,
    trollCooldown: 0,
    milestoneShown: {},
    fakeNotifTimer: 0,
    deathCount: 0,
    fakeDeathFlash: 0,
    bestDist: 0,
    musicPlaying: false,
    musicCheckCounter: 0,
    fps: 60,
    fpsAccum: 0,
    fpsFrames: 0,
    lowPerfMode: false,
    autoQualityFrames: 0,
    gravityFlip: 0,
    invisibleMode: 0,
    invertedColors: 0,
    fakeLag: 0,
    screenRotate: 0,
    carShrink: 0,
    fakeBatteryDrain: 0,
    totalKm: 0,
    topSpeed: 0,
    avgSpeed: 0,
    speedSamples: 0,
    nearMissCount: 0,
    coinsCollected: 0,
    boostMeter: 0,
    boostActive: 0,
    consecutiveDistance: 0,
    timeAlive: 0,
    audioEnabled: true,
    hudVisible: true,
    debugOverlay: false,
    cameraMode: 0,
    lastMilestone: 0,
    // v1.0: per-mode state (kept in flat fields for backward compat)
    // Zombie
    zombieHealth: 100, zombieAmmo: 30, zombieAmmoReserve: 120,
    zombieWave: 0, zombieKills: 0, zombieTotalKills: 0, zombieBestWave: 0,
    zombieReloading: false, zombieReloadTimer: 0, zombieWaveActive: false,
    zombieSpawnQueue: [], zombieLastShot: 0, zombieMuzzleFlash: 0,
    zombiePlayerX: 0, zombieDamageFlash: 0, zombieBetweenWaves: false,
    zombieBetweenTimer: 0, zombieSpawnTimer: 0,
    // FPS mode
    fpsHealth: 100, fpsAmmo: 30, fpsAmmoReserve: 90,
    fpsKills: 0, fpsWave: 0, fpsBestKills: 0, fpsReloading: false,
    fpsReloadTimer: 0, fpsShootCooldown: 0, fpsYaw: 0, fpsPitch: 0,
    fpsPlayerPos: {x:0,y:1.7,z:0}, fpsPlayerVel: {x:0,y:0,z:0},
    fpsOnGround: true, fpsMuzzleFlash: 0, fpsDamageFlash: 0,
    fpsEnemySpawnQueue: [], fpsEnemiesActive: [], fpsWaveActive: false,
    fpsWaveBetweenTimer: 0, fpsLastShot: 0, fpsInvincible: 0,
    // Simulator mode
    simSpeed: 0, simSteer: 0, simPosX: 0, simPosZ: 0, simRotY: 0,
    simMissions: 0, simTargetIdx: 0, simTargets: [], simNpcCars: [],
    simTotalKm: 0, simBoost: 0, simMissionTimer: 0,
    // Time attack
    timeRemaining: C.TIME_ATTACK_DURATION, timeDistance: 0, timeBestDist: 0,
    timeCoinsCollected: 0,
    // Graphics settings
    qualityLevel: 1, fpsLimit: 0, sfxVolume: 0.7, engineVolume: 0.3,
    musicVolume: 0.5, trollLevel: 1, shadowEnabled: true, particleLevel: 1,
};

/* ── THREE GLOBALS ── */
let scene, cam, renderer, clock, loopRunning = false;
let loopToken = 0;
let initFailed = false;
let carGroup, carBodyMesh, wheels = [];
let segData = [];
let decoPool = [];
let obstaclePool = [];
let coinPool = [];
let sunMesh, sunLight, ambientLight, hemiLight;
let dustPts;
let groundMeshes = [];
let isLowDevice = false;
let _shadowEnabled = false;

/* ── MODE STATE ── */
let GameMode = 'desert';
let _selectedMode = 'desert';
let _musicPromptVisible = false;

// Per-mode object pools (kept on globals for simplicity)
let zombiePool = [], bulletPool = [];
let zombiePlayerMesh, zombieMuzzleMesh;
let fpsPlayerWeapon, fpsMuzzleMesh, fpsEnemyPool = [], fpsBulletPool = [];
let fpsLevelGroup = null;
let simNpcPool = [], simTargetPool = [], simBuildingPool = [];

/* ── TIMEOUT TRACKING (cleared on mode exit / restart) ── */
let trollTimeout = null, achievementTimeout = null, fogTimeout = null;
let sandstormTimeout = null, invertTimeout = null, rotateTimeout = null;
let batteryTimeout = null, curseTimeout = null, curseTimeout2 = null;
let waveAnnounceTimeout = null, missionTimeout = null;
let zombieSpawnTimeout = null;
let uiClickTimeout = null;
const ALL_TIMEOUTS = () => [
    trollTimeout, achievementTimeout, fogTimeout, sandstormTimeout,
    invertTimeout, rotateTimeout, batteryTimeout, curseTimeout,
    curseTimeout2, waveAnnounceTimeout, missionTimeout, zombieSpawnTimeout,
    uiClickTimeout
];
function clearAllTimeouts(){
    [trollTimeout, achievementTimeout, fogTimeout, sandstormTimeout,
     invertTimeout, rotateTimeout, batteryTimeout, curseTimeout,
     curseTimeout2, waveAnnounceTimeout, missionTimeout, zombieSpawnTimeout,
     uiClickTimeout].forEach(t => { if(t) clearTimeout(t); });
    trollTimeout=achievementTimeout=fogTimeout=sandstormTimeout=null;
    invertTimeout=rotateTimeout=batteryTimeout=curseTimeout=curseTimeout2=null;
    waveAnnounceTimeout=missionTimeout=zombieSpawnTimeout=uiClickTimeout=null;
}

/* ============================================================
   AUDIO SYSTEM v1.0 — REWRITTEN FROM SCRATCH
   ============================================================
   The v0.9 audio had 4 structural bugs that caused engine sound
   bleeding across modes (see analysis). v1.0 fixes them by:
   1. Wrapping ALL audio in a single AudioEngine object with
      explicit start/stop/cleanup methods.
   2. Engine sound is started/stopped on demand based on the
      current mode's `engineEnabled` flag — NOT left running.
   3. updateAudio() checks `Modes[GameMode].engineEnabled` and
      silences the engine if the mode doesn't use it.
   4. audioCtx.suspend() is called whenever the game exits to
      welcome screen or shows an end screen.
   5. SFX library is centralized in one place with consistent
      gain scaling and disconnect-on-finish.
   ============================================================ */
let audioCtx = null;
let engineOsc = null, engineGain = null, engineFilter = null;
let ambientSource = null, ambientGain = null;
let masterGain = null;
let lastEngineVol = -1, lastEngineFreq = -1;

const AudioEngine = {
    init(){
        if(audioCtx) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 1.0;
            masterGain.connect(audioCtx.destination);

            // Engine: oscillator + lowpass + gain
            engineOsc = audioCtx.createOscillator();
            engineFilter = audioCtx.createBiquadFilter();
            engineGain = audioCtx.createGain();
            engineOsc.type = 'sawtooth';
            engineOsc.frequency.value = 80;
            engineFilter.type = 'lowpass';
            engineFilter.frequency.value = 800;
            engineGain.gain.value = 0;
            engineOsc.connect(engineFilter);
            engineFilter.connect(engineGain);
            engineGain.connect(masterGain);
            engineOsc.start();
            lastEngineVol = -1;
            lastEngineFreq = -1;
        } catch(e){
            console.warn('AudioEngine init failed:', e);
        }
    },

    // Suspend audio context (welcome screen, pause, end screen)
    suspend(){
        if(audioCtx && audioCtx.state === 'running'){
            try { audioCtx.suspend(); } catch(e){}
        }
    },
    resume(){
        if(audioCtx && audioCtx.state === 'suspended'){
            try { audioCtx.resume(); } catch(e){}
        }
    },

    // Set engine gain directly (used by troll curse + mode switch)
    setEngineGain(v){
        if(!audioCtx || !engineGain) return;
        try {
            engineGain.gain.setTargetAtTime(v, audioCtx.currentTime, 0.1);
            lastEngineVol = v;
        } catch(e){}
    },

    // Update engine sound based on speed/music state — only called
    // when current mode has engineEnabled=true AND game is playing.
    updateEngine(){
        if(!audioCtx || !engineOsc) return;
        if(!S.audioEnabled){
            if(lastEngineVol !== 0){ this.setEngineGain(0); }
            return;
        }
        try {
            const freq = 60 + (S.speed / C.CAR_MAX_SPEED) * 120;
            if(Math.abs(freq - lastEngineFreq) > 1){
                engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
                lastEngineFreq = freq;
            }
            let vol;
            if(S.paused){
                vol = 0;
            } else if(S.musicPlaying){
                try {
                    vol = (typeof AndroidBridge !== 'undefined' && AndroidBridge.getEngineVolume)
                        ? AndroidBridge.getEngineVolume()
                        : C.ENGINE_BASE_VOL * 0.15;
                } catch(e){
                    vol = C.ENGINE_BASE_VOL * 0.15;
                }
            } else {
                vol = S.onRoad ? C.ENGINE_BASE_VOL : C.ENGINE_BASE_VOL * 1.6;
            }
            if(Math.abs(vol - lastEngineVol) > 0.001){
                engineGain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
                lastEngineVol = vol;
            }
        } catch(e){}
    },

    // ── SFX LIBRARY (30+ sounds, all procedural) ──
    // Each sound creates its own oscillator/buffer, plays, and
    // auto-disconnects when finished. Web Audio GC handles cleanup.

    _env(type, freq, dur, vol, freqEnd){
        if(!audioCtx || !S.audioEnabled) return;
        try {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, audioCtx.currentTime);
            if(freqEnd !== undefined){
                o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), audioCtx.currentTime + dur);
            }
            g.gain.setValueAtTime(vol * S.sfxVolume, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
            o.connect(g); g.connect(masterGain);
            o.start(); o.stop(audioCtx.currentTime + dur);
            o.onended = () => { try { g.disconnect(); } catch(e){} };
        } catch(e){}
    },

    _noise(dur, vol, filterFreq, filterType){
        if(!audioCtx || !S.audioEnabled) return;
        try {
            const bufSize = Math.floor(audioCtx.sampleRate * dur);
            const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for(let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
            const src = audioCtx.createBufferSource();
            src.buffer = buf;
            const filt = audioCtx.createBiquadFilter();
            filt.type = filterType || 'lowpass';
            filt.frequency.value = filterFreq || 3000;
            const g = audioCtx.createGain();
            g.gain.value = vol * S.sfxVolume;
            src.connect(filt); filt.connect(g); g.connect(masterGain);
            src.start();
            src.onended = () => { try { g.disconnect(); filt.disconnect(); } catch(e){} };
        } catch(e){}
    },

    // ── UI / Generic ──
    click(){ this._env('square', 700, 0.04, 0.06); },
    tap(){ this._env('sine', 880, 0.06, 0.05); },
    select(){ this._env('triangle', 660, 0.08, 0.07, 990); },
    back(){ this._env('triangle', 440, 0.08, 0.07, 220); },
    open(){ this._env('sine', 220, 0.15, 0.07, 660); },
    close(){ this._env('sine', 660, 0.15, 0.07, 220); },
    error(){ this._env('square', 150, 0.2, 0.08, 100); },
    success(){
        if(!audioCtx || !S.audioEnabled) return;
        [523, 659, 784, 1047].forEach((f, i) => {
            setTimeout(() => this._env('triangle', f, 0.15, 0.06), i * 80);
        });
    },

    // ── Desert / Driving ──
    coin(){ this._env('triangle', 660, 0.05, 0.07); setTimeout(() => this._env('triangle', 880, 0.05, 0.07), 50); setTimeout(() => this._env('triangle', 1320, 0.1, 0.07), 100); },
    boost(){ this._env('sawtooth', 200, 0.3, 0.08, 880); },
    brake(){ this._env('sawtooth', 100, 0.2, 0.05, 50); },
    nearMiss(){ this._env('sine', 720, 0.1, 0.05); },
    forkWarning(){ this._env('square', 440, 0.3, 0.08); },
    crash(){
        this._noise(0.4, 0.15, 1500, 'lowpass');
        this._env('sawtooth', 80, 0.4, 0.12, 30);
    },
    offRoad(){ this._noise(0.15, 0.04, 600, 'lowpass'); },
    milestone(){
        [523, 659, 784, 1047, 1319].forEach((f, i) => {
            setTimeout(() => this._env('triangle', f, 0.12, 0.06), i * 70);
        });
    },

    // ── Zombie Mode ──
    gunshot(){
        this._noise(0.15, 0.25, 3000, 'lowpass');
        this._env('sine', 80, 0.1, 0.2, 30);
    },
    zombieGroan(){ this._env('sawtooth', 60 + Math.random() * 40, 0.6, 0.06, 40); },
    zombieDeath(){ this._env('sawtooth', 200, 0.4, 0.12, 30); },
    reloadClick(){ this._env('square', 1200, 0.05, 0.1); },
    reloadDone(){ this._env('triangle', 880, 0.1, 0.08, 1320); },
    waveAlarm(){
        [0, 0.15, 0.3].forEach(d => setTimeout(() => this._env('square', 880, 0.1, 0.1), d * 1000));
    },
    damageThud(){ this._env('sine', 50, 0.2, 0.15, 30); },
    waveComplete(){
        [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this._env('triangle', f, 0.15, 0.08), i * 100));
    },
    heal(){ this._env('sine', 523, 0.3, 0.08, 1047); },

    // ── FPS Mode ──
    rifleShot(){
        this._noise(0.1, 0.3, 4000, 'lowpass');
        this._env('square', 120, 0.08, 0.15, 40);
    },
    shotgunShot(){
        this._noise(0.25, 0.35, 2500, 'lowpass');
        this._env('sawtooth', 60, 0.2, 0.18, 25);
    },
    enemyHit(){ this._env('square', 220, 0.06, 0.08, 110); },
    enemyDeath(){
        this._env('sawtooth', 400, 0.3, 0.1, 80);
        this._noise(0.15, 0.08, 1500, 'lowpass');
    },
    playerHurt(){
        this._env('sine', 200, 0.15, 0.15, 80);
        this._noise(0.1, 0.08, 800, 'lowpass');
    },
    jump(){ this._env('sine', 220, 0.15, 0.08, 660); },
    land(){ this._env('sine', 80, 0.1, 0.1, 40); },
    emptyClick(){ this._env('square', 200, 0.05, 0.05); },

    // ── Simulator Mode ──
    engineStart(){
        this._env('sawtooth', 40, 0.6, 0.08, 120);
    },
    engineOff(){
        this._env('sawtooth', 120, 0.4, 0.06, 40);
    },
    horn(){ this._env('square', 440, 0.4, 0.1); setTimeout(() => this._env('square', 550, 0.4, 0.1), 100); },
    npcPass(){ this._env('sine', 600, 0.1, 0.04, 300); },
    missionNew(){
        [659, 784, 1047].forEach((f, i) => setTimeout(() => this._env('triangle', f, 0.2, 0.08), i * 120));
    },
    missionDone(){
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => this._env('triangle', f, 0.18, 0.08), i * 80));
    },

    // ── Time Attack ──
    tick(){ this._env('square', 880, 0.03, 0.04); },
    countdown(n){
        if(n > 0) this._env('square', 660, 0.15, 0.1);
        else this._env('square', 1320, 0.4, 0.12);
    },
    timeUp(){
        [1047, 880, 659, 523].forEach((f, i) => setTimeout(() => this._env('triangle', f, 0.25, 0.1), i * 150));
    },

    // ── Troll / Easter ──
    trollPop(){ this._env('square', 440, 0.1, 0.05, 660); },
    achievement(){
        [659, 880, 1047].forEach((f, i) => setTimeout(() => this._env('triangle', f, 0.18, 0.07), i * 100));
    },
    curse(){
        // engine curse handled separately in troll code
        this._env('sawtooth', 60, 0.5, 0.08, 30);
    },

    // ── Pause / Resume ──
    pauseSfx(){ this._env('sine', 440, 0.1, 0.07, 220); },
    resumeSfx(){ this._env('sine', 220, 0.1, 0.07, 440); },

    // ── Ambient layer (looping background) ──
    startAmbient(type){
        if(!audioCtx) return;
        this.stopAmbient();
        try {
            // Use a low-volume filtered noise loop for wind/desert ambience
            const bufSize = audioCtx.sampleRate * 2; // 2 second loop
            const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for(let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
            ambientSource = audioCtx.createBufferSource();
            ambientSource.buffer = buf;
            ambientSource.loop = true;
            const filt = audioCtx.createBiquadFilter();
            filt.type = 'bandpass';
            // type: 'desert' (wind), 'indoor' (low rumble), 'city' (busy)
            if(type === 'desert'){ filt.frequency.value = 600; filt.Q.value = 0.5; }
            else if(type === 'indoor'){ filt.frequency.value = 200; filt.Q.value = 1.0; }
            else if(type === 'city'){ filt.frequency.value = 1500; filt.Q.value = 0.3; }
            else { filt.frequency.value = 600; filt.Q.value = 0.5; }
            ambientGain = audioCtx.createGain();
            ambientGain.gain.value = 0.025 * S.sfxVolume;
            ambientSource.connect(filt); filt.connect(ambientGain); ambientGain.connect(masterGain);
            ambientSource.start();
        } catch(e){}
    },
    stopAmbient(){
        if(ambientSource){
            try { ambientSource.stop(); } catch(e){}
            try { ambientSource.disconnect(); } catch(e){}
            ambientSource = null;
        }
        if(ambientGain){
            try { ambientGain.disconnect(); } catch(e){}
            ambientGain = null;
        }
    },
};

// Backward-compat: keep old global function names working
function playSfx(freq, dur, vol){ AudioEngine._env('square', freq, dur, vol || 0.06); }
function playCoinSfx(){ AudioEngine.coin(); }
function playGunshot(){ AudioEngine.gunshot(); }
function playZombieGroan(){ AudioEngine.zombieGroan(); }
function playZombieDeath(){ AudioEngine.zombieDeath(); }
function playReloadClick(){ AudioEngine.reloadClick(); }
function playWaveAlarm(){ AudioEngine.waveAlarm(); }
function playDamageThud(){ AudioEngine.damageThud(); }
function updateAudio(){
    // v1.0: only update engine if the current mode uses engine sound
    if(Modes[GameMode] && Modes[GameMode].engineEnabled){
        AudioEngine.updateEngine();
    }
}

/* ── INPUT ── */
const inp = { left:false, right:false, gas:false, brake:false, boost:false,
              shoot:false, reload:false, jump:false, forward:false, back:false };

/* ── DOM ── */
const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const shakeWrap = $('shakeWrap');
const offVig = $('offroadVignette');
const hudEl = $('hud');
const ctrlEl = $('controls');
const deathScr = $('deathScreen');
const eastScr = $('easterScreen');
const revInd = $('reverseIndicator');
const trollPop = $('trollPopup');
const trollBox = $('trollBox');
const fakeNotif = $('fakeNotif');
const fakeNotifText = $('fakeNotifText');
const msBanner = $('milestoneBanner');
const msKm = $('msKm');
const msMsg = $('msMsg');
const spdH = $('speedHud');
const dstH = $('distHud');
const tmrH = $('timerHud');
const dstD = $('deathDist');
const bestD = $('deathBest');
const pauseScr = $('pauseScreen');
const pauseBtn = $('pauseBtn');
const musicPrompt = $('musicPrompt');
const musicIndicator = $('musicIndicator');
const musicTrackName = $('musicTrackName');
const musicToggleBtn = $('musicToggleBtn');
const boostBar = $('boostBar');
const boostFill = $('boostFill');
const coinCounter = $('coinCounter');
const fpsHud = $('fpsHud');
const debugOverlay = $('debugOverlay');
const cameraModeBtn = $('cameraModeBtn');
const settingsBtn = $('settingsBtn');
const settingsScr = $('settingsScr');
const cheatInput = $('cheatInput');
const topSpeedH = $('topSpeedHud');
const totalKmH = $('totalKmHud');
// Zombie
const zombieCtrlEl = $('zombieControls');
const zombieHudEl = $('zombieHud');
const ammoHudEl = $('ammoHud');
const waveHudEl = $('waveHud');
const killHudEl = $('killHud');
const healthBarEl = $('healthBar');
const healthFillEl = $('healthFill');
const crosshairEl = $('crosshair');
const crosshairDotEl = $('crosshairDot');
const zombieDeathScr = $('zombieDeathScreen');
const zombieDeathInfo = $('zombieDeathInfo');
const zombieDeathBest = $('zombieDeathBest');
const waveAnnounceEl = $('waveAnnounce');
const waText = $('waText');
const waSub = $('waSub');
// v1.0: New modes
const fpsCtrlEl = $('fpsControls');
const fpsDeathScr = $('fpsDeathScreen');
const fpsDeathInfo = $('fpsDeathInfo');
const fpsDeathBest = $('fpsDeathBest');
const simCtrlEl = $('simControls');
const simEndScr = $('simEndScreen');
const simEndInfo = $('simEndInfo');
const simEndBest = $('simEndBest');
const timeEndScr = $('timeEndScreen');
const timeEndInfo = $('timeEndInfo');
const timeEndBest = $('timeEndBest');
const modeHudEl = $('modeHud');
const modeScoreHudEl = $('modeScoreHud');
const modeInfoHudEl = $('modeInfoHud');
const modeStatusHudEl = $('modeStatusHud');
const missionBannerEl = $('missionBanner');
const missionTextEl = $('missionText');

/* ── UI ── */
function onBtn(id, fn){
    const el = $(id);
    if(!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(true); el.classList.add('on'); }, {passive:false});
    el.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); fn(false); el.classList.remove('on'); }, {passive:false});
    el.addEventListener('touchcancel', () => { fn(false); el.classList.remove('on'); });
    el.addEventListener('mousedown', e => { e.preventDefault(); fn(true); el.classList.add('on'); });
    el.addEventListener('mouseup', () => { fn(false); el.classList.remove('on'); });
    el.addEventListener('mouseleave', () => { fn(false); el.classList.remove('on'); });
}
onBtn('bL', v => { inp.left = v; });
onBtn('bR', v => { inp.right = v; });
onBtn('bG', v => { inp.gas = v; });
onBtn('bB', v => { inp.brake = v; });
onBtn('bBoost', v => { inp.boost = v; });
onBtn('bZL', v => { inp.left = v; });
onBtn('bZR', v => { inp.right = v; });
onBtn('bShoot', v => { inp.shoot = v; });
onBtn('bReload', v => { if(v) reloadZombie(); });
// v1.0: FPS controls
onBtn('fpsMoveBtn', v => { inp.forward = v; });
onBtn('fpsShootBtn', v => { inp.shoot = v; });
onBtn('fpsJumpBtn', v => { if(v) fpsJump(); });
onBtn('fpsReloadBtn', v => { if(v) fpsReload(); });
// v1.0: Simulator controls
onBtn('bSimL', v => { inp.left = v; });
onBtn('bSimR', v => { inp.right = v; });
onBtn('bSimG', v => { inp.gas = v; });
onBtn('bSimB', v => { inp.brake = v; });

function addClick(id, fn){
    const el = $(id);
    if(!el) return;
    let lastTouch = 0;
    el.addEventListener('touchstart', e => {
        e.preventDefault(); e.stopPropagation();
        lastTouch = Date.now();
        AudioEngine.click();
        fn();
    }, {passive:false});
    el.addEventListener('click', e => {
        e.preventDefault();
        if(Date.now() - lastTouch < 600) return;
        AudioEngine.click();
        fn();
    });
}

// Mode selection
addClick('modeDesert', () => { _selectedMode = 'desert'; highlightMode(); });
addClick('modeZombie', () => { _selectedMode = 'zombie'; highlightMode(); });
addClick('modeFps',    () => { _selectedMode = 'fps';    highlightMode(); });
addClick('modeSim',    () => { _selectedMode = 'sim';    highlightMode(); });
addClick('modeTime',   () => { _selectedMode = 'time';   highlightMode(); });

function highlightMode(){
    const map = { desert:'modeDesert', zombie:'modeZombie', fps:'modeFps', sim:'modeSim', time:'modeTime' };
    Object.keys(map).forEach(k => {
        const el = $(map[k]);
        if(!el) return;
        const colors = { desert:'#f59e0b', zombie:'#ef4444', fps:'#22c55e', sim:'#60a5fa', time:'#a855f7' };
        el.style.borderColor = _selectedMode === k ? colors[k] : 'rgba(255,255,255,.12)';
        el.style.background  = _selectedMode === k ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.06)';
    });
}
highlightMode();

addClick('playBtn', startGame);
addClick('replayBtn', restart);
addClick('easterBtn', restart);
addClick('zombieReplayBtn', restart);
addClick('fpsReplayBtn', restart);
addClick('simReplayBtn', restart);
addClick('timeReplayBtn', restart);
addClick('pauseBtn', togglePause);
addClick('resumeBtn', () => { if(S.paused) togglePause(); });

// Quit button: v1.0 — proper cleanup including audio suspend
addClick('quitBtn', () => {
    if(!S.paused && S.phase !== 'playing') return;
    S.paused = false;
    S.phase = 'welcome';
    // Cleanup current mode
    if(Modes[GameMode] && Modes[GameMode].exit) Modes[GameMode].exit();
    // Hide all overlays
    deathScr.style.display = 'none';
    eastScr.style.display = 'none';
    pauseScr.style.display = 'none';
    zombieDeathScr.style.display = 'none';
    fpsDeathScr.style.display = 'none';
    simEndScr.style.display = 'none';
    timeEndScr.style.display = 'none';
    // Hide all HUDs
    hudEl.style.display = 'none';
    ctrlEl.style.display = 'none';
    zombieCtrlEl.style.display = 'none';
    fpsCtrlEl.style.display = 'none';
    simCtrlEl.style.display = 'none';
    modeHudEl.style.display = 'none';
    hideZombieUI();
    hideFpsUI();
    hideSimUI();
    hideTimeUI();
    showGameUI(false);
    offVig.style.display = 'none';
    revInd.style.display = 'none';
    fakeNotif.style.display = 'none';
    trollPop.style.display = 'none';
    msBanner.style.display = 'none';
    missionBannerEl.style.display = 'none';
    waveAnnounceEl.style.display = 'none';
    document.body.style.filter = '';
    document.body.style.transform = '';
    // Stop loop & clear timeouts
    stopLoop();
    clearAllTimeouts();
    resetInput();
    // v1.0: SUSPEND audio when going back to welcome (fixes bleed)
    AudioEngine.suspend();
    AudioEngine.stopAmbient();
    $('welcomeScreen').style.display = 'flex';
});

addClick('musicYes', () => { _musicPromptVisible = false; if(musicPrompt) musicPrompt.style.display = 'none'; promptMusic(); });
addClick('musicNo',  () => { _musicPromptVisible = false; if(musicPrompt) musicPrompt.style.display = 'none'; startGameAfterMusic(false); });
addClick('musicToggleBtn', toggleMusicFromButton);
addClick('cameraModeBtn', cycleCameraMode);
addClick('settingsBtn', openSettings);
addClick('settingsClose', () => { if(settingsScr) settingsScr.style.display = 'none'; AudioEngine.close(); });
addClick('toggleSound', toggleSoundFromButton);
addClick('toggleHud', toggleHudFromButton);
addClick('toggleDebug', toggleDebugFromButton);
addClick('cheatSubmit', submitCheat);

function setupSlider(id, valId, labels, fn){
    const sl = $(id), vl = $(valId);
    if(!sl || !vl) return;
    sl.addEventListener('input', () => {
        const v = parseInt(sl.value);
        vl.textContent = labels ? (labels[v] || v) : v + '%';
        if(fn) fn(v);
        AudioEngine.tap();
    });
}
setupSlider('qualitySlider', 'qualityVal', ['Low','Auto','High'], v => { S.qualityLevel = v; });
setupSlider('fpsLimitSlider', 'fpsLimitVal', ['30','60','Không'], v => { S.fpsLimit = v; });
setupSlider('shadowSlider', 'shadowVal', ['Off','On'], v => {
    S.shadowEnabled = v === 1;
    if(_shadowEnabled !== S.shadowEnabled){
        _shadowEnabled = S.shadowEnabled && !isLowDevice;
        if(renderer) renderer.shadowMap.enabled = _shadowEnabled;
        if(sunLight) sunLight.castShadow = _shadowEnabled;
    }
});
setupSlider('particleSlider', 'particleVal', ['Low','Medium','High'], v => { S.particleLevel = v; });
setupSlider('sfxVolSlider', 'sfxVolVal', null, v => { S.sfxVolume = v / 100; });
setupSlider('engineVolSlider', 'engineVolVal', null, v => { S.engineVolume = v / 100; C.ENGINE_BASE_VOL = 0.03 * v / 30; lastEngineVol = -1; });
setupSlider('musicVolSlider', 'musicVolVal', null, v => { S.musicVolume = v / 100; });
setupSlider('cameraSlider', 'cameraVal', ['Follow','Far','Cockpit'], v => { S.cameraMode = v; });
setupSlider('trollSlider', 'trollVal', ['Off','Normal','Chaos'], v => { S.trollLevel = v; });

/* ── KEYBOARD ── */
const cheatBuffer = [];
document.addEventListener('keydown', e => {
    if(e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inp.left = true;
    if(e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inp.right = true;
    if(e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { inp.gas = true; inp.forward = true; }
    if(e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { inp.brake = true; inp.back = true; }
    if(e.key === 'Shift') inp.boost = true;
    if(e.key === 'r' || e.key === 'R'){
        if(GameMode === 'zombie') reloadZombie();
        else if(GameMode === 'fps') fpsReload();
    }
    if(e.key === ' '){
        // v1.0: Space shoots in shooting modes, starts game otherwise
        if(S.phase === 'playing' && (GameMode === 'zombie' || GameMode === 'fps')){
            inp.shoot = true;
        } else if(S.phase === 'welcome' && !_musicPromptVisible){
            startGame();
        } else if(S.phase === 'dead' || S.phase === 'easter'){
            restart();
        }
    }
    if(e.key === 'Enter'){
        if(S.phase === 'welcome' && !_musicPromptVisible) startGame();
        else if(S.phase === 'dead' || S.phase === 'easter') restart();
    }
    if(e.key === 'Escape' || e.key === 'p' || e.key === 'P'){
        if(S.phase === 'playing') togglePause();
    }
    // FPS look controls (arrow keys when in FPS mode)
    if(GameMode === 'fps' && S.phase === 'playing'){
        if(e.key === 'ArrowLeft') S.fpsYaw += 0.1;
        if(e.key === 'ArrowRight') S.fpsYaw -= 0.1;
    }
    cheatBuffer.push(e.key.toLowerCase());
    if(cheatBuffer.length > 12) cheatBuffer.shift();
    checkCheats();
});
document.addEventListener('keyup', e => {
    if(e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inp.left = false;
    if(e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inp.right = false;
    if(e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W'){ inp.gas = false; inp.forward = false; }
    if(e.key === 'ArrowDown' || e.key === 's' || e.key === 'S'){ inp.brake = false; inp.back = false; }
    if(e.key === 'Shift') inp.boost = false;
    if(e.key === ' ') inp.shoot = false;
});

// Touch swipe (alt to buttons)
let touchStart = null;
canvas.addEventListener('touchstart', e => {
    if(S.phase !== 'playing' || S.paused) return;
    if(e.touches.length === 1){
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }
}, {passive: true});
canvas.addEventListener('touchmove', e => {
    if(!touchStart || S.phase !== 'playing') return;
    const dx = e.touches[0].clientX - touchStart.x;
    const dy = e.touches[0].clientY - touchStart.y;
    inp.left = dx < -20;
    inp.right = dx > 20;
    inp.gas = dy < -20;
    inp.brake = dy > 20;
}, {passive: true});
canvas.addEventListener('touchend', () => {
    if(touchStart){
        const dur = Date.now() - touchStart.t;
        if(dur < 200 && GameMode === 'desert' && S.boostMeter > 0.05){
            // tap = boost
            S.boostActive = 0.4;
            S.boostMeter = Math.max(0, S.boostMeter - 0.2);
            AudioEngine.boost();
        }
    }
    touchStart = null;
    inp.left = inp.right = inp.gas = inp.brake = false;
}, {passive: true});

/* ── VIBRATION BRIDGE ── */
function vibrate(ms){
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.vibrate){
            AndroidBridge.vibrate(ms);
        } else if(navigator.vibrate){
            navigator.vibrate(ms);
        }
    } catch(e){}
}

/* ── MUSIC BRIDGE ── */
function promptMusic(){
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.openMusicPicker){
            AndroidBridge.openMusicPicker();
            startGameAfterMusic(true);
        } else {
            startGameAfterMusic(false);
        }
    } catch(e){
        startGameAfterMusic(false);
    }
}

window.onMusicPicked = function(trackName){
    S.musicPlaying = true;
    showMusicIndicator(trackName);
    AudioEngine.success();
};
window.onMusicStopped = function(){
    S.musicPlaying = false;
    hideMusicIndicator();
};

function showMusicIndicator(trackName){
    if(!musicIndicator) return;
    if(musicTrackName) musicTrackName.textContent = '♪ ' + (trackName || 'Music');
    musicIndicator.style.display = 'flex';
}
function hideMusicIndicator(){
    if(!musicIndicator) return;
    musicIndicator.style.display = 'none';
}
function toggleMusicFromButton(){
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.toggleMusic){
            AndroidBridge.toggleMusic();
        }
    } catch(e){}
}

/* ── CAMERA MODE ── */
function cycleCameraMode(){
    S.cameraMode = (S.cameraMode + 1) % 3;
    if(cameraModeBtn){
        cameraModeBtn.textContent = ['📷','🔭','🚗'][S.cameraMode];
    }
    AudioEngine.select();
}

/* ── SETTINGS ── */
function openSettings(){
    if(settingsScr) settingsScr.style.display = 'flex';
    // v1.0: pause the game when opening settings (prevents death while
    // the user is configuring). Resume on close.
    if(S.phase === 'playing' && !S.paused){
        S.paused = true;
        if(audioCtx) audioCtx.suspend();
    }
    AudioEngine.open();
}
function toggleSoundFromButton(){
    S.audioEnabled = !S.audioEnabled;
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.setSoundEnabled){
            AndroidBridge.setSoundEnabled(S.audioEnabled);
        }
    } catch(e){}
    if(S.audioEnabled) AudioEngine.success(); else AudioEngine.close();
}
function toggleHudFromButton(){
    S.hudVisible = !S.hudVisible;
    if(hudEl) hudEl.style.opacity = S.hudVisible ? '1' : '0';
    AudioEngine.tap();
}
function toggleDebugFromButton(){
    S.debugOverlay = !S.debugOverlay;
    if(debugOverlay) debugOverlay.style.display = S.debugOverlay ? 'block' : 'none';
    AudioEngine.tap();
}

/* ── CHEAT CODES ── */
function checkCheats(){
    const buf = cheatBuffer.join('');
    if(buf.endsWith('arrowuparrowuparrowdownarrowdownarrowleftarrowrightarrowleftarrowrightba')){
        activateCheat('GOD MODE (Konami)', () => {
            S.dead = false; S.phase = 'playing';
            deathScr.style.display = 'none'; hudEl.style.display = 'block';
            ctrlEl.style.display = 'block';
            S.fpsInvincible = 9999; S.zombieHealth = 9999;
        });
    }
    if(buf.endsWith('iddqd')){ activateCheat('IDDQD — immortal', () => { S.dead = false; S.fpsInvincible = 9999; S.zombieHealth = 9999; }); }
    if(buf.endsWith('trololol')){ activateCheat('TROLL OVERDRIVE', () => { triggerRandomTroll(); triggerRandomTroll(); triggerRandomTroll(); }); }
    if(buf.endsWith('boost')){ activateCheat('BOOST FULL', () => { S.boostMeter = 1; }); }
}
function activateCheat(name, fn){
    fn();
    showTroll('CHEAT: ' + name, 2000);
    AudioEngine.achievement();
    cheatBuffer.length = 0;
}
function submitCheat(){
    if(!cheatInput) return;
    const code = cheatInput.value.trim().toLowerCase();
    cheatInput.value = '';
    if(code === 'ghost'){ S.invisibleMode = 30; showTroll('CHEAT: Ghost mode 30s', 2000); }
    else if(code === 'fly'){ S.gravityFlip = 30; showTroll('CHEAT: Anti-gravity 30s', 2000); }
    else if(code === 'big'){ if(carGroup) carGroup.scale.set(2,2,2); showTroll('CHEAT: BIG CAR', 2000); }
    else if(code === 'small'){ if(carGroup) carGroup.scale.set(0.7,0.7,0.7); showTroll('CHEAT: small car', 2000); }
    else if(code === 'reset'){ if(carGroup) carGroup.scale.set(C.CAR_SCALE,C.CAR_SCALE,C.CAR_SCALE); showTroll('CHEAT: reset', 1500); }
    else if(code === 'coin'){ S.coinsCollected += 100; updateCoinDisplay(); showTroll('CHEAT: +100 coins', 2000); }
    else if(code === 'speed'){ S.speed = C.CAR_MAX_SPEED; showTroll('CHEAT: MAX SPEED', 2000); }
    else if(code === 'god'){ S.dead = false; S.fpsInvincible = 9999; S.zombieHealth = 9999; showTroll('CHEAT: GOD MODE', 2000); }
    else if(code === 'ammo'){ S.zombieAmmo = 9999; S.zombieAmmoReserve = 9999; S.fpsAmmo = 9999; S.fpsAmmoReserve = 9999; showTroll('CHEAT: Infinite ammo', 2000); }
    else if(code === 'heal'){ S.zombieHealth = ZC.MAX_HEALTH; S.fpsHealth = 100; showTroll('CHEAT: Full health', 2000); }
    else if(code === 'wave'){
        if(GameMode === 'zombie'){ S.zombieBetweenWaves = true; S.zombieBetweenTimer = 0.1; showTroll('CHEAT: Skip wave', 2000); }
        else if(GameMode === 'fps'){ S.fpsWaveBetweenTimer = 0.1; showTroll('CHEAT: Skip wave', 2000); }
        else showTroll('CHEAT: chỉ dùng được trong mode Zombie/FPS', 2000);
    }
    else if(code === 'zombie'){ S.zombieTotalKills += 50; S.fpsKills += 50; updateZombieHud(); showTroll('CHEAT: +50 kills', 2000); }
    else { showTroll('Unknown cheat code', 1500); AudioEngine.error(); return; }
    AudioEngine.achievement();
}

/* ── PAUSE ── */
function togglePause(){
    if(S.phase !== 'playing') return;
    S.paused = !S.paused;
    if(S.paused){
        pauseScr.style.display = 'flex';
        hudEl.style.display = 'none';
        ctrlEl.style.display = 'none';
        zombieCtrlEl.style.display = 'none';
        fpsCtrlEl.style.display = 'none';
        simCtrlEl.style.display = 'none';
        modeHudEl.style.display = 'none';
        showGameUI(false);
        if(audioCtx) audioCtx.suspend();
        AudioEngine.pauseSfx();
    } else {
        pauseScr.style.display = 'none';
        // Restore mode UI
        if(Modes[GameMode] && Modes[GameMode].showPlayingUI) Modes[GameMode].showPlayingUI();
        showGameUI(true);
        if(audioCtx) audioCtx.resume();
        if(clock) clock.start();
        AudioEngine.resumeSfx();
    }
}

/* ── GAMEPLAY UI VISIBILITY ── */
function showGameUI(show){
    const flexDisp = show ? 'flex' : 'none';
    const blockDisp = show ? 'block' : 'none';
    if(pauseBtn) pauseBtn.style.display = flexDisp;
    if(settingsBtn) settingsBtn.style.display = flexDisp;
    if(cameraModeBtn) cameraModeBtn.style.display = flexDisp;
    if(boostBar) boostBar.style.display = blockDisp;
    if(speedoWrap) speedoWrap.style.display = blockDisp;
    if(boostLabel) boostLabel.style.display = blockDisp;
}

/* ───────────────────────────────────────────
   INIT (Three.js setup)
   ─────────────────────────────────────────── */
function init(){
    isLowDevice = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 2 : false;
    const low = isLowDevice;
    S.lowPerfMode = low;
    _shadowEnabled = !low;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xD2B48C, low ? 0.010 : 0.005);

    cam = new THREE.PerspectiveCamera(low ? 55 : 60, innerWidth / innerHeight, 0.5, 500);
    cam.position.set(0, C.CAM_H, C.CAM_DIST);
    cam.lookAt(0, 1.5, 0);

    renderer = new THREE.WebGLRenderer({
        canvas, antialias: !low, powerPreference: 'high-performance',
        precision: low ? 'mediump' : 'highp', alpha: false, stencil: false, depth: true,
    });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : C.PR_CAP));
    renderer.shadowMap.enabled = _shadowEnabled;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    if('physicallyCorrectLights' in renderer) renderer.physicallyCorrectLights = false;

    clock = new THREE.Clock(false);

    // Sky gradient
    const skyC = document.createElement('canvas');
    skyC.width = 2; skyC.height = 512;
    const ctx = skyC.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#1e3a5c'); g.addColorStop(0.15, '#4a6fa5');
    g.addColorStop(0.35, '#8b6e4e'); g.addColorStop(0.55, '#c4956a');
    g.addColorStop(0.75, '#d9b882'); g.addColorStop(1, '#f5deb3');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 512);
    const skyTex = new THREE.CanvasTexture(skyC);
    skyTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = skyTex;

    // Lights
    sunLight = new THREE.DirectionalLight(0xffd700, 2.5);
    sunLight.position.set(60, 90, -40);
    if(_shadowEnabled){
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(C.SHADOW_MAP_SIZE, C.SHADOW_MAP_SIZE);
        sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 250;
        sunLight.shadow.camera.left = -80; sunLight.shadow.camera.right = 80;
        sunLight.shadow.camera.top = 80; sunLight.shadow.camera.bottom = -80;
    }
    scene.add(sunLight); scene.add(sunLight.target);
    ambientLight = new THREE.AmbientLight(0xd4a574, 0.55); scene.add(ambientLight);
    hemiLight = new THREE.HemisphereLight(0xc2956b, 0xD2B48C, 0.4); scene.add(hemiLight);

    sunMesh = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), new THREE.MeshBasicMaterial({color: 0xffd700}));
    sunMesh.position.copy(sunLight.position); scene.add(sunMesh);

    // Build shared desert scene (used by desert + time attack modes)
    buildGround(low); buildRoad(low); buildCar(low); buildDecorations(low);
    buildObstacles(low); buildCoins(low);
    if(!low) buildDust();

    // Zombie weapon model (attached to camera, hidden by default)
    zombiePlayerMesh = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(.15, .15, .6), new THREE.MeshLambertMaterial({color: 0x333333}));
    gunBody.position.set(0.3, -0.2, -0.5); zombiePlayerMesh.add(gunBody);
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .4, 8), new THREE.MeshLambertMaterial({color: 0x222222}));
    gunBarrel.rotation.x = Math.PI / 2; gunBarrel.position.set(0.3, -0.15, -0.9); zombiePlayerMesh.add(gunBarrel);
    zombieMuzzleMesh = new THREE.Mesh(new THREE.SphereGeometry(.08, 6, 6), new THREE.MeshBasicMaterial({color: 0xffaa00, transparent: true, opacity: 0}));
    zombieMuzzleMesh.position.set(0.3, -0.15, -1.1); zombiePlayerMesh.add(zombieMuzzleMesh);
    zombiePlayerMesh.visible = false; scene.add(zombiePlayerMesh);

    // v1.0: FPS weapon (separate from zombie weapon, larger rifle)
    fpsPlayerWeapon = new THREE.Group();
    const fpsGunBody = new THREE.Mesh(new THREE.BoxGeometry(.12, .14, .8), new THREE.MeshLambertMaterial({color: 0x222222}));
    fpsGunBody.position.set(0.25, -0.18, -0.5); fpsPlayerWeapon.add(fpsGunBody);
    const fpsGunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .6, 8), new THREE.MeshLambertMaterial({color: 0x111111}));
    fpsGunBarrel.rotation.x = Math.PI / 2; fpsGunBarrel.position.set(0.25, -0.14, -1.0); fpsPlayerWeapon.add(fpsGunBarrel);
    const fpsGunMag = new THREE.Mesh(new THREE.BoxGeometry(.08, .2, .1), new THREE.MeshLambertMaterial({color: 0x333333}));
    fpsGunMag.position.set(0.25, -0.3, -0.4); fpsPlayerWeapon.add(fpsGunMag);
    const fpsGunStock = new THREE.Mesh(new THREE.BoxGeometry(.1, .12, .25), new THREE.MeshLambertMaterial({color: 0x4a2a1a}));
    fpsGunStock.position.set(0.25, -0.18, -0.05); fpsPlayerWeapon.add(fpsGunStock);
    fpsMuzzleMesh = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 6), new THREE.MeshBasicMaterial({color: 0xffee88, transparent: true, opacity: 0}));
    fpsMuzzleMesh.position.set(0.25, -0.14, -1.3); fpsPlayerWeapon.add(fpsMuzzleMesh);
    fpsPlayerWeapon.visible = false; scene.add(fpsPlayerWeapon);

    // v1.0: Build FPS level (hidden until FPS mode entered)
    buildFpsLevel();

    // v1.0: Build Simulator world (hidden until Sim mode entered)
    buildSimWorld();

    window.addEventListener('resize', onResize, {passive: true});
}

let _resizeTimer = null;
function onResize(){
    if(_resizeTimer) clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
        if(cam){ cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
        if(renderer) renderer.setSize(innerWidth, innerHeight);
        _resizeTimer = null;
    }, 100);
}

/* ── GROUND ── */
function buildGround(low){
    const gMat = new THREE.MeshLambertMaterial({color: 0xD2B48C, flatShading: low});
    for(let i = 0; i < 3; i++){
        const g = new THREE.PlaneGeometry(600, 600, low ? 4 : 10, low ? 4 : 10);
        const v = g.attributes.position.array;
        for(let j = 0; j < v.length; j += 3) if(v[j+2] !== -0.1) v[j+2] += (Math.random() - .5) * .3;
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, gMat);
        m.rotation.x = -Math.PI / 2; m.position.y = -0.08;
        m.receiveShadow = !low; m.userData.gIdx = i;
        scene.add(m); groundMeshes.push(m);
    }
}

/* ── ROAD ── */
function buildRoad(low){
    for(let i = 0; i < C.NUM_SEGS; i++){
        const isFork = (i > 1 && i % C.FORK_EVERY === 0);
        segData.push(createSeg(i, isFork, low));
    }
}
function createSeg(idx, isFork, low){
    const w = C.ROAD_W, len = C.SEG_LEN;
    const grp = new THREE.Group();
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, len, 1, low ? 2 : 4), new THREE.MeshLambertMaterial({color: 0x3d3d3d}));
    road.rotation.x = -Math.PI / 2; road.position.y = 0.03; road.receiveShadow = !low; grp.add(road);
    const lMat = new THREE.MeshBasicMaterial({color: 0xeeeeee});
    const lG = new THREE.PlaneGeometry(.3, len);
    const lL = new THREE.Mesh(lG, lMat); lL.rotation.x = -Math.PI / 2; lL.position.set(-w/2 + .15, .04, 0); grp.add(lL);
    const rL = new THREE.Mesh(lG, lMat); rL.rotation.x = -Math.PI / 2; rL.position.set(w/2 - .15, .04, 0); grp.add(rL);
    const dMat = new THREE.MeshBasicMaterial({color: 0xaaaaaa});
    const dG = new THREE.PlaneGeometry(.15, 4);
    for(let d = -len/2 + 2; d < len/2; d += 8){
        const dash = new THREE.Mesh(dG, dMat);
        dash.rotation.x = -Math.PI / 2; dash.position.set(0, .04, d); grp.add(dash);
    }
    const sMat = new THREE.MeshLambertMaterial({color: 0xb89968});
    const sG = new THREE.PlaneGeometry(3, len);
    const ls = new THREE.Mesh(sG, sMat); ls.rotation.x = -Math.PI / 2; ls.position.set(-w/2 - 1.5, .01, 0); grp.add(ls);
    const rs = new THREE.Mesh(sG, sMat); rs.rotation.x = -Math.PI / 2; rs.position.set(w/2 + 1.5, .01, 0); grp.add(rs);
    if(isFork) buildForkGeometry(grp, low);
    scene.add(grp);
    grp.position.z = -idx * len;
    return {grp, idx, isFork, len};
}
function buildForkGeometry(grp, low){
    const w = C.ROAD_W, len = C.SEG_LEN;
    const fMat = new THREE.MeshLambertMaterial({color: 0x4a4a4a});
    const sMat = new THREE.MeshLambertMaterial({color: 0xf59e0b});
    const pMat = new THREE.MeshLambertMaterial({color: 0x8b4513});
    const fLen = 40, fSegs = 5, fAngle = -0.4;
    let curAngle = 0, curX = -w/2, curZ = len/2 - 10;
    for(let i = 0; i < fSegs; i++){
        const sLen = fLen / fSegs;
        curAngle += fAngle / fSegs;
        const fR = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, sLen), fMat);
        fR.rotation.x = -Math.PI / 2; fR.rotation.z = curAngle;
        fR.position.set(curX, 0.03, curZ - sLen/2); grp.add(fR);
        curX += Math.sin(curAngle) * sLen * (-1);
        curZ -= Math.cos(curAngle) * sLen;
    }
    curAngle = 0; curX = w/2; curZ = len/2 - 10;
    for(let i = 0; i < fSegs; i++){
        const sLen = fLen / fSegs;
        curAngle += 0.4 / fSegs;
        const fR = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, sLen), fMat);
        fR.rotation.x = -Math.PI / 2; fR.rotation.z = curAngle;
        fR.position.set(curX, 0.03, curZ - sLen/2); grp.add(fR);
        curX += Math.sin(curAngle) * sLen;
        curZ -= Math.cos(curAngle) * sLen;
    }
    [-1, 1].forEach(side => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 3.5, 4), pMat);
        post.position.set(side * (w/2 + 3), 1.75, len/2 - 6); grp.add(post);
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, .9, .08), sMat);
        board.position.set(side * (w/2 + 3), 3.2, len/2 - 6); board.rotation.y = side * .25; grp.add(board);
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(.3, .6, 3), new THREE.MeshBasicMaterial({color: 0xffffff}));
        arrow.position.set(side * (w/2 + 3), 3.2, len/2 - 6);
        arrow.rotation.z = side * Math.PI / 2; arrow.rotation.y = side * .25;
        grp.add(arrow);
    });
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(w * .7, 1.8, .4), new THREE.MeshLambertMaterial({color: 0xff3333}));
    barrier.position.set(0, .9, len/2 - 15); grp.add(barrier);
    [-w * .35, w * .35].forEach(xp => {
        const bPost = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 2.5, 6), pMat);
        bPost.position.set(xp, 1.25, len/2 - 15); grp.add(bPost);
    });
    for(let s = -w * .35 + 1; s < w * .35; s += 2){
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.8, .1), new THREE.MeshBasicMaterial({color: 0xffcc00}));
        stripe.position.set(s, 1.3, len/2 - 15.2); stripe.rotation.x = -Math.PI / 2; grp.add(stripe);
    }
    const warnSign = new THREE.Mesh(new THREE.BoxGeometry(2.5, .6, .08), new THREE.MeshBasicMaterial({color: 0xff3333}));
    warnSign.position.set(0, 2.8, len/2 - 15); grp.add(warnSign);
}
function recycleSegs(){
    if(!carGroup) return;
    const carZ = carGroup.position.z;
    const total = C.NUM_SEGS * C.SEG_LEN;
    for(let i = 0, n = segData.length; i < n; i++){
        const s = segData[i];
        const dz = s.grp.position.z - carZ;
        if(dz > C.SEG_LEN * 2.5) s.grp.position.z -= total;
        else if(dz < -total + C.SEG_LEN) s.grp.position.z += total;
    }
    for(let i = 0, n = groundMeshes.length; i < n; i++){
        const m = groundMeshes[i];
        m.position.z = carZ - i * 200;
        m.position.x = carGroup.position.x * 0.3;
    }
    sunMesh.position.set(carGroup.position.x + 60, 90, carGroup.position.z - 40);
    sunLight.position.set(carGroup.position.x + 60, 90, carGroup.position.z - 40);
    sunLight.target.position.copy(carGroup.position);
    sunLight.target.updateMatrixWorld();
}

/* ── CAR ── */
function buildCar(low){
    carGroup = new THREE.Group();
    const bodyM  = new THREE.MeshLambertMaterial({color: 0xcc0000});
    const darkM  = new THREE.MeshLambertMaterial({color: 0xaa0000});
    const glassM = new THREE.MeshLambertMaterial({color: 0x88ccff, transparent: true, opacity: .5});
    const blkM   = new THREE.MeshLambertMaterial({color: 0x1a1a1a});
    const chrM   = new THREE.MeshLambertMaterial({color: 0xdddddd});
    const yelM   = new THREE.MeshBasicMaterial({color: 0xffee44});
    const redM   = new THREE.MeshBasicMaterial({color: 0xff2222});
    carBodyMesh = bx(carGroup, 2.5, .6, 4.6, bodyM, 0, .55, 0, !low);
    const hood = bx(carGroup, 2.35, .35, 1.6, bodyM, 0, .85, 1.15, !low); hood.rotation.x = -.08;
    bx(carGroup, 2.15, .55, 2, darkM, 0, 1.15, -.15, !low);
    bx(carGroup, 1.95, .14, 1.85, blkM, 0, 1.48, -.15, false);
    bx(carGroup, 2.35, .3, 1.1, bodyM, 0, .85, -1.5, !low);
    const ws = bx(carGroup, 2, .52, .06, glassM, 0, 1.15, .7, false); ws.rotation.x = -.38;
    const rw = bx(carGroup, 2, .42, .06, glassM, 0, 1.15, -1.1, false); rw.rotation.x = .32;
    bx(carGroup, .06, .35, 1.6, glassM, -1.08, 1.15, -.15, false);
    bx(carGroup, .06, .35, 1.6, glassM, 1.08, 1.15, -.15, false);
    sp(carGroup, .15, yelM, -.9, .58, 2.3, 8); sp(carGroup, .15, yelM, .9, .58, 2.3, 8);
    sp(carGroup, .08, yelM, -.5, .35, 2.35, 6); sp(carGroup, .08, yelM, .5, .35, 2.35, 6);
    sp(carGroup, .13, redM, -.9, .58, -2.3, 8); sp(carGroup, .13, redM, .9, .58, -2.3, 8);
    bx(carGroup, 2.5, .2, .28, blkM, 0, .36, 2.18, false);
    bx(carGroup, 2.5, .2, .28, blkM, 0, .36, -2.18, false);
    bx(carGroup, 1.7, .22, .08, blkM, 0, .47, 2.32, false);
    for(let s = -.7; s <= .7; s += .35) bx(carGroup, .04, .18, .1, chrM, s, .47, 2.34, false);
    bx(carGroup, .08, .22, 3.9, blkM, -1.27, .32, 0, false);
    bx(carGroup, .08, .22, 3.9, blkM, 1.27, .32, 0, false);
    cy(carGroup, .07, .07, .5, chrM, -.55, .22, -2.35, Math.PI / 2, 8);
    cy(carGroup, .07, .07, .5, chrM, .55, .22, -2.35, Math.PI / 2, 8);
    bx(carGroup, .16, .13, .1, blkM, -1.32, 1, 0.3, false);
    bx(carGroup, .16, .13, .1, blkM, 1.32, 1, 0.3, false);
    bx(carGroup, .02, .45, 1.8, blkM, -1.26, .75, 0, false);
    bx(carGroup, .02, .45, 1.8, blkM, 1.26, .75, 0, false);
    bx(carGroup, 1.9, .08, .45, blkM, 0, 1.4, -1.85, false);
    bx(carGroup, .08, .35, .08, blkM, -.75, 1.22, -1.85, false);
    bx(carGroup, .08, .35, .08, blkM, .75, 1.22, -1.85, false);
    bx(carGroup, .12, .01, 2.5, new THREE.MeshBasicMaterial({color: 0xffffff}), 0, .87, 1, false);
    bx(carGroup, .8, .3, .04, chrM, 0, .38, -2.3, false);
    const wG = new THREE.CylinderGeometry(.36, .36, .24, low ? 10 : 16);
    const hG = new THREE.CylinderGeometry(.16, .16, .26, low ? 6 : 10);
    const rG = new THREE.TorusGeometry(.3, .05, 6, low ? 10 : 16);
    const wP = [{x:-1.28,z:1.4},{x:1.28,z:1.4},{x:-1.28,z:-1.35},{x:1.28,z:-1.35}];
    wP.forEach(p => {
        const wg = new THREE.Group();
        const tire = new THREE.Mesh(wG, blkM); tire.rotation.z = Math.PI / 2; wg.add(tire);
        const hub = new THREE.Mesh(hG, chrM); hub.rotation.z = Math.PI / 2; wg.add(hub);
        const rim = new THREE.Mesh(rG, chrM); rim.rotation.y = Math.PI / 2; wg.add(rim);
        for(let s = 0; s < 5; s++){
            const spoke = bx(wg, .04, .02, .5, chrM, 0, 0, 0, false);
            spoke.rotation.z = Math.PI / 2; spoke.rotation.y = s * Math.PI * 2 / 5;
        }
        wg.position.set(p.x, .36, p.z);
        wg.castShadow = !low;
        carGroup.add(wg); wheels.push(wg);
    });
    carGroup.scale.set(C.CAR_SCALE, C.CAR_SCALE, C.CAR_SCALE);
    carGroup.position.set(0, 0, 0);
    scene.add(carGroup);
}
function bx(p, w, h, d, m, x, y, z, sh){ const o = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m); o.position.set(x,y,z); if(sh) o.castShadow = true; p.add(o); return o; }
function sp(p, r, m, x, y, z, s){ const o = new THREE.Mesh(new THREE.SphereGeometry(r, s||8, s||8), m); o.position.set(x,y,z); p.add(o); return o; }
function cy(p, rt, rb, h, m, x, y, z, rz, s){ const o = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s||8), m); o.position.set(x,y,z); if(rz) o.rotation.z = rz; p.add(o); return o; }

/* ── DECORATIONS ── */
function buildDecorations(low){
    const cMat = new THREE.MeshLambertMaterial({color: 0x2d5a27});
    const rMat = new THREE.MeshLambertMaterial({color: 0x9e8c6c, flatShading: true});
    const dMat = new THREE.MeshLambertMaterial({color: 0xc4a66a, flatShading: low});
    const deadMat = new THREE.MeshLambertMaterial({color: 0x5c4033, flatShading: true});
    const totalLen = C.NUM_SEGS * C.SEG_LEN;
    for(let i = 0; i < 45; i++){
        const c = mkCactus(cMat, low);
        const side = Math.random() > .5 ? 1 : -1;
        c.position.set(side * (C.ROAD_W/2 + 5 + Math.random()*40), 0, -(Math.random() * totalLen));
        c.userData.isDeco = true; scene.add(c); decoPool.push(c);
    }
    for(let i = 0; i < 55; i++){
        const r = mkRock(rMat);
        const side = Math.random() > .5 ? 1 : -1;
        r.position.set(side * (C.ROAD_W/2 + 4 + Math.random()*50), .15, -(Math.random() * totalLen));
        r.userData.isDeco = true; scene.add(r); decoPool.push(r);
    }
    for(let i = 0; i < 14; i++){
        const d = mkDune(dMat, low);
        const side = Math.random() > .5 ? 1 : -1;
        d.position.set(side * (55 + Math.random()*90), -.5, -(Math.random() * totalLen));
        d.userData.isDeco = true; scene.add(d); decoPool.push(d);
    }
    for(let i = 0; i < 8; i++){
        const t = mkDeadTree(deadMat, low);
        const side = Math.random() > .5 ? 1 : -1;
        t.position.set(side * (C.ROAD_W/2 + 8 + Math.random()*25), 0, -(Math.random() * totalLen));
        t.userData.isDeco = true; scene.add(t); decoPool.push(t);
    }
}
function mkCactus(m, low){
    const g = new THREE.Group();
    const h = 1.8 + Math.random() * 1.2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.15, .2, h, low ? 4 : 6), m);
    trunk.position.y = h/2; g.add(trunk);
    if(Math.random() > .25){ const arm = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, .8 + Math.random()*.4, 4), m); arm.position.set(.3, h*.6 + Math.random()*.2, 0); arm.rotation.z = -.55; g.add(arm); }
    if(Math.random() > .25){ const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, .6 + Math.random()*.3, 4), m); arm2.position.set(-.25, h*.5 + Math.random()*.2, 0); arm2.rotation.z = .45; g.add(arm2); }
    const top = new THREE.Mesh(new THREE.SphereGeometry(.14, 4, 4), m); top.position.y = h + .05; g.add(top);
    return g;
}
function mkRock(m){
    const s = .25 + Math.random() * .8;
    const g = new THREE.DodecahedronGeometry(s, 0);
    const v = g.attributes.position.array;
    for(let i = 0; i < v.length; i += 3){ v[i] *= .7 + Math.random()*.5; v[i+1] *= .4 + Math.random()*.4; v[i+2] *= .7 + Math.random()*.5; }
    g.computeVertexNormals(); return new THREE.Mesh(g, m);
}
function mkDune(m, low){
    const g = new THREE.SphereGeometry(14 + Math.random()*12, low ? 4 : 8, low ? 3 : 5, 0, Math.PI*2, 0, Math.PI/3.5);
    const d = new THREE.Mesh(g, m); d.rotation.x = -Math.PI / 2; d.position.y = -.6; return d;
}
function mkDeadTree(m, low){
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, 3, low ? 3 : 5), m);
    trunk.position.y = 1.5; trunk.rotation.z = (Math.random() - .5) * .15; g.add(trunk);
    for(let b = 0; b < 3; b++){ const br = new THREE.Mesh(new THREE.CylinderGeometry(.03, .05, .6 + Math.random(), 3), m); br.position.set(Math.random() > .5 ? .2 : -.2, 1 + b*.5 + Math.random(), 0); br.rotation.z = (Math.random() - .5) * 1.2; g.add(br); }
    return g;
}
function recycleDeco(){
    if(!carGroup) return;
    const cZ = carGroup.position.z, total = C.NUM_SEGS * C.SEG_LEN;
    for(let i = 0, n = decoPool.length; i < n; i++){
        const d = decoPool[i];
        if(!d.userData.isDeco) continue;
        const dz = d.position.z - cZ;
        if(dz > C.SEG_LEN * 3){ d.position.z -= total; const side = Math.random() > .5 ? 1 : -1; d.position.x = side * (C.ROAD_W/2 + 4 + Math.random()*50); }
        if(dz < -total + C.SEG_LEN){ d.position.z += total; const side = Math.random() > .5 ? 1 : -1; d.position.x = side * (C.ROAD_W/2 + 4 + Math.random()*50); }
    }
}

/* ── OBSTACLES ── */
function buildObstacles(low){
    const oMat = new THREE.MeshLambertMaterial({color: 0x9e8c6c, flatShading: true});
    const camelMat = new THREE.MeshLambertMaterial({color: 0xb89968, flatShading: low});
    const totalLen = C.NUM_SEGS * C.SEG_LEN;
    for(let i = 0; i < 20; i++){
        const r = mkRock(oMat);
        const side = Math.random() > .5 ? 1 : -1;
        const xOff = 1 + Math.random() * (C.ROAD_W/2 - 3);
        r.position.set(side * xOff, .2, -(Math.random() * totalLen));
        r.userData.isObs = true; r.userData.obsRadius = .3 + Math.random() * .3;
        const combR = r.userData.obsRadius + C.OBS_COLLISION_R;
        r.userData.combRadiusSq = combR * combR;
        r.userData.nearMissSq = (r.userData.obsRadius + C.OBS_COLLISION_R + 1) * (r.userData.obsRadius + C.OBS_COLLISION_R + 1);
        scene.add(r); obstaclePool.push(r);
    }
    for(let i = 0; i < 6; i++){
        const c = mkDeadCamel(camelMat, low);
        const side = Math.random() > .5 ? 1 : -1;
        const xOff = 1 + Math.random() * 3;
        c.position.set(side * xOff, 0, -(Math.random() * totalLen));
        c.userData.isObs = true; c.userData.obsRadius = 1.5;
        const combR2 = 1.5 + C.OBS_COLLISION_R;
        c.userData.combRadiusSq = combR2 * combR2;
        c.userData.nearMissSq = (1.5 + C.OBS_COLLISION_R + 1) * (1.5 + C.OBS_COLLISION_R + 1);
        scene.add(c); obstaclePool.push(c);
    }
}
function mkDeadCamel(m, low){
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, .8, 2.5), m); body.position.y = .4; g.add(body);
    const legM = new THREE.MeshLambertMaterial({color: 0x9e8c6c});
    [[-0.7,.1,.8],[.7,.1,.8],[-0.7,.1,-.8],[.7,.1,-.8]].forEach(p => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 1.2, 4), legM);
        leg.position.set(p[0], p[1], p[2]); leg.rotation.z = p[0] < 0 ? .4 : -.4; g.add(leg);
    });
    const head = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, .5), m); head.position.set(0, .15, 1.4); head.rotation.x = .3; g.add(head);
    return g;
}
function recycleObs(){
    if(!carGroup) return;
    const cZ = carGroup.position.z, total = C.NUM_SEGS * C.SEG_LEN;
    for(let i = 0, n = obstaclePool.length; i < n; i++){
        const o = obstaclePool[i];
        if(!o.userData.isObs) continue;
        const dz = o.position.z - cZ;
        if(dz > C.SEG_LEN * 3){ o.position.z -= total; const side = Math.random() > .5 ? 1 : -1; o.position.x = side * (1 + Math.random()*(C.ROAD_W/2-3)); }
        if(dz < -total + C.SEG_LEN){ o.position.z += total; const side = Math.random() > .5 ? 1 : -1; o.position.x = side * (1 + Math.random()*(C.ROAD_W/2-3)); }
    }
}
function checkObstacles(){
    if(S.dead || !carGroup) return;
    const cx = carGroup.position.x, cz = carGroup.position.z;
    for(let i = 0, n = obstaclePool.length; i < n; i++){
        const o = obstaclePool[i];
        if(!o.userData.isObs) continue;
        const dx = o.position.x - cx, dz = o.position.z - cz;
        const distSq = dx*dx + dz*dz;
        if(distSq < o.userData.combRadiusSq){
            triggerDeath();
            return;
        }
        if(distSq < o.userData.nearMissSq && dz < 0 && !o.userData._nearMiss){
            S.nearMissCount++;
            o.userData._nearMiss = true;
            if(S.nearMissCount % 5 === 0){
                showTroll('Near-miss x' + S.nearMissCount + '! +1 coin', 1500);
                S.coinsCollected++; updateCoinDisplay(); AudioEngine.nearMiss();
            } else {
                AudioEngine.nearMiss();
            }
        } else if(dz > 5){
            o.userData._nearMiss = false;
        }
    }
}

/* ── COINS ── */
function buildCoins(low){
    const coinMat = new THREE.MeshLambertMaterial({color: 0xffd700, emissive: 0x442200});
    const totalLen = C.NUM_SEGS * C.SEG_LEN;
    for(let i = 0; i < 15; i++){
        const coin = new THREE.Mesh(new THREE.TorusGeometry(.4, .15, 6, 12), coinMat);
        coin.position.set((Math.random() - .5) * (C.ROAD_W - 3), 1.0, -(Math.random() * totalLen));
        coin.userData.isCoin = true; coin.userData.collected = false;
        scene.add(coin); coinPool.push(coin);
    }
}
function recycleCoins(){
    if(!carGroup) return;
    const cZ = carGroup.position.z, total = C.NUM_SEGS * C.SEG_LEN;
    for(let i = 0, n = coinPool.length; i < n; i++){
        const c = coinPool[i];
        const dz = c.position.z - cZ;
        if(dz > C.SEG_LEN * 3 || dz < -total + C.SEG_LEN){
            c.position.z -= total;
            c.position.x = (Math.random() - .5) * (C.ROAD_W - 3);
            c.userData.collected = false; c.visible = true;
        }
    }
}
function checkCoins(){
    if(S.dead || !carGroup) return;
    const cx = carGroup.position.x, cz = carGroup.position.z;
    const r = 1.2, rSq = r * r;
    for(let i = 0, n = coinPool.length; i < n; i++){
        const c = coinPool[i];
        if(c.userData.collected || !c.visible) continue;
        const dx = c.position.x - cx, dz = c.position.z - cz;
        if(dx*dx + dz*dz < rSq){
            c.userData.collected = true; c.visible = false;
            S.coinsCollected++; S.boostMeter = Math.min(1, S.boostMeter + 0.1);
            updateCoinDisplay(); AudioEngine.coin();
        }
    }
}
function updateCoinDisplay(){ if(coinCounter) coinCounter.textContent = '🪙 ' + S.coinsCollected; }

/* ── DUST ── */
function buildDust(){
    const n = C.DUST_COUNT;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for(let i = 0; i < n; i++){ pos[i*3] = (Math.random() - .5) * 8; pos[i*3+1] = Math.random() * 1.5; pos[i*3+2] = (Math.random() - .5) * 4 - 2; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dustPts = new THREE.Points(g, new THREE.PointsMaterial({color: 0xD2B48C, size: .35, transparent: true, opacity: .2, depthWrite: false}));
    scene.add(dustPts);
}
let _dustAccum = 0;
function updateDust(dt){
    if(!dustPts || !carGroup) return;
    _dustAccum += dt;
    if(_dustAccum < C.DUST_UPDATE_INTERVAL) return;
    _dustAccum = 0;
    const p = dustPts.geometry.attributes.position.array;
    const cx = carGroup.position.x, cz = carGroup.position.z;
    const rot = carGroup.rotation.y;
    for(let i = 0, n = p.length; i < n; i += 3){
        p[i] += (Math.random() - .5) * .3;
        p[i+1] += Math.random() * .08;
        p[i+2] += (Math.random() - .5) * .3 - S.speed * C.DUST_UPDATE_INTERVAL * .2;
        if(p[i+1] > 2.5) p[i+1] = Math.random() * .5;
        const dx = p[i] - cx, dz = p[i+2] - cz;
        if(Math.abs(dx) > 10 || Math.abs(dz) > 10){
            p[i] = cx + (Math.random() - .5) * 4 - Math.sin(rot) * 3;
            p[i+1] = Math.random() * 1;
            p[i+2] = cz + (Math.random() - .5) * 4 + Math.cos(rot) * 3;
        }
    }
    dustPts.geometry.attributes.position.needsUpdate = true;
}

// ============================================================
// ZOMBIE MODE
// ============================================================
const ZC = {
    WAVE_BASE: 5, HP_NORMAL: 2, HP_MUTANT: 5, HP_HORROR: 10,
    SPEED_NORMAL: 3, SPEED_MUTANT: 5, SPEED_HORROR: 7,
    DMG_NORMAL: 10, DMG_MUTANT: 20, DMG_HORROR: 35,
    BULLET_SPEED: 50, BULLET_DMG: 1, MAX_AMMO: 30,
    RELOAD_TIME: 1.5, MAX_HEALTH: 100, SPAWN_DIST: 60, ATTACK_RANGE: 2.5,
};

function createZombie(type){
    const g = new THREE.Group();
    let bodyColor, headColor, hp, speed, scale;
    if(type === 'normal'){ bodyColor = 0x3a7a3a; headColor = 0x4a8a4a; hp = ZC.HP_NORMAL; speed = ZC.SPEED_NORMAL; scale = 1; }
    else if(type === 'mutant'){ bodyColor = 0x6a3a8a; headColor = 0x8a4aaa; hp = ZC.HP_MUTANT; speed = ZC.SPEED_MUTANT; scale = 1.4; }
    else { bodyColor = 0x4a1a1a; headColor = 0x6a0a0a; hp = ZC.HP_HORROR; speed = ZC.SPEED_HORROR; scale = 1.8; }
    const bodyMat = new THREE.MeshLambertMaterial({color: bodyColor, flatShading: true});
    const headMat = new THREE.MeshLambertMaterial({color: headColor, flatShading: true});
    const eyeMat = new THREE.MeshBasicMaterial({color: type === 'horror' ? 0xff0000 : 0xff4444});
    const body = new THREE.Mesh(new THREE.BoxGeometry(.8*scale, 1.2*scale, .5*scale), bodyMat); body.position.y = 1.2*scale; g.add(body);
    const headSize = type === 'horror' ? .5*scale : .35*scale;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headSize, 8, 8), headMat); head.position.y = 2*scale; g.add(head);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(.06*scale, 4, 4), eyeMat); eyeL.position.set(-.12*scale, 2.05*scale, headSize*.8); g.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(.06*scale, 4, 4), eyeMat); eyeR.position.set(.12*scale, 2.05*scale, headSize*.8); g.add(eyeR);
    const armMat = new THREE.MeshLambertMaterial({color: bodyColor});
    const armL = new THREE.Mesh(new THREE.BoxGeometry(.2*scale, .8*scale, .2*scale), armMat); armL.position.set(-.5*scale, 1.2*scale, .2*scale); armL.rotation.x = -.5; g.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(.2*scale, .8*scale, .2*scale), armMat); armR.position.set(.5*scale, 1.2*scale, .2*scale); armR.rotation.x = -.5; g.add(armR);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(.2*scale, .8*scale, .2*scale), armMat); legL.position.set(-.2*scale, .4*scale, 0); g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(.2*scale, .8*scale, .2*scale), armMat); legR.position.set(.2*scale, .4*scale, 0); g.add(legR);
    if(type === 'horror'){ for(let i = 0; i < 5; i++){ const spike = new THREE.Mesh(new THREE.ConeGeometry(.05*scale, .3*scale, 4), new THREE.MeshBasicMaterial({color: 0x880000})); spike.position.set((Math.random() - .5)*.6*scale, 1.2*scale + Math.random()*.8*scale, (Math.random() - .5)*.3*scale); g.add(spike); } }
    g.userData = {isZombie: true, type, hp, maxHp: hp, speed, damage: type === 'normal' ? ZC.DMG_NORMAL : type === 'mutant' ? ZC.DMG_MUTANT : ZC.DMG_HORROR, attackCooldown: 0, walkPhase: Math.random() * Math.PI * 2};
    g.castShadow = true; return g;
}
function createBullet(){
    const bullet = new THREE.Mesh(new THREE.SphereGeometry(.08, 4, 4), new THREE.MeshBasicMaterial({color: 0xffff00}));
    bullet.userData = {isBullet: true, active: false}; bullet.visible = false; return bullet;
}
function spawnZombieWave(){
    S.zombieWave++; S.zombieWaveActive = true; S.zombieBetweenWaves = false;
    const w = S.zombieWave;
    let nC = 3 + w*2, mC = Math.max(0, Math.floor((w-2)*1.5)), hC = Math.max(0, Math.floor((w-4)*0.8));
    const maxT = 20; let total = nC + mC + hC;
    if(total > maxT){ const r = maxT / total; nC = Math.floor(nC*r); mC = Math.floor(mC*r); hC = Math.floor(hC*r); }
    S.zombieSpawnQueue = [];
    for(let i = 0; i < nC; i++) S.zombieSpawnQueue.push('normal');
    for(let i = 0; i < mC; i++) S.zombieSpawnQueue.push('mutant');
    for(let i = 0; i < hC; i++) S.zombieSpawnQueue.push('horror');
    for(let i = S.zombieSpawnQueue.length - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [S.zombieSpawnQueue[i], S.zombieSpawnQueue[j]] = [S.zombieSpawnQueue[j], S.zombieSpawnQueue[i]]; }
    if(waText) waText.textContent = 'WAVE ' + w;
    if(waSub) waSub.textContent = total + ' Zombies';
    if(waveAnnounceEl) waveAnnounceEl.style.display = 'block';
    AudioEngine.waveAlarm();
    if(waveAnnounceTimeout) clearTimeout(waveAnnounceTimeout);
    waveAnnounceTimeout = setTimeout(() => { if(waveAnnounceEl) waveAnnounceEl.style.display = 'none'; waveAnnounceTimeout = null; }, 2500);
    S.zombieSpawnTimer = 0; updateZombieHud();
}
function updateZombieMode(dt){
    if(S.dead || S.paused) return;
    S.timeAlive += dt;
    if(S.zombieReloading){
        S.zombieReloadTimer -= dt;
        if(S.zombieReloadTimer <= 0){
            S.zombieReloading = false;
            const needed = ZC.MAX_AMMO - S.zombieAmmo;
            const avail = Math.min(needed, S.zombieAmmoReserve);
            S.zombieAmmo += avail; S.zombieAmmoReserve -= avail;
            AudioEngine.reloadDone();
        }
    }
    if(S.zombieSpawnQueue.length > 0){
        S.zombieSpawnTimer = (S.zombieSpawnTimer || 0) + dt;
        if(S.zombieSpawnTimer > 0.5){
            S.zombieSpawnTimer = 0;
            const type = S.zombieSpawnQueue.shift();
            const z = createZombie(type);
            z.position.set((Math.random() - .5)*14, 0, -ZC.SPAWN_DIST + Math.random()*10);
            z.userData.walkPhase = Math.random() * Math.PI * 2;
            scene.add(z); zombiePool.push(z); AudioEngine.zombieGroan();
        }
    }
    const ms = 10;
    if(inp.left) S.zombiePlayerX -= ms * dt;
    if(inp.right) S.zombiePlayerX += ms * dt;
    S.zombiePlayerX = Math.max(-8, Math.min(8, S.zombiePlayerX));
    if(inp.shoot && !S.zombieReloading && S.zombieAmmo > 0){
        const now = performance.now();
        if(now - S.zombieLastShot > 150){
            S.zombieLastShot = now; S.zombieAmmo--; shootBullet();
            AudioEngine.gunshot(); vibrate(30);
            S.zombieMuzzleFlash = 0.08;
            if(zombieMuzzleMesh) zombieMuzzleMesh.material.opacity = 1;
        }
    }
    if(S.zombieAmmo <= 0 && !S.zombieReloading && S.zombieAmmoReserve > 0) reloadZombie();
    if(S.zombieMuzzleFlash > 0){ S.zombieMuzzleFlash -= dt; if(S.zombieMuzzleFlash <= 0 && zombieMuzzleMesh) zombieMuzzleMesh.material.opacity = 0; }
    if(S.zombieDamageFlash > 0){
        S.zombieDamageFlash -= dt;
        document.body.style.filter = S.zombieDamageFlash > 0 ? 'brightness(1.5) saturate(0.5)' : '';
    }
    for(let i = zombiePool.length - 1; i >= 0; i--){
        const z = zombiePool[i]; if(!z.userData.isZombie) continue;
        const dx = S.zombiePlayerX - z.position.x, dz = -z.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if(dist > 0.1){ z.position.x += (dx/dist) * z.userData.speed * dt; z.position.z += (dz/dist) * z.userData.speed * dt; }
        z.userData.walkPhase += dt * z.userData.speed * 2;
        z.rotation.z = Math.sin(z.userData.walkPhase) * 0.05;
        z.rotation.y = Math.atan2(dx, dz);
        if(dist < ZC.ATTACK_RANGE){
            z.userData.attackCooldown -= dt;
            if(z.userData.attackCooldown <= 0){
                z.userData.attackCooldown = 1;
                S.zombieHealth -= z.userData.damage;
                AudioEngine.damageThud(); vibrate(100);
                S.zombieDamageFlash = 0.15;
                if(S.zombieHealth <= 0){ S.zombieHealth = 0; triggerZombieDeath(); }
                updateZombieHud();
            }
        }
    }
    for(let i = 0, n = bulletPool.length; i < n; i++){
        const b = bulletPool[i]; if(!b.userData.active) continue;
        b.position.z -= ZC.BULLET_SPEED * dt;
        for(let j = zombiePool.length - 1; j >= 0; j--){
            const z = zombiePool[j]; if(!z.userData.isZombie) continue;
            const dx = b.position.x - z.position.x, dz = b.position.z - z.position.z;
            const hitR = z.userData.type === 'horror' ? 2.5 : z.userData.type === 'mutant' ? 1.8 : 1.2;
            if(dx*dx + dz*dz < hitR*hitR){
                z.userData.hp -= ZC.BULLET_DMG;
                b.userData.active = false; b.visible = false;
                if(z.userData.hp <= 0){
                    AudioEngine.zombieDeath(); S.zombieKills++; S.zombieTotalKills++;
                    scene.remove(z); zombiePool.splice(j, 1); vibrate(50);
                } else { AudioEngine.enemyHit(); }
                break;
            }
        }
        if(b.position.z < -ZC.SPAWN_DIST - 20){ b.userData.active = false; b.visible = false; }
    }
    if(zombiePool.length === 0 && S.zombieSpawnQueue.length === 0 && S.zombieWaveActive && !S.zombieBetweenWaves){
        S.zombieWaveActive = false; S.zombieBetweenWaves = true; S.zombieBetweenTimer = 3;
        S.zombieHealth = Math.min(ZC.MAX_HEALTH, S.zombieHealth + 15);
        showTroll('Wave ' + S.zombieWave + ' hoàn thành! +15 HP', 2500);
        AudioEngine.waveComplete(); AudioEngine.heal();
    }
    if(S.zombieBetweenWaves){ S.zombieBetweenTimer -= dt; if(S.zombieBetweenTimer <= 0){ S.zombieBetweenWaves = false; spawnZombieWave(); } }
    updateZombieHud();
}
function shootBullet(){
    let bullet = null;
    for(let i = 0, n = bulletPool.length; i < n; i++){ if(!bulletPool[i].userData.active){ bullet = bulletPool[i]; break; } }
    if(!bullet){ bullet = createBullet(); scene.add(bullet); bulletPool.push(bullet); }
    bullet.userData.active = true; bullet.visible = true; bullet.position.set(S.zombiePlayerX, 1.2, -2);
}
function reloadZombie(){
    if(S.zombieReloading || S.zombieAmmoReserve <= 0 || S.zombieAmmo >= ZC.MAX_AMMO) return;
    S.zombieReloading = true; S.zombieReloadTimer = ZC.RELOAD_TIME;
    AudioEngine.reloadClick();
}
function updateZombieHud(){
    if(healthFillEl) healthFillEl.style.width = (S.zombieHealth / ZC.MAX_HEALTH * 100) + '%';
    if(ammoHudEl) ammoHudEl.textContent = S.zombieAmmo + ' / ' + S.zombieAmmoReserve;
    if(waveHudEl) waveHudEl.textContent = 'WAVE ' + S.zombieWave;
    if(killHudEl) killHudEl.textContent = 'Kills: ' + S.zombieTotalKills;
}
function triggerZombieDeath(){
    if(S.dead) return;
    S.dead = true; S.phase = 'dead'; vibrate(300); AudioEngine.damageThud();
    try { if(typeof AndroidBridge !== 'undefined' && AndroidBridge.onGameDeath) AndroidBridge.onGameDeath(S.zombieWave, 0, S.zombieTotalKills, 0, S.timeAlive); } catch(e){}
    if(S.zombieWave > S.zombieBestWave) S.zombieBestWave = S.zombieWave;
    if(zombieDeathInfo) zombieDeathInfo.textContent = 'Wave: ' + S.zombieWave + ' | Kills: ' + S.zombieTotalKills;
    if(zombieDeathBest) zombieDeathBest.textContent = 'Kỷ lục: Wave ' + S.zombieBestWave;
    if(zombieDeathScr) zombieDeathScr.style.display = 'flex';
    hudEl.style.display = 'none'; zombieCtrlEl.style.display = 'none'; hideZombieUI(); showGameUI(false);
    AudioEngine.suspend();
}
function showZombieUI(){
    if(zombieCtrlEl) zombieCtrlEl.style.display = 'flex';
    if(zombieHudEl) zombieHudEl.style.display = 'block';
    if(healthBarEl) healthBarEl.style.display = 'block';
    if(crosshairEl) crosshairEl.style.display = 'block';
    if(crosshairDotEl) crosshairDotEl.style.display = 'block';
    if(ammoHudEl) ammoHudEl.style.display = 'block';
    if(waveHudEl) waveHudEl.style.display = 'block';
    if(killHudEl) killHudEl.style.display = 'block';
    if(zombiePlayerMesh) zombiePlayerMesh.visible = true;
    if(modeHudEl) modeHudEl.style.display = 'none';
    if(coinCounter) coinCounter.style.display = 'none';
    if(boostBar) boostBar.style.display = 'none';
    if(speedoWrap) speedoWrap.style.display = 'none';
    if(boostLabel) boostLabel.style.display = 'none';
}
function hideZombieUI(){
    if(zombieCtrlEl) zombieCtrlEl.style.display = 'none';
    if(zombieHudEl) zombieHudEl.style.display = 'none';
    if(healthBarEl) healthBarEl.style.display = 'none';
    if(crosshairEl) crosshairEl.style.display = 'none';
    if(crosshairDotEl) crosshairDotEl.style.display = 'none';
    if(ammoHudEl) ammoHudEl.style.display = 'none';
    if(waveHudEl) waveHudEl.style.display = 'none';
    if(killHudEl) killHudEl.style.display = 'none';
    if(zombiePlayerMesh) zombiePlayerMesh.visible = false;
}

// ============================================================
// FPS MODE (v1.0 NEW) — first-person shooter
// ============================================================
const FPS = {
    PLAYER_SPEED: 5, JUMP_VEL: 6, GRAVITY: 18, MAX_HEALTH: 100,
    MAX_AMMO: 30, RELOAD_TIME: 2, SHOOT_COOLDOWN: 0.12, BULLET_SPEED: 80,
    BULLET_DMG: 2, ENEMY_SPEED: 3, ENEMY_DMG: 15, ENEMY_HP: 4,
    SPAWN_DIST: 30, ATTACK_RANGE: 2.5,
};

function createFpsEnemy(){
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({color: 0x8b0000, flatShading: true});
    const headMat = new THREE.MeshLambertMaterial({color: 0x4a0000});
    const body = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.4, .4), bodyMat); body.position.y = .9; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, .4), headMat); head.position.y = 1.8; g.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({color: 0xff0000});
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .04), eyeMat); eyeL.position.set(-.1, 1.85, .21); g.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .04), eyeMat); eyeR.position.set(.1, 1.85, .21); g.add(eyeR);
    const armMat = new THREE.MeshLambertMaterial({color: 0x6a0000});
    const armL = new THREE.Mesh(new THREE.BoxGeometry(.18, .9, .18), armMat); armL.position.set(-.48, 1, 0); g.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(.18, .9, .18), armMat); armR.position.set(.48, 1, 0); g.add(armR);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(.22, .8, .22), armMat); legL.position.set(-.18, .1, 0); g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(.22, .8, .22), armMat); legR.position.set(.18, .1, 0); g.add(legR);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .4), new THREE.MeshLambertMaterial({color: 0x222222}));
    gun.position.set(.48, 1.1, .25); g.add(gun);
    g.userData = {isFpsEnemy: true, hp: FPS.ENEMY_HP, attackCooldown: 0, walkPhase: Math.random() * Math.PI * 2};
    g.castShadow = true; return g;
}
function createFpsBullet(){
    const b = new THREE.Mesh(new THREE.SphereGeometry(.06, 4, 4), new THREE.MeshBasicMaterial({color: 0xffff00}));
    b.userData = {isFpsBullet: true, active: false}; b.visible = false; return b;
}

function buildFpsLevel(){
    // Build a simple enclosed arena with walls, crates, and cover
    fpsLevelGroup = new THREE.Group();
    // Floor
    const floorMat = new THREE.MeshLambertMaterial({color: 0x4a3a2a});
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    fpsLevelGroup.add(floor);
    // Walls (perimeter)
    const wallMat = new THREE.MeshLambertMaterial({color: 0x6a5a4a});
    const wallH = 6;
    const walls = [
        {x: 0, z: 40, w: 80, d: 1},
        {x: 0, z: -40, w: 80, d: 1},
        {x: 40, z: 0, w: 1, d: 80},
        {x: -40, z: 0, w: 1, d: 80},
    ];
    walls.forEach(w => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, wallH, w.d), wallMat);
        m.position.set(w.x, wallH/2, w.z); m.castShadow = true; m.receiveShadow = true;
        fpsLevelGroup.add(m);
    });
    // Crates (cover)
    const crateMat = new THREE.MeshLambertMaterial({color: 0x8b6a3a});
    const cratePositions = [
        [10, 10], [-10, 10], [10, -10], [-10, -10],
        [20, 5], [-20, 5], [20, -5], [-20, -5],
        [5, 20], [-5, 20], [5, -20], [-5, -20],
        [15, 15], [-15, -15], [15, -15], [-15, 15],
        [0, 25], [0, -25], [25, 0], [-25, 0],
    ];
    cratePositions.forEach(p => {
        const size = 1.5 + Math.random() * 1;
        const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateMat);
        crate.position.set(p[0], size/2, p[1]); crate.castShadow = true; crate.receiveShadow = true;
        fpsLevelGroup.add(crate);
    });
    // Ceiling lights (visual only)
    const lightMat = new THREE.MeshBasicMaterial({color: 0xffffaa});
    for(let x = -25; x <= 25; x += 25){
        for(let z = -25; z <= 25; z += 25){
            const lamp = new THREE.Mesh(new THREE.BoxGeometry(2, .2, 2), lightMat);
            lamp.position.set(x, 5.5, z); fpsLevelGroup.add(lamp);
        }
    }
    fpsLevelGroup.visible = false;
    scene.add(fpsLevelGroup);
}

function spawnFpsWave(){
    S.fpsWave++;
    const count = 3 + S.fpsWave * 2;
    S.fpsEnemySpawnQueue = [];
    for(let i = 0; i < count; i++) S.fpsEnemySpawnQueue.push(true);
    S.fpsWaveActive = true;
    if(waText) waText.textContent = 'WAVE ' + S.fpsWave;
    if(waSub) waSub.textContent = count + ' Enemies';
    if(waveAnnounceEl) waveAnnounceEl.style.display = 'block';
    AudioEngine.waveAlarm();
    if(waveAnnounceTimeout) clearTimeout(waveAnnounceTimeout);
    waveAnnounceTimeout = setTimeout(() => { if(waveAnnounceEl) waveAnnounceEl.style.display = 'none'; waveAnnounceTimeout = null; }, 2500);
    if(modeInfoHudEl) modeInfoHudEl.textContent = 'Wave ' + S.fpsWave;
    if(modeScoreHudEl) modeScoreHudEl.textContent = 'Kills: ' + S.fpsKills;
}

let _fpsSpawnTimer = 0;
function updateFpsMode(dt){
    if(S.dead || S.paused) return;
    S.timeAlive += dt;
    // Reload
    if(S.fpsReloading){
        S.fpsReloadTimer -= dt;
        if(S.fpsReloadTimer <= 0){
            S.fpsReloading = false;
            const needed = FPS.MAX_AMMO - S.fpsAmmo;
            const avail = Math.min(needed, S.fpsAmmoReserve);
            S.fpsAmmo += avail; S.fpsAmmoReserve -= avail;
            AudioEngine.reloadDone();
        }
    }
    // Spawn enemies from queue
    if(S.fpsEnemySpawnQueue.length > 0){
        _fpsSpawnTimer += dt;
        if(_fpsSpawnTimer > 0.7){
            _fpsSpawnTimer = 0;
            S.fpsEnemySpawnQueue.pop();
            const e = createFpsEnemy();
            // Spawn at random perimeter position
            const angle = Math.random() * Math.PI * 2;
            const r = 30;
            e.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
            scene.add(e); fpsEnemyPool.push(e);
        }
    }
    // Player movement (WASD relative to yaw)
    const moveSpeed = FPS.PLAYER_SPEED * dt;
    const fwd = (inp.forward ? 1 : 0) - (inp.back ? 1 : 0);
    const strafe = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const cosY = Math.cos(S.fpsYaw), sinY = Math.sin(S.fpsYaw);
    S.fpsPlayerPos.x += (sinY * fwd + cosY * strafe) * moveSpeed;
    S.fpsPlayerPos.z += (cosY * fwd - sinY * strafe) * moveSpeed;
    // Clamp to arena
    S.fpsPlayerPos.x = Math.max(-38, Math.min(38, S.fpsPlayerPos.x));
    S.fpsPlayerPos.z = Math.max(-38, Math.min(38, S.fpsPlayerPos.z));
    // Gravity + jump
    S.fpsPlayerVel.y -= FPS.GRAVITY * dt;
    S.fpsPlayerPos.y += S.fpsPlayerVel.y * dt;
    if(S.fpsPlayerPos.y <= 1.7){
        if(!S.fpsOnGround && S.fpsPlayerVel.y < -3) AudioEngine.land();
        S.fpsPlayerPos.y = 1.7; S.fpsPlayerVel.y = 0; S.fpsOnGround = true;
    } else { S.fpsOnGround = false; }
    // Shoot
    S.fpsShootCooldown -= dt;
    if(inp.shoot && !S.fpsReloading && S.fpsAmmo > 0 && S.fpsShootCooldown <= 0){
        S.fpsShootCooldown = FPS.SHOOT_COOLDOWN;
        S.fpsAmmo--;
        shootFpsBullet();
        AudioEngine.rifleShot(); vibrate(25);
        S.fpsMuzzleFlash = 0.06;
        if(fpsMuzzleMesh) fpsMuzzleMesh.material.opacity = 1;
    } else if(inp.shoot && S.fpsAmmo <= 0 && !S.fpsReloading){
        // Empty click
        if(S.fpsShootCooldown <= 0){ S.fpsShootCooldown = 0.3; AudioEngine.emptyClick(); }
    }
    if(S.fpsAmmo <= 0 && !S.fpsReloading && S.fpsAmmoReserve > 0) fpsReload();
    if(S.fpsMuzzleFlash > 0){ S.fpsMuzzleFlash -= dt; if(S.fpsMuzzleFlash <= 0 && fpsMuzzleMesh) fpsMuzzleMesh.material.opacity = 0; }
    if(S.fpsDamageFlash > 0){
        S.fpsDamageFlash -= dt;
        document.body.style.filter = S.fpsDamageFlash > 0 ? 'brightness(1.4) saturate(0.6)' : '';
    }
    if(S.fpsInvincible > 0) S.fpsInvincible -= dt;
    // Update enemies
    for(let i = fpsEnemyPool.length - 1; i >= 0; i--){
        const e = fpsEnemyPool[i];
        const dx = S.fpsPlayerPos.x - e.position.x, dz = S.fpsPlayerPos.z - e.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if(dist > FPS.ATTACK_RANGE){
            e.position.x += (dx/dist) * FPS.ENEMY_SPEED * dt;
            e.position.z += (dz/dist) * FPS.ENEMY_SPEED * dt;
        } else {
            e.userData.attackCooldown -= dt;
            if(e.userData.attackCooldown <= 0 && S.fpsInvincible <= 0){
                e.userData.attackCooldown = 1.2;
                S.fpsHealth -= FPS.ENEMY_DMG;
                AudioEngine.playerHurt(); vibrate(80);
                S.fpsDamageFlash = 0.2;
                if(S.fpsHealth <= 0){ S.fpsHealth = 0; triggerFpsDeath(); }
            }
        }
        e.userData.walkPhase += dt * 4;
        e.rotation.y = Math.atan2(dx, dz);
        e.rotation.z = Math.sin(e.userData.walkPhase) * 0.04;
    }
    // Update bullets
    for(let i = 0, n = fpsBulletPool.length; i < n; i++){
        const b = fpsBulletPool[i]; if(!b.userData.active) continue;
        b.position.add(b.userData.vel.clone().multiplyScalar(dt));
        for(let j = fpsEnemyPool.length - 1; j >= 0; j--){
            const e = fpsEnemyPool[j];
            const dx = b.position.x - e.position.x, dy = b.position.y - 1.2, dz = b.position.z - e.position.z;
            if(dx*dx + dy*dy + dz*dz < 1.2){
                e.userData.hp -= FPS.BULLET_DMG;
                b.userData.active = false; b.visible = false;
                if(e.userData.hp <= 0){
                    AudioEngine.enemyDeath(); S.fpsKills++;
                    scene.remove(e); fpsEnemyPool.splice(j, 1); vibrate(40);
                } else { AudioEngine.enemyHit(); }
                if(modeScoreHudEl) modeScoreHudEl.textContent = 'Kills: ' + S.fpsKills;
                break;
            }
        }
        // Despawn if too far
        const dxp = b.position.x - S.fpsPlayerPos.x, dzp = b.position.z - S.fpsPlayerPos.z;
        if(dxp*dxp + dzp*dzp > 2500 || b.position.y < 0 || b.position.y > 10){
            b.userData.active = false; b.visible = false;
        }
    }
    // Wave complete
    if(fpsEnemyPool.length === 0 && S.fpsEnemySpawnQueue.length === 0 && S.fpsWaveActive){
        S.fpsWaveActive = false;
        S.fpsWaveBetweenTimer = 4;
        S.fpsHealth = Math.min(FPS.MAX_HEALTH, S.fpsHealth + 25);
        showTroll('Wave ' + S.fpsWave + ' hoàn thành! +25 HP', 2500);
        AudioEngine.waveComplete(); AudioEngine.heal();
    }
    if(S.fpsWaveBetweenTimer > 0){
        S.fpsWaveBetweenTimer -= dt;
        if(S.fpsWaveBetweenTimer <= 0){ spawnFpsWave(); }
    }
    // Update camera (FPS view)
    cam.position.set(S.fpsPlayerPos.x, S.fpsPlayerPos.y, S.fpsPlayerPos.z);
    const lookX = S.fpsPlayerPos.x + Math.sin(S.fpsYaw) * Math.cos(S.fpsPitch);
    const lookY = S.fpsPlayerPos.y + Math.sin(S.fpsPitch);
    const lookZ = S.fpsPlayerPos.z + Math.cos(S.fpsYaw) * Math.cos(S.fpsPitch);
    cam.lookAt(lookX, lookY, lookZ);
    // Attach weapon to camera
    if(fpsPlayerWeapon){
        const fwd = new THREE.Vector3(Math.sin(S.fpsYaw) * Math.cos(S.fpsPitch), Math.sin(S.fpsPitch), Math.cos(S.fpsYaw) * Math.cos(S.fpsPitch));
        const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
        fpsPlayerWeapon.position.set(
            S.fpsPlayerPos.x + right.x * 0.3 - fwd.x * 0.5,
            S.fpsPlayerPos.y - 0.18,
            S.fpsPlayerPos.z + right.z * 0.3 - fwd.z * 0.5
        );
        fpsPlayerWeapon.lookAt(
            S.fpsPlayerPos.x + fwd.x,
            S.fpsPlayerPos.y + fwd.y,
            S.fpsPlayerPos.z + fwd.z
        );
    }
    // Update HUD
    if(modeScoreHudEl) modeScoreHudEl.textContent = 'Kills: ' + S.fpsKills;
    if(modeInfoHudEl) modeInfoHudEl.textContent = 'HP ' + S.fpsHealth + ' | Ammo ' + S.fpsAmmo + '/' + S.fpsAmmoReserve + ' | Wave ' + S.fpsWave;
    if(modeStatusHudEl) modeStatusHudEl.textContent = S.fpsReloading ? 'Đang nạp đạn...' : (S.fpsWaveBetweenTimer > 0 ? 'Nghỉ ' + Math.ceil(S.fpsWaveBetweenTimer) + 's' : '');
}

function shootFpsBullet(){
    let b = null;
    for(let i = 0, n = fpsBulletPool.length; i < n; i++){ if(!fpsBulletPool[i].userData.active){ b = fpsBulletPool[i]; break; } }
    if(!b){ b = createFpsBullet(); scene.add(b); fpsBulletPool.push(b); }
    b.userData.active = true; b.visible = true;
    b.position.set(S.fpsPlayerPos.x, S.fpsPlayerPos.y - 0.1, S.fpsPlayerPos.z);
    const fwd = new THREE.Vector3(
        Math.sin(S.fpsYaw) * Math.cos(S.fpsPitch),
        Math.sin(S.fpsPitch),
        Math.cos(S.fpsYaw) * Math.cos(S.fpsPitch)
    );
    b.userData.vel = fwd.multiplyScalar(FPS.BULLET_SPEED);
}

function fpsReload(){
    if(S.fpsReloading || S.fpsAmmoReserve <= 0 || S.fpsAmmo >= FPS.MAX_AMMO) return;
    S.fpsReloading = true; S.fpsReloadTimer = FPS.RELOAD_TIME;
    AudioEngine.reloadClick();
}
function fpsJump(){
    if(S.fpsOnGround){
        S.fpsPlayerVel.y = FPS.JUMP_VEL;
        S.fpsOnGround = false;
        AudioEngine.jump();
    }
}
function triggerFpsDeath(){
    if(S.dead) return;
    S.dead = true; S.phase = 'dead'; vibrate(300);
    try { if(typeof AndroidBridge !== 'undefined' && AndroidBridge.onGameDeath) AndroidBridge.onGameDeath(S.fpsWave, 0, S.fpsKills, 0, S.timeAlive); } catch(e){}
    if(S.fpsKills > S.fpsBestKills) S.fpsBestKills = S.fpsKills;
    if(fpsDeathInfo) fpsDeathInfo.textContent = 'Kills: ' + S.fpsKills + ' | Wave: ' + S.fpsWave;
    if(fpsDeathBest) fpsDeathBest.textContent = 'Kỷ lục: ' + S.fpsBestKills + ' kills';
    if(fpsDeathScr) fpsDeathScr.style.display = 'flex';
    hudEl.style.display = 'none'; fpsCtrlEl.style.display = 'none'; showGameUI(false); hideFpsUI();
    AudioEngine.suspend();
}
function showFpsUI(){
    if(fpsCtrlEl) fpsCtrlEl.style.display = 'block';
    if(modeHudEl) modeHudEl.style.display = 'block';
    if(fpsPlayerWeapon) fpsPlayerWeapon.visible = true;
    if(crosshairEl) crosshairEl.style.display = 'block';
    if(crosshairDotEl) crosshairDotEl.style.display = 'block';
    if(coinCounter) coinCounter.style.display = 'none';
    if(boostBar) boostBar.style.display = 'none';
    if(speedoWrap) speedoWrap.style.display = 'none';
    if(boostLabel) boostLabel.style.display = 'none';
}
function hideFpsUI(){
    if(fpsCtrlEl) fpsCtrlEl.style.display = 'none';
    if(modeHudEl) modeHudEl.style.display = 'none';
    if(fpsPlayerWeapon) fpsPlayerWeapon.visible = false;
    if(crosshairEl) crosshairEl.style.display = 'none';
    if(crosshairDotEl) crosshairDotEl.style.display = 'none';
}

// ============================================================
// SIMULATOR MODE (v1.0 NEW) — open world driving
// ============================================================
const SIM = {
    MAP_SIZE: 200, NPC_COUNT: 8, MISSION_TARGETS: 12,
    NPC_SPEED_MIN: 8, NPC_SPEED_MAX: 18,
};

function buildSimWorld(){
    // Buildings + roads are part of the existing scene; we add unique sim elements here
    // (we'll keep the desert ground but add a few landmarks)
    simBuildingPool = [];
    const bldMat1 = new THREE.MeshLambertMaterial({color: 0xb89968, flatShading: true});
    const bldMat2 = new THREE.MeshLambertMaterial({color: 0x9e8c6c, flatShading: true});
    const bldMat3 = new THREE.MeshLambertMaterial({color: 0xc4a66a, flatShading: true});
    const bldMats = [bldMat1, bldMat2, bldMat3];
    // Place buildings at grid positions (avoid origin)
    for(let i = 0; i < 24; i++){
        const x = (Math.random() - .5) * 2 * (SIM.MAP_SIZE - 20);
        const z = (Math.random() - .5) * 2 * (SIM.MAP_SIZE - 20);
        if(Math.abs(x) < 15 && Math.abs(z) < 15) continue; // keep spawn clear
        const h = 4 + Math.random() * 12;
        const w = 4 + Math.random() * 6;
        const d = 4 + Math.random() * 6;
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldMats[Math.floor(Math.random() * 3)]);
        b.position.set(x, h/2, z);
        b.castShadow = true; b.receiveShadow = true;
        b.userData.isSimBuilding = true;
        simBuildingPool.push(b);
    }
    // Mission targets (glowing pillars)
    simTargetPool = [];
    const targetMat = new THREE.MeshBasicMaterial({color: 0x22c55e, transparent: true, opacity: 0.7});
    for(let i = 0; i < SIM.MISSION_TARGETS; i++){
        const t = new THREE.Mesh(new THREE.CylinderGeometry(.6, .8, 4, 8), targetMat);
        const angle = (i / SIM.MISSION_TARGETS) * Math.PI * 2;
        const r = 30 + (i % 3) * 20;
        t.position.set(Math.cos(angle) * r, 2, Math.sin(angle) * r);
        t.userData.isSimTarget = true;
        t.userData.collected = false;
        simTargetPool.push(t);
    }
    // NPC cars (reuse car shape but smaller / different colors)
    simNpcPool = [];
    const npcColors = [0x3366cc, 0xcc3399, 0x33cc99, 0xcc9933, 0x9933cc, 0xcc3333, 0x33cccc, 0x999999];
    for(let i = 0; i < SIM.NPC_COUNT; i++){
        const npc = new THREE.Group();
        const bodyColor = npcColors[i % npcColors.length];
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, .8, 3), new THREE.MeshLambertMaterial({color: bodyColor}));
        body.position.y = .8; body.castShadow = true; npc.add(body);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, .5, 1.5), new THREE.MeshLambertMaterial({color: bodyColor}));
        roof.position.set(0, 1.4, -.2); npc.add(roof);
        // 4 wheels
        const wMat = new THREE.MeshLambertMaterial({color: 0x1a1a1a});
        [[-.9, 1], [.9, 1], [-.9, -1], [.9, -1]].forEach(p => {
            const w = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .2, 8), wMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(p[0], .3, p[1]);
            npc.add(w);
        });
        const angle = Math.random() * Math.PI * 2;
        const r = 20 + Math.random() * 60;
        npc.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        npc.userData = {
            isSimNpc: true,
            speed: SIM.NPC_SPEED_MIN + Math.random() * (SIM.NPC_SPEED_MAX - SIM.NPC_SPEED_MIN),
            rotY: Math.random() * Math.PI * 2,
            changeDirIn: 2 + Math.random() * 4,
        };
        npc.rotation.y = npc.userData.rotY;
        simNpcPool.push(npc);
    }
}
function showSimWorld(show){
    simBuildingPool.forEach(b => { if(show) scene.add(b); else scene.remove(b); });
    simTargetPool.forEach(t => { if(show && !t.userData.collected) scene.add(t); else scene.remove(t); });
    simNpcPool.forEach(n => { if(show) scene.add(n); else scene.remove(n); });
}
function updateSimMode(dt){
    if(S.dead || S.paused) return;
    S.timeAlive += dt;
    // Driving physics (similar to desert but with free roaming)
    let target = 0;
    if(inp.gas) target = 30;
    if(inp.brake) target = -8;
    S.simSpeed += (target - S.simSpeed) * dt * 3;
    S.simSpeed = Math.max(-8, Math.min(45, S.simSpeed));
    if(Math.abs(S.simSpeed) > 0.1){
        let steer = 0;
        if(inp.left) steer = 1;
        if(inp.right) steer = -1;
        S.simRotY += steer * 1.5 * dt * (S.simSpeed / 30);
    }
    if(carGroup){
        carGroup.rotation.y = S.simRotY;
        const fwd = S.simSpeed * dt;
        carGroup.position.x += Math.sin(S.simRotY) * fwd;
        carGroup.position.z -= Math.cos(S.simRotY) * fwd;
        // Clamp to map
        const limit = SIM.MAP_SIZE - 5;
        carGroup.position.x = Math.max(-limit, Math.min(limit, carGroup.position.x));
        carGroup.position.z = Math.max(-limit, Math.min(limit, carGroup.position.z));
        // Wheel rotation
        for(let i = 0, n = wheels.length; i < n; i++){
            const w = wheels[i];
            if(w && w.children && w.children.length > 1){
                if(w.children[0]) w.children[0].rotation.x += fwd * 2;
                if(w.children[1]) w.children[1].rotation.x += fwd * 2;
            }
        }
        // Track total km
        S.simTotalKm += Math.abs(S.simSpeed * dt) / C.KM;
        S.totalKm += Math.abs(S.simSpeed * dt) / C.KM;
        if(Math.abs(S.simSpeed) > S.topSpeed) S.topSpeed = Math.abs(S.simSpeed);
    }
    // NPC cars movement
    for(let i = 0, n = simNpcPool.length; i < n; i++){
        const npc = simNpcPool[i];
        npc.userData.changeDirIn -= dt;
        if(npc.userData.changeDirIn <= 0){
            npc.userData.rotY += (Math.random() - .5) * Math.PI;
            npc.userData.changeDirIn = 2 + Math.random() * 4;
        }
        npc.rotation.y = npc.userData.rotY;
        const fwd = npc.userData.speed * dt;
        const nx = npc.position.x + Math.sin(npc.userData.rotY) * fwd;
        const nz = npc.position.z - Math.cos(npc.userData.rotY) * fwd;
        // Bounce off map edge
        const limit = SIM.MAP_SIZE - 5;
        if(Math.abs(nx) > limit || Math.abs(nz) > limit){
            npc.userData.rotY += Math.PI;
        } else {
            npc.position.x = nx; npc.position.z = nz;
        }
    }
    // Check mission target collection
    if(carGroup){
        const cx = carGroup.position.x, cz = carGroup.position.z;
        for(let i = 0, n = simTargetPool.length; i < n; i++){
            const t = simTargetPool[i];
            if(t.userData.collected) continue;
            const dx = t.position.x - cx, dz = t.position.z - cz;
            if(dx*dx + dz*dz < 9){
                t.userData.collected = true;
                scene.remove(t);
                S.simMissions++;
                AudioEngine.missionDone();
                showTroll('Nhiệm vụ ' + S.simMissions + '/' + SIM.MISSION_TARGETS + ' hoàn thành!', 2500);
                if(missionTextEl) missionTextEl.textContent = 'Đã hoàn thành ' + S.simMissions + '/' + SIM.MISSION_TARGETS + ' nhiệm vụ';
                if(missionBannerEl){
                    missionBannerEl.style.display = 'block';
                    if(missionTimeout) clearTimeout(missionTimeout);
                    missionTimeout = setTimeout(() => { missionBannerEl.style.display = 'none'; missionTimeout = null; }, 3000);
                }
                if(S.simMissions >= SIM.MISSION_TARGETS){
                    triggerSimEnd();
                }
            }
        }
    }
    // Camera follows car (3rd person)
    if(carGroup){
        const r = S.simRotY;
        const camDist = 14, camH = 7;
        cam.position.x += ((carGroup.position.x - Math.sin(r) * camDist) - cam.position.x) * 0.1;
        cam.position.y += (camH - cam.position.y) * 0.12;
        cam.position.z += ((carGroup.position.z + Math.cos(r) * camDist) - cam.position.z) * 0.1;
        cam.lookAt(carGroup.position.x, 1.5, carGroup.position.z);
    }
    // Update HUD
    if(modeScoreHudEl) modeScoreHudEl.textContent = Math.round(Math.abs(S.simSpeed) * 3.6) + ' km/h';
    if(modeInfoHudEl) modeInfoHudEl.textContent = 'Nhiệm vụ ' + S.simMissions + '/' + SIM.MISSION_TARGETS + ' | ' + S.simTotalKm.toFixed(2) + ' km';
    if(modeStatusHudEl) modeStatusHudEl.textContent = 'Map: ' + SIM.MAP_SIZE + 'x' + SIM.MAP_SIZE + 'm';
    // Recycle desert decorations to follow car position so the world feels endless
    recycleDeco();
    // Update ground positions to follow car (so ground doesn't run out)
    if(carGroup){
        const cZ = carGroup.position.z, cX = carGroup.position.x;
        for(let i = 0, n = groundMeshes.length; i < n; i++){
            const m = groundMeshes[i];
            m.position.z = cZ - i * 200;
            m.position.x = cX * 0.3;
        }
        sunMesh.position.set(cX + 60, 90, cZ - 40);
        sunLight.position.set(cX + 60, 90, cZ - 40);
        sunLight.target.position.copy(carGroup.position);
        sunLight.target.updateMatrixWorld();
    }
}
function triggerSimEnd(){
    if(S.dead) return;
    S.dead = true; S.phase = 'dead';
    try { if(typeof AndroidBridge !== 'undefined' && AndroidBridge.onGameDeath) AndroidBridge.onGameDeath(S.simTotalKm, S.topSpeed * 3.6, S.simMissions, 0, S.timeAlive); } catch(e){}
    if(simEndInfo) simEndInfo.textContent = 'Nhiệm vụ: ' + S.simMissions + '/' + SIM.MISSION_TARGETS + ' | ' + S.simTotalKm.toFixed(2) + ' km';
    if(simEndBest) simEndBest.textContent = 'Top speed: ' + Math.round(S.topSpeed * 3.6) + ' km/h';
    if(simEndScr) simEndScr.style.display = 'flex';
    hudEl.style.display = 'none'; simCtrlEl.style.display = 'none'; showGameUI(false); hideSimUI();
    AudioEngine.suspend();
}
function showSimUI(){
    if(simCtrlEl) simCtrlEl.style.display = 'block';
    if(modeHudEl) modeHudEl.style.display = 'block';
    if(missionBannerEl){
        missionBannerEl.style.display = 'block';
        if(missionTextEl) missionTextEl.textContent = 'Đã hoàn thành ' + S.simMissions + '/' + SIM.MISSION_TARGETS + ' nhiệm vụ';
    }
    if(coinCounter) coinCounter.style.display = 'none';
    if(boostBar) boostBar.style.display = 'none';
    if(speedoWrap) speedoWrap.style.display = 'none';
    if(boostLabel) boostLabel.style.display = 'none';
}
function hideSimUI(){
    if(simCtrlEl) simCtrlEl.style.display = 'none';
    if(modeHudEl) modeHudEl.style.display = 'none';
    if(missionBannerEl) missionBannerEl.style.display = 'none';
}

// ============================================================
// TIME ATTACK MODE (v1.0 NEW) — endless driving against clock
// ============================================================
const TIME = {
    COIN_BONUS: 2, // seconds per coin
};

function updateTimeMode(dt){
    if(S.dead || S.paused) return;
    S.timeAlive += dt;
    S.timeRemaining -= dt;
    // Reuse desert physics
    updateCar(dt); checkRoad(dt); checkObstacles(); checkCoins(); checkForkBarrier();
    S.dist += S.speed * dt / C.KM;
    S.totalKm += S.speed * dt / C.KM;
    S.timeDistance = S.dist;
    if(S.speed > S.topSpeed) S.topSpeed = S.speed;
    S.speedSamples++; S.avgSpeed = (S.avgSpeed * (S.speedSamples - 1) + S.speed) / S.speedSamples;
    if(S.dist > S.bestDist) S.bestDist = S.dist;
    checkForkWarning(); updateCamera();
    recycleSegs(); recycleDeco(); recycleObs(); recycleCoins();
    if(dustPts) updateDust(dt);
    updateTrolls(dt); updateShake(dt); updateBoost(dt); updateHUD(dt);
    // Coin bonus: each coin adds TIME.COIN_BONUS seconds
    // (handled in checkCoins override — see below)
    // Tick sound on each second
    const prevSec = Math.floor(S.timeRemaining + dt);
    const curSec = Math.floor(S.timeRemaining);
    if(prevSec !== curSec && curSec >= 0 && curSec <= 10){
        AudioEngine.tick();
    }
    if(S.timeRemaining <= 0){
        S.timeRemaining = 0;
        triggerTimeEnd();
    }
    // Override death (Time Attack = no death from obstacles, just bounce)
    if(S.dead){
        // Restore: time attack doesn't kill you on collision
        S.dead = false;
        S.phase = 'playing';
        // Bounce back
        if(carGroup){
            carGroup.position.x *= -0.3;
            S.speed *= 0.5;
        }
        AudioEngine.crash();
    }
    // Off-road in Time Attack doesn't kill either — it slows you
    // (already handled in checkRoad, but cap offRoadT)
    if(S.offRoadT > 3) S.offRoadT = 3;
    // Update mode HUD
    if(modeScoreHudEl) modeScoreHudEl.textContent = Math.round(S.speed * 3.6) + ' km/h';
    const m = Math.floor(S.timeRemaining / 60);
    const s = Math.floor(S.timeRemaining % 60);
    if(modeInfoHudEl) modeInfoHudEl.textContent = '⏱ ' + m + ':' + (s < 10 ? '0' : '') + s + ' | ' + S.dist.toFixed(2) + ' km';
    if(modeStatusHudEl) modeStatusHudEl.textContent = 'Coin +' + TIME.COIN_BONUS + 's | đã ăn ' + S.coinsCollected;
}
function triggerTimeEnd(){
    if(S.dead) return;
    S.dead = true; S.phase = 'dead';
    AudioEngine.timeUp();
    try { if(typeof AndroidBridge !== 'undefined' && AndroidBridge.onGameDeath) AndroidBridge.onGameDeath(S.dist, S.topSpeed * 3.6, S.coinsCollected, 0, S.timeAlive); } catch(e){}
    if(S.dist > S.timeBestDist) S.timeBestDist = S.dist;
    if(timeEndInfo) timeEndInfo.textContent = 'Quãng đường: ' + S.dist.toFixed(2) + ' km | Coin: ' + S.coinsCollected;
    if(timeEndBest) timeEndBest.textContent = 'Kỷ lục: ' + S.timeBestDist.toFixed(2) + ' km';
    if(timeEndScr) timeEndScr.style.display = 'flex';
    hudEl.style.display = 'none'; ctrlEl.style.display = 'none'; showGameUI(false); hideTimeUI();
    AudioEngine.suspend();
}
function showTimeUI(){
    if(modeHudEl) modeHudEl.style.display = 'block';
    if(coinCounter) coinCounter.style.display = 'block';
    if(boostBar) boostBar.style.display = 'block';
    if(boostLabel) boostLabel.style.display = 'block';
    if(speedoWrap) speedoWrap.style.display = 'block';
    // Override checkCoins for time attack (add bonus time per coin)
    // We do this via a wrapper - see updateTimeMode
}
function hideTimeUI(){
    if(modeHudEl) modeHudEl.style.display = 'none';
    if(coinCounter) coinCounter.style.display = 'none';
}

// Wrap coin collection for Time Attack to add time bonus
const _originalCheckCoins = checkCoins;
checkCoins = function(){
    const prevCoins = S.coinsCollected;
    _originalCheckCoins();
    if(GameMode === 'time' && S.coinsCollected > prevCoins){
        S.timeRemaining += TIME.COIN_BONUS;
        showTroll('+' + TIME.COIN_BONUS + 's bonus!', 1000);
    }
};

// ============================================================
// MODE REGISTRY — single dispatch table for all modes
// ============================================================
const Modes = {
    desert: {
        name: 'desert',
        engineEnabled: true,
        ambient: 'desert',
        enter(){
            if(carGroup) carGroup.visible = true;
            if(zombiePlayerMesh) zombiePlayerMesh.visible = false;
            if(fpsPlayerWeapon) fpsPlayerWeapon.visible = false;
            if(fpsLevelGroup) fpsLevelGroup.visible = false;
            showSimWorld(false);
            ctrlEl.style.display = 'block';
            hudEl.style.display = 'block';
            modeHudEl.style.display = 'none';
            coinCounter.style.display = 'block';
            boostBar.style.display = 'block';
            boostLabel.style.display = 'block';
            speedoWrap.style.display = 'block';
            hideZombieUI(); hideFpsUI(); hideSimUI(); hideTimeUI();
            showGameUI(true);
            AudioEngine.startAmbient('desert');
        },
        exit(){
            AudioEngine.stopAmbient();
            AudioEngine.setEngineGain(0);
        },
        update(dt){
            updateCar(dt); checkRoad(dt); checkObstacles(); checkCoins(); checkForkBarrier();
            S.dist += S.speed * dt / C.KM; S.totalKm += S.speed * dt / C.KM;
            if(S.speed > S.topSpeed) S.topSpeed = S.speed;
            S.speedSamples++; S.avgSpeed = (S.avgSpeed * (S.speedSamples - 1) + S.speed) / S.speedSamples;
            if(S.dist > S.bestDist) S.bestDist = S.dist;
            S.timeAlive += dt;
            checkForkWarning(); updateCamera();
            recycleSegs(); recycleDeco(); recycleObs(); recycleCoins();
            if(dustPts) updateDust(dt);
            updateTrolls(dt); updateShake(dt); updateBoost(dt); updateHUD(dt);
        },
        showPlayingUI(){
            hudEl.style.display = 'block';
            ctrlEl.style.display = 'block';
            modeHudEl.style.display = 'none';
            coinCounter.style.display = 'block';
        },
        deathScreen: 'deathScreen',
    },
    zombie: {
        name: 'zombie',
        engineEnabled: false,  // NO engine sound in zombie mode
        ambient: 'indoor',
        enter(){
            if(carGroup) carGroup.visible = false;
            if(zombiePlayerMesh) zombiePlayerMesh.visible = true;
            if(fpsPlayerWeapon) fpsPlayerWeapon.visible = false;
            if(fpsLevelGroup) fpsLevelGroup.visible = false;
            showSimWorld(false);
            hudEl.style.display = 'none';
            ctrlEl.style.display = 'none';
            modeHudEl.style.display = 'none';
            coinCounter.style.display = 'none';
            boostBar.style.display = 'none';
            speedoWrap.style.display = 'none';
            boostLabel.style.display = 'none';
            showZombieUI();
            showGameUI(true);
            // v1.0: explicitly silence engine (no bleed)
            AudioEngine.setEngineGain(0);
            AudioEngine.startAmbient('indoor');
            // Schedule first wave (with cleanup-friendly timeout)
            if(zombieSpawnTimeout) clearTimeout(zombieSpawnTimeout);
            zombieSpawnTimeout = setTimeout(() => { if(S.phase === 'playing' && GameMode === 'zombie') spawnZombieWave(); zombieSpawnTimeout = null; }, 1000);
        },
        exit(){
            AudioEngine.stopAmbient();
            AudioEngine.setEngineGain(0);
            // Cleanup zombie state
            zombiePool.forEach(z => { scene.remove(z); }); zombiePool.length = 0;
            bulletPool.forEach(b => { b.userData.active = false; b.visible = false; });
            if(zombieSpawnTimeout){ clearTimeout(zombieSpawnTimeout); zombieSpawnTimeout = null; }
        },
        update(dt){
            updateZombieMode(dt);
        },
        showPlayingUI(){
            zombieCtrlEl.style.display = 'flex';
            showZombieUI();
        },
        deathScreen: 'zombieDeathScreen',
    },
    fps: {
        name: 'fps',
        engineEnabled: false,
        ambient: 'indoor',
        enter(){
            if(carGroup) carGroup.visible = false;
            if(zombiePlayerMesh) zombiePlayerMesh.visible = false;
            if(fpsPlayerWeapon) fpsPlayerWeapon.visible = true;
            if(fpsLevelGroup) fpsLevelGroup.visible = true;
            showSimWorld(false);
            hudEl.style.display = 'none';
            ctrlEl.style.display = 'none';
            zombieCtrlEl.style.display = 'none';
            simCtrlEl.style.display = 'none';
            coinCounter.style.display = 'none';
            boostBar.style.display = 'none';
            speedoWrap.style.display = 'none';
            boostLabel.style.display = 'none';
            showFpsUI();
            showGameUI(true);
            AudioEngine.setEngineGain(0);
            AudioEngine.startAmbient('indoor');
            // Schedule first wave
            if(zombieSpawnTimeout) clearTimeout(zombieSpawnTimeout);
            zombieSpawnTimeout = setTimeout(() => { if(S.phase === 'playing' && GameMode === 'fps') spawnFpsWave(); zombieSpawnTimeout = null; }, 1500);
            // Reset FPS state
            S.fpsHealth = FPS.MAX_HEALTH;
            S.fpsAmmo = FPS.MAX_AMMO;
            S.fpsAmmoReserve = 90;
            S.fpsKills = 0;
            S.fpsWave = 0;
            S.fpsReloading = false;
            S.fpsShootCooldown = 0;
            S.fpsYaw = 0; S.fpsPitch = 0;
            S.fpsPlayerPos = {x: 0, y: 1.7, z: 0};
            S.fpsPlayerVel = {x: 0, y: 0, z: 0};
            S.fpsOnGround = true;
            S.fpsMuzzleFlash = 0;
            S.fpsDamageFlash = 0;
            S.fpsEnemySpawnQueue = [];
            S.fpsWaveActive = false;
            S.fpsWaveBetweenTimer = 0;
            S.fpsInvincible = 0;
            // Clear pools
            fpsEnemyPool.forEach(e => scene.remove(e)); fpsEnemyPool.length = 0;
            fpsBulletPool.forEach(b => { b.userData.active = false; b.visible = false; });
            // Hide desert decorations
            decoPool.forEach(d => d.visible = false);
            segData.forEach(s => s.grp.visible = false);
            coinPool.forEach(c => c.visible = false);
            obstaclePool.forEach(o => o.visible = false);
            groundMeshes.forEach(m => m.visible = false);
            if(dustPts) dustPts.visible = false;
            sunMesh.visible = false;
        },
        exit(){
            AudioEngine.stopAmbient();
            AudioEngine.setEngineGain(0);
            // Cleanup FPS state
            fpsEnemyPool.forEach(e => scene.remove(e)); fpsEnemyPool.length = 0;
            fpsBulletPool.forEach(b => { b.userData.active = false; b.visible = false; });
            if(fpsLevelGroup) fpsLevelGroup.visible = false;
            if(fpsPlayerWeapon) fpsPlayerWeapon.visible = false;
            if(zombieSpawnTimeout){ clearTimeout(zombieSpawnTimeout); zombieSpawnTimeout = null; }
            // Restore desert scene visibility
            decoPool.forEach(d => d.visible = true);
            segData.forEach(s => s.grp.visible = true);
            coinPool.forEach(c => c.visible = true);
            obstaclePool.forEach(o => o.visible = true);
            groundMeshes.forEach(m => m.visible = true);
            if(dustPts) dustPts.visible = true;
            sunMesh.visible = true;
            document.body.style.filter = '';
        },
        update(dt){
            updateFpsMode(dt);
        },
        showPlayingUI(){
            fpsCtrlEl.style.display = 'block';
            showFpsUI();
        },
        deathScreen: 'fpsDeathScreen',
    },
    sim: {
        name: 'sim',
        engineEnabled: true,
        ambient: 'city',
        enter(){
            if(carGroup){
                carGroup.visible = true;
                carGroup.position.set(0, 0, 0);
                carGroup.rotation.y = 0;
            }
            if(zombiePlayerMesh) zombiePlayerMesh.visible = false;
            if(fpsPlayerWeapon) fpsPlayerWeapon.visible = false;
            if(fpsLevelGroup) fpsLevelGroup.visible = false;
            showSimWorld(true);
            hudEl.style.display = 'none';
            ctrlEl.style.display = 'none';
            zombieCtrlEl.style.display = 'none';
            fpsCtrlEl.style.display = 'none';
            coinCounter.style.display = 'none';
            boostBar.style.display = 'none';
            speedoWrap.style.display = 'none';
            boostLabel.style.display = 'none';
            showSimUI();
            showGameUI(true);
            AudioEngine.startAmbient('city');
            AudioEngine.engineStart();
            // Reset sim state
            S.simSpeed = 0; S.simSteer = 0; S.simRotY = 0;
            S.simMissions = 0; S.simTotalKm = 0;
            // Reset mission targets
            simTargetPool.forEach(t => {
                t.userData.collected = false;
                scene.add(t);
            });
        },
        exit(){
            AudioEngine.stopAmbient();
            AudioEngine.setEngineGain(0);
            AudioEngine.engineOff();
            showSimWorld(false);
        },
        update(dt){
            updateSimMode(dt);
        },
        showPlayingUI(){
            simCtrlEl.style.display = 'block';
            showSimUI();
        },
        deathScreen: 'simEndScreen',
    },
    time: {
        name: 'time',
        engineEnabled: true,
        ambient: 'desert',
        enter(){
            if(carGroup){
                carGroup.visible = true;
                carGroup.position.set(0, 0, 0);
                carGroup.rotation.y = 0;
            }
            if(zombiePlayerMesh) zombiePlayerMesh.visible = false;
            if(fpsPlayerWeapon) fpsPlayerWeapon.visible = false;
            if(fpsLevelGroup) fpsLevelGroup.visible = false;
            showSimWorld(false);
            ctrlEl.style.display = 'block';
            hudEl.style.display = 'block';
            zombieCtrlEl.style.display = 'none';
            fpsCtrlEl.style.display = 'none';
            simCtrlEl.style.display = 'none';
            showTimeUI();
            showGameUI(true);
            AudioEngine.startAmbient('desert');
            // Reset time attack state
            S.timeRemaining = C.TIME_ATTACK_DURATION;
            S.timeDistance = 0;
            S.timeCoinsCollected = 0;
            // Countdown
            AudioEngine.countdown(3);
            setTimeout(() => AudioEngine.countdown(2), 1000);
            setTimeout(() => AudioEngine.countdown(1), 2000);
            setTimeout(() => AudioEngine.countdown(0), 3000);
        },
        exit(){
            AudioEngine.stopAmbient();
            AudioEngine.setEngineGain(0);
        },
        update(dt){
            updateTimeMode(dt);
        },
        showPlayingUI(){
            ctrlEl.style.display = 'block';
            hudEl.style.display = 'block';
            showTimeUI();
        },
        deathScreen: 'timeEndScreen',
    },
};

// ============================================================
// CAR PHYSICS
// ============================================================
function updateCar(dt){
    if(!carGroup) return;
    let target = C.CAR_BASE_SPEED;
    if(S.boostActive > 0){
        target = C.CAR_MAX_SPEED * 1.3;
        S.boostActive -= dt;
        if(S.boostActive <= 0) S.boostActive = 0;
    } else if(inp.boost && S.boostMeter > 0.05){
        S.boostActive = 0.5;
        S.boostMeter = Math.max(0, S.boostMeter - 0.25);
        AudioEngine.boost();
    }
    if(inp.gas) target = Math.max(target, C.CAR_MAX_SPEED);
    if(inp.brake) target = C.CAR_MIN_SPEED;
    S.speed += (target - S.speed) * dt * 3;
    S.speed = Math.max(C.CAR_MIN_SPEED, Math.min(C.CAR_MAX_SPEED * 1.3, S.speed));
    if(!S.onRoad) S.speed = Math.max(3, S.speed * (1 - dt * 2));
    let steer = 0;
    let left = inp.left, right = inp.right;
    if(S.controlsReversed){ left = inp.right; right = inp.left; }
    if(left) steer = -1; if(right) steer = 1;
    const speedFactor = 1 - (S.speed - C.CAR_MIN_SPEED) / (C.CAR_MAX_SPEED - C.CAR_MIN_SPEED) * 0.35;
    carGroup.rotation.y += steer * C.TURN_RATE * speedFactor * dt;
    carGroup.rotation.y = Math.max(-C.MAX_STEER_Y, Math.min(C.MAX_STEER_Y, carGroup.rotation.y));
    if(!left && !right){
        carGroup.rotation.y *= 1 - dt * 2;
        if(Math.abs(carGroup.rotation.y) < 0.01) carGroup.rotation.y = 0;
    }
    const targetBank = -steer * 0.08;
    carGroup.rotation.z += (targetBank - carGroup.rotation.z) * dt * 8;
    const bounceSign = S.gravityFlip > 0 ? -1 : 1;
    carGroup.position.y = Math.sin(performance.now() * 0.008) * 0.02 * bounceSign;
    if(S.gravityFlip > 0) S.gravityFlip -= dt;
    if(S.invisibleMode > 0){
        carGroup.visible = (Math.floor(performance.now() / 100) % 2 === 0);
        S.invisibleMode -= dt;
        if(S.invisibleMode <= 0) carGroup.visible = true;
    }
    if(S.carShrink > 0){
        S.carShrink -= dt;
        if(S.carShrink <= 0) carGroup.scale.set(C.CAR_SCALE, C.CAR_SCALE, C.CAR_SCALE);
    }
    const fwd = S.speed * dt;
    carGroup.position.x += Math.sin(carGroup.rotation.y) * fwd;
    carGroup.position.z -= Math.cos(carGroup.rotation.y) * fwd;
    const roadEdge = C.ROAD_W / 2;
    const absX = Math.abs(carGroup.position.x);
    if(absX > roadEdge + C.ROAD_SOFT_EDGE){
        const pushDir = carGroup.position.x > 0 ? -1 : 1;
        carGroup.position.x += pushDir * C.OFFROAD_PUSH * dt;
    }
    const hardLimit = roadEdge + C.ROAD_SOFT_EDGE + 8;
    if(absX > hardLimit) carGroup.position.x = Math.sign(carGroup.position.x) * hardLimit;
    for(let i = 0, n = wheels.length; i < n; i++){
        const w = wheels[i];
        if(!w || !w.children || w.children.length < 2) continue;
        if(w.children[0]) w.children[0].rotation.x += fwd * 2;
        if(w.children[1]) w.children[1].rotation.x += fwd * 2;
    }
}
function checkRoad(dt){
    if(!carGroup) return;
    const roadEdge = C.ROAD_W / 2;
    const absX = Math.abs(carGroup.position.x);
    if(absX > roadEdge + C.ROAD_SOFT_EDGE){
        S.onRoad = false;
        S.offRoadT += dt;
        offVig.style.display = 'block';
        // v1.0: occasional offroad SFX (not every frame)
        if(Math.random() < 0.05) AudioEngine.offRoad();
        if(S.offRoadT >= C.OFFROAD_LIMIT && GameMode !== 'time') triggerDeath();
    } else {
        S.onRoad = true;
        S.offRoadT = Math.max(0, S.offRoadT - dt * 0.5);
        if(S.offRoadT <= 0) offVig.style.display = 'none';
    }
}
function checkForkBarrier(){
    if(S.dead || !carGroup) return;
    const cZ = carGroup.position.z;
    const absCX = Math.abs(carGroup.position.x);
    for(let i = 0, n = segData.length; i < n; i++){
        const s = segData[i];
        if(!s.isFork) continue;
        const barrierWorldZ = s.grp.position.z + C.SEG_LEN/2 - 15;
        const dz = Math.abs(cZ - barrierWorldZ);
        if(dz < 2.5 && absCX < C.BARRIER_HALF_W + C.CAR_RADIUS * C.CAR_SCALE){
            if(GameMode !== 'time'){
                triggerDeath();
            } else {
                // Time attack: bounce
                carGroup.position.x = -carGroup.position.x * 0.5;
                S.speed *= 0.5;
                AudioEngine.crash();
            }
            return;
        }
    }
}
function checkForkWarning(){
    if(!carGroup) return;
    const cZ = carGroup.position.z;
    let nearFork = false;
    for(let i = 0, n = segData.length; i < n; i++){
        const s = segData[i];
        if(s.isFork){
            const dz = Math.abs(s.grp.position.z - cZ);
            if(dz < 50 && dz > 8) nearFork = true;
        }
    }
    if(nearFork && !S.forkShown){
        S.forkShown = true;
        showTroll('NGÃ RẺ SẮP TỚI! Rẽ trái hoặc phải!', 3000);
        AudioEngine.forkWarning();
    } else if(!nearFork) S.forkShown = false;
}
function updateCamera(){
    if(!carGroup) return;
    const r = carGroup.rotation.y;
    let camDist = C.CAM_DIST, camH = C.CAM_H, lookAhead = C.CAM_LOOK_AHEAD;
    if(S.cameraMode === 1){ camDist = 28; camH = 14; }
    else if(S.cameraMode === 2){ camDist = 4; camH = 2.5; lookAhead = 2; }
    const tX = carGroup.position.x - Math.sin(r) * camDist;
    const tZ = carGroup.position.z + Math.cos(r) * camDist;
    const lerpFactor = C.CAM_LERP;
    cam.position.x += (tX - cam.position.x) * lerpFactor;
    cam.position.y += (camH - cam.position.y) * (lerpFactor * 1.2);
    cam.position.z += (tZ - cam.position.z) * lerpFactor;
    const lX = carGroup.position.x + Math.sin(r) * lookAhead;
    const lZ = carGroup.position.z - Math.cos(r) * lookAhead;
    cam.lookAt(lX, 1.5, lZ);
}
function updateShake(dt){
    if(S.shakeTimer > 0){
        S.shakeTimer -= dt;
        const i = S.shakeIntensity;
        const ox = (Math.random() - .5) * i * 2, oy = (Math.random() - .5) * i;
        shakeWrap.style.transform = `translate(${ox}px,${oy}px)`;
        cam.position.x += ox * .05;
        cam.position.y += oy * .05;
    } else {
        shakeWrap.style.transform = '';
    }
}
function doShake(intensity, duration){ S.shakeIntensity = intensity; S.shakeTimer = duration; }
function updateHUD(dt){
    if(!carGroup) return;
    const speedKmh = Math.round(S.speed * 3.6);
    if(spdH) spdH.textContent = speedKmh + ' km/h';
    if(dstH) dstH.textContent = S.dist.toFixed(2) + ' km';
    const elapsed = Math.floor(S.timeAlive);
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    if(tmrH) tmrH.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    if(topSpeedH) topSpeedH.textContent = Math.round(S.topSpeed * 3.6) + ' km/h';
    if(totalKmH) totalKmH.textContent = S.totalKm.toFixed(2) + ' km';
    if(boostFill) boostFill.style.width = (S.boostMeter * 100) + '%';
    if(speedoDial){
        const angle = -120 + (S.speed / C.CAR_MAX_SPEED) * 240;
        speedoDial.style.transform = `rotate(${angle}deg)`;
    }
}
function updateBoost(dt){
    if(S.boostMeter < 1) S.boostMeter = Math.min(1, S.boostMeter + dt * 0.05);
}
function updateMusicPoll(){
    S.musicCheckCounter++;
    if(S.musicCheckCounter < C.MUSIC_POLL_FRAMES) return;
    S.musicCheckCounter = 0;
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.isMusicPlaying){
            const playing = AndroidBridge.isMusicPlaying();
            if(playing !== S.musicPlaying){
                S.musicPlaying = playing;
                if(playing){
                    const name = (AndroidBridge.getMusicName && AndroidBridge.getMusicName()) || 'Music';
                    showMusicIndicator(name);
                } else {
                    hideMusicIndicator();
                }
            }
        }
    } catch(e){}
}
function updateDebug(){
    if(!debugOverlay) return;
    const info = [
        'FPS: ' + S.fps,
        'Mode: ' + GameMode,
        'Phase: ' + S.phase,
        'Speed: ' + S.speed.toFixed(1),
        'Dist: ' + S.dist.toFixed(3),
        'Pos: ' + (carGroup ? carGroup.position.x.toFixed(1) + ',' + carGroup.position.z.toFixed(1) : 'n/a'),
        'Objs: ' + obstaclePool.length + ' obs, ' + decoPool.length + ' deco',
        'Shadow: ' + (_shadowEnabled ? 'ON' : 'OFF'),
        'Audio: ' + (S.audioEnabled ? 'ON' : 'OFF') + (audioCtx ? ' (' + audioCtx.state + ')' : ' (no ctx)'),
        'Music: ' + (S.musicPlaying ? 'ON' : 'OFF'),
        'Low: ' + (S.lowPerfMode ? 'YES' : 'NO'),
    ];
    debugOverlay.textContent = info.join('\n');
}

/* ── TROLL FEATURES ── */
const TROLL_MESSAGES = [
    'Bạn đang đi rất chậm... Đi bộ nhanh hơn!',
    'Xe này chạy bằng... niềm tin?',
    'Chú ý: Sa mạc này có GPS nhưng... bị lỗi',
    'Tip: Nhấn gas để đi nhanh (ai nghĩ ra tip này?)',
    'Warning: Đường phía trước... cũng là sa mạc',
    'Bạn đã đi __km! Kỷ lục của con gián là 0.001km',
    'Loading ảo giác... Vui lòng đợi 999 năm',
    'Chúc mừng! Bạn là người chơi thứ... 1 ở sa mạc này',
    'Bạn có biết: Sa mạc này được làm bằng JavaScript?',
    'Đã xuất hiện 1 con lạc đà ma! ... À không, chỉ là ảo giác',
    'Mẹ bạn gọi: "Con về ăn cơm!" ...À, không ai gọi',
    'Phía trước có trạm nghỉ... ảo',
    'Chú ý: Đường sắp đổi màu... hoặc không',
    'Bug report: Không tìm thấy bug... vì game này toàn bug',
    'Bạn đã đi được __km! Quán cà phê gần nhất: 500km',
    'Đang tải... 0% complete sau 99 năm',
    'Bạn vừa đâm trúng... ảo giác',
    'Cảnh báo: Xe của bạn sắp hết... ảo giác',
    'Mẹo: Đừng đâm vào rào chắn (ai cũng biết)',
    'Bạn có muốn mua DLC "Sa Mạc Mùa Đông" không?',
    'Đang tải quảng cáo... Ảo!',
    'Xe của bạn vừa được nâng cấp! ...À, không',
    'Bạn vừa trúng jackpot! ...Tiền ảo',
    'Cảnh báo: Hacker đang theo dõi bạn... ảo',
    'Đường phía trước có trạm xăng! ...Năm 2099',
    'Bạn đã chơi quá lâu! ...Ai quan tâm?',
    'Server đang bảo trì... à, game offline mà',
    'Bạn có muốn xem video ads để nhận 2x? ...Ảo',
    'Đang kết nối WiFi... sa mạc không có WiFi',
    'Bạn đã unlock skin "Lạc đà vàng"! ...À, trololol',
    'Game sẽ restart trong 3... 2... 1... À không',
    'Chế độ Simulator: bạn có thể đi làm lạc đà không? Không.',
    'FPS mode: súng này bắn bằng... ảo giác',
    'Time Attack: thời gian là vàng, bạn đang đi... cát',
];
const ACHIEVEMENTS = [
    {km: 0.5, title: 'KHỞI HÀNH', msg: 'Bạn đã đi 0.5km! ...Đó là khoảng cách của 1 con gián'},
    {km: 1,   title: 'KM ĐẦU TIÊN', msg: '1km! Bố mẹ bạn rất tự hào... về việc bạn lãng phí thời gian'},
    {km: 2,   title: 'NGƯỜI LÀM', msg: '2km! Bạn đã đi xa hơn... xe tải chở rác'},
    {km: 5,   title: 'SA MẠC EXPERT', msg: '5km! Bạn có thể ứng tuyển làm hướng dẫn viên sa mạc... ảo'},
    {km: 10,  title: 'PRO PLAYER', msg: '10km! Bạn đã chơi lâu hơn thời gian đọc README'},
    {km: 20,  title: 'MASTER', msg: '20km! 20km trong sa mạc? Người thật việc thật... ảo'},
    {km: 50,  title: 'LEGEND', msg: '50km! Bạn là legend... của sự lãng phí'},
    {km: 100, title: 'GOD', msg: '100km! Bạn đã đi xa hơn... cuộc đời của 1 số người'},
];
const FAKE_NOTIFS = [
    {icon: '🔋', text: 'Pin điện thoại sắp hết! ...À, chỉ là ảo giác'},
    {icon: '📡', text: 'GPS signal lost! ...À, sa mạc không có GPS'},
    {icon: '📞', text: 'Mẹ gọi: "Con về ăn cơm!" ...À, không ai gọi'},
    {icon: '🔥', text: 'Phone overheating! ...À, sa mạc nóng là bình thường'},
    {icon: '📶', text: 'No internet connection! ...Từ lúc nào game có internet?'},
    {icon: '💀', text: 'Warning: Game đang theo dõi bạn... ảo'},
    {icon: '🚗', text: 'Car insurance expired! ...Bạn đang đi xe free'},
    {icon: '🛡️', text: 'Virus detected! ...À, chỉ là con virus sa mạc'},
    {icon: '⛈️', text: 'Cảnh báo bão cát! ...À, chỉ là 1 hạt cát bay qua màn hình'},
    {icon: '👾', text: 'Alien xâm chiếm sa mạc! ...À, đó là UFO (ảo)'},
    {icon: '💰', text: 'Bạn vừa trúng 1 tỷ đồng! ...À, tiền ảo'},
    {icon: '⚠️', text: 'Tài khoản của bạn bị khóa! ...À, không có tài khoản'},
];

let trollTimer = 0;
let nextTrollAt = 15;

function updateTrolls(dt){
    if(S.trollLevel === 0) return;
    trollTimer += dt;
    if(S.controlsReversed){
        S.reverseTimer -= dt;
        if(S.reverseTimer <= 0){ S.controlsReversed = false; revInd.style.display = 'none'; }
    }
    if(S.carColorTimer > 0){
        S.carColorTimer -= dt;
        if(S.carColorTimer <= 0 && carBodyMesh) carBodyMesh.material.color.setHex(0xcc0000);
    }
    if(S.fakeDeathFlash > 0){
        S.fakeDeathFlash -= dt;
        if(S.fakeDeathFlash <= 0){
            deathScr.style.display = 'none';
            hudEl.style.display = 'block';
            ctrlEl.style.display = 'block';
            S.phase = 'playing';
        }
    }
    ACHIEVEMENTS.forEach(a => {
        if(S.dist >= a.km && !S.milestoneShown[a.km]){
            S.milestoneShown[a.km] = true;
            showAchievement(a.title, a.msg.replace('__', S.dist.toFixed(1)));
            doShake(3, .3);
            AudioEngine.milestone();
            try { if(typeof AndroidBridge !== 'undefined' && AndroidBridge.fireLuaEvent) AndroidBridge.fireLuaEvent('on_achievement'); } catch(e){}
        }
    });
    if(trollTimer >= nextTrollAt && S.trollCooldown <= 0){
        triggerRandomTroll();
        nextTrollAt = trollTimer + (S.trollLevel === 2 ? 8 + Math.random() * 15 : 12 + Math.random() * 25);
        S.trollCooldown = 3;
    }
    if(S.trollCooldown > 0) S.trollCooldown -= dt;
    if(S.fakeNotifTimer > 0){
        S.fakeNotifTimer -= dt;
        if(S.fakeNotifTimer <= 0) fakeNotif.style.display = 'none';
    }
}

function triggerRandomTroll(){
    const roll = Math.random();
    if(roll < 0.18){
        const msg = TROLL_MESSAGES[Math.floor(Math.random() * TROLL_MESSAGES.length)].replace('__', S.dist.toFixed(1));
        showTroll(msg, 3000);
        AudioEngine.trollPop();
    } else if(roll < 0.30){
        S.controlsReversed = true;
        S.reverseTimer = 4 + Math.random() * 3;
        revInd.style.display = 'block';
        showTroll('ĐIỀU KHIỂN ĐẢO NGƯỢC! ◀ = ▶ , ▶ = ◀', 2500);
        doShake(4, .5); vibrate(200);
        AudioEngine._env('square', 200, 0.3, 0.08);
    } else if(roll < 0.38){
        if(carBodyMesh){
            const colors = [0x00cc00, 0x0000cc, 0xcccc00, 0xff6600, 0x9900cc, 0x00cccc, 0xff00ff];
            carBodyMesh.material.color.setHex(colors[Math.floor(Math.random() * colors.length)]);
            S.carColorTimer = 8 + Math.random() * 5;
            showTroll('Xe bạn đổi màu! Có ai mua xe cũ không?', 2500);
        }
    } else if(roll < 0.46){
        showTroll('GAME OVER! ...À, chỉ là ảo giác', 1500);
        doShake(6, .3); vibrate(100);
        AudioEngine._env('square', 150, 0.5, 0.1);
    } else if(roll < 0.54){
        const n = FAKE_NOTIFS[Math.floor(Math.random() * FAKE_NOTIFS.length)];
        if(fakeNotifText) fakeNotifText.innerHTML = '<span class="notif-icon">' + n.icon + '</span>' + n.text;
        fakeNotif.style.display = 'block';
        S.fakeNotifTimer = 3;
    } else if(roll < 0.62){
        doShake(2 + Math.random() * 3, .5 + Math.random() * .5);
        showTroll('Sóng sa mạc! ...hoặc chỉ là bug', 2000);
    } else if(roll < 0.70){
        S.speed = Math.random() > .5 ? C.CAR_MAX_SPEED * 1.2 : C.CAR_MIN_SPEED;
        const msg = S.speed > C.CAR_BASE_SPEED ? 'TURBO BOOST! (ảo)' : 'XE BỊ KẸT CÁT! (ảo)';
        showTroll(msg, 2000);
        doShake(3, .2);
        AudioEngine._env('square', S.speed > C.CAR_BASE_SPEED ? 880 : 100, 0.3, 0.08);
    } else if(roll < 0.76){
        scene.fog = new THREE.FogExp2(0x6699cc, 0.02);
        showTroll('Mưa ở sa mạc?! ...À, ảo giác', 3000);
        if(fogTimeout) clearTimeout(fogTimeout);
        fogTimeout = setTimeout(() => {
            scene.fog = new THREE.FogExp2(0xD2B48C, isLowDevice ? 0.010 : 0.005);
            fogTimeout = null;
        }, 4000);
    }
    else if(roll < 0.80){
        S.gravityFlip = 6 + Math.random() * 4;
        showTroll('🌟 TRỌNG LỰC ĐẢO! Xe bay lên trời!', 2500);
        doShake(5, .4); vibrate(300);
        AudioEngine._env('sine', 440, 0.4, 0.1);
    } else if(roll < 0.84){
        S.invisibleMode = 5;
        showTroll('👻 XE TÀN HÌNH! Bạn đang ở đâu?', 2500);
        AudioEngine._env('sine', 550, 0.3, 0.08);
    } else if(roll < 0.88){
        document.body.style.filter = 'invert(1)';
        showTroll('🌀 SA MẠC AMONG US! Màu đảo ngược', 3000);
        if(invertTimeout) clearTimeout(invertTimeout);
        invertTimeout = setTimeout(() => { document.body.style.filter = ''; invertTimeout = null; }, 5000);
        AudioEngine._env('triangle', 330, 0.5, 0.08);
    } else if(roll < 0.92){
        if(carGroup){
            S.carShrink = 5;
            carGroup.scale.set(C.CAR_SCALE * 0.3, C.CAR_SCALE * 0.3, C.CAR_SCALE * 0.3);
            showTroll('🤏 XE THU NHỎ! Cẩn thận kẻo lạc', 2500);
            AudioEngine._env('triangle', 1100, 0.3, 0.08);
        }
    } else if(roll < 0.95){
        S.fakeLag = 1 + Math.random() * 2;
        showTroll('🐌 LAG! ...À, chỉ là troll lag', 2000);
        AudioEngine._env('sawtooth', 80, 0.8, 0.06);
    } else if(roll < 0.97){
        const ang = (Math.random() - .5) * 30;
        document.body.style.transform = `rotate(${ang}deg)`;
        document.body.style.transformOrigin = 'center';
        showTroll('🔄 SA MẠC NGHIÊNG! Mọi thứ xiên hết', 2500);
        if(rotateTimeout) clearTimeout(rotateTimeout);
        rotateTimeout = setTimeout(() => { document.body.style.transform = ''; rotateTimeout = null; }, 4000);
    } else if(roll < 0.985){
        if(fakeNotifText) fakeNotifText.innerHTML = '<span class="notif-icon">🪫</span>Cảnh báo: Pin chỉ còn 1%! ...À, ảo giác';
        fakeNotif.style.display = 'block';
        S.fakeNotifTimer = 4;
        showTroll('Pin sập! ...À, không có', 2000);
    } else if(roll < 0.992){
        S.speed *= 0.3;
        showTroll('⏰ CHẬM MO! Sa mạc vào slow-motion', 2000);
        AudioEngine._env('triangle', 220, 0.5, 0.1);
    } else if(roll < 0.997){
        if(S.coinsCollected > 0){
            const stolen = Math.min(S.coinsCollected, 5 + Math.floor(Math.random() * 10));
            S.coinsCollected -= stolen;
            updateCoinDisplay();
            showTroll(`💸 Lạc đà ma ăn cắp ${stolen} đồng!`, 2500);
        } else {
            showTroll('💸 Lạc đà ma định ăn cắp... nhưng bạn nghèo!', 2500);
        }
        AudioEngine._env('sawtooth', 150, 0.4, 0.1);
    } else {
        // Engine curse — only in driving modes
        if(Modes[GameMode].engineEnabled && engineGain && audioCtx){
            AudioEngine.setEngineGain(0);
            if(curseTimeout) clearTimeout(curseTimeout);
            curseTimeout = setTimeout(() => {
                if(engineGain && audioCtx && Modes[GameMode].engineEnabled){
                    AudioEngine.setEngineGain(C.ENGINE_BASE_VOL * 2);
                    if(curseTimeout2) clearTimeout(curseTimeout2);
                    curseTimeout2 = setTimeout(() => {
                        if(engineGain && audioCtx && Modes[GameMode].engineEnabled){
                            AudioEngine.setEngineGain(C.ENGINE_BASE_VOL);
                        }
                        curseTimeout2 = null;
                    }, 1500);
                }
                curseTimeout = null;
            }, 2000);
            lastEngineVol = -1;
        }
        AudioEngine.curse();
        showTroll('🔇 ĐỘNG CƠ TẮT! ...À, chỉ là troll', 2500);
    }
}

function showTroll(msg, duration){
    if(!trollBox || !trollPop) return;
    trollBox.textContent = msg;
    trollBox.className = 't-box';
    trollPop.style.display = 'block';
    if(trollTimeout) clearTimeout(trollTimeout);
    trollTimeout = setTimeout(() => {
        if(trollPop) trollPop.style.display = 'none';
        trollTimeout = null;
    }, duration);
}
function showAchievement(title, msg){
    if(!msKm || !msMsg || !msBanner) return;
    msKm.textContent = title;
    msMsg.textContent = msg;
    msBanner.style.display = 'block';
    if(achievementTimeout) clearTimeout(achievementTimeout);
    achievementTimeout = setTimeout(() => {
        if(msBanner) msBanner.style.display = 'none';
        achievementTimeout = null;
    }, 4000);
}

/* ───────────────────────────────────────────
   GAME LOOP — single dispatcher to current mode
   ─────────────────────────────────────────── */
function gameLoop(now, token){
    if(!loopRunning || token !== loopToken) return;
    requestAnimationFrame(t => gameLoop(t, token));
    S.fpsFrames++;
    if(gameLoop._lastNow && now > gameLoop._lastNow){
        const inst = 1000 / (now - gameLoop._lastNow);
        if(isFinite(inst)) S.fpsAccum += inst;
    }
    gameLoop._lastNow = now;
    if(S.fpsFrames >= 30){
        S.fps = S.fpsFrames > 0 ? Math.round(S.fpsAccum / S.fpsFrames) : 60;
        if(!isFinite(S.fps) || S.fps < 0) S.fps = 60;
        S.fpsAccum = 0; S.fpsFrames = 0;
        if(S.fps < 30 && !S.lowPerfMode && S.autoQualityFrames++ > 3){
            S.lowPerfMode = true;
            if(_shadowEnabled){
                _shadowEnabled = false;
                if(renderer) renderer.shadowMap.enabled = false;
                if(sunLight) sunLight.castShadow = false;
            }
            showTroll('Tự động giảm chất lượng (FPS thấp)', 2000);
        }
        if(fpsHud) fpsHud.textContent = S.fps + ' FPS';
    }
    if(S.phase !== 'playing' || S.paused){
        if(S.phase === 'dead' || S.phase === 'easter'){
            try { renderer.render(scene, cam); } catch(e){}
        }
        return;
    }
    if(S.fpsLimit === 1){ if(gameLoop._last30 && now - gameLoop._last30 < 33) return; gameLoop._last30 = now; }
    else if(S.fpsLimit === 2){ if(gameLoop._last60 && now - gameLoop._last60 < 16) return; gameLoop._last60 = now; }
    let dt;
    try { dt = Math.min(clock.getDelta(), 0.06); } catch(e){ dt = 0.016; }
    if(!isFinite(dt) || dt <= 0) dt = 0.016;
    // v1.0: dispatch to current mode
    if(Modes[GameMode] && Modes[GameMode].update){
        try { Modes[GameMode].update(dt); } catch(e){ console.warn('Mode update error:', e); }
    }
    updateMusicPoll();
    updateAudio();
    updateLuaState();
    if(Date.now() - S.t0 >= C.EASTER_MS) triggerEaster();
    if(debugOverlay && S.debugOverlay) updateDebug();
    try { renderer.render(scene, cam); } catch(e){}
}
function startLoop(){
    if(loopRunning) return;
    loopRunning = true;
    if(clock) clock.start();
    gameLoop._lastNow = 0;
    loopToken++;
    const myToken = loopToken;
    requestAnimationFrame(t => gameLoop(t, myToken));
}
function stopLoop(){
    loopRunning = false;
    loopToken++;
}

/* ── START / RESTART ── */
function startGame(){
    GameMode = _selectedMode || 'desert';
    if(initFailed) return;
    if(_musicPromptVisible) return;
    if(musicPrompt){
        musicPrompt.style.display = 'flex';
        _musicPromptVisible = true;
        return;
    }
    startGameAfterMusic(false);
}
function startGameAfterMusic(musicPicked){
    if(initFailed || !scene || !cam || !carGroup || !renderer){
        showFatalError('Không thể khởi tạo 3D. Thiết bị của bạn có thể không hỗ trợ WebGL2.');
        return;
    }
    $('welcomeScreen').style.display = 'none';
    if(musicPrompt) musicPrompt.style.display = 'none';
    canvas.style.display = 'block';
    S.phase = 'playing';
    S.dead = false; S.paused = false;
    S.t0 = Date.now();
    S.dist = 0; S.speed = C.CAR_BASE_SPEED; S.offRoadT = 0; S.onRoad = true;
    S.controlsReversed = false; S.reverseTimer = 0;
    S.carColorTimer = 0; S.shakeTimer = 0; S.milestoneShown = {};
    S.forkShown = false; S.fakeNotifTimer = 0; S.fakeDeathFlash = 0;
    S.gravityFlip = 0; S.invisibleMode = 0; S.carShrink = 0;
    S.topSpeed = 0; S.avgSpeed = 0; S.speedSamples = 0;
    S.timeAlive = 0; S.nearMissCount = 0; S.coinsCollected = 0;
    S.boostMeter = 0; S.boostActive = 0;
    S.musicPlaying = false;
    trollTimer = 0; nextTrollAt = 15; S.trollCooldown = 0;
    // Reset car position
    carGroup.position.set(0, 0, 0);
    carGroup.rotation.y = 0; carGroup.rotation.z = 0;
    carGroup.scale.set(C.CAR_SCALE, C.CAR_SCALE, C.CAR_SCALE);
    if(carBodyMesh && carBodyMesh.material) carBodyMesh.material.color.setHex(0xcc0000);
    segData.forEach(s => { s.grp.position.z = -s.idx * C.SEG_LEN; });
    obstaclePool.forEach(o => {
        if(!o.userData.isObs) return;
        const side = Math.random() > .5 ? 1 : -1;
        o.position.x = side * (1 + Math.random() * (C.ROAD_W/2 - 3));
        o.userData._nearMiss = false;
    });
    coinPool.forEach(c => {
        c.userData.collected = false;
        c.visible = true;
        c.position.x = (Math.random() - .5) * (C.ROAD_W - 3);
    });
    cam.position.set(0, C.CAM_H, C.CAM_DIST);
    cam.lookAt(0, 1.5, 0);
    // Hide all end screens
    deathScr.style.display = 'none'; eastScr.style.display = 'none';
    pauseScr.style.display = 'none';
    zombieDeathScr.style.display = 'none';
    fpsDeathScr.style.display = 'none';
    simEndScr.style.display = 'none';
    timeEndScr.style.display = 'none';
    document.body.style.filter = '';
    document.body.style.transform = '';
    // v1.0: enter current mode
    if(Modes[GameMode] && Modes[GameMode].enter){
        Modes[GameMode].enter();
    }
    updateCoinDisplay();
    resetInput();
    // Init audio (must be in user gesture)
    if(!audioCtx) AudioEngine.init();
    if(audioCtx && audioCtx.state === 'suspended'){
        try { audioCtx.resume(); } catch(e){}
    }
    startLoop();
}

function showFatalError(msg){
    const errEl = document.createElement('div');
    errEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
        'background:rgba(0,0,0,.92);color:#fbbf24;font-family:system-ui,sans-serif;' +
        'display:flex;align-items:center;justify-content:center;flex-direction:column;' +
        'padding:32px;text-align:center;z-index:9999;';
    errEl.innerHTML =
        '<div style="font-size:42px;margin-bottom:16px;">⚠️</div>' +
        '<div style="font-size:18px;font-weight:800;letter-spacing:1px;margin-bottom:12px;">LỖI KHỞI TẠO</div>' +
        '<div style="font-size:14px;color:#cbd5e1;line-height:1.6;max-width:480px;">' +
        (msg || 'Không thể khởi tạo game.') +
        '<br><br><small style="color:#64748b;">Vui lòng cập nhật Android System WebView và thử lại.</small></div>';
    document.body.appendChild(errEl);
}

function updateLuaState(){
    if(_luaStateCounter++ < C.LUA_UPDATE_FRAMES) return;
    _luaStateCounter = 0;
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.updateLuaGameState){
            AndroidBridge.updateLuaGameState(S.dist, S.speed * 3.6, S.deathCount, S.bestDist, 1);
        }
    } catch(e){}
}
let _luaStateCounter = 0;

function triggerDeath(){
    if(S.dead) return;
    S.dead = true; S.phase = 'dead'; S.deathCount++;
    vibrate(300); AudioEngine.crash();
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.onGameDeath){
            AndroidBridge.onGameDeath(S.dist, S.topSpeed * 3.6, S.coinsCollected, S.nearMissCount, S.timeAlive);
        }
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.fireLuaEvent) AndroidBridge.fireLuaEvent('on_death');
    } catch(e){}
    let extra = '';
    if(S.deathCount === 1) extra = ' (Lần đầu chết, rất bình thường)';
    else if(S.deathCount === 2) extra = ' (Lần 2, bạn chưa học bài?)';
    else if(S.deathCount === 3) extra = ' (Lần 3, sa mạc không thích bạn)';
    else if(S.deathCount === 5) extra = ' (5 lần! Bạn là professional... chết)';
    else if(S.deathCount === 10) extra = ' (10 LẦN! Bạn có nên thử game khác?)';
    else if(S.deathCount === 20) extra = ' (20 lần... Bạn kiên trì hay mắc kẹt?)';
    else if(S.deathCount >= 50) extra = ' (Bạn đã chết ' + S.deathCount + ' lần. Game tôn vinh sự kiên trì)';
    let stats = 'Bạn đã đi được ' + S.dist.toFixed(2) + 'km rồi, cố lên!' + extra;
    stats += ' | Tốc độ tối đa: ' + Math.round(S.topSpeed * 3.6) + ' km/h';
    stats += ' | Coin: ' + S.coinsCollected;
    stats += ' | Near-miss: ' + S.nearMissCount;
    if(dstD) dstD.textContent = stats;
    if(bestD) bestD.textContent = 'Kỷ lục: ' + S.bestDist.toFixed(2) + ' km';
    deathScr.style.display = 'flex';
    hudEl.style.display = 'none'; ctrlEl.style.display = 'none';
    offVig.style.display = 'none'; revInd.style.display = 'none';
    fakeNotif.style.display = 'none'; trollPop.style.display = 'none'; msBanner.style.display = 'none';
    doShake(5, .8);
    // v1.0: suspend audio on death (no bleed)
    AudioEngine.suspend();
}
function triggerEaster(){
    S.phase = 'easter';
    eastScr.style.display = 'flex';
    hudEl.style.display = 'none'; ctrlEl.style.display = 'none';
    zombieCtrlEl.style.display = 'none'; fpsCtrlEl.style.display = 'none';
    simCtrlEl.style.display = 'none'; modeHudEl.style.display = 'none';
    hideZombieUI(); hideFpsUI(); hideSimUI(); hideTimeUI();
    offVig.style.display = 'none'; revInd.style.display = 'none';
    fakeNotif.style.display = 'none'; trollPop.style.display = 'none'; msBanner.style.display = 'none';
    AudioEngine.suspend();
}
function restart(){
    if(initFailed || !carGroup || !cam) return;
    stopLoop();
    clearAllTimeouts();
    // Exit current mode (cleanup)
    if(Modes[GameMode] && Modes[GameMode].exit) Modes[GameMode].exit();
    S.phase = 'playing'; S.dead = false; S.paused = false;
    S.dist = 0; S.speed = C.CAR_BASE_SPEED; S.offRoadT = 0; S.onRoad = true;
    S.t0 = Date.now(); S.forkShown = false;
    S.controlsReversed = false; S.reverseTimer = 0;
    S.carColorTimer = 0; S.shakeTimer = 0; S.milestoneShown = {};
    S.fakeNotifTimer = 0; S.fakeDeathFlash = 0;
    S.gravityFlip = 0; S.invisibleMode = 0; S.carShrink = 0;
    S.topSpeed = 0; S.avgSpeed = 0; S.speedSamples = 0;
    S.timeAlive = 0; S.nearMissCount = 0; S.coinsCollected = 0;
    S.boostMeter = 0; S.boostActive = 0;
    trollTimer = 0; nextTrollAt = 15; S.trollCooldown = 0;
    // Reset car
    carGroup.position.set(0, 0, 0);
    carGroup.rotation.y = 0; carGroup.rotation.z = 0;
    carGroup.visible = true;
    carGroup.scale.set(C.CAR_SCALE, C.CAR_SCALE, C.CAR_SCALE);
    if(carBodyMesh && carBodyMesh.material) carBodyMesh.material.color.setHex(0xcc0000);
    segData.forEach(s => { s.grp.position.z = -s.idx * C.SEG_LEN; });
    obstaclePool.forEach(o => {
        if(!o.userData.isObs) return;
        const side = Math.random() > .5 ? 1 : -1;
        o.position.x = side * (1 + Math.random() * (C.ROAD_W/2 - 3));
        o.userData._nearMiss = false;
    });
    coinPool.forEach(c => {
        c.userData.collected = false; c.visible = true;
        c.position.x = (Math.random() - .5) * (C.ROAD_W - 3);
    });
    cam.position.set(0, C.CAM_H, C.CAM_DIST);
    cam.lookAt(0, 1.5, 0);
    // Hide all end screens
    deathScr.style.display = 'none'; eastScr.style.display = 'none';
    pauseScr.style.display = 'none';
    zombieDeathScr.style.display = 'none';
    fpsDeathScr.style.display = 'none';
    simEndScr.style.display = 'none';
    timeEndScr.style.display = 'none';
    document.body.style.filter = '';
    document.body.style.transform = '';
    // Re-enter mode (re-init mode-specific state)
    if(Modes[GameMode] && Modes[GameMode].enter) Modes[GameMode].enter();
    showGameUI(true);
    offVig.style.display = 'none'; revInd.style.display = 'none';
    fakeNotif.style.display = 'none'; trollPop.style.display = 'none'; msBanner.style.display = 'none';
    updateCoinDisplay();
    resetInput();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    startLoop();
}
function resetInput(){
    inp.left = inp.right = inp.gas = inp.brake = inp.boost = false;
    inp.shoot = inp.reload = inp.jump = inp.forward = inp.back = false;
    document.querySelectorAll('.cb').forEach(b => b.classList.remove('on'));
}

/* ── PAUSE/RESUME (Android) ── */
window.pauseGame = function(){
    if(S.phase === 'playing' && !S.paused){
        S.paused = true;
        pauseScr.style.display = 'flex';
        hudEl.style.display = 'none'; ctrlEl.style.display = 'none';
        zombieCtrlEl.style.display = 'none'; fpsCtrlEl.style.display = 'none';
        simCtrlEl.style.display = 'none'; modeHudEl.style.display = 'none';
        if(audioCtx) audioCtx.suspend();
    }
};
window.resumeGame = function(){
    if(S.paused){
        S.paused = false;
        pauseScr.style.display = 'none';
        if(Modes[GameMode] && Modes[GameMode].showPlayingUI) Modes[GameMode].showPlayingUI();
        if(clock) clock.start();
        if(audioCtx) audioCtx.resume();
    }
};

/* ── BOOT ── */
try {
    init();
    if(renderer && scene && cam) renderer.render(scene, cam);
} catch(e){
    initFailed = true;
    console.error('[Sa Mạc Ảo Giác] init() failed:', e);
    showFatalError('Không thể khởi tạo đồ họa 3D: ' + (e && e.message ? e.message : e) +
        '.<br><br>Hãy cập nhật Android System WebView lên phiên bản mới nhất và mở lại.');
}

/* ============================================================
   v1.0 CHANGELOG (summary)
   ============================================================
   - 5 game modes via Mode Registry (desert, zombie, fps, sim, time)
   - Audio engine rewritten: no more bleeding across modes
   - 30+ procedural SFX (UI, driving, zombie, FPS, sim, time, troll)
   - Ambient layer per mode (desert wind, indoor, city)
   - HUD layout fixed: no overlap with control buttons
   - Settings panel: scrollable, opens with pause, music volume slider
   - End screens: text wraps, no overflow on small screens
   - All timeouts centralized and cleared on restart/quit
   - FPS mode: 3D arena with crates, cover, walls, enemies
   - Simulator mode: large open map, NPC traffic, 12 missions
   - Time Attack mode: 120s countdown, no death, +2s per coin
   ============================================================ */
})();
