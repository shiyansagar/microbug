// ---------- sound: a few synthesised blips, nothing downloaded ----------
const SND = { ctx: null, on: true, master: null, last: {} };
function audioInit() {
  if (SND.ctx || !SND.on) { if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume(); return; }
  try { const AC = window.AudioContext || window.webkitAudioContext; SND.ctx = new AC(); SND.master = SND.ctx.createGain(); SND.master.gain.value = 0.5; SND.master.connect(SND.ctx.destination); } catch (e) { SND.ctx = null; }
}
function tone(f, dur, type, vol, when, slide) {
  const c = SND.ctx; if (!c) return;
  const t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(SND.master); o.start(t); o.stop(t + dur + 0.03);
}
function noise(dur, vol) {
  const c = SND.ctx; if (!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
  s.buffer = buf; s.connect(f); f.connect(g); g.connect(SND.master); s.start();
}
const SFX = {
  place: () => { tone(220, 0.07, 'square', 0.07); tone(330, 0.09, 'square', 0.06, 0.05); },
  road: () => tone(170, 0.04, 'square', 0.05),
  coin: () => { tone(988, 0.07, 'square', 0.06); tone(1319, 0.18, 'square', 0.06, 0.06); },
  grow: () => { tone(392, 0.08, 'triangle', 0.11); tone(523, 0.08, 'triangle', 0.11, 0.07); tone(659, 0.15, 'triangle', 0.11, 0.14); },
  merge: () => [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 0.17, 'square', 0.06, i * 0.07)),
  goal: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.1)),
  doze: () => { noise(0.2, 0.14); tone(110, 0.16, 'sawtooth', 0.05, 0, 55); },
  err: () => tone(130, 0.12, 'sawtooth', 0.05, 0, 95),
  click: () => tone(660, 0.03, 'square', 0.04),
};
function sfx(name) {
  if (!SND.on || !SND.ctx) return;
  const now = performance.now(); if (now - (SND.last[name] || 0) < 90) return; SND.last[name] = now;
  try { SFX[name](); } catch (e) { /* audio is optional */ }
}

// ---------- goals ----------
const GOALS = [
  { t: 'Lay 5 road tiles', r: 40, p: () => [G.stat.roads, 5] },
  { t: 'Place 4 home lots beside a road', r: 60, p: () => [G.stat.home, 4] },
  { t: 'Plant a park within 3 tiles of a home', r: 60, p: () => [G.stat.park > 0 && G.stat.greenHomes > 0 ? 1 : 0, 1] },
  { t: 'Grow a home to level 2', r: 80, p: () => [Math.min(2, G.stat.maxHome), 2] },
  { t: 'Reach 30 residents to unlock shops', r: 100, p: () => [G.pop, 30] },
  { t: 'Open 2 shops', r: 100, p: () => [G.stat.shop, 2] },
  { t: 'Grow a home to level 3', r: 120, p: () => [Math.min(3, G.stat.maxHome), 3] },
  { t: 'Reach 80 residents to unlock workshops', r: 150, p: () => [G.pop, 80] },
  { t: 'Build 2 workshops, 3 tiles away from homes', r: 150, p: () => [G.stat.work, 2] },
  { t: 'Pick up 5 floating coins', r: 120, p: () => [G.stat.picked, 5] },
  { t: 'Grow a home to level 4', r: 200, p: () => [Math.min(4, G.stat.maxHome), 4] },
  { t: 'Reach 250 residents to unlock the school', r: 300, p: () => [G.pop, 250] },
  { t: 'Build a school', r: 300, p: () => [G.stat.school, 1] },
  { t: 'Merge four level-4 lots (a 2×2 square) into a block', r: 600, p: () => [G.stat.merges, 1] },
  { t: 'Reach 600 residents to unlock the Town Hall', r: 800, p: () => [G.pop, 600] },
  { t: 'Build the Town Hall', r: 1200, p: () => [G.hall ? 1 : 0, 1] },
  { t: 'Grow a high-rise (level 6)', r: 2000, p: () => [Math.min(6, G.stat.maxLvl), 6] },
  { t: 'Reach 2,000 residents to unlock the Stadium', r: 3000, p: () => [G.pop, 2000] },
  { t: 'Build the Stadium', r: 5000, p: () => [G.stadium ? 1 : 0, 1] },
  { t: 'Grow a skyscraper (level 7)', r: 10000, p: () => [Math.min(7, G.stat.maxLvl), 7] },
];
function currentGoal() {
  if (G.sandbox) return null;
  if (G.goal < GOALS.length) return GOALS[G.goal];
  const target = 4000 * Math.pow(2, G.goal - GOALS.length);
  return { t: 'Reach ' + fmt(target) + ' residents', r: target * 3, p: () => [G.pop, target] };
}
function rankOf(pop) { let k = 0; for (let i = 0; i < RANKS.length; i++) if (pop >= RANKS[i][0]) k = i; return k; }

// What is holding this building back? Shown as a little bubble over it. null = nothing to say.
function needIcon(b) {
  if (!LEVELS[b.kind]) return null;
  if (!b.road) return 'road';
  if (b.lvl >= 7) return null;
  if (b.tgt > b.lvl) return b.s === 1 && b.lvl === 4 ? 'merge' : null;          // growing, or waiting for neighbours to merge with
  if (b.kind === 'home') {
    if (b.nSmog) return 'smog';
    if (!b.nGreen) return 'tree';
    if (!unlocked('shop')) return null;
    if (!b.nShop) return 'shop';
    if (!G.jobsOk) return 'jobs';
    if (b.s === 1) return b.lvl === 4 && !b.nSchool && unlocked('school') ? 'school' : null;
  } else {
    const need = (b.kind === 'shop' ? SHOP_NEED : WORK_NEED)[b.lvl - 1], have = b.kind === 'shop' ? b.cust : G.pop;
    if (have < need) return 'people';
    if (b.s === 1) return null;
  }
  if (b.lvl === 5 && !G.hall) return unlocked('hall') ? 'star' : null;           // a big block waiting for a landmark
  if (b.lvl === 6 && !G.stadium) return unlocked('stadium') ? 'star' : null;
  return null;
}

// ---------- the town crier ----------
const FLAVOUR = ['Quiet day in {c}. The ducks are pleased.', 'Local man counts every window downtown. "It is a lot," he reports.', '{c} Gazette: new traffic light admired for a full minute.', 'Weather: pixelated, with a chance of dithering.', 'Council debates what colour the next roof should be.', 'Bus driver waves. Town waves back.', 'Mayor seen hovering over {c} with a giant cursor.', 'Fountain declared "quite splashy" by visiting pigeons.'];
function advise() {
  let noRoad = 0, wantGreen = 0, wantShop = 0, smog = 0, wantSchool = 0, l4 = 0, homes = 0;
  for (const b of G.blds.values()) {
    if (!LEVELS[b.kind]) continue;
    if (!b.road) noRoad++;
    if (b.kind === 'home' && b.s === 1) { homes++; if (!b.nGreen) wantGreen++; if (!b.nShop) wantShop++; if (b.nSmog) smog++; if (b.lvl === 4) { l4++; if (!b.nSchool) wantSchool++; } }
  }
  if (!G.sandbox && G.goal === 0) return 'Tip: pick Road, then drag across the grass to lay a street.';
  if (!G.sandbox && G.goal === 1) return 'Tip: pick Homes, then click the grass beside a road.';
  const m = [];
  if (noRoad) m.push(noRoad === 1 ? 'One lot has no road beside it, so nothing happens there.' : noRoad + ' lots have no road beside them, so nothing happens there.');
  if (G.pop > 0 && !G.jobsOk && unlocked('shop')) m.push('Short of work: ' + fmt(G.jobs) + ' jobs for ' + fmt(G.pop) + ' residents. ' + (unlocked('work') ? 'Build shops or workshops.' : 'Build shops.'));
  if (homes && wantGreen > homes * 0.3) m.push(wantGreen + (wantGreen === 1 ? ' home wants' : ' homes want') + ' a park within 3 tiles.');
  if (homes && unlocked('shop') && wantShop > homes * 0.3) m.push(wantShop + (wantShop === 1 ? ' home has' : ' homes have') + ' no shop within 5 tiles.');
  if (smog) m.push('Smog complaints from ' + smog + (smog === 1 ? ' home.' : ' homes.') + ' Keep workshops 3 tiles away.');
  if (wantSchool && unlocked('school')) m.push('Level-4 homes need a school within 8 tiles before they can merge.');
  if (l4 >= 2 && !G.stat.merges) m.push('Four level-4 lots of one kind in a 2×2 square merge into one big block.');
  if (G.stat.merges && !G.hall && unlocked('hall')) m.push('A Town Hall lets big blocks grow into high-rises.');
  if (G.hall && !G.stadium && unlocked('stadium')) m.push('A Stadium lets high-rises grow into skyscrapers.');
  if (!m.length || Math.random() < 0.3) m.push(FLAVOUR[Math.floor(Math.random() * FLAVOUR.length)].replace('{c}', G.name));
  return m[Math.floor(Math.random() * m.length)];
}

// ---------- simulation step ----------
const SIM = { coinT: 5, goalT: 1, recalcT: 0, rank: 0, tickT: 2, saveT: 12, balT: 45 };
function spawnCoin() {
  if (G.coinsFx.length >= 5 || G.rate <= 0) return;
  const c = []; for (const b of G.blds.values()) if (incomeOf(b) > 0 && !G.coinsFx.some(x => x.id === b.id)) c.push(b);
  if (!c.length) return;
  const b = c[Math.floor(Math.random() * c.length)];
  G.coinsFx.push({ id: b.id, val: Math.max(4, Math.round(G.rate * 0.1)), born: G.time, ttl: 30 });
}
function collectCoin(c) {
  const i = G.coinsFx.indexOf(c); if (i < 0) return;
  G.coinsFx.splice(i, 1); G.coins += c.val; G.stat.picked++;
}
function simStep(dt) {
  G.time += dt; G.clock += dt;
  SIM.recalcT -= dt;
  if (G.dirty || SIM.recalcT <= 0) { recalc(); SIM.recalcT = 2; }
  G.coins += G.rate * dt / 60;
  if (stepGrowth(dt)) onMerged();
  if (G.dirty) recalc();
  SIM.coinT -= dt; if (SIM.coinT <= 0) { SIM.coinT = 4 + Math.random() * 4; spawnCoin(); }
  for (let i = G.coinsFx.length - 1; i >= 0; i--) if (G.time - G.coinsFx[i].born >= G.coinsFx[i].ttl) G.coinsFx.splice(i, 1);
  SIM.balT -= dt; if (SIM.balT <= 0) { SIM.balT = 85 + Math.random() * 50; if ((G.rate > 0 || G.sandbox) && !SCN.balloon.userData.on) { launchBalloon(); onBalloon(); } }
  SIM.goalT -= dt;
  if (SIM.goalT <= 0) {
    SIM.goalT = 0.7;
    const g = currentGoal();
    if (g) { const p = g.p(); if (p[0] >= p[1]) { G.coins += g.r; G.goal++; onGoalDone(g); } }
    const rk = rankOf(G.pop); if (rk > SIM.rank) { onRankUp(SIM.rank, rk); } SIM.rank = Math.max(SIM.rank, rk);
  }
}
