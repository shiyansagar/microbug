// ---------- boot, main loop, saving ----------
const APP = { last: 0, t: 0, started: false, L: null, saveT: 10, mem: null };
const DAY_LEN = 240, SAVE_KEY = 'microburg.town.v1';

// The town is kept in this browser's storage, with a copy in memory in case storage is switched off.
function saveTown() { if (G.sandbox || !APP.started) return; APP.mem = saveState(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(APP.mem)); } catch (e) { /* the game still works without storage */ } }
function readSave() { try { const s = localStorage.getItem(SAVE_KEY); if (s) return JSON.parse(s); } catch (e) { /* fall through to the copy in memory */ } return APP.mem; }
function afterLoad() {
  sceneSyncAll(); VIEW.target.set(N / 2, 0, N / 2); SIM.rank = rankOf(G.pop); SIM.coinT = 4; UI.sel = null; UI.confirm = null; UI.tickT = 1.5;
  setTool('look'); refreshHud(); setText('ticker', advise());
}
function startNewTown() { APP.started = true; newTown(1 + Math.floor(Math.random() * 99999)); afterLoad(); saveTown(); toast('Welcome to ' + G.name + '. Start with a few homes along the road.'); }
function visitCity() { saveTown(); showcase(2000); afterLoad(); }
function backToTown() { const s = readSave(); if (s && loadState(s)) { APP.started = true; afterLoad(); } else startNewTown(); }
function openIntro() {
  const has = !!readSave();
  $('bStart').textContent = !G.sandbox ? 'Keep building' : has ? 'Back to my town' : 'Start a new town';
  $('bTour').textContent = G.sandbox ? (APP.started ? 'Keep looking around' : 'Look around the big city') : 'Visit the big city';
  $('intro').hidden = false;
}

function frame(ms) {
  const now = ms / 1000, dt = Math.min(0.1, APP.last ? now - APP.last : 1 / 60); APP.last = now; APP.t += dt;
  const simDt = dt * G.speed;
  for (let left = simDt; left > 1e-6; left -= 0.1) simStep(Math.min(0.1, left));
  uiFrame(dt);
  updateCamera(dt);
  const ph = UI.tod === 'day' ? 0.2 : UI.tod === 'night' ? 0.76 : (G.clock / DAY_LEN) % 1;
  APP.L = todBlend(APP.L, todAt(ph), 1 - Math.exp(-dt * 5)); applyTod(APP.L);
  sceneStep(dt, simDt, APP.t);
  renderFrame(APP.t);
  APP.saveT -= dt; if (APP.saveT <= 0) { APP.saveT = 10; saveTown(); }
  requestAnimationFrame(frame);
}

function start(hot) {
  const stage = $('stage'), canvas = $('view'); UI.stage = stage;
  try { if (!window.THREE) throw new Error('3D library did not load'); initPipeline(canvas, stage); }
  catch (e) {
    $('intro').hidden = false; $('intro').querySelector('p').textContent = 'Microburg draws its city with WebGL, and this browser would not start it. Try another browser, or turn hardware acceleration on.';
    $('intro').querySelector('ol').hidden = true; $('intro').querySelector('.acts').hidden = true; return;
  }
  initZoom(); resizeView(); initScene(); makeThumbs(); buildToolbar(); initChrome(); initInput();
  APP.L = TOD.day;
  const s = hot && hot.town ? hot.town : readSave();
  if (s && loadState(s)) {
    APP.started = true; afterLoad();
    const away = Math.min(1800, (Date.now() - (+s.at || Date.now())) / 1000);
    if (away > 90 && G.rate > 0) { const got = Math.floor(away * G.rate / 60 * 0.25); G.coins += got; toast('Welcome back. ' + G.name + ' earned ' + fmt(got) + ' coins while you were away.'); }
  } else { showcase(2000); afterLoad(); openIntro(); }
  updateCamera(0);
  window.addEventListener('resize', () => { resizeView(); UI.hoverDirty = true; });
  document.addEventListener('visibilitychange', () => {
    APP.last = 0;
    if (document.hidden) { saveTown(); APP.hiddenAt = Date.now(); return; }
    const away = Math.min(1800, (Date.now() - (APP.hiddenAt || Date.now())) / 1000); APP.hiddenAt = 0;      // the game sleeps in a hidden tab; credit a quarter of what it would have earned
    if (away > 90 && G.rate > 0 && !G.sandbox && G.speed > 0) { const got = Math.floor(away * G.rate / 60 * 0.25); G.coins += got; toast('Welcome back. ' + G.name + ' earned ' + fmt(got) + ' coins while you were away.'); }
  });
  window.addEventListener('pagehide', saveTown);
  requestAnimationFrame(frame);
}

// keep the town across live updates of the page, then boot
(function () {
  const hot = window.claude && window.claude.hot;
  try { if (hot && hot.snapshot) hot.snapshot(() => ({ town: G.sandbox || !APP.started ? null : saveState() })); } catch (e) { /* optional */ }
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
