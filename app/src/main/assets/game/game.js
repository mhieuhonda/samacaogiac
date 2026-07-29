// ============================================================
// SA MẠC ẢO GIÁC — Game Engine v0.5
// Fixed: Kotlin duplicate class CI, fork barrier collision,
//        obstacle recycling, speed-dependent steering,
//        camera smoothness, pause system, sound FX,
//        ProGuard rules, mobile polish, memory safety
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
    // FIX: barrier width = 0.7 * ROAD_W = 9.8, half = 4.9
    // car must be OUTSIDE the barrier zone to pass
    BARRIER_HALF_W: 4.9,
    CAR_RADIUS: 1.5,
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
};

/* ── THREE ── */
let scene, cam, renderer, clock, loopRunning = false;
let carGroup, carBodyMesh, wheels = [];
let segData = [];
let decoPool = [];
let obstaclePool = [];
let sunMesh, sunLight, ambientLight, hemiLight;
let dustPts;
let groundMeshes = [];
let isLowDevice = false;

/* ── TIMEOUT TRACKING ── */
let trollTimeout = null;
let achievementTimeout = null;
let fogTimeout = null;

/* ── AUDIO ── */
let audioCtx = null;
let engineOsc = null, engineGain = null;

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
    } catch(e){}
}

function updateAudio(){
    if(!audioCtx || !engineOsc) return;
    try {
        // Engine sound frequency based on speed
        const freq = 60 + (S.speed / C.CAR_MAX_SPEED) * 120;
        engineOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
        const vol = S.paused ? 0 : (S.onRoad ? 0.03 : 0.05);
        engineGain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
    } catch(e){}
}

function playSfx(freq, dur, vol){
    if(!audioCtx) return;
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

/* ── INPUT ── */
const inp = { left:false, right:false, gas:false, brake:false };

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

/* ── UI ── */
function onBtn(id, fn){
    const el=$(id);
    el.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();fn(true);el.classList.add('on')},{passive:false});
    el.addEventListener('touchend',e=>{e.preventDefault();e.stopPropagation();fn(false);el.classList.remove('on')},{passive:false});
    el.addEventListener('touchcancel',e=>{fn(false);el.classList.remove('on')});
    el.addEventListener('mousedown',e=>{e.preventDefault();fn(true);el.classList.add('on')});
    el.addEventListener('mouseup',e=>{fn(false);el.classList.remove('on')});
    el.addEventListener('mouseleave',()=>{fn(false);el.classList.remove('on')});
}
onBtn('bL',v=>{inp.left=v}); onBtn('bR',v=>{inp.right=v});
onBtn('bG',v=>{inp.gas=v}); onBtn('bB',v=>{inp.brake=v});

function addClick(id, fn){
    const el=$(id);
    el.addEventListener('click', e=>{e.preventDefault();fn()});
    el.addEventListener('touchstart', e=>{e.preventDefault();e.stopPropagation();fn()},{passive:false});
}
addClick('playBtn', startGame);
addClick('replayBtn', restart);
addClick('easterBtn', restart);
addClick('pauseBtn', togglePause);
addClick('resumeBtn', ()=>{ if(S.paused) togglePause(); });
addClick('quitBtn', ()=>{ if(S.paused){ S.phase='welcome'; $('welcomeScreen').style.display='flex'; deathScr.style.display='none'; eastScr.style.display='none'; pauseScr.style.display='none'; hudEl.style.display='none'; ctrlEl.style.display='none'; stopLoop(); resetInput(); } });

/* FIX: Keyboard controls for desktop testing */
document.addEventListener('keydown', e=>{
    if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') inp.left=true;
    if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') inp.right=true;
    if(e.key==='ArrowUp'||e.key==='w'||e.key==='W') inp.gas=true;
    if(e.key==='ArrowDown'||e.key==='s'||e.key==='S') inp.brake=true;
    if(e.key===' '||e.key==='Enter') {
        if(S.phase==='welcome') startGame();
        else if(S.phase==='dead') restart();
        else if(S.phase==='easter') restart();
    }
    if(e.key==='Escape'||e.key==='p'||e.key==='P') {
        if(S.phase==='playing') togglePause();
    }
});
document.addEventListener('keyup', e=>{
    if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') inp.left=false;
    if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') inp.right=false;
    if(e.key==='ArrowUp'||e.key==='w'||e.key==='W') inp.gas=false;
    if(e.key==='ArrowDown'||e.key==='s'||e.key==='S') inp.brake=false;
});

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

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xD2B48C, low ? 0.010 : 0.005);

    cam = new THREE.PerspectiveCamera(low?55:60, innerWidth/innerHeight, 0.5, 500);
    cam.position.set(0, C.CAM_H, C.CAM_DIST);
    cam.lookAt(0, 1.5, 0);

    renderer = new THREE.WebGLRenderer({canvas, antialias:!low, powerPreference:'high-performance'});
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, low?1:C.PR_CAP));
    renderer.shadowMap.enabled = !low;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    clock = new THREE.Clock(false);

    // Sky
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
    if(!low){
        sunLight.castShadow=true;
        sunLight.shadow.mapSize.set(1024,1024);
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
    if(!low) buildDust();

    window.addEventListener('resize',()=>{
        cam.aspect=innerWidth/innerHeight;
        cam.updateProjectionMatrix();
        renderer.setSize(innerWidth,innerHeight);
    });
}

/* ── GROUND ── */
function buildGround(low){
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
    segData.forEach(s=>{
        const dz=s.grp.position.z-carZ;
        if(dz>C.SEG_LEN*2.5) s.grp.position.z-=total;
        if(dz<-total+C.SEG_LEN) s.grp.position.z+=total;
    });
    groundMeshes.forEach((m,i)=>{
        m.position.z=carZ-i*200;
        m.position.x=carGroup.position.x*0.3;
    });
    sunMesh.position.set(carGroup.position.x+60,90,carGroup.position.z-40);
    sunLight.position.set(carGroup.position.x+60,90,carGroup.position.z-40);
    sunLight.target.position.copy(carGroup.position);
    sunLight.target.updateMatrixWorld();
}

/* ── CAR ── */
function buildCar(low){
    carGroup=new THREE.Group();

    const bodyM=new THREE.MeshPhongMaterial({color:0xcc0000,shininess:90,specular:0x555555});
    const darkM=new THREE.MeshPhongMaterial({color:0xaa0000,shininess:70,specular:0x333333});
    const glassM=new THREE.MeshPhongMaterial({color:0x88ccff,shininess:120,specular:0xffffff,transparent:true,opacity:.5});
    const blkM=new THREE.MeshPhongMaterial({color:0x1a1a1a,shininess:30});
    const chrM=new THREE.MeshPhongMaterial({color:0xdddddd,shininess:120,specular:0xffffff});
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
    decoPool.forEach(d=>{
        if(!d.userData.isDeco)return;
        const dz=d.position.z-cZ;
        if(dz>C.SEG_LEN*3){
            d.position.z-=total;
            const side=Math.random()>.5?1:-1;
            d.position.x=side*(C.ROAD_W/2+4+Math.random()*50);
        }
        // FIX: also recycle if too far ahead
        if(dz<-total+C.SEG_LEN){
            d.position.z+=total;
            const side=Math.random()>.5?1:-1;
            d.position.x=side*(C.ROAD_W/2+4+Math.random()*50);
        }
    });
}

/* ── OBSTACLES ── */
function buildObstacles(low){
    const oMat=new THREE.MeshLambertMaterial({color:0x9e8c6c,flatShading:true});
    const camelMat=new THREE.MeshLambertMaterial({color:0xb89968,flatShading:low});
    const totalLen=C.NUM_SEGS*C.SEG_LEN;
    for(let i=0;i<20;i++){
        const r=mkRock(oMat);
        const side=Math.random()>.5?1:-1;
        // FIX: ensure obstacle is always on the correct side of the road
        const xOff = 1 + Math.random()*(C.ROAD_W/2-3);
        r.position.set(side*xOff,.2,-(Math.random()*totalLen));
        r.userData.isObs=true; r.userData.obsRadius=.3+Math.random()*.3;
        scene.add(r); obstaclePool.push(r);
    }
    for(let i=0;i<6;i++){
        const c=mkDeadCamel(camelMat,low);
        const side=Math.random()>.5?1:-1;
        const xOff = 1 + Math.random()*3;
        c.position.set(side*xOff,0,-(Math.random()*totalLen));
        c.userData.isObs=true; c.userData.obsRadius=1.5;
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
    obstaclePool.forEach(o=>{
        if(!o.userData.isObs)return;
        const dz=o.position.z-cZ;
        if(dz>C.SEG_LEN*3){
            o.position.z-=total;
            const side=Math.random()>.5?1:-1;
            // FIX: ensure positive X offset on correct side
            o.position.x=side*(1+Math.random()*(C.ROAD_W/2-3));
        }
        // FIX: also recycle if too far ahead
        if(dz<-total+C.SEG_LEN){
            o.position.z+=total;
            const side=Math.random()>.5?1:-1;
            o.position.x=side*(1+Math.random()*(C.ROAD_W/2-3));
        }
    });
}

function checkObstacles(){
    if(S.dead) return;
    const cx=carGroup.position.x, cz=carGroup.position.z;
    obstaclePool.forEach(o=>{
        if(!o.userData.isObs)return;
        const dx=o.position.x-cx, dz=o.position.z-cz;
        const dist=Math.sqrt(dx*dx+dz*dz);
        if(dist<o.userData.obsRadius+1.5*C.CAR_SCALE) triggerDeath();
    });
}

/* ── DUST ── */
function buildDust(){
    const n=60;
    const g=new THREE.BufferGeometry();
    const pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*8;pos[i*3+1]=Math.random()*1.5;pos[i*3+2]=(Math.random()-.5)*4-2;}
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    dustPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xD2B48C,size:.35,transparent:true,opacity:.2,depthWrite:false}));
    scene.add(dustPts);
}

/* ───────────────────────────────────────────
   GAME LOOP
   ─────────────────────────────────────────── */
function gameLoop(){
    if(!loopRunning) return;
    requestAnimationFrame(gameLoop);

    if(S.phase!=='playing'||S.paused){
        if(S.phase==='dead'||S.phase==='easter') renderer.render(scene,cam);
        return;
    }

    const dt=Math.min(clock.getDelta(),0.06);

    updateCar(dt);
    checkRoad(dt);
    checkObstacles();
    checkForkBarrier();
    S.dist+=S.speed*dt/C.KM;
    if(S.dist>S.bestDist) S.bestDist=S.dist;
    checkForkWarning();
    updateCamera();
    recycleSegs(); recycleDeco(); recycleObs();
    if(dustPts) updateDust(dt);
    updateTrolls(dt);
    updateShake(dt);
    updateHUD(dt);
    updateAudio();
    if(Date.now()-S.t0>=C.EASTER_MS) triggerEaster();
    renderer.render(scene,cam);
}

function startLoop(){
    if(loopRunning) return;
    loopRunning=true;
    clock.start();
    gameLoop();
}
function stopLoop(){ loopRunning=false; }

/* ── CAR PHYSICS ── */
function updateCar(dt){
    let target=C.CAR_BASE_SPEED;
    if(inp.gas) target=C.CAR_MAX_SPEED;
    if(inp.brake) target=C.CAR_MIN_SPEED;
    S.speed+=(target-S.speed)*dt*3;
    S.speed=Math.max(C.CAR_MIN_SPEED,Math.min(C.CAR_MAX_SPEED,S.speed));
    if(!S.onRoad) S.speed=Math.max(3,S.speed*(1-dt*2));

    let steer=0;
    let left=inp.left, right=inp.right;
    if(S.controlsReversed){left=inp.right;right=inp.left;}
    if(left) steer=-1; if(right) steer=1;

    // FIX: speed-dependent steering — less turning at high speed
    const speedFactor = 1 - (S.speed - C.CAR_MIN_SPEED) / (C.CAR_MAX_SPEED - C.CAR_MIN_SPEED) * 0.35;
    carGroup.rotation.y+=steer*C.TURN_RATE*speedFactor*dt;
    carGroup.rotation.y=Math.max(-C.MAX_STEER_Y, Math.min(C.MAX_STEER_Y, carGroup.rotation.y));
    if(!left&&!right){
        carGroup.rotation.y*=1-dt*2;
        if(Math.abs(carGroup.rotation.y)<0.01) carGroup.rotation.y=0;
    }

    // FIX: bank angle proportional to steering, not just steer input
    const targetBank = -steer * 0.08;
    carGroup.rotation.z += (targetBank - carGroup.rotation.z) * dt * 8;

    // Bounce effect
    carGroup.position.y=Math.sin(Date.now()*0.008)*.02;

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

    wheels.forEach(w=>{
        w.children[0].rotation.x+=fwd*2;
        w.children[1].rotation.x+=fwd*2;
    });
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

/* ── FORK BARRIER COLLISION ──
   FIX: The barrier is 0.7*ROAD_W wide, centered at x=0.
   Barrier extends from -4.9 to +4.9 on X axis.
   Car must be OUTSIDE the barrier zone (|carX| > BARRIER_HALF_W + CAR_RADIUS)
   to pass on either side. If car is INSIDE the barrier zone, it hits the barrier. */
function checkForkBarrier(){
    if(S.dead) return;
    const cZ=carGroup.position.z;
    const absCX=Math.abs(carGroup.position.x);
    segData.forEach(s=>{
        if(!s.isFork) return;
        const barrierWorldZ = s.grp.position.z + C.SEG_LEN/2 - 15;
        const dz=Math.abs(cZ - barrierWorldZ);
        // Car hits barrier if: within Z range AND inside barrier X range
        if(dz < 2.5 && absCX < C.BARRIER_HALF_W + C.CAR_RADIUS * C.CAR_SCALE) triggerDeath();
    });
}

/* ── FORK WARNING ── */
function checkForkWarning(){
    const cZ=carGroup.position.z;
    let nearFork=false;
    segData.forEach(s=>{
        if(s.isFork){
            const dz=Math.abs(s.grp.position.z-cZ);
            if(dz<50&&dz>8) nearFork=true;
        }
    });
    if(nearFork&&!S.forkShown){
        S.forkShown=true;
        showTroll('NGÃ RẼ SẮP TỚI! Rẽ trái hoặc phải!', 3000);
        playSfx(440, 0.3, 0.08);
    } else if(!nearFork) S.forkShown=false;
}

/* ── CAMERA ── */
function updateCamera(){
    const r=carGroup.rotation.y;
    const tX=carGroup.position.x-Math.sin(r)*C.CAM_DIST;
    const tZ=carGroup.position.z+Math.cos(r)*C.CAM_DIST;
    const lerpFactor = C.CAM_LERP;
    cam.position.x+=(tX-cam.position.x)*lerpFactor;
    cam.position.y+=(C.CAM_H-cam.position.y)*(lerpFactor*1.2);
    cam.position.z+=(tZ-cam.position.z)*lerpFactor;
    const lX=carGroup.position.x+Math.sin(r)*C.CAM_LOOK_AHEAD;
    const lZ=carGroup.position.z-Math.cos(r)*C.CAM_LOOK_AHEAD;
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

/* ── DUST UPDATE ── */
function updateDust(dt){
    const p=dustPts.geometry.attributes.position.array;
    const cx=carGroup.position.x,cz=carGroup.position.z;
    const rot=carGroup.rotation.y;
    for(let i=0;i<p.length;i+=3){
        p[i]+=(Math.random()-.5)*.3;
        p[i+1]+=Math.random()*.08;
        p[i+2]+=(Math.random()-.5)*.3-S.speed*dt*.2;
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

/* ── HUD ── */
function updateHUD(dt){
    spdH.textContent=Math.round(S.speed*3.6)+' km/h';
    dstH.textContent=S.dist.toFixed(2)+' km';
    const elapsed=Math.floor((Date.now()-S.t0)/1000);
    const m=Math.floor(elapsed/60), s=elapsed%60;
    tmrH.textContent=m+':'+(s<10?'0':'')+s;
}

/* ───────────────────────────────────────────
   TROLL FEATURES
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
    'Mẹ bạn gọi: "Con về ăn cơm!" ... À, không ai gọi',
    'Phía trước có trạm nghỉ... ảo',
    'Chú ý: Đường sắp đổi màu... hoặc không',
    'Bug report: Không tìm thấy bug... vì game này toàn bug',
    'Bạn đã đi được __km! Quán cà phê gần nhất: 500km',
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
    if(roll<0.25){
        const msg=TROLL_MESSAGES[Math.floor(Math.random()*TROLL_MESSAGES.length)].replace('__',S.dist.toFixed(1));
        showTroll(msg, 3000);
    } else if(roll<0.45){
        S.controlsReversed=true;
        S.reverseTimer=4+Math.random()*3;
        revInd.style.display='block';
        showTroll('ĐIỀU KHIỂN ĐẢO NGƯỢC! ◀ = ▶ , ▶ = ◀', 2500);
        doShake(4,.5);
        vibrate(200);
        playSfx(200, 0.3, 0.08);
    } else if(roll<0.55){
        const colors=[0x00cc00,0x0000cc,0xcccc00,0xff6600,0x9900cc,0x00cccc,0xff00ff];
        const c=colors[Math.floor(Math.random()*colors.length)];
        carBodyMesh.material.color.setHex(c);
        S.carColorTimer=8+Math.random()*5;
        showTroll('Xe bạn đổi màu! Có ai mua xe cũ không?', 2500);
    } else if(roll<0.65){
        showTroll('GAME OVER! ...À, chỉ là ảo giác', 1500);
        doShake(6,.3);
        vibrate(100);
        playSfx(150, 0.5, 0.1);
    } else if(roll<0.75){
        const n=FAKE_NOTIFS[Math.floor(Math.random()*FAKE_NOTIFS.length)];
        if(fakeNotifText) fakeNotifText.innerHTML='<span class="notif-icon">'+n.icon+'</span>'+n.text;
        fakeNotif.style.display='block';
        S.fakeNotifTimer=3;
    } else if(roll<0.85){
        doShake(2+Math.random()*3,.5+Math.random()*.5);
        showTroll('Sóng sa mạc! ...hoặc chỉ là bug', 2000);
    } else if(roll<0.92){
        S.speed=Math.random()>.5?C.CAR_MAX_SPEED*1.2:C.CAR_MIN_SPEED;
        const msg=S.speed>C.CAR_BASE_SPEED?'TURBO BOOST! (ảo)':'XE BỊ KẸT CÁT! (ảo)';
        showTroll(msg, 2000);
        doShake(3,.2);
        playSfx(S.speed>C.CAR_BASE_SPEED?880:100, 0.3, 0.08);
    } else {
        scene.fog=new THREE.FogExp2(0x6699cc,0.02);
        showTroll('Mưa ở sa mạc?! ...À, ảo giác', 3000);
        if(fogTimeout) clearTimeout(fogTimeout);
        fogTimeout=setTimeout(()=>{
            scene.fog=new THREE.FogExp2(0xD2B48C, isLowDevice?0.010:0.005);
            fogTimeout=null;
        },4000);
    }
}

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
    $('welcomeScreen').style.display='none';
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
    trollTimer=0;nextTrollAt=15;S.trollCooldown=0;

    const r=carGroup.rotation.y;
    cam.position.set(
        carGroup.position.x - Math.sin(r)*C.CAM_DIST,
        C.CAM_H,
        carGroup.position.z + Math.cos(r)*C.CAM_DIST
    );
    cam.lookAt(carGroup.position.x+Math.sin(r)*C.CAM_LOOK_AHEAD, 1.5, carGroup.position.z-Math.cos(r)*C.CAM_LOOK_AHEAD);

    // Init audio on first user interaction
    if(!audioCtx) initAudio();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

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

    let extra='';
    if(S.deathCount===1) extra=' (Lần đầu chết, rất bình thường)';
    else if(S.deathCount===2) extra=' (Lần 2, bạn chưa học bài?)';
    else if(S.deathCount===3) extra=' (Lần 3, sa mạc không thích bạn)';
    else if(S.deathCount===5) extra=' (5 lần! Bạn là professional... chết)';
    else if(S.deathCount===10) extra=' (10 LẦN! Bạn có nên thử game khác?)';
    else if(S.deathCount===20) extra=' (20 lần... Bạn kiên trì hay mắc kẹt?)';
    else if(S.deathCount>=50) extra=' (Bạn đã chết '+S.deathCount+' lần. Game tôn vinh sự kiên trì)';

    dstD.textContent='Bạn đã đi được '+S.dist.toFixed(2)+'km rồi, cố lên!'+extra;
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
    // Preserve bestDist across restarts
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
    trollTimer=0;nextTrollAt=15;S.trollCooldown=0;

    // Clear all pending timeouts
    if(trollTimeout){clearTimeout(trollTimeout);trollTimeout=null;}
    if(achievementTimeout){clearTimeout(achievementTimeout);achievementTimeout=null;}
    if(fogTimeout){clearTimeout(fogTimeout);fogTimeout=null;}

    carGroup.position.set(0,0,0);
    carGroup.rotation.y=0;
    carGroup.rotation.z=0;
    carBodyMesh.material.color.setHex(0xcc0000);

    segData.forEach(s=>{s.grp.position.z=-s.idx*C.SEG_LEN;});
    obstaclePool.forEach(o=>{
        if(!o.userData.isObs)return;
        const side=Math.random()>.5?1:-1;
        o.position.x=side*(1+Math.random()*(C.ROAD_W/2-3));
    });

    cam.position.set(0, C.CAM_H, C.CAM_DIST);
    cam.lookAt(0, 1.5, 0);

    deathScr.style.display='none';eastScr.style.display='none';pauseScr.style.display='none';
    hudEl.style.display='block';ctrlEl.style.display='block';
    offVig.style.display='none';revInd.style.display='none';
    fakeNotif.style.display='none';trollPop.style.display='none';msBanner.style.display='none';
    resetInput();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    startLoop();
}

function resetInput(){
    inp.left=inp.right=inp.gas=inp.brake=false;
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

})();
