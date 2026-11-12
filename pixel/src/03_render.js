// ---------- render pipeline ----------
// Real 3D geometry -> small render target (one texel = one art pixel) -> post pass: outline wherever depth jumps,
// ordered dither, snap to the palette -> the small canvas is scaled up by a whole number of device pixels.
// Camera: orthographic, 30 degrees above the horizon, so a ground tile is exactly 32 x 16 art pixels (classic 2:1 isometric).
const scene = new THREE.Scene();
const BASE_PPU = 32 / Math.SQRT2;            // art pixels per world unit when a tile is 32 px wide
const VIEW = {
  az: Math.PI / 4, azCur: Math.PI / 4, elev: 30 * DEG, ppu: BASE_PPU, s: 1, target: new THREE.Vector3(N / 2, 0, N / 2),
  W: 320, H: 180, zooms: [{ s: 1, dp: 2 }], zoomIdx: 0, css: 2,
  dir: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), fwd: new THREE.Vector3(), T: new THREE.Vector3(),
};
const R = { renderer: null, canvas: null, stage: null, rt: null, post: null, postScene: null, postCam: null, camera: null, sun: null, hemi: null, shadowDirty: true, t: 0 };
const UNI = { detail: { value: 0 }, night: { value: 0 }, glowA: { value: new THREE.Vector3(1.0, 0.86, 0.42) }, glowB: { value: new THREE.Vector3(0.78, 0.92, 1.0) } };
const MAT = {};
const WATER_Y = -0.14;

const POST_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const POST_FRAG = `
precision highp float;
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tLut;
uniform vec2 uRes; uniform float uRange; uniform float uThr; uniform float uDither; uniform float uOutline; uniform float uAlphaBg;
varying vec2 vUv;
float bayer4(vec2 p){ vec2 q = mod(floor(p), 4.0);
  float x0 = mod(q.x, 2.0), x1 = floor(q.x / 2.0), y0 = mod(q.y, 2.0), y1 = floor(q.y / 2.0);
  return (abs(x0 - y0) * 8.0 + y0 * 4.0 + abs(x1 - y1) * 2.0 + y1 + 0.5) / 16.0; }
void main(){
  vec2 px = floor(vUv * uRes), t = 1.0 / uRes;
  vec3 c = texture2D(tColor, vUv).rgb;
  float d = texture2D(tDepth, vUv).x, a = 1.0;
  bool empty = d > 0.99999;
  float dl = texture2D(tDepth, vUv - vec2(t.x, 0.0)).x, dr = texture2D(tDepth, vUv + vec2(t.x, 0.0)).x;
  float du = texture2D(tDepth, vUv + vec2(0.0, t.y)).x, dn = texture2D(tDepth, vUv - vec2(0.0, t.y)).x;
  bool edge = uOutline > 0.5 && max(max(d - dl, d - dr), max(d - du, d - dn)) * uRange > uThr;
  if (edge) c = empty ? vec3(0.08, 0.09, 0.13) : c * vec3(0.42, 0.42, 0.52);
  else if (empty && uAlphaBg > 0.5) a = 0.0;
  c += (bayer4(px) - 0.5) * uDither;
  vec3 q = floor(clamp(c, 0.0, 1.0) * 63.0 + 0.5);
  vec2 uv = (vec2(mod(q.b, 8.0), floor(q.b / 8.0)) * 64.0 + q.rg + 0.5) / 512.0;
  gl_FragColor = vec4(texture2D(tLut, uv).rgb, a);
}`;

// Lit, vertex-coloured material. The extra "glow" vertex attribute marks windows (0..1: lights up once night passes that value)
// and self-lit signs (2+: shows its own colour unshaded at night).
function makeLit() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uNight = UNI.night; sh.uniforms.uGlowA = UNI.glowA; sh.uniforms.uGlowB = UNI.glowB; sh.uniforms.uDetail = UNI.detail;
    // fine-detail triangles (lod above the current detail level) are thrown outside the view, so one mesh serves every zoom
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nattribute float lod;\nuniform float uDetail;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nif (lod > uDetail + 0.5) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform float uNight;\nuniform vec3 uGlowA;\nuniform vec3 uGlowB;')
      .replace('#include <tonemapping_fragment>', `
  if (vGlow > 1.5) { gl_FragColor.rgb = mix(gl_FragColor.rgb, vColor.rgb, step(vGlow - 1.99, uNight)); }
  else if (vGlow > 0.01) { gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(uGlowA, uGlowB, step(0.84, fract(vGlow * 7.31))), step(vGlow, uNight)); }
  #include <tonemapping_fragment>`);
  };
  return m;
}
const WATER_VERT = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const WATER_FRAG = `
precision highp float;
uniform float uTime; uniform sampler2D tShore; uniform vec3 uTint; uniform vec2 uOrg; uniform float uSize;
uniform vec3 cDeep; uniform vec3 cMid; uniform vec3 cShal; uniform vec3 cFoam; uniform vec3 cGlint;
varying vec3 vW;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec2 uv = (vW.xz - uOrg) / uSize;
  float d = 4.0;
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) d = texture2D(tShore, uv).r * 4.0;
  float wob = sin(uTime * 1.2 + vW.x * 2.1 + vW.z * 1.7);
  vec3 c = cDeep;
  if (d < 2.5 + wob * 0.15) c = cMid;
  if (d < 1.1 + wob * 0.08) c = cShal;
  if (d < 0.2 + wob * 0.07) c = cFoam;
  vec2 gp = floor(vW.xz * 8.0);
  float h = hash(gp + floor(uTime * 1.5 + hash(gp) * 9.0) * 0.37);
  if (h > 0.988 && d > 0.45) c = mix(c, cGlint, 0.55);
  gl_FragColor = vec4(c * uTint, 1.0);
}`;

function initPipeline(canvas, stage) {
  R.canvas = canvas; R.stage = stage;
  const r = R.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  r.setPixelRatio(1);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.shadowMap.autoUpdate = false;
  r.outputEncoding = THREE.LinearEncoding;
  R.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 260);
  R.post = new THREE.ShaderMaterial({
    vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
    uniforms: { tColor: { value: null }, tDepth: { value: null }, tLut: { value: buildLut() }, uRes: { value: new THREE.Vector2(320, 180) }, uRange: { value: 259 }, uThr: { value: 0.2 }, uDither: { value: 0.055 }, uOutline: { value: 1 }, uAlphaBg: { value: 0 } },
  });
  R.postScene = new THREE.Scene(); R.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), R.post); quad.frustumCulled = false; R.postScene.add(quad);

  MAT.lit = makeLit();          // ordinary meshes
  MAT.inst = makeLit();         // instanced meshes (trees, cars, coins): three r128 keeps one shader per material, so the two kinds must not share
  MAT.water = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
    uniforms: { uTime: { value: 0 }, tShore: { value: null }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uOrg: { value: new THREE.Vector2(-12, -12) }, uSize: { value: N + 24 },
      cDeep: { value: new THREE.Color(PAL.b2) }, cMid: { value: new THREE.Color('#2a68d8') }, cShal: { value: new THREE.Color(PAL.b3) }, cFoam: { value: new THREE.Color(PAL.b5) }, cGlint: { value: new THREE.Color(PAL.b4) } },
  });
  MAT.hl = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthTest: false, depthWrite: false });
  MAT.cover = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.36, depthWrite: false });
  MAT.coin = new THREE.MeshBasicMaterial({ vertexColors: true });
  MAT.icon = new THREE.MeshBasicMaterial({ vertexColors: true });
  MAT.puff = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });

  // sun (casts the only shadow) + sky fill
  const k = R.sun = new THREE.DirectionalLight(0xffffff, 0.55); k.castShadow = true; k.shadow.mapSize.set(2048, 2048);
  const c = k.shadow.camera; c.left = -31; c.right = 31; c.top = 31; c.bottom = -31; c.near = 1; c.far = 170;
  k.shadow.bias = -0.0006; k.shadow.normalBias = 0.02; k.target.position.set(N / 2, 0, N / 2);
  R.hemi = new THREE.HemisphereLight(0xffffff, 0xd0d0e0, 0.58);
  scene.add(k, k.target, R.hemi);
}
function makeTargets(w, h) {
  if (R.rt) { R.rt.depthTexture.dispose(); R.rt.dispose(); }
  const depth = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
  R.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, depthBuffer: true, depthTexture: depth });
}
// Zoom ladder. The far steps only change how big an art pixel is drawn (dp device pixels). The near steps instead
// double the resolution of the art itself (s = 2, then 4), which is when the fine detail and the people appear.
function initZoom() {
  const dpr = window.devicePixelRatio || 1, seen = new Set(), L = [];
  for (const [s, k] of [[1, 1], [1, 1.5], [1, 2], [1, 3], [2, 2], [2, 3], [4, 2]]) { const dp = Math.max(1, Math.round(k * dpr)); if (!seen.has(s * dp)) { seen.add(s * dp); L.push({ s, dp }); } }
  VIEW.zooms = L.sort((a, b) => a.s * a.dp - b.s * b.dp);
  const want = (window.innerWidth < 700 ? 1.5 : 2) * dpr; let bi = 0;
  L.forEach((z, i) => { if (z.s === 1 && Math.abs(z.dp - want) < Math.abs(L[bi].dp - want)) bi = i; });
  VIEW.zoomIdx = bi;
}
// one art pixel = a whole number of device pixels, so the picture stays crisp at every zoom step
function resizeView() {
  const box = R.stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, z = VIEW.zooms[VIEW.zoomIdx], dp = z.dp;
  VIEW.s = z.s; VIEW.ppu = BASE_PPU * z.s; UNI.detail.value = z.s >= 4 ? 2 : z.s >= 2 ? 1 : 0;
  const w = Math.max(64, Math.ceil(box.width * dpr / dp)), h = Math.max(64, Math.ceil(box.height * dpr / dp));
  VIEW.W = w; VIEW.H = h; VIEW.css = dp / dpr;
  R.renderer.setSize(w, h, false);
  R.canvas.style.width = (w * dp / dpr) + 'px'; R.canvas.style.height = (h * dp / dpr) + 'px';
  makeTargets(w, h);
}
function updateCamera(dt) {
  const d = wrapPi(VIEW.az - VIEW.azCur);
  if (Math.abs(d) < 0.002) { if (VIEW.azCur !== VIEW.az) { VIEW.azCur = VIEW.az; R.shadowDirty = true; } }
  else { VIEW.azCur += d * Math.min(1, dt * 11); R.shadowDirty = true; }
  const a = VIEW.azCur, e = VIEW.elev, ppu = VIEW.ppu, c = R.camera;
  VIEW.dir.set(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
  VIEW.right.set(Math.cos(a), 0, -Math.sin(a));
  VIEW.up.set(-Math.sin(e) * Math.sin(a), Math.cos(e), -Math.sin(e) * Math.cos(a));
  VIEW.fwd.set(-Math.sin(a), 0, -Math.cos(a));
  // snap the look-at point to whole art pixels so still geometry never shimmers while panning
  const T = VIEW.T.copy(VIEW.target), wpp = 1 / ppu;
  const sx = Math.round(T.dot(VIEW.right) / wpp) * wpp - T.dot(VIEW.right), sy = Math.round(T.dot(VIEW.up) / wpp) * wpp - T.dot(VIEW.up);
  T.addScaledVector(VIEW.right, sx).addScaledVector(VIEW.up, sy);
  c.left = -VIEW.W / 2 / ppu; c.right = VIEW.W / 2 / ppu; c.top = VIEW.H / 2 / ppu; c.bottom = -VIEW.H / 2 / ppu; c.updateProjectionMatrix();
  c.position.copy(T).addScaledVector(VIEW.dir, 110); c.lookAt(T); c.updateMatrixWorld(true);
  // the sun rides with the camera, so every quarter turn is lit the same way: left walls bright, right walls shaded, shadows falling right
  const L = _v1.copy(VIEW.right).multiplyScalar(-0.60).addScaledVector(VIEW.fwd, 0.10); L.y = 0.85; L.normalize();
  R.sun.position.set(N / 2, 0, N / 2).addScaledVector(L, 85);
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();

// css pixel (relative to the stage) -> point on the ground plane
function screenToGround(cx, cy, out) {
  const sx = cx / VIEW.css, sy = cy / VIEW.css, ppu = VIEW.ppu;
  const P = _v2.copy(VIEW.T).addScaledVector(VIEW.right, (sx - VIEW.W / 2) / ppu).addScaledVector(VIEW.up, (VIEW.H / 2 - sy) / ppu);
  const s = P.y / VIEW.dir.y;
  return (out || new THREE.Vector3()).copy(P).addScaledVector(VIEW.dir, -s);
}
// world point -> css pixel (relative to the stage)
function worldToScreen(x, y, z) {
  const rx = x - VIEW.T.x, ry = y - VIEW.T.y, rz = z - VIEW.T.z, r = VIEW.right, u = VIEW.up;
  return [(VIEW.W / 2 + (rx * r.x + ry * r.y + rz * r.z) * VIEW.ppu) * VIEW.css, (VIEW.H / 2 - (rx * u.x + ry * u.y + rz * u.z) * VIEW.ppu) * VIEW.css];
}

// ---------- time of day ----------
const TOD = {
  day: { sun: [1.0, 0.98, 0.93], si: 0.55, sky: [1.0, 1.0, 1.0], gnd: [0.80, 0.80, 0.88], hi: 0.58, night: 0, water: [1, 1, 1] },
  dusk: { sun: [1.0, 0.66, 0.40], si: 0.50, sky: [0.92, 0.74, 0.80], gnd: [0.56, 0.50, 0.72], hi: 0.52, night: 0.4, water: [0.86, 0.66, 0.84] },
  night: { sun: [0.50, 0.60, 1.0], si: 0.24, sky: [0.38, 0.46, 0.80], gnd: [0.26, 0.29, 0.58], hi: 0.58, night: 1, water: [0.24, 0.27, 0.52] },
};
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function todBlend(A, B, t) {
  return { sun: mix3(A.sun, B.sun, t), si: lerp(A.si, B.si, t), sky: mix3(A.sky, B.sky, t), gnd: mix3(A.gnd, B.gnd, t), hi: lerp(A.hi, B.hi, t), night: lerp(A.night, B.night, t), water: mix3(A.water, B.water, t) };
}
// phase 0..1 over one full day: long day, dusk, night, dawn
function todAt(ph) {
  const D = TOD.day, K = TOD.dusk, Nn = TOD.night, s = x => x * x * (3 - 2 * x);
  if (ph < 0.50) return D;
  if (ph < 0.58) return todBlend(D, K, s((ph - 0.50) / 0.08));
  if (ph < 0.66) return todBlend(K, Nn, s((ph - 0.58) / 0.08));
  if (ph < 0.86) return Nn;
  if (ph < 0.93) return todBlend(Nn, K, s((ph - 0.86) / 0.07));
  return todBlend(K, D, s((ph - 0.93) / 0.07));
}
function applyTod(L) {
  R.sun.color.setRGB(L.sun[0], L.sun[1], L.sun[2]); R.sun.intensity = L.si;
  R.hemi.color.setRGB(L.sky[0], L.sky[1], L.sky[2]); R.hemi.groundColor.setRGB(L.gnd[0], L.gnd[1], L.gnd[2]); R.hemi.intensity = L.hi;
  UNI.night.value = L.night; MAT.water.uniforms.uTint.value.set(L.water[0], L.water[1], L.water[2]);
}

function renderFrame(t) {
  const r = R.renderer, u = R.post.uniforms;
  if (R.shadowDirty) { r.shadowMap.needsUpdate = true; R.shadowDirty = false; }
  MAT.water.uniforms.uTime.value = t;
  u.tColor.value = R.rt.texture; u.tDepth.value = R.rt.depthTexture; u.uRes.value.set(VIEW.W, VIEW.H);
  u.uRange.value = R.camera.far - R.camera.near; u.uThr.value = 0.07 + 2.9 / VIEW.ppu; u.uAlphaBg.value = 0; u.uDither.value = VIEW.s > 1 ? 0.034 : 0.055;      // close up, big flat walls want a quieter dither
  r.setRenderTarget(R.rt); r.setClearColor(0x1f55c8, 1); r.clear(); r.render(scene, R.camera);
  r.setRenderTarget(null); r.render(R.postScene, R.postCam);
}

// ---------- thumbnails: the tool buttons show the real models, drawn by the same pipeline ----------
function renderThumb(geo, S) {
  const r = R.renderer, sc = new THREE.Scene(), mesh = new THREE.Mesh(geo, MAT.lit);
  const sun = new THREE.DirectionalLight(0xffffff, 0.55), hemi = new THREE.HemisphereLight(0xffffff, 0xd0d0e0, 0.58);
  sc.add(mesh, sun, hemi);
  const a = Math.PI / 4, e = 30 * DEG, dir = new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)), right = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
  const up = new THREE.Vector3(-Math.sin(e) * Math.sin(a), Math.cos(e), -Math.sin(e) * Math.cos(a)), fwd = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a));
  sun.position.copy(right).multiplyScalar(-0.60).addScaledVector(fwd, 0.10); sun.position.y = 0.85;
  // fit the model's bounding box into the frame
  const bb = geo.boundingBox; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const p = new THREE.Vector3();
  for (let i = 0; i < 8; i++) { p.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z); const px = p.dot(right), py = p.dot(up); x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  const ppu = Math.min((S - 3) / (x1 - x0), (S - 3) / (y1 - y0)), T = new THREE.Vector3().addScaledVector(right, (x0 + x1) / 2).addScaledVector(up, (y0 + y1) / 2);
  const cam = new THREE.OrthographicCamera(-S / 2 / ppu, S / 2 / ppu, S / 2 / ppu, -S / 2 / ppu, 1, 120);
  cam.position.copy(T).addScaledVector(dir, 50); cam.lookAt(T); cam.updateMatrixWorld(true);
  const depth = new THREE.DepthTexture(S, S, THREE.UnsignedIntType);
  const rtA = new THREE.WebGLRenderTarget(S, S, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, depthBuffer: true, depthTexture: depth });
  const rtB = new THREE.WebGLRenderTarget(S, S, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, depthBuffer: false });
  const u = R.post.uniforms, night = UNI.night.value, det = UNI.detail.value; UNI.night.value = 0; UNI.detail.value = 0;
  r.setRenderTarget(rtA); r.setClearColor(0x000000, 0); r.clear(); r.render(sc, cam);
  u.tColor.value = rtA.texture; u.tDepth.value = depth; u.uRes.value.set(S, S); u.uRange.value = 119; u.uThr.value = 0.07 + 2.9 / ppu; u.uAlphaBg.value = 1;
  r.setRenderTarget(rtB); r.clear(); r.render(R.postScene, R.postCam);
  const buf = new Uint8Array(S * S * 4); r.readRenderTargetPixels(rtB, 0, 0, S, S, buf);
  r.setRenderTarget(null); UNI.night.value = night; UNI.detail.value = det; u.uAlphaBg.value = 0;
  rtA.dispose(); rtB.dispose(); depth.dispose();
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) img.data.set(buf.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL();
}
