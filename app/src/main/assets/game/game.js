// ============================================================
// SA MẠC ẢO GIÁC — Game Engine v0.1
// Third-person desert driving game with looping road
// ============================================================
(function(){
'use strict';

/* ── CONFIG ── */
const C = {
    ROAD_W: 8,              // road width
    SEG_LEN: 60,            // length of one road segment
    NUM_SEGS: 18,           // total road segments in loop
    FORK_EVERY: 4,          // fork every N segments
    CAR_BASE_SPEED: 30,     // m/s
    CAR_MAX_SPEED: 55,
    CAR_MIN_SPEED: 8,
    TURN_RATE: 2.0,
    CAM_DIST: 11,
    CAM_H: 5.5,
    CAM_LOOK_AHEAD: 6,
    OFFROAD_LIMIT: 3.5,     // seconds off-road before death
    KM: 1000,               // 1 km in game units
    EASTER_MS: 3600000,     // 1 hour
    PIXEL_RATIO_CAP: 1.5,   // cap for weak phones
};

/* ── STATE ── */
let state = {
    phase: 'welcome', // welcome | playing | dead | easter
    dist: 0,
    speed: C.CAR_BASE_SPEED,
    offRoadT: 0,
    onRoad: true,
    t0: 0,
    paused: false,
    segIdx: 0,            // current segment index
    forkShown: false,
    forkWarningTimer: 0,
};

/* ── THREE ── */
let scene, cam, renderer, clock;
let carGroup, wheels = [];
let segPool = [];          // road segment pool
let decoPool = [];         // decorations
let sun, ambient, hemi;
let dustPts;

/* ── INPUT ── */
const inp = { left:false, right:false, gas:false, brake:false };

/* ── DOM ── */
const $ = id => document.getElementById(id);
const canvas   = $('gameCanvas');
const hud      = $('hud');
const ctrl     = $('controls');
const deathScr = $('deathScreen');
const eastScr  = $('easterEggScreen');
const forkWarn = $('forkWarning');
const spdTxt   = $('speedDisplay');
const dstTxt   = $('distanceDisplay');
const dstD     = $('deathDist');

/* ── UI BINDINGS ── */
$('playBtn').addEventListener('click', startGame);
$('playBtn').addEventListener('touchstart', e=>{e.preventDefault();startGame()});
$('replayBtn').addEventListener('click', restart);
$('replayBtn').addEventListener('touchstart', e=>{e.preventDefault();restart()});
$('easterEggBtn').addEventListener('click', restart);
$('easterEggBtn').addEventListener('touchstart', e=>{e.preventDefault();restart()});

bindCtrl('btnLeft','left'); bindCtrl('btnRight','right');
bindCtrl('btnGas','gas');   bindCtrl('btnBrake','brake');

function bindCtrl(id, key){
    const el=$(id);
    const on=()=>{inp[key]=true;el.classList.add('active')};
    const off=()=>{inp[key]=false;el.classList.remove('active')};
    el.addEventListener('touchstart',e=>{e.preventDefault();on()});
    el.addEventListener('touchend',e=>{e.preventDefault();off()});
    el.addEventListener('touchcancel',e=>{e.preventDefault();off()});
    el.addEventListener('mousedown',e=>{e.preventDefault();on()});
    el.addEventListener('mouseup',e=>{e.preventDefault();off()});
    el.addEventListener('mouseleave',e=>{off()});
}

/* ──────────────────────────────────────────────
   INIT THREE.JS
   ────────────────────────────────────────────── */
function init(){
    // Detect low-end
    const low = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 2 : false;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xD2B48C, low ? 0.012 : 0.006);

    cam = new THREE.PerspectiveCamera(low?55:60, innerWidth/innerHeight, 0.5, 400);

    renderer = new THREE.WebGLRenderer({
        canvas, antialias: !low,
        powerPreference: 'high-performance',
    });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, low?1:C.PIXEL_RATIO_CAP));
    renderer.shadowMap.enabled = !low;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    clock = new THREE.Clock(false);

    // Sky
    const skyC = document.createElement('canvas');
    skyC.width=2; skyC.height=256;
    const ctx=skyC.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,256);
    g.addColorStop(0,'#1a3a5c'); g.addColorStop(0.25,'#8b6e4e');
    g.addColorStop(0.5,'#c4956a'); g.addColorStop(0.75,'#d9b882');
    g.addColorStop(1,'#f5deb3');
    ctx.fillStyle=g; ctx.fillRect(0,0,2,256);
    const skyTex=new THREE.CanvasTexture(skyC);
    skyTex.mapping=THREE.EquirectangularReflectionMapping;
    scene.background=skyTex;

    // Lights
    sun=new THREE.DirectionalLight(0xffd700,2.2);
    sun.position.set(60,90,-40);
    if(!low){sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
        sun.shadow.camera.near=1;sun.shadow.camera.far=200;
        sun.shadow.camera.left=-60;sun.shadow.camera.right=60;
        sun.shadow.camera.top=60;sun.shadow.camera.bottom=-60;}
    scene.add(sun); scene.add(sun.target);

    ambient=new THREE.AmbientLight(0xd4a574,0.5); scene.add(ambient);
    hemi=new THREE.HemisphereLight(0xc2956b,0xD2B48C,0.35); scene.add(hemi);

    // Sun sphere
    const sunM=new THREE.Mesh(
        new THREE.SphereGeometry(4,8,8),
        new THREE.MeshBasicMaterial({color:0xffd700})
    );
    sunM.position.copy(sun.position); scene.add(sunM);

    // Ground
    buildGround(low);
    // Road
    buildRoad(low);
    // Car
    buildCar(low);
    // Decorations
    buildDecorations(low);
    // Dust
    if(!low) buildDust();

    window.addEventListener('resize',()=>{
        cam.aspect=innerWidth/innerHeight;
        cam.updateProjectionMatrix();
        renderer.setSize(innerWidth,innerHeight);
    });
}

/* ── GROUND ── */
function buildGround(low){
    const g=new THREE.PlaneGeometry(600,600,low?6:12,low?6:12);
    const v=g.attributes.position.array;
    for(let i=0;i<v.length;i+=3) v[i+2]+=(Math.random()-.5)*.25;
    g.computeVertexNormals();
    const m=new THREE.MeshLambertMaterial({color:0xD2B48C, flatShading:low});
    const mesh=new THREE.Mesh(g,m);
    mesh.rotation.x=-Math.PI/2; mesh.position.y=-0.05;
    mesh.receiveShadow=!low;
    mesh.userData.isGround=true;
    scene.add(mesh);
    decoPool.push(mesh);
}

/* ── ROAD POOL (looping) ── */
// Road segments are created once and recycled.
// Each segment has: road plane, edge lines, center dashes, optional fork
const SEG_POOL_SIZE = C.NUM_SEGS;
let segData = [];

function buildRoad(low){
    for(let i=0; i<SEG_POOL_SIZE; i++){
        const isFork = (i>0 && i%C.FORK_EVERY===0);
        const s = createSegment(i, isFork, low);
        segData.push(s);
    }
}

function createSegment(idx, isFork, low){
    const w=C.ROAD_W, len=C.SEG_LEN;
    const group = new THREE.Group();

    // Road surface
    const rg=new THREE.PlaneGeometry(w, len, 1, low?2:4);
    const rm=new THREE.MeshLambertMaterial({color:0x3d3d3d});
    const road=new THREE.Mesh(rg,rm);
    road.rotation.x=-Math.PI/2; road.position.y=0.02;
    road.receiveShadow=!low;
    group.add(road);

    // Edge lines
    const lm=new THREE.MeshBasicMaterial({color:0xeeeeee});
    const lg=new THREE.PlaneGeometry(.25, len);
    const ll=new THREE.Mesh(lg,lm); ll.rotation.x=-Math.PI/2; ll.position.set(-w/2+.12,.03,0); group.add(ll);
    const rl=new THREE.Mesh(lg,lm); rl.rotation.x=-Math.PI/2; rl.position.set(w/2-.12,.03,0); group.add(rl);

    // Center dashes
    const dg=new THREE.PlaneGeometry(.15,2.5);
    const dm=new THREE.MeshBasicMaterial({color:0xcccccc});
    for(let d=-len/2+2; d<len/2; d+=6){
        const dash=new THREE.Mesh(dg,dm);
        dash.rotation.x=-Math.PI/2; dash.position.set(0,.03,d);
        group.add(dash);
    }

    // Shoulders
    const sg=new THREE.PlaneGeometry(2.5, len);
    const sm=new THREE.MeshLambertMaterial({color:0xb89968});
    const ls=new THREE.Mesh(sg,sm); ls.rotation.x=-Math.PI/2; ls.position.set(-w/2-1.25,.005,0); group.add(ls);
    const rs=new THREE.Mesh(sg,sm); rs.rotation.x=-Math.PI/2; rs.position.set(w/2+1.25,.005,0); group.add(rs);

    // Fork sign if applicable
    if(isFork){
        addForkSigns(group, low);
    }

    scene.add(group);

    // Position segment
    const z = -idx * len;
    group.position.z = z;

    return {
        group,
        idx,
        isFork,
        z: z,
        len: len,
    };
}

function addForkSigns(group, low){
    // Arrow signs on both sides
    const signMat = new THREE.MeshLambertMaterial({color:0xf59e0b});
    const postMat = new THREE.MeshLambertMaterial({color:0x8b4513});

    [-1,1].forEach(side=>{
        const post = new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,2.5,4), postMat);
        post.position.set(side*(C.ROAD_W/2+1.5), 1.25, C.SEG_LEN/2 - 5);
        group.add(post);

        const board = new THREE.Mesh(new THREE.BoxGeometry(1.2,.7,.08), signMat);
        board.position.set(side*(C.ROAD_W/2+1.5), 2.7, C.SEG_LEN/2 - 5);
        board.rotation.y = side * 0.3;
        group.add(board);
    });
}

function recycleSegments(){
    // Move segments that are behind the car to the front
    const carZ = carGroup.position.z;
    const totalLen = SEG_POOL_SIZE * C.SEG_LEN;

    segData.forEach(s=>{
        const relZ = s.group.position.z - carZ;
        // If segment is too far behind, move it ahead
        if(relZ > C.SEG_LEN * 2){
            s.group.position.z -= totalLen;
        }
        // If segment is too far ahead, move it behind (shouldn't happen normally)
        if(relZ < -totalLen + C.SEG_LEN){
            s.group.position.z += totalLen;
        }
    });

    // Move ground
    decoPool.forEach(d=>{
        if(d.userData.isGround){
            d.position.z = carZ;
        }
    });
}

/* ── CAR ── */
function buildCar(low){
    carGroup = new THREE.Group();

    const bodyMat = new THREE.MeshPhongMaterial({color:0xcc0000, shininess:80, specular:0x444444});
    const darkMat = new THREE.MeshPhongMaterial({color:0x990000, shininess:60, specular:0x333333});
    const glassMat = new THREE.MeshPhongMaterial({color:0x88ccff, shininess:120, specular:0xffffff, transparent:true, opacity:.55});
    const blackMat = new THREE.MeshPhongMaterial({color:0x1a1a1a, shininess:20});
    const chromeMat = new THREE.MeshPhongMaterial({color:0xcccccc, shininess:100, specular:0xffffff});
    const yellowMat = new THREE.MeshBasicMaterial({color:0xffee44});
    const redMat = new THREE.MeshBasicMaterial({color:0xff2222});

    // ── Main body lower ──
    addBox(carGroup, 2.5, .55, 4.5, bodyMat, 0, .52, 0, !low);
    // ── Hood (front) ──
    addBox(carGroup, 2.3, .3, 1.5, bodyMat, 0, .8, 1.2, !low);
    // ── Cabin ──
    addBox(carGroup, 2.1, .5, 1.8, darkMat, 0, 1.1, -.2, !low);
    // ── Roof ──
    addBox(carGroup, 1.9, .12, 1.7, blackMat, 0, 1.42, -.2, false);
    // ── Trunk (rear) ──
    addBox(carGroup, 2.3, .25, 1.0, bodyMat, 0, .8, -1.5, !low);

    // ── Windshield ──
    const ws = addBox(carGroup, 1.95, .5, .06, glassMat, 0, 1.1, .65, false);
    ws.rotation.x = -.35;
    // ── Rear window ──
    const rw = addBox(carGroup, 1.95, .4, .06, glassMat, 0, 1.1, -1.05, false);
    rw.rotation.x = .3;
    // ── Side windows ──
    addBox(carGroup, .05, .32, 1.5, glassMat, -1.05, 1.1, -.2, false);
    addBox(carGroup, .05, .32, 1.5, glassMat, 1.05, 1.1, -.2, false);

    // ── Headlights ──
    addSphere(carGroup, .14, yellowMat, -.85, .55, 2.26, 6);
    addSphere(carGroup, .14, yellowMat, .85, .55, 2.26, 6);
    // ── Tail lights ──
    addSphere(carGroup, .12, redMat, -.85, .55, -2.26, 6);
    addSphere(carGroup, .12, redMat, .85, .55, -2.26, 6);

    // ── Bumpers ──
    addBox(carGroup, 2.5, .18, .25, blackMat, 0, .35, 2.15, false);
    addBox(carGroup, 2.5, .18, .25, blackMat, 0, .35, -2.15, false);

    // ── Grille ──
    addBox(carGroup, 1.6, .2, .08, blackMat, 0, .45, 2.28, false);

    // ── Side skirts ──
    addBox(carGroup, .08, .2, 3.8, blackMat, -1.25, .3, 0, false);
    addBox(carGroup, .08, .2, 3.8, blackMat, 1.25, .3, 0, false);

    // ── Exhaust pipes ──
    addCyl(carGroup, .06, .06, .4, chromeMat, -.6, .2, -2.3, Math.PI/2, 6);
    addCyl(carGroup, .06, .06, .4, chromeMat, .6, .2, -2.3, Math.PI/2, 6);

    // ── Side mirrors ──
    addBox(carGroup, .15, .12, .08, blackMat, -1.3, .95, .3, false);
    addBox(carGroup, .15, .12, .08, blackMat, 1.3, .95, .3, false);

    // ── Wheels ──
    const wGeom = new THREE.CylinderGeometry(.34,.34,.22, low?8:16);
    const hubGeom = new THREE.CylinderGeometry(.14,.14,.24, low?6:8);
    const rimGeom = new THREE.TorusGeometry(.28,.04,4,low?8:12);

    const wPos = [
        {x:-1.25, z:1.35}, {x:1.25, z:1.35},
        {x:-1.25, z:-1.3}, {x:1.25, z:-1.3},
    ];

    wPos.forEach(p=>{
        const wg = new THREE.Group();
        const wh = new THREE.Mesh(wGeom, blackMat);
        wh.rotation.z = Math.PI/2; wg.add(wh);
        const hb = new THREE.Mesh(hubGeom, chromeMat);
        hb.rotation.z = Math.PI/2; wg.add(hb);
        const rim = new THREE.Mesh(rimGeom, chromeMat);
        rim.rotation.y = Math.PI/2; wg.add(rim);
        wg.position.set(p.x, .34, p.z);
        wg.castShadow = !low;
        carGroup.add(wg);
        wheels.push(wg);
    });

    // ── Spoiler ──
    addBox(carGroup, 1.8, .06, .4, blackMat, 0, 1.35, -1.8, false);
    addBox(carGroup, .08, .3, .08, blackMat, -.7, 1.2, -1.8, false);
    addBox(carGroup, .08, .3, .08, blackMat, .7, 1.2, -1.8, false);

    carGroup.position.set(0, 0, 0);
    scene.add(carGroup);
}

function addBox(parent, w,h,d, mat, x,y,z, shadow){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x,y,z);
    if(shadow) m.castShadow=true;
    parent.add(m);
    return m;
}
function addSphere(parent, r, mat, x,y,z, seg){
    const m=new THREE.Mesh(new THREE.SphereGeometry(r,seg||6,seg||6), mat);
    m.position.set(x,y,z); parent.add(m); return m;
}
function addCyl(parent, rt,rb,h, mat, x,y,z, rotZ, seg){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||8), mat);
    m.position.set(x,y,z); if(rotZ) m.rotation.z=rotZ; parent.add(m); return m;
}

/* ── DECORATIONS ── */
function buildDecorations(low){
    const cactusMat = new THREE.MeshLambertMaterial({color:0x2d5a27});
    const rockMat = new THREE.MeshLambertMaterial({color:0x9e8c6c, flatShading:true});
    const duneMat = new THREE.MeshLambertMaterial({color:0xc4a66a, flatShading:low});

    // Cacti
    for(let i=0;i<40;i++){
        const c = makeCactus(cactusMat, low);
        const side = Math.random()>.5?1:-1;
        c.position.set(side*(C.ROAD_W/2+4+Math.random()*35), 0, -(Math.random()*C.NUM_SEGS*C.SEG_LEN));
        c.userData.isDeco=true;
        scene.add(c); decoPool.push(c);
    }

    // Rocks
    for(let i=0;i<50;i++){
        const r = makeRock(rockMat);
        const side = Math.random()>.5?1:-1;
        r.position.set(side*(C.ROAD_W/2+3+Math.random()*45), .15, -(Math.random()*C.NUM_SEGS*C.SEG_LEN));
        r.userData.isDeco=true;
        scene.add(r); decoPool.push(r);
    }

    // Dunes
    for(let i=0;i<12;i++){
        const d = makeDune(duneMat, low);
        const side = Math.random()>.5?1:-1;
        d.position.set(side*(50+Math.random()*80), -.5, -(Math.random()*C.NUM_SEGS*C.SEG_LEN));
        d.userData.isDeco=true;
        scene.add(d); decoPool.push(d);
    }
}

function makeCactus(mat, low){
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,2.2+Math.random(),low?4:6), mat);
    trunk.position.y=1.1; g.add(trunk);
    if(Math.random()>.3){
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,1,4), mat);
        arm.position.set(.35,1.3+Math.random()*.3,0); arm.rotation.z=-.5; g.add(arm);
    }
    if(Math.random()>.3){
        const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,.8,4), mat);
        arm2.position.set(-.3,1.1+Math.random()*.3,0); arm2.rotation.z=.4; g.add(arm2);
    }
    const top = new THREE.Mesh(new THREE.SphereGeometry(.16,4,4), mat);
    top.position.y=2.2+Math.random(); g.add(top);
    return g;
}

function makeRock(mat){
    const s=.3+Math.random()*.7;
    const g=new THREE.DodecahedronGeometry(s,0);
    const v=g.attributes.position.array;
    for(let i=0;i<v.length;i+=3){v[i]*=.8+Math.random()*.4;v[i+1]*=.5+Math.random()*.3;v[i+2]*=.8+Math.random()*.4;}
    g.computeVertexNormals();
    return new THREE.Mesh(g,mat);
}

function makeDune(mat, low){
    const g=new THREE.SphereGeometry(12+Math.random()*10,low?4:8,low?3:4,0,Math.PI*2,0,Math.PI/3);
    const d=new THREE.Mesh(g,mat);
    d.rotation.x=-Math.PI/2; d.position.y=-.5;
    return d;
}

function recycleDecorations(){
    const carZ = carGroup.position.z;
    const totalLen = C.NUM_SEGS * C.SEG_LEN;
    decoPool.forEach(d=>{
        if(d.userData.isDeco){
            const dz = d.position.z - carZ;
            if(dz > C.SEG_LEN * 3){
                d.position.z -= totalLen;
                const side = Math.random()>.5?1:-1;
                d.position.x = side*(C.ROAD_W/2+3+Math.random()*45);
            }
        }
    });
}

/* ── DUST PARTICLES ── */
function buildDust(){
    const n=40;
    const g=new THREE.BufferGeometry();
    const pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){
        pos[i*3]=(Math.random()-.5)*16;
        pos[i*3+1]=Math.random()*2.5;
        pos[i*3+2]=(Math.random()-.5)*16;
    }
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const m=new THREE.PointsMaterial({color:0xD2B48C,size:.4,transparent:true,opacity:.25,depthWrite:false});
    dustPts=new THREE.Points(g,m);
    scene.add(dustPts);
}

/* ──────────────────────────────────────────────
   GAME LOOP
   ────────────────────────────────────────────── */
let animId;

function loop(){
    animId = requestAnimationFrame(loop);
    if(state.phase!=='playing'||state.paused) return;

    const dt = Math.min(clock.getDelta(), 0.08);

    // ── Car physics ──
    updateCar(dt);

    // ── Check road ──
    checkRoad();

    // ── Distance ──
    state.dist += state.speed * dt / C.KM;

    // ── Fork warning ──
    checkForkProximity();

    // ── Camera ──
    updateCamera();

    // ── Recycle ──
    recycleSegments();
    recycleDecorations();

    // ── Particles ──
    if(dustPts) updateDust(dt);

    // ── HUD ──
    spdTxt.textContent = Math.round(state.speed*3.6)+' km/h';
    dstTxt.textContent = state.dist.toFixed(2)+' km';

    // ── Easter egg ──
    if(Date.now()-state.t0 >= C.EASTER_MS) triggerEaster();

    // ── Render ──
    renderer.render(scene, cam);
}

function updateCar(dt){
    // Speed
    let target = C.CAR_BASE_SPEED;
    if(inp.gas) target = C.CAR_MAX_SPEED;
    if(inp.brake) target = C.CAR_MIN_SPEED;
    state.speed += (target - state.speed) * dt * 3;
    state.speed = Math.max(C.CAR_MIN_SPEED, Math.min(C.CAR_MAX_SPEED, state.speed));

    // Off-road slowdown
    if(!state.onRoad) state.speed = Math.max(5, state.speed * (1 - dt * 2));

    // Steering
    let steer = 0;
    if(inp.left) steer = -1;
    if(inp.right) steer = 1;

    carGroup.rotation.y += steer * C.TURN_RATE * dt;

    // Move
    const fwd = state.speed * dt;
    carGroup.position.x += Math.sin(carGroup.rotation.y) * fwd;
    carGroup.position.z -= Math.cos(carGroup.rotation.y) * fwd;

    // Wheel spin
    wheels.forEach(w=>{
        w.children[0].rotation.x += fwd * 1.5;
        w.children[1].rotation.x += fwd * 1.5;
    });
}

function checkRoad(){
    const absX = Math.abs(carGroup.position.x);
    const halfW = C.ROAD_W / 2;

    if(absX > halfW + 2.5){
        state.onRoad = false;
        state.offRoadT += clock.getDelta() || 0.016;
        if(state.offRoadT >= C.OFFROAD_LIMIT) triggerDeath();
    } else {
        state.onRoad = true;
        state.offRoadT = 0;
    }
}

function checkForkProximity(){
    const carZ = carGroup.position.z;
    let nearFork = false;

    segData.forEach(s=>{
        if(s.isFork){
            const dz = Math.abs(s.group.position.z - carZ);
            if(dz < 40 && dz > 5){
                nearFork = true;
            }
        }
    });

    if(nearFork && !state.forkShown){
        state.forkShown = true;
        forkWarn.style.display = 'block';
        setTimeout(()=>{forkWarn.style.display='none';}, 3000);
    } else if(!nearFork){
        state.forkShown = false;
    }
}

function updateCamera(){
    const rot = carGroup.rotation.y;
    const cx = carGroup.position.x - Math.sin(rot)*C.CAM_DIST;
    const cz = carGroup.position.z + Math.cos(rot)*C.CAM_DIST;

    cam.position.x += (cx - cam.position.x) * .07;
    cam.position.y += (C.CAM_H - cam.position.y) * .08;
    cam.position.z += (cz - cam.position.z) * .07;

    const lx = carGroup.position.x + Math.sin(rot)*C.CAM_LOOK_AHEAD;
    const lz = carGroup.position.z - Math.cos(rot)*C.CAM_LOOK_AHEAD;
    cam.lookAt(lx, 1.5, lz);

    // Sun follows
    sun.position.set(carGroup.position.x+60, 90, carGroup.position.z-40);
    sun.target.position.copy(carGroup.position);
    sun.target.updateMatrixWorld();
}

function updateDust(dt){
    const p=dustPts.geometry.attributes.position.array;
    const cx=carGroup.position.x, cz=carGroup.position.z;
    for(let i=0;i<p.length;i+=3){
        p[i]+=((Math.random()-.5)*.5);
        p[i+1]+=Math.random()*.1;
        p[i+2]+=((Math.random()-.5)*.5 + state.speed*dt*.3);
        if(p[i+1]>3) p[i+1]=Math.random()*.5;
        const dx=p[i]-cx, dz=p[i+2]-cz;
        if(Math.abs(dx)>12||Math.abs(dz)>12){
            p[i]=cx+(Math.random()-.5)*10;
            p[i+1]=Math.random()*1.5;
            p[i+2]=cz+(Math.random()-.5)*10+Math.random()*8;
        }
    }
    dustPts.geometry.attributes.position.needsUpdate=true;
}

/* ── GAME STATE TRANSITIONS ── */
function startGame(){
    $('welcomeScreen').style.display='none';
    canvas.style.display='block';
    hud.style.display='block';
    ctrl.style.display='block';
    state.phase='playing';
    state.t0=Date.now();
    state.dist=0;
    state.speed=C.CAR_BASE_SPEED;
    state.offRoadT=0;
    state.onRoad=true;
    resetInput();
    clock.start();
    loop();
}

function triggerDeath(){
    state.phase='dead';
    dstD.textContent='Bạn đã đi được '+state.dist.toFixed(2)+'km rồi, cố lên!';
    deathScr.style.display='flex';
    hud.style.display='none';
    ctrl.style.display='none';
}

function triggerEaster(){
    state.phase='easter';
    eastScr.style.display='flex';
    hud.style.display='none';
    ctrl.style.display='none';
}

function restart(){
    state.phase='playing';
    state.dist=0;
    state.speed=C.CAR_BASE_SPEED;
    state.offRoadT=0;
    state.onRoad=true;
    state.t0=Date.now();
    state.forkShown=false;

    carGroup.position.set(0,0,0);
    carGroup.rotation.y=0;

    // Reset segments
    segData.forEach(s=>{
        s.group.position.z = -s.idx * C.SEG_LEN;
    });

    deathScr.style.display='none';
    eastScr.style.display='none';
    hud.style.display='block';
    ctrl.style.display='block';
    forkWarn.style.display='none';
    resetInput();
    clock.start();
    loop();
}

function resetInput(){
    inp.left=inp.right=inp.gas=inp.brake=false;
    document.querySelectorAll('.ctrl-btn').forEach(b=>b.classList.remove('active'));
}

/* ── PAUSE / RESUME (Android bridge) ── */
window.pauseGame = function(){
    state.paused=true;
    clock.stop();
};
window.resumeGame = function(){
    state.paused=false;
    clock.start();
    loop();
};

/* ── BOOT ── */
init();

})();
