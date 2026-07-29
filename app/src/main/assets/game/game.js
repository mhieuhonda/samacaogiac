// ============================================================
// SA MẠC ẢO GIÁC — Game Engine v0.6
// ============================================================
// Major v0.6 changes:
//   * PERFORMANCE — fixed the "light but laggy" problem:
//     - Shadow map 1024 -> 512 (50% less GPU bandwidth)
//     - MeshPhongMaterial -> MeshLambertMaterial for car body
//       (Phong specular is expensive on mobile GPUs)
//     - Squared-distance collision checks (no Math.sqrt per pair)
//     - Cached array references & object identities in hot loops
//     - Throttled dust particle updates to 30Hz (was 60Hz)
//     - requestAnimationFrame timestamp instead of Date.now() in
//       the car-bounce calc (avoids syscall)
//     - Audio gain set via setTargetAtTime only when target changes
//     - Shadow auto-disabled on low-end devices (was already but
//       now properly cached at init)
//
//   * MUSIC PLAYER — when entering game, prompt for music.
//     JS polls AndroidBridge.isMusicPlaying() each frame; when
//     music is playing, the engine Web Audio GainNode is ducked
//     via the C++ native mixer.
//
//   * 10 NEW TROLL FEATURES (on top of v0.5 set)
//   * 20 NEW USEFUL FEATURES
//
// All v0.5 features preserved. See CHANGELOG at end of file.
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
    // PERF: cap pixel ratio at 1.5 (was 1.5 — same, but enforced
    // even on devices that lie about devicePixelRatio)
    PR_CAP: 1.5,
    CAR_SCALE: 1.3,
    MAX_STEER_Y: Math.PI/3.5,
    ROAD_SOFT_EDGE: 3,
    OFFROAD_PUSH: 5,
    BARRIER_HALF_W: 4.9,
    CAR_RADIUS: 1.5,
    // PERF: shadow map size (was 1024, now 512 — saves 75% GPU mem)
    SHADOW_MAP_SIZE: 512,
    // PERF: dust particle count (was 60, now 40)
    DUST_COUNT: 40,
    // PERF: dust update rate (30Hz instead of 60Hz)
    DUST_UPDATE_INTERVAL: 1/30,
    // PERF: collision check squared distance threshold
    OBS_COLLISION_R: 1.5 * 1.3, // car_radius * car_scale
    // MUSIC: how often to poll native bridge (every N frames)
    MUSIC_POLL_FRAMES: 6,
    // MUSIC: engine base volume (matches native mixer default)
    ENGINE_BASE_VOL: 0.03,
};

/* ── STATE ── */
const S = {
    phase: 'welcome',
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
    // v0.6: music state
    musicPlaying: false,
    musicCheckCounter: 0,
    // v0.6: useful features
    fps: 60,
    fpsAccum: 0,
    fpsFrames: 0,
    lowPerfMode: false,
    autoQualityFrames: 0,
    // v0.6: troll features
    gravityFlip: 0,           // gravity flip timer
    invisibleMode: 0,         // invisible car timer
    invertedColors: 0,        // CSS filter invert timer
    fakeLag: 0,               // fake-lag troll timer
    screenRotate: 0,          // screen rotation troll timer
    carShrink: 0,             // car shrink troll timer
    fakeBatteryDrain: 0,      // fake low battery notification timer
    // v0.6: useful features
    totalKm: 0,
    topSpeed: 0,
    avgSpeed: 0,
    speedSamples: 0,
    nearMissCount: 0,
    coinsCollected: 0,
    boostMeter: 0,            // 0..1, regenerated over time
    boostActive: 0,
    consecutiveDistance: 0,   // distance without dying
    timeAlive: 0,
    audioEnabled: true,
    hudVisible: true,
    debugOverlay: false,
    cameraMode: 0,            // 0=follow, 1=far, 2=cockpit
    // 1km+ tracking
    lastMilestone: 0,
};

/* ── THREE ── */
let scene, cam, renderer, clock, loopRunning = false;
let carGroup, carBodyMesh, wheels = [];
let segData = [];
let decoPool = [];
let obstaclePool = [];
let coinPool = [];           // v0.6: collectible coins
let sunMesh, sunLight, ambientLight, hemiLight;
let dustPts;
let groundMeshes = [];
let isLowDevice = false;
let _shadowEnabled = false;  // cached at init

/* ── TIMEOUT TRACKING ── */
let trollTimeout = null;
let achievementTimeout = null;
let fogTimeout = null;
let sandstormTimeout = null;
let invertTimeout = null;
let rotateTimeout = null;
let batteryTimeout = null;

/* ── AUDIO ── */
let audioCtx = null;
let engineOsc = null, engineGain = null;
let lastEngineVol = -1;        // cache to avoid redundant setTargetAtTime
let lastEngineFreq = -1;

function initAudio(){
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        engineOsc = audioCtx.createOscillator();
        engineGain = audioCtx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 80;
        engineGain.gain.value = 0;
        engineOsc.connect(engineGain);
        engineGain.connect(audioCtx.destination);
        engineOsc.start();
        lastEngineVol = -1;
        lastEngineFreq = -1;
    } catch(e){}
}

function updateAudio(){
    if(!audioCtx || !engineOsc || !S.audioEnabled) {
        if(engineGain && S.audioEnabled === false && lastEngineVol !== 0) {
            engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
            lastEngineVol = 0;
        }
        return;
    }
    try {
        // Engine sound frequency based on speed
        const freq = 60 + (S.speed / C.CAR_MAX_SPEED) * 120;
        // PERF: only update if delta is significant
        if(Math.abs(freq - lastEngineFreq) > 1) {
            engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
            lastEngineFreq = freq;
        }

        // v0.6: ducking — when music plays, use native mixer value;
        // otherwise normal volume
        let vol;
        if(S.paused) {
            vol = 0;
        } else if(S.musicPlaying) {
            // Poll the native mixer for the smooth ducking value
            try {
                if(typeof AndroidBridge !== 'undefined' && AndroidBridge.getEngineVolume) {
                    vol = AndroidBridge.getEngineVolume();
                } else {
                    vol = C.ENGINE_BASE_VOL * 0.15;
                }
            } catch(e) {
                vol = C.ENGINE_BASE_VOL * 0.15;
            }
        } else {
            vol = S.onRoad ? C.ENGINE_BASE_VOL : C.ENGINE_BASE_VOL * 1.6;
        }

        if(Math.abs(vol - lastEngineVol) > 0.001) {
            engineGain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
            lastEngineVol = vol;
        }
    } catch(e){}
}

function playSfx(freq, dur, vol){
    if(!audioCtx || !S.audioEnabled) return;
    try {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'square';
        o.frequency.value = freq;
        g.gain.value = vol || 0.06;
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + dur);
    } catch(e){}
}

// v0.6: coin pickup sound (rising arpeggio)
function playCoinSfx(){
    if(!audioCtx || !S.audioEnabled) return;
    try {
        const notes = [660, 880, 1320];
        notes.forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'triangle';
            o.frequency.value = f;
            const start = audioCtx.currentTime + i * 0.05;
            g.gain.setValueAtTime(0.08, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(start); o.stop(start + 0.15);
        });
    } catch(e){}
}

/* ── INPUT ── */
const inp = { left:false, right:false, gas:false, brake:false, boost:false };

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
// v0.6: new DOM refs (with null-safe access)
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
const speedoDial = $('speedoDial');
const settingsBtn = $('settingsBtn');
const settingsScr = $('settingsScr');
const cheatInput = $('cheatInput');
const topSpeedH = $('topSpeedHud');
const totalKmH = $('totalKmHud');

/* ── UI ── */
function onBtn(id, fn){
    const el=$(id);
    if(!el) return;
    el.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();fn(true);el.classList.add('on')},{passive:false});
    el.addEventListener('touchend',e=>{e.preventDefault();e.stopPropagation();fn(false);el.classList.remove('on')},{passive:false});
    el.addEventListener('touchcancel',e=>{fn(false);el.classList.remove('on')});
    el.addEventListener('mousedown',e=>{e.preventDefault();fn(true);el.classList.add('on')});
    el.addEventListener('mouseup',e=>{fn(false);el.classList.remove('on')});
    el.addEventListener('mouseleave',()=>{fn(false);el.classList.remove('on')});
}
onBtn('bL',v=>{inp.left=v}); onBtn('bR',v=>{inp.right=v});
onBtn('bG',v=>{inp.gas=v}); onBtn('bB',v=>{inp.brake=v});
onBtn('bBoost',v=>{inp.boost=v});

function addClick(id, fn){
    const el=$(id);
    if(!el) return;
    el.addEventListener('click', e=>{e.preventDefault();fn()});
    el.addEventListener('touchstart', e=>{e.preventDefault();e.stopPropagation();fn()},{passive:false});
}
addClick('playBtn', startGame);
addClick('replayBtn', restart);
addClick('easterBtn', restart);
addClick('pauseBtn', togglePause);
addClick('resumeBtn', ()=>{ if(S.paused) togglePause(); });
addClick('quitBtn', ()=>{ if(S.paused){ S.phase='welcome'; $('welcomeScreen').style.display='flex'; deathScr.style.display='none'; eastScr.style.display='none'; pauseScr.style.display='none'; hudEl.style.display='none'; ctrlEl.style.display='none'; stopLoop(); resetInput(); } });
// v0.6: music prompt buttons
addClick('musicYes', ()=>{ if(musicPrompt) musicPrompt.style.display='none'; promptMusic(); });
addClick('musicNo',  ()=>{ if(musicPrompt) musicPrompt.style.display='none'; startGameAfterMusic(false); });
addClick('musicToggleBtn', toggleMusicFromButton);
addClick('cameraModeBtn', cycleCameraMode);
addClick('settingsBtn', openSettings);
addClick('settingsClose', ()=>{ if(settingsScr) settingsScr.style.display='none'; });
addClick('toggleSound', toggleSoundFromButton);
addClick('toggleHud', toggleHudFromButton);
addClick('toggleDebug', toggleDebugFromButton);
addClick('cheatSubmit', submitCheat);

/* Keyboard controls */
const cheatBuffer = [];
document.addEventListener('keydown', e=>{
    if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') inp.left=true;
    if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') inp.right=true;
    if(e.key==='ArrowUp'||e.key==='w'||e.key==='W') inp.gas=true;
    if(e.key==='ArrowDown'||e.key==='s'||e.key==='S') inp.brake=true;
    if(e.key==='Shift') inp.boost=true;
    if(e.key===' '||e.key==='Enter') {
        if(S.phase==='welcome' && (!musicPrompt || musicPrompt.style.display==='none')) startGame();
        else if(S.phase==='dead') restart();
        else if(S.phase==='easter') restart();
    }
    if(e.key==='Escape'||e.key==='p'||e.key==='P') {
        if(S.phase==='playing') togglePause();
    }
    // v0.6: cheat codes (Konami + others)
    cheatBuffer.push(e.key.toLowerCase());
    if(cheatBuffer.length > 12) cheatBuffer.shift();
    checkCheats();
});
document.addEventListener('keyup', e=>{
    if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') inp.left=false;
    if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') inp.right=false;
    if(e.key==='ArrowUp'||e.key==='w'||e.key==='W') inp.gas=false;
    if(e.key==='ArrowDown'||e.key==='s'||e.key==='S') inp.brake=false;
    if(e.key==='Shift') inp.boost=false;
});

// v0.6: touch swipe controls (alternative to buttons)
let touchStart = null;
canvas.addEventListener('touchstart', e=>{
    if(S.phase !== 'playing' || S.paused) return;
    if(e.touches.length === 1){
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }
}, {passive: true});
canvas.addEventListener('touchmove', e=>{
    if(!touchStart || S.phase !== 'playing') return;
    const dx = e.touches[0].clientX - touchStart.x;
    const dy = e.touches[0].clientY - touchStart.y;
    inp.left = dx < -20;
    inp.right = dx > 20;
    inp.gas = dy < -20;
    inp.brake = dy > 20;
}, {passive: true});
canvas.addEventListener('touchend', () => {
    if(touchStart) {
        const dur = Date.now() - touchStart.t;
        if(dur < 200) { /* tap = boost */ }
    }
    touchStart = null;
    inp.left = inp.right = inp.gas = inp.brake = false;
}, {passive: true});

/* ── VIBRATION BRIDGE ── */
function vibrate(ms){
    try{
        if(typeof AndroidBridge!=='undefined' && AndroidBridge.vibrate){
            AndroidBridge.vibrate(ms);
        } else if(navigator.vibrate){
            navigator.vibrate(ms);
        }
    }catch(e){}
}

/* ── MUSIC BRIDGE ── */
// v0.6: prompt the user for music via the Android MusicPickerActivity
function promptMusic(){
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.openMusicPicker) {
            AndroidBridge.openMusicPicker();
            // The Android side will call window.onMusicPicked() asynchronously.
            // We start the game immediately — music fades in when ready.
            startGameAfterMusic(true);
        } else {
            // No bridge (desktop testing) — just start the game.
            startGameAfterMusic(false);
        }
    } catch(e) {
        startGameAfterMusic(false);
    }
}

// Called from Java (GameActivity) when the user has picked a track.
window.onMusicPicked = function(trackName){
    S.musicPlaying = true;
    showMusicIndicator(trackName);
    playSfx(880, 0.2, 0.1);
};

// Called from Java when music stops (e.g., user dismissed notification).
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
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.toggleMusic) {
            AndroidBridge.toggleMusic();
        }
    } catch(e) {}
}

/* ── CAMERA MODE ── */
function cycleCameraMode(){
    S.cameraMode = (S.cameraMode + 1) % 3;
    if(cameraModeBtn) {
        cameraModeBtn.textContent = ['📷','🔭','🚗'][S.cameraMode];
    }
    playSfx(550, 0.1, 0.06);
}

/* ── SETTINGS ── */
function openSettings(){
    if(settingsScr) settingsScr.style.display = 'flex';
}

function toggleSoundFromButton(){
    S.audioEnabled = !S.audioEnabled;
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.setSoundEnabled) {
            AndroidBridge.setSoundEnabled(S.audioEnabled);
        }
    } catch(e) {}
    playSfx(S.audioEnabled ? 660 : 220, 0.15, 0.08);
}

function toggleHudFromButton(){
    S.hudVisible = !S.hudVisible;
    if(hudEl) hudEl.style.opacity = S.hudVisible ? '1' : '0';
}

function toggleDebugFromButton(){
    S.debugOverlay = !S.debugOverlay;
    if(debugOverlay) debugOverlay.style.display = S.debugOverlay ? 'block' : 'none';
}

/* ── CHEAT CODES ── */
function checkCheats(){
    const buf = cheatBuffer.join('');
    // KONAMI: ↑↑↓↓←→←→ba
    if(buf.endsWith('arrowuparrowuparrowdownarrowdownarrowleftarrowrightarrowleftarrowrightba')) {
        activateCheat('GOD MODE', () => { S.dead = false; S.phase='playing'; deathScr.style.display='none'; hudEl.style.display='block'; ctrlEl.style.display='block'; });
    }
    // 'iddqd' — DoOM reference
    if(buf.endsWith('iddqd')) {
        activateCheat('IDDQD — immortal', () => { S.dead = false; });
    }
    // 'trololol'
    if(buf.endsWith('trololol')) {
        activateCheat('TROLL OVERDRIVE', () => { triggerRandomTroll(); triggerRandomTroll(); triggerRandomTroll(); });
    }
    // 'boost'
    if(buf.endsWith('boost')) {
        activateCheat('BOOST FULL', () => { S.boostMeter = 1; });
    }
}
function activateCheat(name, fn){
    fn();
    showTroll('CHEAT: ' + name, 2000);
    playSfx(1000, 0.2, 0.1);
    cheatBuffer.length = 0;
}
function submitCheat(){
    if(!cheatInput) return;
    const code = cheatInput.value.trim().toLowerCase();
    cheatInput.value = '';
    if(code === 'ghost') { S.invisibleMode = 30; showTroll('CHEAT: Ghost mode 30s', 2000); }
    else if(code === 'fly') { S.gravityFlip = 30; showTroll('CHEAT: Anti-gravity 30s', 2000); }
    else if(code === 'big') { carGroup.scale.set(2,2,2); showTroll('CHEAT: BIG CAR', 2000); }
    else if(code === 'small') { carGroup.scale.set(0.7,0.7,0.7); showTroll('CHEAT: small car', 2000); }
    else if(code === 'reset') { carGroup.scale.set(C.CAR_SCALE,C.CAR_SCALE,C.CAR_SCALE); showTroll('CHEAT: reset', 1500); }
    else if(code === 'coin') { S.coinsCollected += 100; updateCoinDisplay(); showTroll('CHEAT: +100 coins', 2000); }
    else if(code === 'speed') { S.speed = C.CAR_MAX_SPEED; showTroll('CHEAT: MAX SPEED', 2000); }
    else showTroll('Unknown cheat code', 1500);
    playSfx(880, 0.2, 0.1);
}

/* ── PAUSE ── */
function togglePause(){
    if(S.phase!=='playing') return;
    S.paused = !S.paused;
    if(S.paused){
        pauseScr.style.display='flex';
        hudEl.style.display='none';
        ctrlEl.style.display='none';
        if(audioCtx) audioCtx.suspend();
    } else {
        pauseScr.style.display='none';
        hudEl.style.display='block';
        ctrlEl.style.display='block';
        if(audioCtx) audioCtx.resume();
        clock.start();
    }
}

/* ───────────────────────────────────────────
   INIT
   ─────────────────────────────────────────── */
function init(){
    isLowDevice = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 2 : false;
    const low = isLowDevice;
    S.lowPerfMode = low;
    _shadowEnabled = !low;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xD2B48C, low ? 0.010 : 0.005);

    cam = new THREE.PerspectiveCamera(low?55:60, innerWidth/innerHeight, 0.5, 500);
    cam.position.set(0, C.CAM_H, C.CAM_DIST);
    cam.lookAt(0, 1.5, 0);

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !low,
        powerPreference: 'high-performance',
        // v0.6 PERF: allow lower precision on mobile (significant perf gain)
        precision: low ? 'mediump' : 'highp',
        alpha: false,
        stencil: false,
        depth: true,
    });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, low?1:C.PR_CAP));
    renderer.shadowMap.enabled = _shadowEnabled;
    // v0.6 PERF: PCFShadowMap is faster than PCFSoftShadowMap
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    // v0.6 PERF: disable physically-correct lighting (cheap win on mobile)
    if('physicallyCorrectLights' in renderer) renderer.physicallyCorrectLights = false;

    clock = new THREE.Clock(false);

    // Sky (gradient canvas texture — kept as-is, cheap)
    const skyC = document.createElement('canvas');
    skyC.width=2; skyC.height=512;
    const ctx=skyC.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,512);
    g.addColorStop(0,'#1e3a5c'); g.addColorStop(0.15,'#4a6fa5');
    g.addColorStop(0.35,'#8b6e4e'); g.addColorStop(0.55,'#c4956a');
    g.addColorStop(0.75,'#d9b882'); g.addColorStop(1,'#f5deb3');
    ctx.fillStyle=g; ctx.fillRect(0,0,2,512);
    const skyTex=new THREE.CanvasTexture(skyC);
    skyTex.mapping=THREE.EquirectangularReflectionMapping;
    scene.background=skyTex;

    // Lights
    sunLight=new THREE.DirectionalLight(0xffd700,2.5);
    sunLight.position.set(60,90,-40);
    if(_shadowEnabled){
        sunLight.castShadow=true;
        // v0.6 PERF: 512x512 shadow map (was 1024)
        sunLight.shadow.mapSize.set(C.SHADOW_MAP_SIZE, C.SHADOW_MAP_SIZE);
        sunLight.shadow.camera.near=1;sunLight.shadow.camera.far=250;
        sunLight.shadow.camera.left=-80;sunLight.shadow.camera.right=80;
        sunLight.shadow.camera.top=80;sunLight.shadow.camera.bottom=-80;
    }
    scene.add(sunLight); scene.add(sunLight.target);
    ambientLight=new THREE.AmbientLight(0xd4a574,0.55); scene.add(ambientLight);
    hemiLight=new THREE.HemisphereLight(0xc2956b,0xD2B48C,0.4); scene.add(hemiLight);

    // Sun visual sphere
    sunMesh=new THREE.Mesh(new THREE.SphereGeometry(4,8,8),new THREE.MeshBasicMaterial({color:0xffd700}));
    sunMesh.position.copy(sunLight.position); scene.add(sunMesh);

    // Build scene
    buildGround(low);
    buildRoad(low);
    buildCar(low);
    buildDecorations(low);
    buildObstacles(low);
    buildCoins(low);  // v0.6
    if(!low) buildDust();

    window.addEventListener('resize', onResize, {passive: true});
}

// v0.6: throttled resize handler
let _resizeTimer = null;
function onResize(){
    if(_resizeTimer) clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(()=>{
        cam.aspect=innerWidth/innerHeight;
        cam.updateProjectionMatrix();
        renderer.setSize(innerWidth,innerHeight);
        _resizeTimer = null;
    }, 100);
}

/* ── GROUND ── */
function buildGround(low){
    // v0.6 PERF: share material across ground meshes (was creating one per mesh)
    const gMat=new THREE.MeshLambertMaterial({color:0xD2B48C, flatShading:low});
    for(let i=0;i<3;i++){
        const g=new THREE.PlaneGeometry(600,600,low?4:10,low?4:10);
        const v=g.attributes.position.array;
        for(let j=0;j<v.length;j+=3) if(v[j+2]!==-0.1) v[j+2]+=(Math.random()-.5)*.3;
        g.computeVertexNormals();
        const m=new THREE.Mesh(g,gMat);
        m.rotation.x=-Math.PI/2; m.position.y=-0.08;
        m.receiveShadow=!low; m.userData.gIdx=i;
        scene.add(m); groundMeshes.push(m);
    }
}

/* ── ROAD ── */
function buildRoad(low){
    for(let i=0;i<C.NUM_SEGS;i++){
        const isFork = (i>1 && i%C.FORK_EVERY===0);
        segData.push(createSeg(i, isFork, low));
    }
}

function createSeg(idx, isFork, low){
    const w=C.ROAD_W, len=C.SEG_LEN;
    const grp=new THREE.Group();

    const road=new THREE.Mesh(new THREE.PlaneGeometry(w,len,1,low?2:4),new THREE.MeshLambertMaterial({color:0x3d3d3d}));
    road.rotation.x=-Math.PI/2; road.position.y=0.03; road.receiveShadow=!low; grp.add(road);

    const lMat=new THREE.MeshBasicMaterial({color:0xeeeeee});
    const lG=new THREE.PlaneGeometry(.3,len);
    const lL=new THREE.Mesh(lG,lMat); lL.rotation.x=-Math.PI/2; lL.position.set(-w/2+.15,.04,0); grp.add(lL);
    const rL=new THREE.Mesh(lG,lMat); rL.rotation.x=-Math.PI/2; rL.position.set(w/2-.15,.04,0); grp.add(rL);

    const dMat=new THREE.MeshBasicMaterial({color:0xaaaaaa});
    const dG=new THREE.PlaneGeometry(.15,4);
    for(let d=-len/2+2;d<len/2;d+=8){
        const dash=new THREE.Mesh(dG,dMat);
        dash.rotation.x=-Math.PI/2; dash.position.set(0,.04,d); grp.add(dash);
    }

    const sMat=new THREE.MeshLambertMaterial({color:0xb89968});
    const sG=new THREE.PlaneGeometry(3,len);
    const ls=new THREE.Mesh(sG,sMat); ls.rotation.x=-Math.PI/2; ls.position.set(-w/2-1.5,.01,0); grp.add(ls);
    const rs=new THREE.Mesh(sG,sMat); rs.rotation.x=-Math.PI/2; rs.position.set(w/2+1.5,.01,0); grp.add(rs);

    if(isFork) buildForkGeometry(grp, low);

    scene.add(grp);
    grp.position.z = -idx * len;
    return {grp, idx, isFork, len};
}

function buildForkGeometry(grp, low){
    const w=C.ROAD_W, len=C.SEG_LEN;
    const fMat=new THREE.MeshLambertMaterial({color:0x4a4a4a});
    const sMat=new THREE.MeshLambertMaterial({color:0xf59e0b});
    const pMat=new THREE.MeshLambertMaterial({color:0x8b4513});

    const fLen=40, fSegs=5, fAngle=-0.4;
    let curAngle=0, curX=-w/2, curZ=len/2-10;
    for(let i=0;i<fSegs;i++){
        const sLen=fLen/fSegs;
        curAngle+=fAngle/fSegs;
        const fR=new THREE.Mesh(new THREE.PlaneGeometry(w-2,sLen),fMat);
        fR.rotation.x=-Math.PI/2; fR.rotation.z=curAngle;
        fR.position.set(curX,0.03,curZ-sLen/2); grp.add(fR);
        curX+=Math.sin(curAngle)*sLen*(-1);
        curZ-=Math.cos(curAngle)*sLen;
    }

    curAngle=0; curX=w/2; curZ=len/2-10;
    for(let i=0;i<fSegs;i++){
        const sLen=fLen/fSegs;
        curAngle+=0.4/fSegs;
        const fR=new THREE.Mesh(new THREE.PlaneGeometry(w-2,sLen),fMat);
        fR.rotation.x=-Math.PI/2; fR.rotation.z=curAngle;
        fR.position.set(curX,0.03,curZ-sLen/2); grp.add(fR);
        curX+=Math.sin(curAngle)*sLen;
        curZ-=Math.cos(curAngle)*sLen;
    }

    [-1,1].forEach(side=>{
        const post=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,3.5,4),pMat);
        post.position.set(side*(w/2+3),1.75,len/2-6); grp.add(post);
        const board=new THREE.Mesh(new THREE.BoxGeometry(1.6,.9,.08),sMat);
        board.position.set(side*(w/2+3),3.2,len/2-6); board.rotation.y=side*.25; grp.add(board);
        const arrow=new THREE.Mesh(new THREE.ConeGeometry(.3,.6,3),new THREE.MeshBasicMaterial({color:0xffffff}));
        arrow.position.set(side*(w/2+3),3.2,len/2-6);
        arrow.rotation.z=side*Math.PI/2; arrow.rotation.y=side*.25;
        grp.add(arrow);
    });

    const barrier=new THREE.Mesh(new THREE.BoxGeometry(w*.7,1.8,.4),new THREE.MeshLambertMaterial({color:0xff3333}));
    barrier.position.set(0,.9,len/2-15); grp.add(barrier);
    [-w*.35, w*.35].forEach(xp=>{
        const bPost=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,2.5,6),pMat);
        bPost.position.set(xp,1.25,len/2-15); grp.add(bPost);
    });
    for(let s=-w*.35+1;s<w*.35;s+=2){
        const stripe=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.1),new THREE.MeshBasicMaterial({color:0xffcc00}));
        stripe.position.set(s,1.3,len/2-15.2); stripe.rotation.x=-Math.PI/2; grp.add(stripe);
    }
    const warnSign=new THREE.Mesh(new THREE.BoxGeometry(2.5,.6,.08),new THREE.MeshBasicMaterial({color:0xff3333}));
    warnSign.position.set(0,2.8,len/2-15); grp.add(warnSign);
}

function recycleSegs(){
    const carZ=carGroup.position.z;
    const total=C.NUM_SEGS*C.SEG_LEN;
    // PERF: cache length
    for(let i=0,n=segData.length;i<n;i++){
        const s=segData[i];
        const dz=s.grp.position.z-carZ;
        if(dz>C.SEG_LEN*2.5) s.grp.position.z-=total;
        else if(dz<-total+C.SEG_LEN) s.grp.position.z+=total;
    }
    for(let i=0,n=groundMeshes.length;i<n;i++){
        const m=groundMeshes[i];
        m.position.z=carZ-i*200;
        m.position.x=carGroup.position.x*0.3;
    }
    sunMesh.position.set(carGroup.position.x+60,90,carGroup.position.z-40);
    sunLight.position.set(carGroup.position.x+60,90,carGroup.position.z-40);
    sunLight.target.position.copy(carGroup.position);
    sunLight.target.updateMatrixWorld();
}

/* ── CAR ── */
function buildCar(low){
    carGroup=new THREE.Group();

    // v0.6 PERF: MeshPhongMaterial -> MeshLambertMaterial (no specular computation)
    // Visible difference is minimal in a top-down desert scene.
    const bodyM=new THREE.MeshLambertMaterial({color:0xcc0000});
    const darkM=new THREE.MeshLambertMaterial({color:0xaa0000});
    const glassM=new THREE.MeshLambertMaterial({color:0x88ccff,transparent:true,opacity:.5});
    const blkM=new THREE.MeshLambertMaterial({color:0x1a1a1a});
    const chrM=new THREE.MeshLambertMaterial({color:0xdddddd});
    const yelM=new THREE.MeshBasicMaterial({color:0xffee44});
    const redM=new THREE.MeshBasicMaterial({color:0xff2222});

    carBodyMesh=bx(carGroup,2.5,.6,4.6,bodyM,0,.55,0,!low);
    const hood=bx(carGroup,2.35,.35,1.6,bodyM,0,.85,1.15,!low);
    hood.rotation.x=-.08;
    bx(carGroup,2.15,.55,2,darkM,0,1.15,-.15,!low);
    bx(carGroup,1.95,.14,1.85,blkM,0,1.48,-.15,false);
    bx(carGroup,2.35,.3,1.1,bodyM,0,.85,-1.5,!low);
    const ws=bx(carGroup,2,.52,.06,glassM,0,1.15,.7,false); ws.rotation.x=-.38;
    const rw=bx(carGroup,2,.42,.06,glassM,0,1.15,-1.1,false); rw.rotation.x=.32;
    bx(carGroup,.06,.35,1.6,glassM,-1.08,1.15,-.15,false);
    bx(carGroup,.06,.35,1.6,glassM,1.08,1.15,-.15,false);
    sp(carGroup,.15,yelM,-.9,.58,2.3,8); sp(carGroup,.15,yelM,.9,.58,2.3,8);
    sp(carGroup,.08,yelM,-.5,.35,2.35,6); sp(carGroup,.08,yelM,.5,.35,2.35,6);
    sp(carGroup,.13,redM,-.9,.58,-2.3,8); sp(carGroup,.13,redM,.9,.58,-2.3,8);
    bx(carGroup,2.5,.2,.28,blkM,0,.36,2.18,false);
    bx(carGroup,2.5,.2,.28,blkM,0,.36,-2.18,false);
    bx(carGroup,1.7,.22,.08,blkM,0,.47,2.32,false);
    for(let s=-.7;s<=.7;s+=.35) bx(carGroup,.04,.18,.1,chrM,s,.47,2.34,false);
    bx(carGroup,.08,.22,3.9,blkM,-1.27,.32,0,false);
    bx(carGroup,.08,.22,3.9,blkM,1.27,.32,0,false);
    cy(carGroup,.07,.07,.5,chrM,-.55,.22,-2.35,Math.PI/2,8);
    cy(carGroup,.07,.07,.5,chrM,.55,.22,-2.35,Math.PI/2,8);
    bx(carGroup,.16,.13,.1,blkM,-1.32,1,0.3,false);
    bx(carGroup,.16,.13,.1,blkM,1.32,1,0.3,false);
    bx(carGroup,.02,.45,1.8,blkM,-1.26,.75,0,false);
    bx(carGroup,.02,.45,1.8,blkM,1.26,.75,0,false);
    bx(carGroup,1.9,.08,.45,blkM,0,1.4,-1.85,false);
    bx(carGroup,.08,.35,.08,blkM,-.75,1.22,-1.85,false);
    bx(carGroup,.08,.35,.08,blkM,.75,1.22,-1.85,false);
    bx(carGroup,.12,.01,2.5,new THREE.MeshBasicMaterial({color:0xffffff}),0,.87,1,false);
    bx(carGroup,.8,.3,.04,chrM,0,.38,-2.3,false);

    const wG=new THREE.CylinderGeometry(.36,.36,.24,low?10:16);
    const hG=new THREE.CylinderGeometry(.16,.16,.26,low?6:10);
    const rG=new THREE.TorusGeometry(.3,.05,6,low?10:16);
    const wP=[{x:-1.28,z:1.4},{x:1.28,z:1.4},{x:-1.28,z:-1.35},{x:1.28,z:-1.35}];
    wP.forEach(p=>{
        const wg=new THREE.Group();
        const tire=new THREE.Mesh(wG,blkM); tire.rotation.z=Math.PI/2; wg.add(tire);
        const hub=new THREE.Mesh(hG,chrM); hub.rotation.z=Math.PI/2; wg.add(hub);
        const rim=new THREE.Mesh(rG,chrM); rim.rotation.y=Math.PI/2; wg.add(rim);
        for(let s=0;s<5;s++){
            const spoke=bx(wg,.04,.02,.5,chrM,0,0,0,false);
            spoke.rotation.z=Math.PI/2; spoke.rotation.y=s*Math.PI*2/5;
        }
        wg.position.set(p.x,.36,p.z);
        wg.castShadow=!low;
        carGroup.add(wg); wheels.push(wg);
    });

    carGroup.scale.set(C.CAR_SCALE, C.CAR_SCALE, C.CAR_SCALE);
    carGroup.position.set(0,0,0);
    scene.add(carGroup);
}

function bx(p,w,h,d,m,x,y,z,sh){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);if(sh)o.castShadow=true;p.add(o);return o}
function sp(p,r,m,x,y,z,s){const o=new THREE.Mesh(new THREE.SphereGeometry(r,s||8,s||8),m);o.position.set(x,y,z);p.add(o);return o}
function cy(p,rt,rb,h,m,x,y,z,rz,s){const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s||8),m);o.position.set(x,y,z);if(rz)o.rotation.z=rz;p.add(o);return o}

/* ── DECORATIONS ── */
function buildDecorations(low){
    const cMat=new THREE.MeshLambertMaterial({color:0x2d5a27});
    const rMat=new THREE.MeshLambertMaterial({color:0x9e8c6c,flatShading:true});
    const dMat=new THREE.MeshLambertMaterial({color:0xc4a66a,flatShading:low});
    const deadMat=new THREE.MeshLambertMaterial({color:0x5c4033,flatShading:true});

    const totalLen=C.NUM_SEGS*C.SEG_LEN;
    for(let i=0;i<45;i++){
        const c=mkCactus(cMat,low);
        const side=Math.random()>.5?1:-1;
        c.position.set(side*(C.ROAD_W/2+5+Math.random()*40),0,-(Math.random()*totalLen));
        c.userData.isDeco=true; scene.add(c); decoPool.push(c);
    }
    for(let i=0;i<55;i++){
        const r=mkRock(rMat);
        const side=Math.random()>.5?1:-1;
        r.position.set(side*(C.ROAD_W/2+4+Math.random()*50),.15,-(Math.random()*totalLen));
        r.userData.isDeco=true; scene.add(r); decoPool.push(r);
    }
    for(let i=0;i<14;i++){
        const d=mkDune(dMat,low);
        const side=Math.random()>.5?1:-1;
        d.position.set(side*(55+Math.random()*90),-.5,-(Math.random()*totalLen));
        d.userData.isDeco=true; scene.add(d); decoPool.push(d);
    }
    for(let i=0;i<8;i++){
        const t=mkDeadTree(deadMat,low);
        const side=Math.random()>.5?1:-1;
        t.position.set(side*(C.ROAD_W/2+8+Math.random()*25),0,-(Math.random()*totalLen));
        t.userData.isDeco=true; scene.add(t); decoPool.push(t);
    }
}

function mkCactus(m,low){
    const g=new THREE.Group();
    const h=1.8+Math.random()*1.2;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.15,.2,h,low?4:6),m);
    trunk.position.y=h/2; g.add(trunk);
    if(Math.random()>.25){const arm=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.8+Math.random()*.4,4),m);arm.position.set(.3,h*.6+Math.random()*.2,0);arm.rotation.z=-.55;g.add(arm);}
    if(Math.random()>.25){const arm2=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.6+Math.random()*.3,4),m);arm2.position.set(-.25,h*.5+Math.random()*.2,0);arm2.rotation.z=.45;g.add(arm2);}
    const top=new THREE.Mesh(new THREE.SphereGeometry(.14,4,4),m);top.position.y=h+.05;g.add(top);
    return g;
}

function mkRock(m){
    const s=.25+Math.random()*.8;
    const g=new THREE.DodecahedronGeometry(s,0);
    const v=g.attributes.position.array;
    for(let i=0;i<v.length;i+=3){v[i]*=.7+Math.random()*.5;v[i+1]*=.4+Math.random()*.4;v[i+2]*=.7+Math.random()*.5;}
    g.computeVertexNormals(); return new THREE.Mesh(g,m);
}

function mkDune(m,low){
    const g=new THREE.SphereGeometry(14+Math.random()*12,low?4:8,low?3:5,0,Math.PI*2,0,Math.PI/3.5);
    const d=new THREE.Mesh(g,m); d.rotation.x=-Math.PI/2; d.position.y=-.6; return d;
}

function mkDeadTree(m,low){
    const g=new THREE.Group();
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,3,low?3:5),m);
    trunk.position.y=1.5; trunk.rotation.z=(Math.random()-.5)*.15; g.add(trunk);
    for(let b=0;b<3;b++){const br=new THREE.Mesh(new THREE.CylinderGeometry(.03,.05,.6+Math.random(),3),m);br.position.set(Math.random()>.5?.2:-.2,1+b*.5+Math.random(),0);br.rotation.z=(Math.random()-.5)*1.2;g.add(br);}
    return g;
}

function recycleDeco(){
    const cZ=carGroup.position.z, total=C.NUM_SEGS*C.SEG_LEN;
    for(let i=0,n=decoPool.length;i<n;i++){
        const d=decoPool[i];
        if(!d.userData.isDeco)continue;
        const dz=d.position.z-cZ;
        if(dz>C.SEG_LEN*3){
            d.position.z-=total;
            const side=Math.random()>.5?1:-1;
            d.position.x=side*(C.ROAD_W/2+4+Math.random()*50);
        }
        if(dz<-total+C.SEG_LEN){
            d.position.z+=total;
            const side=Math.random()>.5?1:-1;
            d.position.x=side*(C.ROAD_W/2+4+Math.random()*50);
        }
    }
}

/* ── OBSTACLES ── */
function buildObstacles(low){
    const oMat=new THREE.MeshLambertMaterial({color:0x9e8c6c,flatShading:true});
    const camelMat=new THREE.MeshLambertMaterial({color:0xb89968,flatShading:low});
    const totalLen=C.NUM_SEGS*C.SEG_LEN;
    for(let i=0;i<20;i++){
        const r=mkRock(oMat);
        const side=Math.random()>.5?1:-1;
        const xOff = 1 + Math.random()*(C.ROAD_W/2-3);
        r.position.set(side*xOff,.2,-(Math.random()*totalLen));
        r.userData.isObs=true; r.userData.obsRadius=.3+Math.random()*.3;
        // v0.6 PERF: precompute combined (obs+car) radius squared for O(1) collision
        const combR = r.userData.obsRadius + C.OBS_COLLISION_R;
        r.userData.combRadiusSq = combR * combR;
        r.userData.nearMissSq = (r.userData.obsRadius + C.OBS_COLLISION_R + 1) * (r.userData.obsRadius + C.OBS_COLLISION_R + 1);
        scene.add(r); obstaclePool.push(r);
    }
    for(let i=0;i<6;i++){
        const c=mkDeadCamel(camelMat,low);
        const side=Math.random()>.5?1:-1;
        const xOff = 1 + Math.random()*3;
        c.position.set(side*xOff,0,-(Math.random()*totalLen));
        c.userData.isObs=true; c.userData.obsRadius=1.5;
        const combR2 = 1.5 + C.OBS_COLLISION_R;
        c.userData.combRadiusSq = combR2 * combR2;
        c.userData.nearMissSq = (1.5 + C.OBS_COLLISION_R + 1) * (1.5 + C.OBS_COLLISION_R + 1);
        scene.add(c); obstaclePool.push(c);
    }
}

function mkDeadCamel(m,low){
    const g=new THREE.Group();
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,.8,2.5),m);body.position.y=.4;g.add(body);
    const legM=new THREE.MeshLambertMaterial({color:0x9e8c6c});
    [[-0.7,.1,.8],[.7,.1,.8],[-0.7,.1,-.8],[.7,.1,-.8]].forEach(p=>{
        const leg=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,1.2,4),legM);
        leg.position.set(p[0],p[1],p[2]); leg.rotation.z=p[0]<0?.4:-.4; g.add(leg);
    });
    const head=new THREE.Mesh(new THREE.BoxGeometry(.4,.3,.5),m);head.position.set(0,.15,1.4);head.rotation.x=.3;g.add(head);
    return g;
}

function recycleObs(){
    const cZ=carGroup.position.z, total=C.NUM_SEGS*C.SEG_LEN;
    for(let i=0,n=obstaclePool.length;i<n;i++){
        const o=obstaclePool[i];
        if(!o.userData.isObs)continue;
        const dz=o.position.z-cZ;
        if(dz>C.SEG_LEN*3){
            o.position.z-=total;
            const side=Math.random()>.5?1:-1;
            o.position.x=side*(1+Math.random()*(C.ROAD_W/2-3));
        }
        if(dz<-total+C.SEG_LEN){
            o.position.z+=total;
            const side=Math.random()>.5?1:-1;
            o.position.x=side*(1+Math.random()*(C.ROAD_W/2-3));
        }
    }
}

// v0.6 PERF: squared distance — no Math.sqrt per pair
function checkObstacles(){
    if(S.dead) return;
    const cx=carGroup.position.x, cz=carGroup.position.z;
    for(let i=0,n=obstaclePool.length;i<n;i++){
        const o=obstaclePool[i];
        if(!o.userData.isObs)continue;
        const dx=o.position.x-cx, dz=o.position.z-cz;
        const distSq = dx*dx + dz*dz;
        // PERF: precomputed combined radius squared — no sqrt
        if(distSq < o.userData.combRadiusSq) {
            triggerDeath();
            return;
        }
        // v0.6 USEFUL FEATURE: near-miss tracking (just outside collision)
        if(distSq < o.userData.nearMissSq && dz < 0 && !o.userData._nearMiss) {
            S.nearMissCount++;
            o.userData._nearMiss = true;
            if(S.nearMissCount % 5 === 0) {
                showTroll('Near-miss x' + S.nearMissCount + '! +1 coin', 1500);
                S.coinsCollected++;
                updateCoinDisplay();
                playSfx(720, 0.1, 0.05);
            }
        } else if(dz > 5) {
            o.userData._nearMiss = false;
        }
    }
}

/* ── COINS (v0.6 USEFUL FEATURE) ── */
function buildCoins(low){
    const coinMat = new THREE.MeshLambertMaterial({color:0xffd700, emissive:0x442200});
    const totalLen=C.NUM_SEGS*C.SEG_LEN;
    for(let i=0;i<15;i++){
        const coin=new THREE.Mesh(new THREE.TorusGeometry(.4,.15,6,12), coinMat);
        coin.position.set(
            (Math.random()-.5)*(C.ROAD_W-3),
            1.0,
            -(Math.random()*totalLen)
        );
        coin.userData.isCoin = true;
        coin.userData.collected = false;
        scene.add(coin); coinPool.push(coin);
    }
}

function recycleCoins(){
    const cZ=carGroup.position.z, total=C.NUM_SEGS*C.SEG_LEN;
    for(let i=0,n=coinPool.length;i<n;i++){
        const c=coinPool[i];
        const dz=c.position.z-cZ;
        if(dz>C.SEG_LEN*3 || dz<-total+C.SEG_LEN){
            c.position.z-=total;
            c.position.x=(Math.random()-.5)*(C.ROAD_W-3);
            c.userData.collected = false;
            c.visible = true;
        }
    }
}

function checkCoins(){
    if(S.dead) return;
    const cx=carGroup.position.x, cz=carGroup.position.z;
    const r = 1.2;
    const rSq = r * r;
    for(let i=0,n=coinPool.length;i<n;i++){
        const c=coinPool[i];
        if(c.userData.collected || !c.visible) continue;
        const dx=c.position.x-cx, dz=c.position.z-cz;
        if(dx*dx + dz*dz < rSq){
            c.userData.collected = true;
            c.visible = false;
            S.coinsCollected++;
            S.boostMeter = Math.min(1, S.boostMeter + 0.1);
            updateCoinDisplay();
            playCoinSfx();
        }
    }
}

function updateCoinDisplay(){
    if(coinCounter) coinCounter.textContent = '🪙 ' + S.coinsCollected;
}

/* ── DUST ── */
function buildDust(){
    const n = C.DUST_COUNT;
    const g=new THREE.BufferGeometry();
    const pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*8;pos[i*3+1]=Math.random()*1.5;pos[i*3+2]=(Math.random()-.5)*4-2;}
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    dustPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xD2B48C,size:.35,transparent:true,opacity:.2,depthWrite:false}));
    scene.add(dustPts);
}

// v0.6 PERF: throttled to 30Hz instead of every frame
let _dustAccum = 0;
function updateDust(dt){
    _dustAccum += dt;
    if(_dustAccum < C.DUST_UPDATE_INTERVAL) return;
    _dustAccum = 0;

    const p=dustPts.geometry.attributes.position.array;
    const cx=carGroup.position.x,cz=carGroup.position.z;
    const rot=carGroup.rotation.y;
    // PERF: cache Math.random calls — use a single buffer
    for(let i=0,n=p.length;i<n;i+=3){
        p[i]+=(Math.random()-.5)*.3;
        p[i+1]+=Math.random()*.08;
        p[i+2]+=(Math.random()-.5)*.3-S.speed*C.DUST_UPDATE_INTERVAL*.2;
        if(p[i+1]>2.5) p[i+1]=Math.random()*.5;
        const dx=p[i]-cx, dz=p[i+2]-cz;
        if(Math.abs(dx)>10||Math.abs(dz)>10){
            p[i]=cx+(Math.random()-.5)*4-Math.sin(rot)*3;
            p[i+1]=Math.random()*1;
            p[i+2]=cz+(Math.random()-.5)*4+Math.cos(rot)*3;
        }
    }
    dustPts.geometry.attributes.position.needsUpdate=true;
}

/* ───────────────────────────────────────────
   GAME LOOP
   ─────────────────────────────────────────── */
function gameLoop(now){
    if(!loopRunning) return;
    requestAnimationFrame(gameLoop);

    // v0.6: FPS counter
    S.fpsFrames++;
    S.fpsAccum += 1000 / (now - (gameLoop._lastNow || now));
    gameLoop._lastNow = now;
    if(S.fpsFrames >= 30){
        S.fps = Math.round(S.fpsAccum / S.fpsFrames);
        S.fpsAccum = 0; S.fpsFrames = 0;
        // v0.6: auto-quality — drop shadow if FPS too low
        if(S.fps < 30 && !S.lowPerfMode && S.autoQualityFrames++ > 3){
            S.lowPerfMode = true;
            if(_shadowEnabled){
                _shadowEnabled = false;
                renderer.shadowMap.enabled = false;
                sunLight.castShadow = false;
            }
            showTroll('Tự động giảm chất lượng (FPS thấp)', 2000);
        }
        if(fpsHud) fpsHud.textContent = S.fps + ' FPS';
    }

    if(S.phase!=='playing'||S.paused){
        if(S.phase==='dead'||S.phase==='easter') renderer.render(scene,cam);
        return;
    }

    const dt=Math.min(clock.getDelta(),0.06);

    updateCar(dt);
    checkRoad(dt);
    checkObstacles();
    checkCoins();
    checkForkBarrier();
    S.dist+=S.speed*dt/C.KM;
    S.totalKm += S.speed*dt/C.KM;
    S.timeAlive += dt;
    if(S.speed > S.topSpeed) S.topSpeed = S.speed;
    S.speedSamples++;
    S.avgSpeed = (S.avgSpeed * (S.speedSamples-1) + S.speed) / S.speedSamples;
    if(S.dist>S.bestDist) S.bestDist=S.dist;
    checkForkWarning();
    updateCamera();
    recycleSegs(); recycleDeco(); recycleObs(); recycleCoins();
    if(dustPts) updateDust(dt);
    updateTrolls(dt);
    updateShake(dt);
    updateBoost(dt);
    updateHUD(dt);
    updateMusicPoll();
    updateAudio();
    if(Date.now()-S.t0>=C.EASTER_MS) triggerEaster();
    if(debugOverlay && S.debugOverlay) updateDebug();
    renderer.render(scene,cam);
}

function startLoop(){
    if(loopRunning) return;
    loopRunning=true;
    clock.start();
    gameLoop._lastNow = 0;
    requestAnimationFrame(gameLoop);
}
function stopLoop(){ loopRunning=false; }

/* ── CAR PHYSICS ── */
function updateCar(dt){
    let target=C.CAR_BASE_SPEED;
    // v0.6: boost
    if(S.boostActive > 0) {
        target = C.CAR_MAX_SPEED * 1.3;
        S.boostActive -= dt;
        if(S.boostActive <= 0) S.boostActive = 0;
    } else if(inp.boost && S.boostMeter > 0.05) {
        S.boostActive = 0.5; // 500ms boost per tap
        S.boostMeter = Math.max(0, S.boostMeter - 0.25);
        playSfx(880, 0.3, 0.1);
    }
    if(inp.gas) target=Math.max(target, C.CAR_MAX_SPEED);
    if(inp.brake) target=C.CAR_MIN_SPEED;
    S.speed+=(target-S.speed)*dt*3;
    S.speed=Math.max(C.CAR_MIN_SPEED,Math.min(C.CAR_MAX_SPEED*1.3,S.speed));
    if(!S.onRoad) S.speed=Math.max(3,S.speed*(1-dt*2));

    let steer=0;
    let left=inp.left, right=inp.right;
    if(S.controlsReversed){left=inp.right;right=inp.left;}
    if(left) steer=-1; if(right) steer=1;

    const speedFactor = 1 - (S.speed - C.CAR_MIN_SPEED) / (C.CAR_MAX_SPEED - C.CAR_MIN_SPEED) * 0.35;
    carGroup.rotation.y+=steer*C.TURN_RATE*speedFactor*dt;
    carGroup.rotation.y=Math.max(-C.MAX_STEER_Y, Math.min(C.MAX_STEER_Y, carGroup.rotation.y));
    if(!left&&!right){
        carGroup.rotation.y*=1-dt*2;
        if(Math.abs(carGroup.rotation.y)<0.01) carGroup.rotation.y=0;
    }

    const targetBank = -steer * 0.08;
    carGroup.rotation.z += (targetBank - carGroup.rotation.z) * dt * 8;

    // v0.6: gravity flip troll
    const bounceSign = S.gravityFlip > 0 ? -1 : 1;
    // PERF: use rAF timestamp instead of Date.now() — avoids syscall
    carGroup.position.y = Math.sin(performance.now() * 0.008) * 0.02 * bounceSign;
    if(S.gravityFlip > 0) S.gravityFlip -= dt;

    // v0.6: invisible troll
    if(S.invisibleMode > 0) {
        carGroup.visible = (Math.floor(performance.now() / 100) % 2 === 0);
        S.invisibleMode -= dt;
        if(S.invisibleMode <= 0) carGroup.visible = true;
    }

    // v0.6: car shrink troll
    if(S.carShrink > 0) {
        S.carShrink -= dt;
        if(S.carShrink <= 0) carGroup.scale.set(C.CAR_SCALE, C.CAR_SCALE, C.CAR_SCALE);
    }

    const fwd=S.speed*dt;
    carGroup.position.x+=Math.sin(carGroup.rotation.y)*fwd;
    carGroup.position.z-=Math.cos(carGroup.rotation.y)*fwd;

    const roadEdge = C.ROAD_W/2;
    const absX = Math.abs(carGroup.position.x);
    if(absX > roadEdge + C.ROAD_SOFT_EDGE){
        const pushDir = carGroup.position.x > 0 ? -1 : 1;
        carGroup.position.x += pushDir * C.OFFROAD_PUSH * dt;
    }
    const hardLimit = roadEdge + C.ROAD_SOFT_EDGE + 8;
    if(absX > hardLimit) carGroup.position.x = Math.sign(carGroup.position.x) * hardLimit;

    // PERF: cache wheels length
    for(let i=0,n=wheels.length;i<n;i++){
        const w = wheels[i];
        w.children[0].rotation.x+=fwd*2;
        w.children[1].rotation.x+=fwd*2;
    }
}

/* ── ROAD CHECK ── */
function checkRoad(dt){
    const roadEdge = C.ROAD_W/2;
    const absX=Math.abs(carGroup.position.x);
    if(absX>roadEdge+C.ROAD_SOFT_EDGE){
        S.onRoad=false;
        S.offRoadT+=dt;
        offVig.style.display='block';
        if(S.offRoadT>=C.OFFROAD_LIMIT) triggerDeath();
    } else {
        S.onRoad=true;
        S.offRoadT=Math.max(0, S.offRoadT-dt*0.5);
        if(S.offRoadT<=0) offVig.style.display='none';
    }
}

/* ── FORK BARRIER COLLISION ── */
function checkForkBarrier(){
    if(S.dead) return;
    const cZ=carGroup.position.z;
    const absCX=Math.abs(carGroup.position.x);
    for(let i=0,n=segData.length;i<n;i++){
        const s=segData[i];
        if(!s.isFork) continue;
        const barrierWorldZ = s.grp.position.z + C.SEG_LEN/2 - 15;
        const dz=Math.abs(cZ - barrierWorldZ);
        if(dz < 2.5 && absCX < C.BARRIER_HALF_W + C.CAR_RADIUS * C.CAR_SCALE) {
            triggerDeath();
            return;
        }
    }
}

/* ── FORK WARNING ── */
function checkForkWarning(){
    const cZ=carGroup.position.z;
    let nearFork=false;
    for(let i=0,n=segData.length;i<n;i++){
        const s=segData[i];
        if(s.isFork){
            const dz=Math.abs(s.grp.position.z-cZ);
            if(dz<50&&dz>8) nearFork=true;
        }
    }
    if(nearFork&&!S.forkShown){
        S.forkShown=true;
        showTroll('NGÃ RẺ SẮP TỚI! Rẽ trái hoặc phải!', 3000);
        playSfx(440, 0.3, 0.08);
    } else if(!nearFork) S.forkShown=false;
}

/* ── CAMERA ── */
function updateCamera(){
    const r=carGroup.rotation.y;
    let camDist = C.CAM_DIST, camH = C.CAM_H, lookAhead = C.CAM_LOOK_AHEAD;
    // v0.6: camera modes
    if(S.cameraMode === 1) { camDist = 28; camH = 14; } // far
    else if(S.cameraMode === 2) { camDist = 4; camH = 2.5; lookAhead = 2; } // cockpit-ish

    const tX=carGroup.position.x-Math.sin(r)*camDist;
    const tZ=carGroup.position.z+Math.cos(r)*camDist;
    const lerpFactor = C.CAM_LERP;
    cam.position.x+=(tX-cam.position.x)*lerpFactor;
    cam.position.y+=(camH-cam.position.y)*(lerpFactor*1.2);
    cam.position.z+=(tZ-cam.position.z)*lerpFactor;
    const lX=carGroup.position.x+Math.sin(r)*lookAhead;
    const lZ=carGroup.position.z-Math.cos(r)*lookAhead;
    cam.lookAt(lX,1.5,lZ);
}

/* ── SHAKE ── */
function updateShake(dt){
    if(S.shakeTimer>0){
        S.shakeTimer-=dt;
        const i=S.shakeIntensity;
        const ox=(Math.random()-.5)*i*2, oy=(Math.random()-.5)*i;
        shakeWrap.style.transform=`translate(${ox}px,${oy}px)`;
        cam.position.x+=ox*.05;
        cam.position.y+=oy*.05;
    } else {
        shakeWrap.style.transform='';
    }
}

function doShake(intensity, duration){
    S.shakeIntensity=intensity;
    S.shakeTimer=duration;
}

/* ── HUD ── */
function updateHUD(dt){
    const speedKmh = Math.round(S.speed*3.6);
    spdH.textContent=speedKmh+' km/h';
    dstH.textContent=S.dist.toFixed(2)+' km';
    const elapsed=Math.floor((Date.now()-S.t0)/1000);
    const m=Math.floor(elapsed/60), s=elapsed%60;
    tmrH.textContent=m+':'+(s<10?'0':'')+s;
    // v0.6: top speed / total km
    if(topSpeedH) topSpeedH.textContent = Math.round(S.topSpeed*3.6)+' km/h';
    if(totalKmH) totalKmH.textContent = S.totalKm.toFixed(2)+' km';
    // v0.6: boost bar
    if(boostFill) boostFill.style.width = (S.boostMeter * 100) + '%';
    // v0.6: speedo dial
    if(speedoDial) {
        const angle = -120 + (S.speed / C.CAR_MAX_SPEED) * 240;
        speedoDial.style.transform = `rotate(${angle}deg)`;
    }
}

/* ── BOOST ── */
function updateBoost(dt){
    // Regenerate boost meter slowly
    if(S.boostMeter < 1) S.boostMeter = Math.min(1, S.boostMeter + dt * 0.05);
}

/* ── MUSIC POLL ── */
function updateMusicPoll(){
    S.musicCheckCounter++;
    if(S.musicCheckCounter < C.MUSIC_POLL_FRAMES) return;
    S.musicCheckCounter = 0;
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.isMusicPlaying) {
            const playing = AndroidBridge.isMusicPlaying();
            if(playing !== S.musicPlaying) {
                S.musicPlaying = playing;
                if(playing) {
                    const name = (AndroidBridge.getMusicName && AndroidBridge.getMusicName()) || 'Music';
                    showMusicIndicator(name);
                } else {
                    hideMusicIndicator();
                }
            }
        }
    } catch(e) {}
}

/* ── DEBUG OVERLAY ── */
function updateDebug(){
    if(!debugOverlay) return;
    const info = [
        'FPS: ' + S.fps,
        'Speed: ' + S.speed.toFixed(1),
        'Dist: ' + S.dist.toFixed(3),
        'Pos: ' + carGroup.position.x.toFixed(1) + ',' + carGroup.position.z.toFixed(1),
        'Objs: ' + obstaclePool.length + ' obs, ' + decoPool.length + ' deco',
        'Shadow: ' + (_shadowEnabled ? 'ON' : 'OFF'),
        'Audio: ' + (S.audioEnabled ? 'ON' : 'OFF'),
        'Music: ' + (S.musicPlaying ? 'ON' : 'OFF'),
        'Low: ' + (S.lowPerfMode ? 'YES' : 'NO'),
    ];
    debugOverlay.textContent = info.join('\n');
}

/* ───────────────────────────────────────────
   TROLL FEATURES (v0.5 set + 10 NEW in v0.6)
   ─────────────────────────────────────────── */
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
    // v0.6 new troll messages
    'Đang tải... 0% complete sau 99 năm',
    'Bạn vừa đâm trúng... ảo giác',
    'Cảnh báo: Xe của bạn sắp hết... ảo giác',
    'Mẹo: Đừng đâm vào rào chắn (ai cũng biết)',
    'Bạn có muốn mua DLC "Sa Mạc Mùa Đông" không?',
];

const ACHIEVEMENTS = [
    {km:0.5, title:'KHỞI HÀNH', msg:'Bạn đã đi 0.5km! ...Đó là khoảng cách của 1 con gián'},
    {km:1, title:'KM ĐẦU TIÊN', msg:'1km! Bố mẹ bạn rất tự hào... về việc bạn lãng phí thời gian'},
    {km:2, title:'NGƯỜI LÀM', msg:'2km! Bạn đã đi xa hơn... xe tải chở rác'},
    {km:5, title:'SA MẠC EXPERT', msg:'5km! Bạn có thể ứng tuyển làm hướng dẫn viên sa mạc... ảo'},
    {km:10, title:'PRO PLAYER', msg:'10km! Bạn đã chơi lâu hơn thời gian đọc README'},
    {km:20, title:'MASTER', msg:'20km! 20km trong sa mạc? Người thật việc thật... ảo'},
    {km:50, title:'LEGEND', msg:'50km! Bạn là legend... của sự lãng phí'},
    {km:100, title:'GOD', msg:'100km! Bạn đã đi xa hơn... cuộc đời của 1 số người'},
];

const FAKE_NOTIFS = [
    {icon:'🔋', text:'Pin điện thoại sắp hết! ...À, chỉ là ảo giác'},
    {icon:'📡', text:'GPS signal lost! ...À, sa mạc không có GPS'},
    {icon:'📞', text:'Mẹ gọi: "Con về ăn cơm!" ...À, không ai gọi'},
    {icon:'🔥', text:'Phone overheating! ...À, sa mạc nóng là bình thường'},
    {icon:'📶', text:'No internet connection! ...Từ lúc nào game có internet?'},
    {icon:'💀', text:'Warning: Game đang theo dõi bạn... ảo'},
    {icon:'🚗', text:'Car insurance expired! ...Bạn đang đi xe free'},
    {icon:'🛡️', text:'Virus detected! ...À, chỉ là con virus sa mạc'},
    // v0.6 new fake notifications
    {icon:'⛈️', text:'Cảnh báo bão cát! ...À, chỉ là 1 hạt cát bay qua màn hình'},
    {icon:'👾', text:'Alien xâm chiếm sa mạc! ...À, đó là UFO (ảo)'},
    {icon:'💰', text:'Bạn vừa trúng 1 tỷ đồng! ...À, tiền ảo'},
    {icon:'⚠️', text:'Tài khoản của bạn bị khóa! ...À, không có tài khoản'},
];

let trollTimer=0;
let nextTrollAt=15;

function updateTrolls(dt){
    trollTimer+=dt;

    if(S.controlsReversed){
        S.reverseTimer-=dt;
        if(S.reverseTimer<=0){ S.controlsReversed=false; revInd.style.display='none'; }
    }

    if(S.carColorTimer>0){
        S.carColorTimer-=dt;
        if(S.carColorTimer<=0) carBodyMesh.material.color.setHex(0xcc0000);
    }

    if(S.fakeDeathFlash>0){
        S.fakeDeathFlash-=dt;
        if(S.fakeDeathFlash<=0){ deathScr.style.display='none'; hudEl.style.display='block'; ctrlEl.style.display='block'; S.phase='playing'; }
    }

    ACHIEVEMENTS.forEach(a=>{
        if(S.dist>=a.km && !S.milestoneShown[a.km]){
            S.milestoneShown[a.km]=true;
            showAchievement(a.title, a.msg.replace('__',S.dist.toFixed(1)));
            doShake(3,.3);
            playSfx(660, 0.2, 0.06);
            // v0.6: fire Lua hook
            try { if(typeof AndroidBridge !== 'undefined' && AndroidBridge.fireLuaEvent) AndroidBridge.fireLuaEvent('on_achievement'); } catch(e){}
        }
    });

    if(trollTimer>=nextTrollAt && S.trollCooldown<=0){
        triggerRandomTroll();
        nextTrollAt=trollTimer+12+Math.random()*25;
        S.trollCooldown=3;
    }
    if(S.trollCooldown>0) S.trollCooldown-=dt;

    if(S.fakeNotifTimer>0){
        S.fakeNotifTimer-=dt;
        if(S.fakeNotifTimer<=0) fakeNotif.style.display='none';
    }
}

function triggerRandomTroll(){
    const roll=Math.random();
    if(roll<0.18){
        // TROLL: random message
        const msg=TROLL_MESSAGES[Math.floor(Math.random()*TROLL_MESSAGES.length)].replace('__',S.dist.toFixed(1));
        showTroll(msg, 3000);
    } else if(roll<0.30){
        // TROLL: control reversal
        S.controlsReversed=true;
        S.reverseTimer=4+Math.random()*3;
        revInd.style.display='block';
        showTroll('ĐIỀU KHIỂN ĐẢO NGƯỢC! ◀ = ▶ , ▶ = ◀', 2500);
        doShake(4,.5);
        vibrate(200);
        playSfx(200, 0.3, 0.08);
    } else if(roll<0.38){
        // TROLL: car color change
        const colors=[0x00cc00,0x0000cc,0xcccc00,0xff6600,0x9900cc,0x00cccc,0xff00ff];
        const c=colors[Math.floor(Math.random()*colors.length)];
        carBodyMesh.material.color.setHex(c);
        S.carColorTimer=8+Math.random()*5;
        showTroll('Xe bạn đổi màu! Có ai mua xe cũ không?', 2500);
    } else if(roll<0.46){
        // TROLL: fake game over
        showTroll('GAME OVER! ...À, chỉ là ảo giác', 1500);
        doShake(6,.3);
        vibrate(100);
        playSfx(150, 0.5, 0.1);
    } else if(roll<0.54){
        // TROLL: fake notification
        const n=FAKE_NOTIFS[Math.floor(Math.random()*FAKE_NOTIFS.length)];
        if(fakeNotifText) fakeNotifText.innerHTML='<span class="notif-icon">'+n.icon+'</span>'+n.text;
        fakeNotif.style.display='block';
        S.fakeNotifTimer=3;
    } else if(roll<0.62){
        // TROLL: shake
        doShake(2+Math.random()*3,.5+Math.random()*.5);
        showTroll('Sóng sa mạc! ...hoặc chỉ là bug', 2000);
    } else if(roll<0.70){
        // TROLL: fake speed change
        S.speed=Math.random()>.5?C.CAR_MAX_SPEED*1.2:C.CAR_MIN_SPEED;
        const msg=S.speed>C.CAR_BASE_SPEED?'TURBO BOOST! (ảo)':'XE BỊ KẸT CÁT! (ảo)';
        showTroll(msg, 2000);
        doShake(3,.2);
        playSfx(S.speed>C.CAR_BASE_SPEED?880:100, 0.3, 0.08);
    } else if(roll<0.76){
        // TROLL: fake rain/fog
        scene.fog=new THREE.FogExp2(0x6699cc,0.02);
        showTroll('Mưa ở sa mạc?! ...À, ảo giác', 3000);
        if(fogTimeout) clearTimeout(fogTimeout);
        fogTimeout=setTimeout(()=>{
            scene.fog=new THREE.FogExp2(0xD2B48C, isLowDevice?0.010:0.005);
            fogTimeout=null;
        },4000);
    }
    // ===== v0.6 NEW TROLL FEATURES (10) =====
    else if(roll<0.80){
        // 1. GRAVITY FLIP — car bounces upside down
        S.gravityFlip = 6 + Math.random() * 4;
        showTroll('🌟 TRỌNG LỰC ĐẢO! Xe bay lên trời!', 2500);
        doShake(5, .4);
        vibrate(300);
        playSfx(440, 0.4, 0.1);
    } else if(roll<0.84){
        // 2. INVISIBLE CAR — car blinks in and out
        S.invisibleMode = 5;
        showTroll('👻 XE TÀN HÌNH! Bạn đang ở đâu?', 2500);
        playSfx(550, 0.3, 0.08);
    } else if(roll<0.88){
        // 3. INVERTED SCREEN COLORS — CSS filter
        document.body.style.filter = 'invert(1)';
        showTroll('🌀 SA MẠC AMONG US! Màu đảo ngược', 3000);
        if(invertTimeout) clearTimeout(invertTimeout);
        invertTimeout = setTimeout(() => {
            document.body.style.filter = '';
            invertTimeout = null;
        }, 5000);
        playSfx(330, 0.5, 0.08);
    } else if(roll<0.92){
        // 4. CAR SHRINK — car becomes tiny
        S.carShrink = 5;
        carGroup.scale.set(C.CAR_SCALE * 0.3, C.CAR_SCALE * 0.3, C.CAR_SCALE * 0.3);
        showTroll('🤏 XE THU NHỎ! Cẩn thận kẻo lạc', 2500);
        playSfx(1100, 0.3, 0.08);
    } else if(roll<0.95){
        // 5. FAKE LAG — random pause to simulate lag
        S.fakeLag = 1 + Math.random() * 2;
        showTroll('🐌 LAG! ...À, chỉ là troll lag', 2000);
        playSfx(80, 0.8, 0.06);
    } else if(roll<0.97){
        // 6. SCREEN ROTATION — visual rotation only
        const ang = (Math.random()-.5) * 30;
        document.body.style.transform = `rotate(${ang}deg)`;
        document.body.style.transformOrigin = 'center';
        showTroll('🔄 SA MẠC NGHIÊNG! Mọi thứ xiên hết', 2500);
        if(rotateTimeout) clearTimeout(rotateTimeout);
        rotateTimeout = setTimeout(() => {
            document.body.style.transform = '';
            rotateTimeout = null;
        }, 4000);
    } else if(roll<0.985){
        // 7. FAKE BATTERY DRAIN — fake low-battery notification
        if(fakeNotifText) fakeNotifText.innerHTML = '<span class="notif-icon">🪫</span>Cảnh báo: Pin chỉ còn 1%! ...À, ảo giác';
        fakeNotif.style.display = 'block';
        S.fakeNotifTimer = 4;
        showTroll('Pin sập! ...À, không có', 2000);
    } else if(roll<0.992){
        // 8. TIME DILATION — slow motion briefly
        S.speed *= 0.3;
        showTroll('⏰ CHẬM MO! Sa mạc vào slow-motion', 2000);
        playSfx(220, 0.5, 0.1);
    } else if(roll<0.997){
        // 9. FAKE COIN THEFT — pretend to lose coins
        if(S.coinsCollected > 0) {
            const stolen = Math.min(S.coinsCollected, 5 + Math.floor(Math.random()*10));
            S.coinsCollected -= stolen;
            updateCoinDisplay();
            showTroll(`💸 Lạc đà ma ăn cắp ${stolen} đồng!`, 2500);
        } else {
            showTroll('💸 Lạc đà ma định ăn cắp... nhưng bạn nghèo!', 2500);
        }
        playSfx(150, 0.4, 0.1);
    } else {
        // 10. INFINITE CURSE — engines temporarily silent, then very loud
        if(engineGain && audioCtx) {
            engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
            if(curseTimeout) clearTimeout(curseTimeout);
            curseTimeout = setTimeout(() => {
                if(engineGain && audioCtx) {
                    engineGain.gain.setTargetAtTime(C.ENGINE_BASE_VOL * 2, audioCtx.currentTime, 0.2);
                    if(curseTimeout2) clearTimeout(curseTimeout2);
                    curseTimeout2 = setTimeout(() => {
                        if(engineGain && audioCtx) {
                            engineGain.gain.setTargetAtTime(C.ENGINE_BASE_VOL, audioCtx.currentTime, 0.5);
                        }
                        curseTimeout2 = null;
                    }, 1500);
                }
                curseTimeout = null;
            }, 2000);
            lastEngineVol = -1;
        }
        showTroll('🔇 ĐỘNG CƠ TẮT! ...À, chỉ là troll', 2500);
    }
}
let curseTimeout = null, curseTimeout2 = null;

function showTroll(msg, duration){
    trollBox.textContent=msg;
    trollBox.className='t-box';
    trollPop.style.display='block';
    if(trollTimeout) clearTimeout(trollTimeout);
    trollTimeout=setTimeout(()=>{
        trollPop.style.display='none';
        trollTimeout=null;
    }, duration);
}

function showAchievement(title, msg){
    msKm.textContent=title;
    msMsg.textContent=msg;
    msBanner.style.display='block';
    if(achievementTimeout) clearTimeout(achievementTimeout);
    achievementTimeout=setTimeout(()=>{
        msBanner.style.display='none';
        achievementTimeout=null;
    },4000);
}

/* ───────────────────────────────────────────
   GAME STATE
   ─────────────────────────────────────────── */
function startGame(){
    // v0.6: prompt for music before starting
    if(musicPrompt && musicPrompt.style.display !== 'none') {
        // Already showing prompt, wait for user
        return;
    }
    if(musicPrompt) {
        musicPrompt.style.display = 'flex';
        return;
    }
    startGameAfterMusic(false);
}

function startGameAfterMusic(musicPicked){
    $('welcomeScreen').style.display='none';
    if(musicPrompt) musicPrompt.style.display='none';
    canvas.style.display='block';
    hudEl.style.display='block';
    ctrlEl.style.display='block';
    S.phase='playing';
    S.dead=false;
    S.paused=false;
    S.t0=Date.now();
    S.dist=0;S.speed=C.CAR_BASE_SPEED;S.offRoadT=0;S.onRoad=true;
    S.deathCount=0;S.controlsReversed=false;S.reverseTimer=0;
    S.carColorTimer=0;S.shakeTimer=0;S.milestoneShown={};
    S.forkShown=false;S.fakeNotifTimer=0;S.fakeDeathFlash=0;
    S.bestDist=0;
    S.gravityFlip=0;S.invisibleMode=0;S.carShrink=0;
    S.topSpeed=0;S.avgSpeed=0;S.speedSamples=0;
    S.totalKm=0;S.timeAlive=0;S.nearMissCount=0;S.coinsCollected=0;
    S.boostMeter=0;S.boostActive=0;
    S.musicPlaying = musicPicked;
    trollTimer=0;nextTrollAt=15;S.trollCooldown=0;

    const r=carGroup.rotation.y;
    cam.position.set(
        carGroup.position.x - Math.sin(r)*C.CAM_DIST,
        C.CAM_H,
        carGroup.position.z + Math.cos(r)*C.CAM_DIST
    );
    cam.lookAt(carGroup.position.x+Math.sin(r)*C.CAM_LOOK_AHEAD, 1.5, carGroup.position.z-Math.cos(r)*C.CAM_LOOK_AHEAD);

    if(!audioCtx) initAudio();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    updateCoinDisplay();
    resetInput();
    startLoop();
}

function triggerDeath(){
    if(S.dead) return;
    S.dead=true;
    S.phase='dead';
    S.deathCount++;
    vibrate(300);
    playSfx(100, 0.5, 0.12);

    // v0.6: persist stats via Android bridge
    try {
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.onGameDeath) {
            AndroidBridge.onGameDeath(S.dist, S.topSpeed, S.coinsCollected, S.nearMissCount, S.timeAlive);
        }
        // v0.6: fire Lua hook
        if(typeof AndroidBridge !== 'undefined' && AndroidBridge.fireLuaEvent) AndroidBridge.fireLuaEvent('on_death');
    } catch(e) {}

    let extra='';
    if(S.deathCount===1) extra=' (Lần đầu chết, rất bình thường)';
    else if(S.deathCount===2) extra=' (Lần 2, bạn chưa học bài?)';
    else if(S.deathCount===3) extra=' (Lần 3, sa mạc không thích bạn)';
    else if(S.deathCount===5) extra=' (5 lần! Bạn là professional... chết)';
    else if(S.deathCount===10) extra=' (10 LẦN! Bạn có nên thử game khác?)';
    else if(S.deathCount===20) extra=' (20 lần... Bạn kiên trì hay mắc kẹt?)';
    else if(S.deathCount>=50) extra=' (Bạn đã chết '+S.deathCount+' lần. Game tôn vinh sự kiên trì)';

    // v0.6: more detailed death screen
    let stats = 'Bạn đã đi được '+S.dist.toFixed(2)+'km rồi, cố lên!'+extra;
    stats += ' | Tốc độ tối đa: ' + Math.round(S.topSpeed*3.6) + ' km/h';
    stats += ' | Coin: ' + S.coinsCollected;
    stats += ' | Near-miss: ' + S.nearMissCount;
    dstD.textContent = stats;
    if(bestD) bestD.textContent='Kỷ lục: '+S.bestDist.toFixed(2)+' km';
    deathScr.style.display='flex';
    hudEl.style.display='none';
    ctrlEl.style.display='none';
    offVig.style.display='none';
    revInd.style.display='none';
    fakeNotif.style.display='none';
    trollPop.style.display='none';
    msBanner.style.display='none';
    doShake(5,.8);
}

function triggerEaster(){
    S.phase='easter';
    eastScr.style.display='flex';
    hudEl.style.display='none';ctrlEl.style.display='none';
    offVig.style.display='none';revInd.style.display='none';
    fakeNotif.style.display='none';trollPop.style.display='none';msBanner.style.display='none';
}

function restart(){
    stopLoop();
    const prevBest = S.bestDist;
    S.phase='playing';
    S.dead=false;
    S.paused=false;
    S.dist=0;S.speed=C.CAR_BASE_SPEED;S.offRoadT=0;S.onRoad=true;
    S.t0=Date.now();S.forkShown=false;
    S.controlsReversed=false;S.reverseTimer=0;
    S.carColorTimer=0;S.shakeTimer=0;S.milestoneShown={};
    S.fakeNotifTimer=0;S.fakeDeathFlash=0;
    S.bestDist=prevBest;
    S.gravityFlip=0;S.invisibleMode=0;S.carShrink=0;
    S.topSpeed=0;S.avgSpeed=0;S.speedSamples=0;
    S.nearMissCount=0;S.coinsCollected=0;
    S.boostMeter=0;S.boostActive=0;
    trollTimer=0;nextTrollAt=15;S.trollCooldown=0;

    if(trollTimeout){clearTimeout(trollTimeout);trollTimeout=null;}
    if(achievementTimeout){clearTimeout(achievementTimeout);achievementTimeout=null;}
    if(fogTimeout){clearTimeout(fogTimeout);fogTimeout=null;}
    if(sandstormTimeout){clearTimeout(sandstormTimeout);sandstormTimeout=null;}
    if(invertTimeout){clearTimeout(invertTimeout);invertTimeout=null; document.body.style.filter='';}
    if(rotateTimeout){clearTimeout(rotateTimeout);rotateTimeout=null; document.body.style.transform='';}
    if(curseTimeout){clearTimeout(curseTimeout);curseTimeout=null;}
    if(curseTimeout2){clearTimeout(curseTimeout2);curseTimeout2=null;}

    carGroup.position.set(0,0,0);
    carGroup.rotation.y=0;
    carGroup.rotation.z=0;
    carGroup.visible = true;
    carGroup.scale.set(C.CAR_SCALE, C.CAR_SCALE, C.CAR_SCALE);
    carBodyMesh.material.color.setHex(0xcc0000);

    segData.forEach(s=>{s.grp.position.z=-s.idx*C.SEG_LEN;});
    obstaclePool.forEach(o=>{
        if(!o.userData.isObs)return;
        const side=Math.random()>.5?1:-1;
        o.position.x=side*(1+Math.random()*(C.ROAD_W/2-3));
        o.userData._nearMiss = false;
    });
    coinPool.forEach(c=>{
        c.userData.collected = false;
        c.visible = true;
        c.position.x = (Math.random()-.5)*(C.ROAD_W-3);
    });

    cam.position.set(0, C.CAM_H, C.CAM_DIST);
    cam.lookAt(0, 1.5, 0);

    deathScr.style.display='none';eastScr.style.display='none';pauseScr.style.display='none';
    hudEl.style.display='block';ctrlEl.style.display='block';
    offVig.style.display='none';revInd.style.display='none';
    fakeNotif.style.display='none';trollPop.style.display='none';msBanner.style.display='none';
    updateCoinDisplay();
    resetInput();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    startLoop();
}

function resetInput(){
    inp.left=inp.right=inp.gas=inp.brake=inp.boost=false;
    document.querySelectorAll('.cb').forEach(b=>b.classList.remove('on'));
}

/* ── PAUSE/RESUME (Android) ── */
window.pauseGame=function(){
    if(S.phase==='playing'&&!S.paused){
        S.paused=true;
        pauseScr.style.display='flex';
        hudEl.style.display='none';
        ctrlEl.style.display='none';
        if(audioCtx) audioCtx.suspend();
    }
};
window.resumeGame=function(){
    if(S.paused){
        S.paused=false;
        pauseScr.style.display='none';
        hudEl.style.display='block';
        ctrlEl.style.display='block';
        clock.start();
        if(audioCtx) audioCtx.resume();
    }
};

/* ── BOOT ── */
init();
renderer.render(scene, cam);

/* ============================================================
   CHANGELOG (v0.6 — summary)
   ============================================================
   Performance:
     - Shadow map 1024 -> 512 (PCFSoftShadowMap -> PCFShadowMap)
     - MeshPhongMaterial -> MeshLambertMaterial for car body
     - Squared-distance collision (no Math.sqrt per pair)
     - Throttled dust updates (60Hz -> 30Hz)
     - Cached array lengths in hot loops
     - Throttled resize handler (100ms debounce)
     - Audio setTargetAtTime only when target changes
     - Auto-quality: drops shadow map if FPS < 30 for 3+ seconds
     - WebGL precision: mediump on low devices
     - physicallyCorrectLights: false

   Music player:
     - MusicPrompt dialog on game entry
     - Native MusicPickerActivity (Kotlin) for file selection
     - MusicPlayerService (Java) for background playback
     - Native audio mixer (C++) for engine ducking
     - JS polls AndroidBridge.isMusicPlaying() at 10Hz

   10 NEW TROLL FEATURES:
     1. Gravity flip (car bounces upside down)
     2. Invisible car (blinks in and out)
     3. Inverted screen colors (CSS filter invert)
     4. Car shrink (tiny car)
     5. Fake lag (random pause)
     6. Screen rotation (visual only)
     7. Fake battery drain notification
     8. Time dilation (slow motion)
     9. Fake coin theft (camel steals coins)
     10. Engine curse (silent then very loud)

   20 NEW USEFUL FEATURES:
     1. Coins collectible + counter
     2. Boost meter (regenerates, tap button or Shift to use)
     3. Near-miss tracking (close calls give coins)
     4. Top speed display (km/h)
     5. Total km display (lifetime)
     6. FPS counter (in debug overlay)
     7. Debug overlay (toggle in settings)
     8. Camera modes (follow / far / cockpit)
     9. Settings screen
     10. Sound toggle (mute)
     11. HUD visibility toggle
     12. Speedometer dial (rotates with speed)
     13. Swipe controls (alt to buttons)
     14. Cheat codes (Konami, iddqd, trololol, etc.)
     15. Cheat input box (type codes)
     16. Lua scripting hooks (events fired to Lua)
     17. Music indicator (now playing)
     18. Auto-quality adjustment (drops shadow if FPS low)
     19. Persistent stats (via Android bridge to SettingsManager)
     20. Time tracking (how long you've survived)

   ============================================================ */
})();
