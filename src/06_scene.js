// ---------- scene: turns the town state into meshes, and runs the small moving things (cars, smoke, coins) ----------
const CAR_CAP = 70, PART_CAP = 520, COIN_CAP = 12, WALK_CAP = 36, BUB_CAP = 14;
const SCN = { terrain: null, water: null, roads: null, trees: [], bm: new Map(), anims: [], cars: [], carMesh: null, parts: [], partMesh: null, coinMesh: null, hl: null, cover: null, smokeT: 0, geo: {},
  walkers: [], walkMesh: [], bubs: [], bubGeo: {}, needs: [], needT: 0, balloon: null };
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _sc = new THREE.Vector3(), _ps = new THREE.Vector3(), _c3 = new THREE.Color(), _yAxis = new THREE.Vector3(0, 1, 0);
const landAt = (x, y) => inMap(x, y) && G.terr[idx(x, y)] > 0;

// An instanced mesh with room for cap copies. The colour buffer is made at full size up front:
// three sizes it from mesh.count the first time setColorAt runs, and these meshes start out empty.
function instanced(geo, mat, cap) {
  const m = new THREE.InstancedMesh(geo, mat, cap);
  m.instanceColor = new THREE.BufferAttribute(new Float32Array(cap * 3).fill(1), 3);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scene.add(m);
  return m;
}
function initScene() {
  const wg = new THREE.PlaneGeometry(420, 420); wg.rotateX(-Math.PI / 2);
  SCN.water = new THREE.Mesh(wg, MAT.water); SCN.water.position.set(N / 2, WATER_Y, N / 2); scene.add(SCN.water);
  // cars
  let g = new Geo();
  g.box(-1.2 * U, 0.4 * V, -2.5 * U, 1.2 * U, 2 * V, 2.5 * U, PAL.white, 'b'); g.box(-1.1 * U, 2 * V, -1.7 * U, 1.1 * U, 3.3 * V, 1 * U, PAL.g2, 'b');
  g.glow = 2.0; g.rs(-1.1 * U, -0.4 * U, 0.9 * V, 1.6 * V, 2.5 * U, PAL.y4); g.rs(0.4 * U, 1.1 * U, 0.9 * V, 1.6 * V, 2.5 * U, PAL.y4); g.glow = 0;
  g.lod = 1;                                                             // close up: wheels and tail lights
  for (const sx of [-1, 1]) for (const sz of [-1.5 * U, 1.5 * U]) g.box(sx > 0 ? 1 * U : -1.4 * U, 0, sz - 0.5 * U, sx > 0 ? 1.4 * U : -1 * U, 1 * V, sz + 0.5 * U, PAL.ink, 'b');
  g.glow = 2.0; g.rn(-1.1 * U, -0.5 * U, 0.9 * V, 1.6 * V, -2.5 * U, PAL.r3); g.rn(0.5 * U, 1.1 * U, 0.9 * V, 1.6 * V, -2.5 * U, PAL.r3); g.glow = 0; g.lod = 0;
  SCN.carMesh = instanced(g.build(), MAT.inst, CAR_CAP);
  // particles
  SCN.partMesh = instanced(new THREE.BoxGeometry(1, 1, 1), MAT.puff, PART_CAP); SCN.partMesh.renderOrder = 5;
  // coins: a thick 8-sided disc standing on edge
  g = new Geo(); const cr = 2.7 * U, ct = 0.6 * U;
  g.cyl(0, -ct, 0, cr, 2 * ct, 8, PAL.y1, { top: PAL.y3 });
  for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i / 8 * TAU, b = Math.PI / 8 + (i + 1) / 8 * TAU; g.tri([0, -ct, 0], [Math.cos(a) * cr, -ct, Math.sin(a) * cr], [Math.cos(b) * cr, -ct, Math.sin(b) * cr], PAL.y3, [0, -1, 0]); }
  g.flat(-0.5 * U, -1.4 * U, 0.5 * U, 1.4 * U, ct + 0.003, PAL.y1);
  const cg = g.build(); cg.rotateX(Math.PI / 2);
  SCN.coinMesh = instanced(cg, MAT.coin, COIN_CAP);          // unlit, so a coin stays bright from every side and at night
  // cursor: a square frame per tile, drawn over everything. Tint: a flat tile that hugs the ground (footprints and coverage).
  const P = [], o = 0.5, w = 0.13, strip = (x0, z0, x1, z1) => P.push(x0, 0, z1, x1, 0, z1, x1, 0, z0, x0, 0, z1, x1, 0, z0, x0, 0, z0);
  strip(-o, -o, o, -o + w); strip(-o, o - w, o, o); strip(-o, -o + w, -o + w, o - w); strip(o - w, -o + w, o, o - w);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  SCN.hl = instanced(fg, MAT.hl, 96); SCN.hl.renderOrder = 10;
  const cgq = new THREE.PlaneGeometry(1, 1); cgq.rotateX(-Math.PI / 2);
  SCN.cover = instanced(cgq, MAT.cover, 560); SCN.cover.renderOrder = 4;
  // tree shapes
  g = new Geo(); treePine(g, 0, 0, 1, PAL.gr1, 0); SCN.geo.pine = g.build();
  g = new Geo(); treeRound(g, 0, 0, 1, PAL.gr2, 0); SCN.geo.round = g.build();
  // people: little box figures, one instanced mesh per shirt colour. All fine detail, so they only exist close up.
  WALK_COLS.forEach((col, i) => {
    g = new Geo(); g.lod = 1; const skin = [PAL.sand2, PAL.br3, PAL.r4, PAL.br2][i % 4], hair = [PAL.br0, PAL.ink, PAL.y1, PAL.g2][(i * 3) % 4];
    g.box(-0.4 * U, 0, -0.25 * U, 0.4 * U, 1.3 * V, 0.25 * U, i % 2 ? PAL.g1 : PAL.b1, 'b');
    g.box(-0.5 * U, 1.3 * V, -0.3 * U, 0.5 * U, 2.9 * V, 0.3 * U, col, 'b');
    g.box(-0.4 * U, 2.9 * V, -0.3 * U, 0.4 * U, 3.8 * V, 0.3 * U, { s: skin, t: hair }, 'b');
    SCN.walkMesh.push(instanced(g.build(), MAT.inst, WALK_CAP));
  });
  // "I need..." bubbles: 1-bit style icons built as flat geometry that always faces the camera
  for (const k in ICONS) SCN.bubGeo[k] = bubbleGeo(ICONS[k]);
  for (let i = 0; i < BUB_CAP; i++) { const m = new THREE.Mesh(SCN.bubGeo.road, MAT.icon); m.visible = false; scene.add(m); SCN.bubs.push(m); }
  // the gift balloon
  g = new Geo(); mBalloon(g); SCN.balloon = new THREE.Mesh(g.build(), MAT.lit); SCN.balloon.visible = false; SCN.balloon.userData = { on: false }; scene.add(SCN.balloon);
}

const WALK_COLS = [PAL.r2, PAL.b3, PAL.y2, PAL.white, PAL.t2, PAL.m1];
// 7x7 icons; letters pick palette colours
const ICON_COL = { G: PAL.gr2, B: PAL.br1, R: PAL.r2, Y: PAL.y2, C: PAL.s3, T: PAL.t2, D: PAL.br0, K: PAL.br2, N: PAL.b1, A: PAL.g2, L: PAL.y3, S: PAL.g3, P: PAL.r4, U: PAL.b3, O: PAL.o1, M: PAL.y1 };
const ICONS = {
  tree: ['...G...', '..GGG..', '.GGGGG.', '..GGG..', '.GGGGG.', 'GGGGGGG', '...B...'],
  shop: ['RYRYRYR', 'RYRYRYR', '.CCCCC.', '.CTTDC.', '.CTTDC.', '.CTTDC.', '.......'],
  jobs: ['.......', '..KKK..', '.K...K.', 'KKKKKKK', 'KKKYKKK', 'KKKKKKK', 'KKKKKKK'],
  school: ['...N...', '.NNNNN.', 'NNNNNNN', '.NNNNN.', '..NNNY.', '..NNNY.', '.....Y.'],
  road: ['.......', 'AAAAAAA', 'AAAAAAA', 'LLALALL', 'AAAAAAA', 'AAAAAAA', '.......'],
  smog: ['.......', '..SS...', '.SSSSS.', 'SSSSSSS', 'SSSSSSS', '.SSSSS.', '.......'],
  people: ['..PPP..', '..PPP..', '...P...', '.UUUUU.', '.UUUUU.', '.UUUUU.', '.U...U.'],
  merge: ['OOO.OOO', 'OOO.OOO', 'OOO.OOO', '.......', 'OOO.OOO', 'OOO.OOO', 'OOO.OOO'],
  star: ['...M...', '...M...', 'MMMMMMM', '.MMMMM.', '..MMM..', '.MM.MM.', '.M...M.'],
};
const BUB_BODY = ['..#######..', '.#########.', '###########', '###########', '###########', '###########', '###########', '###########', '###########', '.#########.', '..#######..', '....###....', '.....#.....'];
function bubbleGeo(icon) {
  const g = new Geo(), px = 1 / BASE_PPU, H = BUB_BODY.length, n = [0, 0, 1];
  const rect = (c0, c1, r, z, col) => { const x0 = (c0 - 5.5) * px, x1 = (c1 - 5.5) * px, y0 = (H - 1 - r) * px, y1 = (H - r) * px; g.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], col, n); };
  BUB_BODY.forEach((row, r) => { let c = 0; while (c < 11) { if (row[c] !== '#') { c++; continue; } let e = c; while (e < 11 && row[e] === '#') e++; rect(c, e, r, 0, PAL.white); c = e; } });
  icon.forEach((row, r) => { for (let c = 0; c < 7; c++) if (row[c] !== '.') rect(c + 2, c + 3, r + 2, 0.01, ICON_COL[row[c]]); });
  return g.build();
}
function mBalloon(g) {
  const prof = [[5 * V, 1.2 * U], [8 * V, 3.6 * U], [12 * V, 5.2 * U], [16 * V, 5.4 * U], [19.5 * V, 4 * U], [21.5 * V, 1.6 * U]], seg = 8, cols = [PAL.r2, PAL.y3];
  for (let k = 0; k < prof.length - 1; k++) for (let i = 0; i < seg; i++) {
    const a = i / seg * TAU, b = (i + 1) / seg * TAU, y0 = prof[k][0], r0 = prof[k][1], y1 = prof[k + 1][0], r1 = prof[k + 1][1];
    g.quad([Math.cos(b) * r0, y0, Math.sin(b) * r0], [Math.cos(a) * r0, y0, Math.sin(a) * r0], [Math.cos(a) * r1, y1, Math.sin(a) * r1], [Math.cos(b) * r1, y1, Math.sin(b) * r1], cols[i % 2]);
  }
  g.cyl(0, 21.5 * V, 0, 1.6 * U, 0.6 * V, 8, PAL.r1, { a0: 0 });
  g.boxc(0, 0, 0, 2.4 * U, 2 * V, 2.4 * U, { s: PAL.br2, t: PAL.br1 }, '');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.boxc(sx * 1 * U, 2 * V, sz * 1 * U, 0.3 * U, 3.4 * V, 0.3 * U, PAL.g2);
  g.glow = 2.0; g.boxc(0, -2.2 * V, 0, 1.6 * U, 1.6 * V, 1.6 * U, PAL.m2, ''); g.glow = 0; g.boxc(0, -0.6 * V, 0, 0.3 * U, 0.7 * V, 0.3 * U, PAL.g2);      // the gift
}

function buildTerrain() {
  if (SCN.terrain) { scene.remove(SCN.terrain); SCN.terrain.geometry.dispose(); }
  const g = new Geo(), sd = G.seed, WY = WATER_Y - 0.02;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = G.terr[idx(x, y)]; if (!t) continue;
    g.flat(x, y, x + 1, y + 1, 0, t === 1 ? PAL.sand1 : PAL.gr3);
    // flat palette colours for the ground (a gradient would dither into stray dotted lines), with a few specks for texture
    const h = hash2(x, y, sd + 21);
    if (h < 0.5) { const tx = x + 0.1 + hash2(x, y, sd + 22) * 0.7, tz = y + 0.1 + hash2(x, y, sd + 23) * 0.7; g.flat(tx, tz, tx + 2 * U, tz + U, 0.004, t === 1 ? (h < 0.25 ? PAL.sand2 : PAL.br3) : (h < 0.25 ? PAL.gr4 : PAL.gr2)); }
    g.lod = 1;                               // close up: more tufts, wild flowers, pebbles
    for (let k = 0; k < 4; k++) {
      const a = hash2(x * 5 + k, y, sd + 31), b = hash2(x, y * 5 + k, sd + 32), fx = x + 0.06 + a * 0.86, fz = y + 0.06 + b * 0.86;
      if (t === 1) g.flat(fx, fz, fx + U, fz + 0.5 * U, 0.004, a < 0.5 ? PAL.sand2 : PAL.br3);
      else if ((a * 7) % 1 < 0.2) g.flat(fx, fz, fx + 0.5 * U, fz + 0.5 * U, 0.005, [PAL.m2, PAL.y3, PAL.white, PAL.y3, PAL.r4][k + (b < 0.5 ? 1 : 0)]);
      else g.flat(fx, fz, fx + U, fz + 0.5 * U, 0.004, b < 0.5 ? PAL.gr4 : PAL.gr2);
    }
    g.lod = 0;
    const sk = t === 1 ? PAL.br3 : PAL.br2;
    if (!landAt(x, y + 1)) g.quad([x, WY, y + 1], [x + 1, WY, y + 1], [x + 1, 0, y + 1], [x, 0, y + 1], sk, [0, 0, 1]);
    if (!landAt(x, y - 1)) g.quad([x + 1, WY, y], [x, WY, y], [x, 0, y], [x + 1, 0, y], sk, [0, 0, -1]);
    if (!landAt(x + 1, y)) g.quad([x + 1, WY, y + 1], [x + 1, WY, y], [x + 1, 0, y], [x + 1, 0, y + 1], sk, [1, 0, 0]);
    if (!landAt(x - 1, y)) g.quad([x, WY, y], [x, WY, y + 1], [x, 0, y + 1], [x, 0, y], sk, [-1, 0, 0]);
  }
  SCN.terrain = new THREE.Mesh(g.build(), MAT.lit); SCN.terrain.receiveShadow = true; scene.add(SCN.terrain);
  // distance-to-shore map for the water shader (shallows and a foam line)
  const S = 128, size = N + 24, org = -12, data = new Uint8Array(S * S * 4), shore = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (landAt(x, y) && !(landAt(x - 1, y) && landAt(x + 1, y) && landAt(x, y - 1) && landAt(x, y + 1))) shore.push(x, y);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const wx = org + (i + 0.5) / S * size, wz = org + (j + 0.5) / S * size; let best = 16;
    for (let k = 0; k < shore.length; k += 2) { const dx = Math.max(shore[k] - wx, 0, wx - shore[k] - 1), dz = Math.max(shore[k + 1] - wz, 0, wz - shore[k + 1] - 1), d = dx * dx + dz * dz; if (d < best) best = d; }
    const o = (j * S + i) * 4, v = Math.min(255, Math.sqrt(best) / 4 * 255); data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
  }
  const u = MAT.water.uniforms; if (u.tShore.value) u.tShore.value.dispose();
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true; u.tShore.value = tex;
  R.shadowDirty = true;
}

function buildRoads() {
  if (SCN.roads) { scene.remove(SCN.roads); SCN.roads.geometry.dispose(); SCN.roads = null; }
  const g = new Geo(), sw = 2 * U, yr = 0.012; G.roadList.length = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y); if (!G.road[i]) continue;
    G.roadList.push(i);
    const n = roadAt(x, y - 1), s = roadAt(x, y + 1), e = roadAt(x + 1, y), w = roadAt(x - 1, y), wet = G.terr[i] === 0;
    if (wet) { g.box(x, -0.07, y, x + 1, yr, y + 1, { s: PAL.g4, t: PAL.g2 }, 'b'); g.box(x + 0.5 - 2 * U, WATER_Y - 0.02, y + 0.5 - 2 * U, x + 0.5 + 2 * U, -0.07, y + 0.5 + 2 * U, PAL.g3, 'bt'); }
    else g.flat(x, y, x + 1, y + 1, yr, PAL.g2);
    const kc = wet ? { s: PAL.g5, t: PAL.g6 } : { s: PAL.g4, t: PAL.g5 }, kh = wet ? 2.2 * V : H0, kw = wet ? 1 * U : sw;
    if (!n) g.box(x, 0, y, x + 1, kh, y + kw, kc, 'b');
    if (!s) g.box(x, 0, y + 1 - kw, x + 1, kh, y + 1, kc, 'b');
    if (!w) g.box(x, 0, y + (n ? 0 : kw), x + kw, kh, y + 1 - (s ? 0 : kw), kc, 'b');
    if (!e) g.box(x + 1 - kw, 0, y + (n ? 0 : kw), x + 1, kh, y + 1 - (s ? 0 : kw), kc, 'b');
    if (!wet) {
      if (n && w) g.box(x, 0, y, x + sw, H0, y + sw, kc, 'b');
      if (n && e) g.box(x + 1 - sw, 0, y, x + 1, H0, y + sw, kc, 'b');
      if (s && w) g.box(x, 0, y + 1 - sw, x + sw, H0, y + 1, kc, 'b');
      if (s && e) g.box(x + 1 - sw, 0, y + 1 - sw, x + 1, H0, y + 1, kc, 'b');
    }
    if ((n || s) && !(e || w)) for (const o of [2, 10]) g.flat(x + 0.5 - U / 2, y + o * U, x + 0.5 + U / 2, y + (o + 4) * U, yr + 0.003, PAL.y2);
    else if ((e || w) && !(n || s)) for (const o of [2, 10]) g.flat(x + o * U, y + 0.5 - U / 2, x + (o + 4) * U, y + 0.5 + U / 2, yr + 0.003, PAL.y2);
    if (wet) continue;
    // close up: paving seams, zebra crossings at junctions, manholes, street lamps
    g.lod = 1; const ys = H0 + 0.002, q = 0.25 * U;
    for (const o of [4, 8, 12]) {
      if (!n) g.flat(x + o * U - q, y, x + o * U + q, y + sw, ys, PAL.g4);
      if (!s) g.flat(x + o * U - q, y + 1 - sw, x + o * U + q, y + 1, ys, PAL.g4);
      if (!w) g.flat(x, y + o * U - q, x + sw, y + o * U + q, ys, PAL.g4);
      if (!e) g.flat(x + 1 - sw, y + o * U - q, x + 1, y + o * U + q, ys, PAL.g4);
    }
    if ((n ? 1 : 0) + (s ? 1 : 0) + (e ? 1 : 0) + (w ? 1 : 0) >= 3) for (let k = 0; k < 6; k++) {
      const a = (2.5 + k * 2) * U;
      if (n) g.flat(x + a, y + 0.5 * U, x + a + U, y + 2.5 * U, yr + 0.003, PAL.g6);
      if (s) g.flat(x + a, y + 1 - 2.5 * U, x + a + U, y + 1 - 0.5 * U, yr + 0.003, PAL.g6);
      if (w) g.flat(x + 0.5 * U, y + a, x + 2.5 * U, y + a + U, yr + 0.003, PAL.g6);
      if (e) g.flat(x + 1 - 2.5 * U, y + a, x + 1 - 0.5 * U, y + a + U, yr + 0.003, PAL.g6);
    }
    if (hash2(x, y, 77) < 0.18) g.flat(x + 10 * U, y + 10 * U, x + 11.5 * U, y + 11.5 * U, yr + 0.002, PAL.g1);
    if ((x + y) % 2 === 0) {
      const ns = (n || s) && !(e || w), ew = (e || w) && !(n || s), c = 0.5, ph = 7 * V;
      if (ns) { g.box(x + 0.75 * U, H0, y + c - q, x + 1.25 * U, H0 + ph, y + c + q, PAL.g2, 'b'); g.box(x + 1.25 * U, H0 + ph - 0.5 * V, y + c - q, x + 3 * U, H0 + ph, y + c + q, PAL.g2, 'w'); g.glow = 2.0; g.box(x + 2.2 * U, H0 + ph - 1.1 * V, y + c - 0.4 * U, x + 3.2 * U, H0 + ph - 0.5 * V, y + c + 0.4 * U, PAL.y4, 't'); g.glow = 0; }
      else if (ew) { g.box(x + c - q, H0, y + 0.75 * U, x + c + q, H0 + ph, y + 1.25 * U, PAL.g2, 'b'); g.box(x + c - q, H0 + ph - 0.5 * V, y + 1.25 * U, x + c + q, H0 + ph, y + 3 * U, PAL.g2, 'n'); g.glow = 2.0; g.box(x + c - 0.4 * U, H0 + ph - 1.1 * V, y + 2.2 * U, x + c + 0.4 * U, H0 + ph - 0.5 * V, y + 3.2 * U, PAL.y4, 't'); g.glow = 0; }
    }
    g.lod = 0;
  }
  if (g.i.length) { SCN.roads = new THREE.Mesh(g.build(), MAT.lit); SCN.roads.receiveShadow = true; scene.add(SCN.roads); }
  R.shadowDirty = true;
}

function buildTrees() {
  for (const m of SCN.trees) scene.remove(m); SCN.trees.length = 0;
  const list = { pine: [], round: [] }, sd = G.seed;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = G.tree[idx(x, y)]; if (!n) continue;
    const conifer = fbm(x * 0.3, y * 0.3, sd + 31) > 0.5;
    for (let k = 0; k < n; k++) {
      const h1 = hash2(x * 3 + k, y, sd + 11), h2 = hash2(x, y * 3 + k, sd + 12), h3 = hash2(x + k * 7, y + k * 3, sd + 13);
      const px = x + (n === 1 ? 0.3 + h1 * 0.4 : 0.18 + ((k * 0.37 + h1 * 0.3) % 0.64)), pz = y + (n === 1 ? 0.3 + h2 * 0.4 : 0.18 + ((k * 0.53 + h2 * 0.3) % 0.64));
      (conifer !== (h3 > 0.86) ? list.pine : list.round).push(px, pz, 1.15 + h3 * 0.55, 0.86 + h1 * 0.26);
    }
  }
  for (const k of ['pine', 'round']) {
    const a = list[k], n = a.length / 4; if (!n) continue;
    const m = new THREE.InstancedMesh(SCN.geo[k], MAT.inst, n); m.frustumCulled = false; m.castShadow = true;
    for (let i = 0; i < n; i++) { _m4.compose(_ps.set(a[i * 4], 0, a[i * 4 + 1]), _q.setFromAxisAngle(_yAxis, a[i * 4 + 3] * 9), _sc.set(a[i * 4 + 2], a[i * 4 + 2], a[i * 4 + 2])); m.setMatrixAt(i, _m4); m.setColorAt(i, _c3.setScalar(a[i * 4 + 3])); }
    scene.add(m); SCN.trees.push(m);
  }
  R.shadowDirty = true;
}

// ---------- buildings ----------
function sceneAddBuilding(b, animate, big) {
  const m = getModel(b.kind, b.lvl, b.v), mesh = new THREE.Mesh(m.geo, MAT.lit);
  mesh.position.set(b.x + b.s / 2, 0, b.y + b.s / 2); mesh.rotation.y = b.rot * Math.PI / 2; mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData.h = m.h; mesh.userData.smoke = m.smoke; mesh.userData.b = b;
  scene.add(mesh); SCN.bm.set(b.id, mesh); R.shadowDirty = true;
  if (animate) { SCN.anims.push({ mesh, t: 0, dur: big ? 0.7 : 0.45 }); mesh.scale.set(1, 0.2, 1); dust(b, big ? 26 : 9); }
}
function sceneRemoveBuilding(b) {
  const mesh = SCN.bm.get(b.id); if (!mesh) return;
  scene.remove(mesh); SCN.bm.delete(b.id); SCN.anims = SCN.anims.filter(a => a.mesh !== mesh); R.shadowDirty = true;
}
function sceneGrowBuilding(b) {
  const mesh = SCN.bm.get(b.id); if (!mesh) return;
  const m = getModel(b.kind, b.lvl, b.v); mesh.geometry = m.geo; mesh.userData.h = m.h; mesh.userData.smoke = m.smoke;
  SCN.anims = SCN.anims.filter(a => a.mesh !== mesh); SCN.anims.push({ mesh, t: 0, dur: b.s > 1 ? 0.7 : 0.45 }); mesh.scale.set(1, 0.5, 1);
  dust(b, b.s > 1 ? 22 : 8); R.shadowDirty = true;
  onBuildingGrew(b);
}
function sceneTurnBuilding(b) { const mesh = SCN.bm.get(b.id); if (mesh) { mesh.rotation.y = b.rot * Math.PI / 2; R.shadowDirty = true; } }
function heightOf(b) { const m = SCN.bm.get(b.id); return m ? m.userData.h : 0.5; }
function sceneSyncAll() {
  for (const m of SCN.bm.values()) scene.remove(m);
  SCN.bm.clear(); SCN.anims.length = 0; SCN.cars.length = 0; SCN.parts.length = 0; SCN.walkers.length = 0; SCN.needs.length = 0; SCN.needT = 0;
  SCN.balloon.visible = false; SCN.balloon.userData.on = false; for (const m of SCN.bubs) m.visible = false;
  buildTerrain(); buildRoads(); buildTrees(); G.dirtyRoads = G.dirtyTrees = false;
  for (const b of G.blds.values()) sceneAddBuilding(b, false);
  setHighlights(null); setCover(null);
}

// ---------- particles ----------
function spawnPart(x, y, z, vx, vy, vz, life, size, grow, col, grav, lit) { if (SCN.parts.length < PART_CAP) SCN.parts.push({ x, y, z, vx, vy, vz, t: 0, life, size, grow, col, grav: grav || 0, lit: !!lit }); }
// a few bursts of sparks for the big moments
const FW_COLS = [0xffe066, 0xf078a8, 0x9fe3d4, 0xd85f3c, 0x7fb6f2, 0xf4f4ef];
function fireworks(x, y, z, n) {
  for (let k = 0; k < (n || 3); k++) setTimeout(() => {
    const bx = x + (Math.random() - 0.5) * 4, by = y + Math.random() * 1.5, bz = z + (Math.random() - 0.5) * 4, col = FW_COLS[Math.floor(Math.random() * FW_COLS.length)];
    for (let i = 0; i < 20; i++) { const a = Math.random() * TAU, e = Math.acos(Math.random() * 2 - 1), sp = 1.3 + Math.random() * 0.6; spawnPart(bx, by, bz, Math.sin(e) * Math.cos(a) * sp, Math.cos(e) * sp + 0.5, Math.sin(e) * Math.sin(a) * sp, 0.7 + Math.random() * 0.4, 0.1, -0.06, col, 1.9, true); }
  }, k * 220);
}
function dust(b, n) {
  const cx = b.x + b.s / 2, cz = b.y + b.s / 2, cols = [0xd4cab6, 0xcfd3d9, 0xb0a695];
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, rr = b.s * (0.3 + Math.random() * 0.3); spawnPart(cx + Math.cos(a) * rr, 0.08, cz + Math.sin(a) * rr, Math.cos(a) * 0.5, 0.5 + Math.random() * 0.7, Math.sin(a) * 0.5, 0.5 + Math.random() * 0.4, 0.09, 0.12, cols[i % 3], 1.6); }
}
function sparkle(x, y, z, n, col) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU; spawnPart(x, y, z, Math.cos(a) * 0.9, 0.6 + Math.random() * 1.2, Math.sin(a) * 0.9, 0.45 + Math.random() * 0.3, 0.07, -0.05, col, 2.6, true); } }
function stepParts(dt, simDt) {
  // chimneys
  SCN.smokeT -= simDt;
  if (SCN.smokeT <= 0) {
    SCN.smokeT = 0.3;
    for (const mesh of SCN.bm.values()) {
      const sm = mesh.userData.smoke; if (!sm || !mesh.userData.b.road) continue;
      const c = Math.cos(mesh.rotation.y), s = Math.sin(mesh.rotation.y);
      for (const p of sm) { if (Math.random() < 0.45) continue; const steam = p[3] === 1; spawnPart(mesh.position.x + p[0] * c + p[2] * s, p[1], mesh.position.z - p[0] * s + p[2] * c, 0.12 + Math.random() * 0.1, 0.5 + Math.random() * 0.25, -0.05, 2.2 + Math.random(), steam ? 0.16 : 0.1, steam ? 0.12 : 0.07, steam ? 0xf4f4ef : (Math.random() < 0.5 ? 0xaab0ba : 0x878d99)); }
    }
  }
  const P = SCN.parts, mesh = SCN.partMesh; let n = 0;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.t += dt;
    if (p.t >= p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= p.grav * dt;
  }
  const dim = 1 - 0.55 * UNI.night.value;
  for (const p of P) { const k = p.t / p.life, sz = Math.max(0.02, p.size + p.grow * p.t) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 * 0.7 : 1); _m4.compose(_ps.set(p.x, p.y, p.z), _q.identity(), _sc.set(sz, sz, sz)); mesh.setMatrixAt(n, _m4); mesh.setColorAt(n, _c3.set(p.col).multiplyScalar(p.lit ? 1 : dim)); n++; }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// ---------- cars: they wander the road network, keeping right ----------
const CAR_COLS = [0xb03e2e, 0x3b82e8, 0xf4f4ef, 0xe6bb2a, 0xaab0ba, 0x1a8a8f, 0x2f7d3b, 0xd9731c, 0x454a57, 0xc43a7a, 0xf4f4ef, 0xcfd3d9];
function spawnCar() {
  const L = G.roadList;
  for (let tries = 0; tries < 6; tries++) {
    const i = L[Math.floor(Math.random() * L.length)], x = i % N, y = Math.floor(i / N), opts = [];
    for (let d = 0; d < 4; d++) if (roadAt(x + DX[d], y + DY[d])) opts.push(d);
    if (!opts.length) continue;
    const d = opts[Math.floor(Math.random() * opts.length)], big = Math.random() < 0.12;
    return { x, y, d, pd: d, t: Math.random(), sp: big ? 1.1 : 1.3 + Math.random() * 0.7, col: big ? (Math.random() < 0.5 ? 0xe6bb2a : 0xf4f4ef) : CAR_COLS[Math.floor(Math.random() * CAR_COLS.length)], len: big ? 1.7 : 0.9 + Math.random() * 0.25 };
  }
  return null;
}
function stepCars(dt) {
  const L = G.roadList, want = L.length < 3 ? 0 : Math.min(CAR_CAP, Math.floor(L.length / 3), 3 + Math.floor(G.pop / 14)), C = SCN.cars, mesh = SCN.carMesh;
  while (C.length < want) { const c = spawnCar(); if (!c) break; C.push(c); }
  if (C.length > want) C.length = want;
  for (let i = 0; i < C.length; i++) {
    let c = C[i];
    if (!roadAt(c.x, c.y) || !roadAt(c.x + DX[c.d], c.y + DY[c.d])) { const nc = spawnCar(); if (!nc) { C.length = 0; break; } c = C[i] = nc; }
    c.t += dt * c.sp;
    if (c.t >= 1) {
      c.t -= 1; c.x += DX[c.d]; c.y += DY[c.d]; c.pd = c.d;
      const opts = []; for (let d = 0; d < 4; d++) if (d !== (c.d + 2) % 4 && roadAt(c.x + DX[d], c.y + DY[d])) opts.push(d);
      if (opts.length) { if (!(opts.includes(c.d) && Math.random() < 0.55)) c.d = opts[Math.floor(Math.random() * opts.length)]; }
      else c.d = (c.d + 2) % 4;
      if (c.t >= 1) c.t = 0.99;
    }
    const fx = DX[c.d], fz = DY[c.d], pfx = DX[c.pd], pfz = DY[c.pd]; let k = Math.min(1, c.t / 0.4); k = k * k * (3 - 2 * k);
    const rx = lerp(-pfz, -fz, k), rz = lerp(pfx, fx, k), a0 = Math.atan2(pfx, pfz), ang = a0 + wrapPi(Math.atan2(fx, fz) - a0) * k;
    _m4.compose(_ps.set(c.x + 0.5 + fx * c.t + rx * 0.17, 0.012, c.y + 0.5 + fz * c.t + rz * 0.17), _q.setFromAxisAngle(_yAxis, ang), _sc.set(1, 1, c.len));
    mesh.setMatrixAt(i, _m4); mesh.setColorAt(i, _c3.set(c.col));
  }
  mesh.count = C.length; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// ---------- floating coins ----------
function coinPos(c, t, out) {
  const b = G.blds.get(c.id); if (!b) return null;
  out[0] = b.x + b.s / 2; out[1] = heightOf(b) + 0.42 + Math.sin(t * 3 + c.id) * 0.06; out[2] = b.y + b.s / 2; return out;
}
const _cp = [0, 0, 0];
function stepCoins(t) {
  const mesh = SCN.coinMesh; let n = 0;
  for (const c of G.coinsFx) {
    if (n >= COIN_CAP || !coinPos(c, t, _cp)) continue;
    const left = c.born + c.ttl - G.time, blink = left < 5 && Math.floor(t * 6) % 2 === 0, s = blink ? 0.001 : 1.25;
    _m4.compose(_ps.set(_cp[0], _cp[1], _cp[2]), _q.setFromAxisAngle(_yAxis, t * 3.2 + c.id), _sc.set(s, s, s)); mesh.setMatrixAt(n++, _m4);
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
}

// ---------- highlights ----------
function fillTiles(mesh, list, y) {
  let n = 0;
  if (list) for (const t of list) { if (n >= mesh.instanceMatrix.count) break; _m4.makeTranslation(t.x + 0.5, y, t.y + 0.5); mesh.setMatrixAt(n, _m4); mesh.setColorAt(n, _c3.set(t.c)); n++; }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
function setHighlights(list) { fillTiles(SCN.hl, list, 0.06); }
function setCover(list) { fillTiles(SCN.cover, list, 0.045); }

// ---------- people: they stroll along the pavements, and only exist at the close zoom levels ----------
function spawnWalker() {
  const L = G.roadList;
  for (let tries = 0; tries < 6; tries++) {
    const i = L[Math.floor(Math.random() * L.length)], x = i % N, y = Math.floor(i / N), opts = [];
    if (G.terr[i] === 0) continue;
    for (let d = 0; d < 4; d++) if (roadAt(x + DX[d], y + DY[d])) opts.push(d);
    if (!opts.length) continue;
    const d = opts[Math.floor(Math.random() * opts.length)];
    return { x, y, d, pd: d, t: Math.random(), sp: 0.24 + Math.random() * 0.22, m: Math.floor(Math.random() * WALK_COLS.length), ph: Math.random() * 6 };
  }
  return null;
}
function stepWalkers(dt, t) {
  const W = SCN.walkers, M = SCN.walkMesh, cnt = M.map(() => 0);
  if (UNI.detail.value < 1 || G.roadList.length < 2) { for (const m of M) m.count = 0; return; }
  const want = Math.floor(Math.min(WALK_CAP * M.length * 0.7, G.roadList.length * 1.2, 5 + G.pop / 6));
  while (W.length < want) { const w = spawnWalker(); if (!w) break; W.push(w); }
  if (W.length > want) W.length = want;
  for (let i = 0; i < W.length; i++) {
    let c = W[i];
    if (!roadAt(c.x, c.y) || !roadAt(c.x + DX[c.d], c.y + DY[c.d])) { const nc = spawnWalker(); if (!nc) { W.length = 0; break; } c = W[i] = nc; }
    c.t += dt * c.sp;
    if (c.t >= 1) {
      c.t -= 1; c.x += DX[c.d]; c.y += DY[c.d]; c.pd = c.d;
      const opts = []; for (let d = 0; d < 4; d++) if (d !== (c.d + 2) % 4 && roadAt(c.x + DX[d], c.y + DY[d])) opts.push(d);
      if (opts.length) { if (!(opts.includes(c.d) && Math.random() < 0.6)) c.d = opts[Math.floor(Math.random() * opts.length)]; } else c.d = (c.d + 2) % 4;
      if (c.t >= 1) c.t = 0.99;
    }
    if (cnt[c.m] >= WALK_CAP) continue;
    const fx = DX[c.d], fz = DY[c.d], pfx = DX[c.pd], pfz = DY[c.pd]; let k = Math.min(1, c.t / 0.3); k = k * k * (3 - 2 * k);
    const rx = lerp(-pfz, -fz, k), rz = lerp(pfx, fx, k), a0 = Math.atan2(pfx, pfz), ang = a0 + wrapPi(Math.atan2(fx, fz) - a0) * k;
    _m4.compose(_ps.set(c.x + 0.5 + fx * c.t + rx * 0.435, H0 + Math.abs(Math.sin(t * 9 + c.ph)) * 0.4 * V, c.y + 0.5 + fz * c.t + rz * 0.435), _q.setFromAxisAngle(_yAxis, ang), _sc.set(1, 1, 1));
    M[c.m].setMatrixAt(cnt[c.m]++, _m4);
  }
  M.forEach((m, j) => { m.count = cnt[j]; m.instanceMatrix.needsUpdate = true; });
}

// ---------- "I need..." bubbles over buildings that are stuck ----------
function stepBubbles(dt, t) {
  SCN.needT -= dt;
  if (SCN.needT <= 0) {
    SCN.needT = 0.7; SCN.needs.length = 0;
    for (const b of G.blds.values()) { const k = needIcon(b); if (k) SCN.needs.push({ b, k, o: (k === 'road' ? 0 : 1) + ((b.id * 0.618) % 1) }); }
    SCN.needs.sort((p, q) => p.o - q.o);
  }
  let n = 0; const sc = VIEW.s >= 4 ? 0.5 : 1;
  for (const e of SCN.needs) {
    if (n >= BUB_CAP) break;
    const b = e.b; if (!G.blds.has(b.id) || G.coinsFx.some(c => c.id === b.id)) continue;
    let k = 1;
    if (e.k !== 'road') { const ph = (t / 11 + (b.id * 0.618) % 1) % 1; if (ph > 0.42) continue; k = Math.min(1, ph / 0.015, (0.42 - ph) / 0.015); }   // each takes a turn: up for a few seconds, then gone for a while
    const m = SCN.bubs[n++]; m.geometry = SCN.bubGeo[e.k]; m.userData.b = b;
    m.position.set(b.x + b.s / 2, heightOf(b) + 0.22 + Math.sin(t * 2.6 + b.id) * 0.04, b.y + b.s / 2); m.quaternion.copy(R.camera.quaternion); m.scale.setScalar(Math.max(0.01, k) * sc); m.visible = true;
  }
  for (; n < BUB_CAP; n++) SCN.bubs[n].visible = false;
}
function bubbleAt(cx, cy) {
  const rad = 8 * VIEW.css * VIEW.s; let best = null, bd = rad * rad;
  for (const m of SCN.bubs) { if (!m.visible) continue; const s = worldToScreen(m.position.x, m.position.y + 7 / BASE_PPU * m.scale.x * 0.866, m.position.z), d = (s[0] - cx) * (s[0] - cx) + (s[1] - cy) * (s[1] - cy); if (d < bd) { bd = d; best = m.userData.b; } }
  return best;
}

// ---------- the gift balloon: drifts across the island now and then ----------
function launchBalloon() {
  const m = SCN.balloon, u = m.userData, a = Math.random() * TAU, b = a + Math.PI + (Math.random() - 0.5) * 1.2, c = N / 2, r = 17;
  u.x0 = c + Math.cos(a) * r; u.z0 = c + Math.sin(a) * r; u.x1 = c + Math.cos(b) * r; u.z1 = c + Math.sin(b) * r; u.t = 0; u.dur = 46; u.on = true; m.visible = true;
}
function stepBalloon(dt, t) {
  const m = SCN.balloon, u = m.userData; if (!u.on) return;
  u.t += dt; const k = u.t / u.dur;
  if (k >= 1) { u.on = false; m.visible = false; return; }
  m.position.set(lerp(u.x0, u.x1, k), 7.4 + Math.sin(t * 0.9) * 0.18, lerp(u.z0, u.z1, k)); m.rotation.y = t * 0.25;
}
function balloonAt(cx, cy) {
  const m = SCN.balloon; if (!m.userData.on) return false;
  const s = worldToScreen(m.position.x, m.position.y + 12 * V, m.position.z), rad = Math.max(20, 12 * VIEW.css * VIEW.s);
  return (s[0] - cx) * (s[0] - cx) + (s[1] - cy) * (s[1] - cy) < rad * rad;
}

function sceneStep(dt, simDt, t) {
  if (G.dirtyRoads) { buildRoads(); G.dirtyRoads = false; }
  if (G.dirtyTrees) { buildTrees(); G.dirtyTrees = false; }
  for (let i = SCN.anims.length - 1; i >= 0; i--) {
    const a = SCN.anims[i]; a.t += dt; const k = Math.min(1, a.t / a.dur), c1 = 1.70158, c3 = c1 + 1, e = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
    const w = 1 + 0.07 * Math.sin(Math.PI * k);
    a.mesh.scale.set(w, 0.2 + 0.8 * e, w); R.shadowDirty = true;
    if (k >= 1) { a.mesh.scale.set(1, 1, 1); SCN.anims.splice(i, 1); }
  }
  stepCars(simDt); stepWalkers(simDt, t); stepParts(dt, simDt); stepCoins(t); stepBubbles(dt, t); stepBalloon(simDt, t);
}
