// ---------- the town: state, map generation, placement rules, needs and growth targets ----------
const KIND = {
  home: { name: 'Homes', size: 1, cost: 30, mult: 1.10, unlock: 0, grows: true, desc: 'Families move in. Homes grow as you give them a road, greenery, shops, jobs and a school.' },
  shop: { name: 'Shops', size: 1, cost: 60, mult: 1.13, unlock: 30, grows: true, radius: 5.2, desc: 'Jobs and shopping. A shop grows with the residents living within 6 tiles.' },
  work: { name: 'Workshops', size: 1, cost: 90, mult: 1.13, unlock: 80, grows: true, radius: 2.3, bad: true, desc: 'Lots of jobs, growing with the town. Smoggy: keep them 3 tiles from homes.' },
  park: { name: 'Park', size: 1, cost: 50, mult: 1.10, unlock: 0, radius: 3.2, desc: 'Greenery for every home within 3 tiles.' },
  fountain: { name: 'Fountain', size: 1, cost: 250, mult: 1.25, unlock: 150, radius: 5.2, desc: 'A paved square. Counts as greenery within 5 tiles.' },
  school: { name: 'School', size: 2, cost: 900, mult: 1.6, unlock: 250, radius: 8.2, desc: 'Lets level-4 homes within 8 tiles merge into big blocks.' },
  hall: { name: 'Town Hall', size: 2, cost: 4000, mult: 1, unlock: 600, unique: true, desc: 'Lets merged blocks grow into high-rises (level 6).' },
  stadium: { name: 'Stadium', size: 3, cost: 20000, mult: 1, unlock: 2000, unique: true, desc: 'Lets high-rises grow into skyscrapers (level 7).' },
};
const LEVELS = {
  home: { names: ['Cottage', 'House', 'Townhouses', 'Apartments', 'Residences', 'High-rise', 'Sky tower'], cap: [4, 10, 24, 50, 260, 600, 1200], inc: [20, 36, 60, 100, 420, 800, 1500], unit: 'residents' },
  shop: { names: ['Corner store', 'High-street shop', 'Arcade', 'Office block', 'Galleria', 'Office tower', 'Headquarters'], cap: [4, 10, 22, 45, 220, 500, 1000], inc: [24, 44, 76, 130, 560, 1100, 2100], unit: 'jobs' },
  work: { names: ['Workshop', 'Warehouse', 'Factory', 'Plant', 'Works complex', 'Heavy works', 'Tech campus'], cap: [8, 18, 36, 72, 350, 700, 1300], inc: [30, 50, 84, 140, 600, 1200, 2200], unit: 'jobs' },
};
const SHOP_NEED = [12, 40, 110, 300, 700, 1500];        // residents within reach for shop level 2..7
const WORK_NEED = [20, 70, 180, 450, 1000, 2200];       // town residents for workshop level 2..7
const GROW_T = [0, 10, 25, 50, 60, 150, 300];              // seconds of met needs before level n becomes n+1 (index 4 = the 2x2 merge)
const JOB_RATIO = 0.4, ROAD_COST = 4, BRIDGE_COST = 40, TREE_COST = 6;
const RANKS = [[0, 'Hamlet'], [30, 'Village'], [80, 'Township'], [150, 'Town'], [250, 'Borough'], [600, 'Small city'], [1200, 'City'], [2000, 'Big city'], [4000, 'Metropolis'], [8000, 'Megacity'], [16000, 'Megalopolis']];
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];           // directions 0 N (-z), 1 E (+x), 2 S (+z), 3 W (-x)

const G = {
  seed: 1, name: 'Microburg', coins: 0, pop: 0, jobs: 0, rate: 0, time: 0, clock: 0, speed: 1, sandbox: false,
  terr: new Uint8Array(N * N),        // 0 water, 1 sand, 2 grass
  road: new Uint8Array(N * N), tree: new Uint8Array(N * N), bid: new Uint16Array(N * N),
  blds: new Map(), nextId: 1, counts: {}, hall: false, stadium: false, jobsOk: true,
  goal: 0, stat: {}, dirty: true, dirtyRoads: true, dirtyTrees: true, coinsFx: [], roadList: [], lake: null,
};
const CV = { green: new Uint8Array(N * N), shop: new Uint8Array(N * N), school: new Uint8Array(N * N), smog: new Uint8Array(N * N) };
const idx = (x, y) => y * N + x, inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const roadAt = (x, y) => inMap(x, y) && G.road[idx(x, y)] === 1;

function genTerrain(seed) {
  const r = rng(seed * 7919 + 13), c = N / 2;
  const la = r() * TAU, ld = 8 + r() * 3, lake = G.lake = { x: c + Math.cos(la) * ld, y: c + Math.sin(la) * ld, r: 3.2 + r() * 1.6 };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x + 0.5 - c) / c, dy = (y + 0.5 - c) / c, d = Math.hypot(dx, dy), dc = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    let e = 0.66 + (fbm(x * 0.11, y * 0.11, seed) - 0.5) * 0.9 - Math.pow(d, 2.4) * 0.75;
    if (dc < 7) e += (7 - dc) * 0.05;
    e -= Math.max(0, 1 - Math.hypot(x + 0.5 - lake.x, y + 0.5 - lake.y) / lake.r) * 1.2;
    if (x < 2 || y < 2 || x >= N - 2 || y >= N - 2) e = -1;
    const i = idx(x, y);
    G.terr[i] = e < 0.30 ? 0 : e < 0.345 ? 1 : 2;
    G.tree[i] = 0;
    if (G.terr[i] === 2 && dc > 4.5) {
      const f = fbm(x * 0.17 + 40, y * 0.17 + 40, seed + 99), h = hash2(x, y, seed + 5);
      if (f > 0.55) G.tree[i] = 1 + Math.floor(h * 3); else if (h > 0.955) G.tree[i] = 1;
    }
  }
  // tidy the coast: drop one-tile islets and spikes
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = idx(x, y); if (!G.terr[i]) continue;
    const n = (G.terr[i - 1] ? 1 : 0) + (G.terr[i + 1] ? 1 : 0) + (G.terr[i - N] ? 1 : 0) + (G.terr[i + N] ? 1 : 0);
    if (n < 2) { G.terr[i] = 0; G.tree[i] = 0; }
  }
}
const CITY_A = ['Maple', 'Larch', 'Otter', 'Pine', 'Heron', 'Clover', 'Juniper', 'Marsh', 'Amber', 'Willow', 'Finch', 'Cedar'], CITY_B = ['ford', ' Bay', 'ton', ' Hollow', 'wick', ' Harbor', 'field', 'burg', ' Cove', 'mere'];
function resetState(seed) {
  G.seed = seed; G.coins = 0; G.pop = 0; G.jobs = 0; G.rate = 0; G.time = 0; G.clock = 0; G.sandbox = false;
  G.road.fill(0); G.bid.fill(0); G.blds.clear(); G.nextId = 1; G.counts = {}; G.hall = false; G.stadium = false; G.goal = 0;
  G.stat = { roads: 0, home: 0, shop: 0, work: 0, park: 0, school: 0, picked: 0, merges: 0, maxHome: 0, maxLvl: 0, greenHomes: 0 };
  G.coinsFx.length = 0; G.dirty = G.dirtyRoads = G.dirtyTrees = true;
  const r = rng(seed + 77); G.name = pick(r, CITY_A) + pick(r, CITY_B);
  genTerrain(seed);
}
function newTown(seed) {
  resetState(seed);
  const c = N / 2;
  for (let y = c - 4; y <= c + 4; y++) for (let x = c - 5; x <= c + 5; x++) if (hash2(x, y, seed) < 0.8) G.tree[idx(x, y)] = 0;
  for (let x = c - 3; x <= c + 3; x++) { G.road[idx(x, c)] = 1; G.tree[idx(x, c)] = 0; }
  G.coins = 99999; for (const x of [c - 2, c - 1, c + 1]) place('home', x, c - 1, true);
  G.coins = 500; G.stat.home = 0;
  recalc();
}

// ---------- placing and removing ----------
function footprint(kind, x, y) { const s = KIND[kind].size; return { s, x: x - (s === 3 ? 1 : 0), y: y - (s === 3 ? 1 : 0) }; }
function costOf(kind) { const k = KIND[kind]; return G.sandbox ? k.cost : Math.round(k.cost * Math.pow(k.mult, G.counts[kind] || 0)); }   // each lot of a kind costs a little more than the last
function unlocked(kind) { return G.sandbox || G.pop >= KIND[kind].unlock || (G.stat['u_' + kind] === 1); }
function canPlace(kind, x, y) {
  const k = KIND[kind], f = footprint(kind, x, y); let cost = costOf(kind);
  if (!unlocked(kind)) return { ok: false, why: 'Unlocks at ' + fmt(k.unlock) + ' residents', f, cost };
  if (k.unique && G[kind]) return { ok: false, why: 'The town already has one', f, cost };
  for (let j = 0; j < f.s; j++) for (let i = 0; i < f.s; i++) {
    const tx = f.x + i, ty = f.y + j;
    if (!inMap(tx, ty) || G.terr[idx(tx, ty)] === 0) return { ok: false, why: 'Needs dry land', f, cost };
    if (G.road[idx(tx, ty)] || G.bid[idx(tx, ty)]) return { ok: false, why: 'Something is already here', f, cost };
    if (G.tree[idx(tx, ty)]) cost += TREE_COST;
  }
  if (G.coins < cost) return { ok: false, why: 'Not enough coins (' + fmt(cost) + ')', f, cost, poor: true };
  return { ok: true, f, cost };
}
function facing(b) {             // which side has the most road: the front door goes there. Ties prefer south, then east.
  let best = -1, rot = b.rot || 0;
  for (const d of [2, 1, 0, 3]) {
    let n = 0;
    for (let i = 0; i < b.s; i++) { const tx = d === 1 ? b.x + b.s : d === 3 ? b.x - 1 : b.x + i, ty = d === 2 ? b.y + b.s : d === 0 ? b.y - 1 : b.y + i; if (roadAt(tx, ty)) n++; }
    if (n > best && n > 0) { best = n; rot = [2, 1, 0, 3][d]; }
  }
  return { rot, road: best > 0 };
}
function addBuilding(kind, x, y, s, lvl, v) {
  const b = { id: G.nextId++, kind, x, y, s, lvl, v: v === undefined ? Math.floor(Math.random() * 1e6) : v, rot: 0, grow: 0, tgt: lvl, road: false, cust: 0, born: G.time, faced: false };
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const t = idx(x + i, y + j); G.bid[t] = b.id; if (G.tree[t]) { G.tree[t] = 0; G.dirtyTrees = true; } }
  const f = facing(b); b.rot = f.rot; b.road = f.road; b.faced = f.road;
  G.blds.set(b.id, b);
  G.counts[kind] = (G.counts[kind] || 0) + (KIND[kind].grows ? s * s : 1);
  if (kind === 'hall') G.hall = true; if (kind === 'stadium') G.stadium = true;
  G.dirty = true;
  return b;
}
function place(kind, x, y, quiet) {
  const c = canPlace(kind, x, y); if (!c.ok) return c;
  G.coins -= c.cost;
  const b = addBuilding(kind, c.f.x, c.f.y, c.f.s, 1);
  if (G.stat[kind] !== undefined) G.stat[kind]++;
  if (!quiet) sceneAddBuilding(b, true);
  return { ok: true, b, cost: c.cost };
}
function canRoad(x, y) {
  if (!inMap(x, y) || x < 1 || y < 1 || x >= N - 1 || y >= N - 1) return { ok: false, why: 'Off the map' };
  const i = idx(x, y);
  if (G.road[i]) return { ok: false, why: '', dup: true };
  if (G.bid[i]) return { ok: false, why: 'Something is already here' };
  const cost = (G.terr[i] === 0 ? BRIDGE_COST : ROAD_COST) + (G.tree[i] ? TREE_COST : 0);
  if (G.coins < cost) return { ok: false, why: 'Not enough coins (' + cost + ')', poor: true, cost };
  return { ok: true, cost };
}
function placeRoad(x, y) {
  const c = canRoad(x, y); if (!c.ok) return c;
  const i = idx(x, y); G.coins -= c.cost; G.road[i] = 1; G.stat.roads++;
  if (G.tree[i]) { G.tree[i] = 0; G.dirtyTrees = true; }
  G.dirty = G.dirtyRoads = true;
  return c;
}
function removeBuilding(b) {
  for (let j = 0; j < b.s; j++) for (let i = 0; i < b.s; i++) G.bid[idx(b.x + i, b.y + j)] = 0;
  G.blds.delete(b.id);
  G.counts[b.kind] = Math.max(0, (G.counts[b.kind] || 0) - (KIND[b.kind].grows ? b.s * b.s : 1));
  if (b.kind === 'hall') G.hall = false; if (b.kind === 'stadium') G.stadium = false;
  G.coinsFx = G.coinsFx.filter(c => c.id !== b.id);
  sceneRemoveBuilding(b); G.dirty = true;
}
// what would the bulldozer hit here?
function dozeTarget(x, y) {
  if (!inMap(x, y)) return null;
  const i = idx(x, y);
  if (G.bid[i]) return { type: 'b', b: G.blds.get(G.bid[i]) };
  if (G.road[i]) return { type: 'road' };
  if (G.tree[i]) return { type: 'tree', cost: TREE_COST };
  return null;
}
function doze(x, y) {
  const t = dozeTarget(x, y); if (!t) return null;
  const i = idx(x, y);
  if (t.type === 'b') removeBuilding(t.b);
  else if (t.type === 'road') { G.road[i] = 0; G.dirty = G.dirtyRoads = true; }
  else { if (G.coins < TREE_COST) return { ok: false, why: 'Not enough coins (' + TREE_COST + ')' }; G.coins -= TREE_COST; G.tree[i] = 0; G.dirty = G.dirtyTrees = true; }
  t.ok = true; return t;
}

// ---------- needs ----------
function stamp(map, b, r) {
  const R0 = Math.ceil(r), r2 = r * r;
  for (let j = 0; j < b.s; j++) for (let i = 0; i < b.s; i++) {
    const cx = b.x + i, cy = b.y + j;
    for (let dy = -R0; dy <= R0; dy++) for (let dx = -R0; dx <= R0; dx++) if (dx * dx + dy * dy <= r2 && inMap(cx + dx, cy + dy)) map[idx(cx + dx, cy + dy)] = 1;
  }
}
function covered(map, b) { for (let j = 0; j < b.s; j++) for (let i = 0; i < b.s; i++) if (map[idx(b.x + i, b.y + j)]) return true; return false; }
const capOf = b => LEVELS[b.kind] ? LEVELS[b.kind].cap[b.lvl - 1] : 0;
const incomeOf = b => LEVELS[b.kind] && b.road ? LEVELS[b.kind].inc[b.lvl - 1] : 0;                 // coins per minute
const _treeCnt = new Uint8Array(N * N);
function recalc() {
  G.dirty = false;
  CV.green.fill(0); CV.shop.fill(0); CV.school.fill(0); CV.smog.fill(0); _treeCnt.fill(0);
  // a patch of woodland counts as greenery: 4+ wooded tiles within 2 tiles
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (G.tree[idx(x, y)]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inMap(x + dx, y + dy)) _treeCnt[idx(x + dx, y + dy)]++;
  for (let i = 0; i < N * N; i++) if (_treeCnt[i] >= 4) CV.green[i] = 1;
  let pop = 0, jobs = 0, rate = 0, maxHome = 0, maxLvl = 0;
  for (const b of G.blds.values()) {
    const f = facing(b); b.road = f.road;
    if (f.road && !b.faced) { b.faced = true; if (b.rot !== f.rot) { b.rot = f.rot; sceneTurnBuilding(b); } }
    if (b.kind === 'park') stamp(CV.green, b, KIND.park.radius);
    else if (b.kind === 'fountain') stamp(CV.green, b, KIND.fountain.radius);
    else if (b.kind === 'school') stamp(CV.school, b, KIND.school.radius);
    else if (b.kind === 'shop' && b.road) stamp(CV.shop, b, KIND.shop.radius);
    else if (b.kind === 'work' && b.lvl < 7) stamp(CV.smog, b, KIND.work.radius);
    if (b.road) { if (b.kind === 'home') pop += capOf(b); else if (LEVELS[b.kind]) jobs += capOf(b); }
    rate += incomeOf(b);
    if (b.kind === 'home') maxHome = Math.max(maxHome, b.lvl);
    if (LEVELS[b.kind]) maxLvl = Math.max(maxLvl, b.lvl);
  }
  G.pop = pop; G.jobs = jobs; G.rate = rate; G.jobsOk = jobs >= Math.ceil(pop * JOB_RATIO);
  G.stat.maxHome = maxHome; G.stat.maxLvl = maxLvl;
  for (const k in KIND) if (pop >= KIND[k].unlock) G.stat['u_' + k] = 1;       // an unlock sticks even if the town shrinks
  const homes = []; for (const b of G.blds.values()) if (b.kind === 'home' && b.road) homes.push(b);
  let greenHomes = 0;
  for (const b of G.blds.values()) {
    if (!LEVELS[b.kind]) continue;
    let t = 1;
    if (b.kind === 'home') {
      b.nGreen = covered(CV.green, b); b.nShop = covered(CV.shop, b); b.nSchool = covered(CV.school, b); b.nSmog = covered(CV.smog, b);
      if (b.nGreen) greenHomes++;
      t = clamp(1 + (b.nGreen ? 1 : 0) + (b.nShop ? 1 : 0) + (G.jobsOk ? 1 : 0) - (b.nSmog ? 1 : 0), 1, 4);
      if (t === 4 && b.nSchool) t = 5;                                           // a school on top of everything else lets the lot merge
    } else if (b.kind === 'shop') {
      const cx = b.x + b.s / 2, cy = b.y + b.s / 2, r = 6 + b.s / 2; let c = 0;
      for (const h of homes) { const dx = h.x + h.s / 2 - cx, dy = h.y + h.s / 2 - cy; if (dx * dx + dy * dy <= r * r) c += capOf(h); }
      b.cust = c; for (const n of SHOP_NEED) if (c >= n) t++;
    } else { for (const n of WORK_NEED) if (pop >= n) t++; }
    if (b.kind === 'home') { if (t >= 5) t = G.hall ? (G.stadium ? 7 : 6) : 5; }
    else { if (t >= 6 && !G.hall) t = 5; if (t >= 7 && !G.stadium) t = 6; }
    if (b.s === 1 && t > 5) t = 5;
    if (!b.road) t = b.lvl;
    b.tgt = t;
  }
  G.stat.greenHomes = greenHomes;
}

// ---------- growth ----------
function stepGrowth(dt) {
  let merged = false;
  for (const b of G.blds.values()) {
    if (!LEVELS[b.kind] || !b.road || b.tgt <= b.lvl) continue;
    b.grow += dt;
    if (b.s === 1 && b.lvl >= 4) continue;                       // waits for three neighbours to merge with
    if (b.grow >= GROW_T[b.lvl]) { b.lvl++; b.grow = 0; G.dirty = true; sceneGrowBuilding(b); }
  }
  // four level-4 lots of one kind in a square become one 2x2 block
  for (const b of [...G.blds.values()]) {
    if (!G.blds.has(b.id) || b.s !== 1 || b.lvl !== 4 || b.tgt < 5 || b.grow < GROW_T[4] || b.x + 1 >= N || b.y + 1 >= N) continue;
    const q = [b, G.blds.get(G.bid[idx(b.x + 1, b.y)]), G.blds.get(G.bid[idx(b.x, b.y + 1)]), G.blds.get(G.bid[idx(b.x + 1, b.y + 1)])];
    if (!q.every(o => o && o.s === 1 && o.kind === b.kind && o.lvl === 4 && o.tgt >= 5 && o.grow >= GROW_T[4])) continue;
    const kind = b.kind, x = b.x, y = b.y, v = b.v;
    for (const o of q) { G.counts[kind] += 1; removeBuilding(o); }     // removeBuilding lowers the count; a merge keeps the four lots
    const nb = addBuilding(kind, x, y, 2, 5, v); G.counts[kind] -= 4;
    G.stat.merges++; merged = true; G.lastMerge = nb; sceneAddBuilding(nb, true, true);
  }
  return merged;
}

// ---------- save / load ----------
function saveState() {
  return { v: 1, seed: G.seed, name: G.name, coins: Math.floor(G.coins), time: Math.floor(G.time), clock: G.clock, goal: G.goal, stat: G.stat, sandbox: G.sandbox, at: Date.now(),
    road: Array.from(G.road).join(''), tree: Array.from(G.tree).join(''),
    b: [...G.blds.values()].map(b => [b.kind, b.x, b.y, b.s, b.lvl, b.v, b.rot, Math.round(b.grow)]) };
}
function loadState(s) {
  if (!s || s.v !== 1 || typeof s.road !== 'string' || s.road.length !== N * N || !Array.isArray(s.b)) return false;
  resetState(s.seed | 0);
  G.name = String(s.name || G.name).slice(0, 22); G.time = +s.time || 0; G.clock = +s.clock || 0; G.goal = s.goal | 0; G.sandbox = !!s.sandbox;
  Object.assign(G.stat, s.stat || {});
  for (let i = 0; i < N * N; i++) { G.road[i] = s.road.charCodeAt(i) === 49 ? 1 : 0; G.tree[i] = s.tree ? clamp(s.tree.charCodeAt(i) - 48, 0, 3) : 0; }
  for (const a of s.b) {
    if (!KIND[a[0]] || !inMap(a[1], a[2]) || !inMap(a[1] + a[3] - 1, a[2] + a[3] - 1)) continue;
    const b = addBuilding(a[0], a[1], a[2], a[3], clamp(a[4] | 0, 1, 7), a[5] | 0); b.rot = a[6] & 3; b.faced = true; b.grow = +a[7] || 0;
  }
  G.coins = +s.coins || 0;
  recalc();
  return true;
}

// ---------- the big city: a finished town to look around in (and to play with as a sandbox) ----------
function showcase(seed) {
  resetState(seed); G.sandbox = true; G.name = 'Lakeland'; G.clock = 0;
  const c = N / 2, r = rng(seed + 5), land = (x, y) => inMap(x, y) && x > 2 && y > 2 && x < N - 3 && y < N - 3 && G.terr[idx(x, y)] > 0;
  const free = (x, y, s) => { for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (!land(x + i, y + j) || G.road[idx(x + i, y + j)] || G.bid[idx(x + i, y + j)]) return false; return true; };
  const x0 = c - 13, y0 = c - 13;
  // the stadium goes in first, on the block grid, so the streets wrap around it
  let stad = null;
  for (const [gx, gy] of [[1, 5], [6, 1], [1, 2], [6, 6], [2, 6]]) { const px = x0 + gx * 3 + 1, py = y0 + gy * 3 + 1; let ok = true; for (let j = -1; j < 6; j++) for (let i = -1; i < 6; i++) if (!land(px + i, py + j)) ok = false; if (ok) { stad = [px, py]; break; } }
  const inStad = (x, y) => stad && x >= stad[0] && x < stad[0] + 5 && y >= stad[1] && y < stad[1] + 5;
  for (let y = y0; y <= c + 13; y++) for (let x = x0; x <= c + 13; x++) {
    if (!land(x, y) || inStad(x, y)) continue;
    if ((x - x0) % 3 === 0 || (y - y0) % 3 === 0) G.road[idx(x, y)] = 1;
  }
  if (stad) { addBuilding('stadium', stad[0] + 1, stad[1] + 1, 3, 1); for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { const t = idx(stad[0] + i, stad[1] + j); if (!G.bid[t]) { if (r() < 0.5) addBuilding('park', stad[0] + i, stad[1] + j, 1, 1); else addBuilding('fountain', stad[0] + i, stad[1] + j, 1, 1); } } }
  for (let i = 0; i < N * N; i++) if (G.road[i]) G.tree[i] = 0;
  const blocks = [], nearRoad = (bx, by) => { for (let k = 0; k < 2; k++) if (roadAt(bx + k, by - 1) || roadAt(bx + k, by + 2) || roadAt(bx - 1, by + k) || roadAt(bx + 2, by + k)) return true; return false; };
  for (let by = y0 + 1; by < c + 13; by += 3) for (let bx = x0 + 1; bx < c + 13; bx += 3) if (free(bx, by, 2) && nearRoad(bx, by)) blocks.push([bx, by, Math.hypot(bx + 1 - c, by + 1 - c)]);
  blocks.sort((a, b) => a[2] - b[2]);
  let schools = 0, hall = false;
  blocks.forEach(([bx, by, d], n) => {
    const east = bx > c + 5 && by > c - 2;
    if (!hall && n === 2) { addBuilding('hall', bx, by, 2, 1); hall = true; return; }
    if ((n === 9 || n === 22 || n === 38) && schools < 3) { addBuilding('school', bx, by, 2, 1); schools++; return; }
    const u = r();
    if (u < 0.09) { for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) addBuilding(r() < 0.75 ? 'park' : 'fountain', bx + i, by + j, 1, 1); return; }
    const kind = east ? (r() < 0.8 ? 'work' : 'shop') : d < 4.5 ? (r() < 0.75 ? 'shop' : 'home') : d < 9 ? (r() < 0.72 ? 'home' : 'shop') : (r() < 0.85 ? 'home' : 'shop');
    const tall = d < 4 ? 0.95 : d < 7 ? 0.6 : d < 10 ? 0.25 : 0.04;
    if (r() < tall) { const lvl = d < 4 ? (r() < 0.6 ? 7 : 6) : d < 7 ? pick(r, [5, 6, 6, 7]) : pick(r, [5, 5, 6]); addBuilding(kind, bx, by, 2, kind === 'work' ? Math.min(lvl, east ? 6 : 7) : lvl, Math.floor(r() * 1e6)); }
    else for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { if (r() < 0.07) addBuilding('park', bx + i, by + j, 1, 1); else addBuilding(kind, bx + i, by + j, 1, d < 8 ? pick(r, [3, 4, 4]) : pick(r, [1, 2, 2, 3, 3, 4]), Math.floor(r() * 1e6)); }
  });
  G.coins = 500000; G.stat.u_shop = G.stat.u_work = G.stat.u_fountain = G.stat.u_school = G.stat.u_hall = G.stat.u_stadium = 1;
  for (const b of G.blds.values()) { const f = facing(b); b.rot = f.rot; b.faced = true; }
  recalc();
}
