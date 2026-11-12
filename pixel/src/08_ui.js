// ---------- chrome, tools and input ----------
const TOOLS = [
  { id: 'look', name: 'Look', desc: 'Click a building to see what it wants.' },
  { id: 'road', name: 'Road', desc: 'Drag to lay road. Every lot needs one beside it. Over water it becomes a bridge.', paint: true },
  { id: 'home', kind: 'home' }, { id: 'shop', kind: 'shop' }, { id: 'work', kind: 'work' }, { id: 'park', kind: 'park' },
  { id: 'fountain', kind: 'fountain' }, { id: 'school', kind: 'school' }, { id: 'hall', kind: 'hall' }, { id: 'stadium', kind: 'stadium' },
  { id: 'doze', name: 'Bulldoze', short: 'Dozer', desc: 'Drag to remove buildings and roads for free. Clearing trees costs ' + TREE_COST + '.', paint: true },
];
const PAINT = { road: 1, doze: 1 };          // these paint while you drag; with every other tool a drag moves the map and a click places
const TURN_PER_PX = 0.0036;                  // two-finger sideways travel -> radians of turn
const UI = { tool: 'look', sel: null, keys: {}, tod: 'auto', ptr: new Map(), pinch: null, drag: null, mx: 0, my: 0, over: false, hoverDirty: true, wheel: { t: 0, mode: null, ax: 0, ay: 0, z: 0, zt: 0, steps: 0 }, turnT: 0, hudT: 0, tickT: 2.5, confirm: null, cache: {}, stage: null };
const THUMBS = {};
const HL = { ok: 0xfff3b0, bad: 0xd85f3c, sel: 0x7fb6f2, dim: 0xf4f4ef, good: 0xf4f4ef, smog: 0xd85f3c };
const BMP2 = { lock: ['..###..', '.#...#.', '.#...#.', '#######', '###.###', '###.###', '#######'], coin: ['.###.', '#####', '##.##', '#####', '.###.'] };

function setText(id, v) { if (UI.cache[id] !== v) { UI.cache[id] = v; $(id).textContent = v; } }
function setHtml(id, v) { if (UI.cache[id] !== v) { UI.cache[id] = v; $(id).innerHTML = v; return true; } return false; }
function toast(msg, bad) {
  const box = $('toasts'), el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.textContent = msg; box.appendChild(el);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => el.remove(), 4000);
}
function floatText(x, y, z, text, cls) {
  const p = worldToScreen(x, y, z), el = document.createElement('div'); el.className = 'float' + (cls ? ' ' + cls : ''); el.textContent = text; el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px';
  $('fx').appendChild(el); setTimeout(() => el.remove(), 1000);
}

// ---------- toolbar ----------
function makeThumbs() {
  const S = 26, m = (k, l, v) => renderThumb(getModel(k, l, v).geo, S);
  THUMBS.road = m('road', 1, 0); THUMBS.home = m('home', 2, 3); THUMBS.shop = m('shop', 2, 1); THUMBS.work = m('work', 3, 0); THUMBS.park = m('park', 1, 0);
  THUMBS.fountain = m('fountain', 1, 0); THUMBS.school = m('school', 1, 0); THUMBS.hall = m('hall', 1, 0); THUMBS.stadium = m('stadium', 1, 0); THUMBS.doze = m('dozer', 1, 0);
}
function buildToolbar() {
  const box = $('tools'); box.innerHTML = '';
  TOOLS.forEach((t, i) => {
    const k = t.kind ? KIND[t.kind] : null; t.name = t.name || k.name; t.desc = t.desc || k.desc;
    const b = document.createElement('button'); b.className = 'tool'; b.id = 'tool_' + t.id; b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.title = t.name + (i < 10 ? ' (' + ((i + 1) % 10) + ')' : ' (B)'); b.setAttribute('aria-label', t.name);
    b.innerHTML = (t.id === 'look' ? '<span class="glyph">' + bmp(BMP.look, 3) + '</span>' : '<img alt="" src="' + THUMBS[t.id] + '" width="52" height="52">') + '<span id="tl_' + t.id + '">' + (t.short || t.name) + '</span>';
    b.addEventListener('click', () => { audioInit(); setTool(t.id); sfx('click'); });
    box.appendChild(b);
  });
}
function setTool(id) {
  UI.tool = id; UI.confirm = null;
  for (const t of TOOLS) $('tool_' + t.id).setAttribute('aria-pressed', t.id === id ? 'true' : 'false');
  UI.stage.classList.toggle('painting', id !== 'look');
  if (id !== 'look') showInspect(null);
  UI.hoverDirty = true; refreshToolInfo();
}
function refreshToolInfo() {
  const t = TOOLS.find(x => x.id === UI.tool); let cost = '';
  if (t.kind) cost = unlocked(t.kind) ? (KIND[t.kind].unique && G[t.kind] ? 'built' : fmt(costOf(t.kind)) + ' coins') : 'unlocks at ' + fmt(KIND[t.kind].unlock) + ' residents';
  else if (t.id === 'road') cost = ROAD_COST + ' coins a tile';
  const how = t.paint ? 'To move the map: right-drag, arrow keys, or hold Space.' : t.id === 'look' ? 'Drag moves the map.' : 'Click to place. Drag moves the map.';
  setHtml('toolInfo', '<b>' + t.name + '</b><span class="cost">' + cost + '</span><div class="d">' + t.desc + '</div><div class="d soft">' + how + '</div>');
}
function refreshTools() {
  for (const t of TOOLS) {
    const el = $('tool_' + t.id); let label = t.short || t.name, locked = false, poor = false;
    if (t.kind) {
      if (!unlocked(t.kind)) { locked = true; label = bmp(BMP2.lock, 1) + ' ' + fmt(KIND[t.kind].unlock); }
      else if (KIND[t.kind].unique && G[t.kind]) label = 'built';
      else { const c = costOf(t.kind); poor = G.coins < c; label = fmt(c); }
    } else if (t.id === 'road') label = 'Road';
    if (setHtml('tl_' + t.id, '<span style="display:inline-flex;gap:3px;align-items:center">' + label + '</span>')) { el.classList.toggle('locked', locked); }
    el.classList.toggle('poor', poor && !locked);
  }
}

// ---------- picking ----------
function tileAt(cx, cy) { const p = screenToGround(cx, cy, _v1); return { x: Math.floor(p.x), y: Math.floor(p.z) }; }
function pickBuilding(cx, cy) {
  const sx = cx / VIEW.css, sy = cy / VIEW.css, ppu = VIEW.ppu, D = VIEW.dir;
  const ox = VIEW.T.x + VIEW.right.x * (sx - VIEW.W / 2) / ppu + VIEW.up.x * (VIEW.H / 2 - sy) / ppu + D.x * 60, oy = VIEW.T.y + VIEW.up.y * (VIEW.H / 2 - sy) / ppu + D.y * 60, oz = VIEW.T.z + VIEW.right.z * (sx - VIEW.W / 2) / ppu + VIEW.up.z * (VIEW.H / 2 - sy) / ppu + D.z * 60;
  let best = null, bt = 1e9;
  for (const b of G.blds.values()) {
    const h = Math.max(0.15, heightOf(b));
    // ray o - D * t against the building's box
    let t0 = -1e9, t1 = 1e9;
    const lo = [b.x, 0, b.y], hi = [b.x + b.s, h, b.y + b.s], o = [ox, oy, oz], d = [-D.x, -D.y, -D.z]; let hit = true;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) { hit = false; break; } continue; }
      let ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a]; if (ta > tb) { const s = ta; ta = tb; tb = s; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { hit = false; break; }
    }
    if (hit && t0 < bt) { bt = t0; best = b; }
  }
  return best;
}
function coinAt(cx, cy) {
  const rad = Math.max(18, 9 * VIEW.css * VIEW.s), p = [0, 0, 0]; let best = null, bd = rad * rad;
  for (const c of G.coinsFx) { if (!coinPos(c, APP.t, p)) continue; const s = worldToScreen(p[0], p[1], p[2]), d = (s[0] - cx) * (s[0] - cx) + (s[1] - cy) * (s[1] - cy); if (d < bd) { bd = d; best = c; } }
  return best;
}
function pickCoin(c) {
  const p = [0, 0, 0]; if (!coinPos(c, APP.t, p)) return;
  collectCoin(c); sfx('coin'); sparkle(p[0], p[1], p[2], 10, 0xffe066); floatText(p[0], p[1] + 0.3, p[2], '+' + fmt(c.val));
}

function popBalloon() {
  const m = SCN.balloon, got = Math.max(60, Math.round(G.rate * 0.6)), p = m.position;
  m.userData.on = false; m.visible = false; G.coins += got; G.stat.gifts = (G.stat.gifts || 0) + 1;
  sfx('goal'); sparkle(p.x, p.y + 0.6, p.z, 16, 0xffe066); fireworks(p.x, p.y, p.z, 2); floatText(p.x, p.y + 0.8, p.z, '+' + fmt(got)); toast('Balloon gift: +' + fmt(got) + ' coins');
}
function onBalloon() { setText('ticker', 'A balloon is drifting over ' + G.name + '. Click it for a gift.'); UI.tickT = 11; }

// ---------- hover / highlights ----------
function eachTile(b, fn) { for (let j = 0; j < b.s; j++) for (let i = 0; i < b.s; i++) fn(b.x + i, b.y + j); }
function updateHover() {
  UI.hoverDirty = false;
  const hl = [], sel = UI.sel && G.blds.get(UI.sel); let cover = [], point = false;
  if (sel) eachTile(sel, (x, y) => hl.push({ x, y, c: HL.sel }));
  if (UI.over && !(UI.drag && UI.drag.pan && UI.drag.moved) && !UI.pinch) {
    const t = tileAt(UI.mx, UI.my), tool = UI.tool;
    if (coinAt(UI.mx, UI.my) || balloonAt(UI.mx, UI.my) || bubbleAt(UI.mx, UI.my)) point = true;
    else if (tool === 'look') { const b = pickBuilding(UI.mx, UI.my); if (b) { point = true; if (b !== sel) eachTile(b, (x, y) => hl.push({ x, y, c: HL.dim })); } }
    else if (tool === 'road') { const c = canRoad(t.x, t.y), t2 = { x: t.x, y: t.y, c: c.ok ? HL.ok : c.dup ? HL.dim : HL.bad }; hl.push(t2); if (!c.dup) cover.push(t2); }
    else if (tool === 'doze') { const d = dozeTarget(t.x, t.y); if (d && d.type === 'b') eachTile(d.b, (x, y) => hl.push({ x, y, c: HL.bad })); else if (inMap(t.x, t.y)) hl.push({ x: t.x, y: t.y, c: d ? HL.bad : HL.dim }); }
    else {
      const c = canPlace(tool, t.x, t.y), k = KIND[tool];
      if (k.radius) {
        const r = k.radius, R0 = Math.ceil(r), col = k.bad ? HL.smog : HL.good;
        for (let y = c.f.y - R0; y < c.f.y + c.f.s + R0; y++) for (let x = c.f.x - R0; x < c.f.x + c.f.s + R0; x++) {
          if (!landAt(x, y)) continue;
          const dx = Math.max(c.f.x - x, 0, x - (c.f.x + c.f.s - 1)), dy = Math.max(c.f.y - y, 0, y - (c.f.y + c.f.s - 1));
          if ((dx || dy) && dx * dx + dy * dy <= r * r) cover.push({ x, y, c: col });
        }
      }
      for (let j = 0; j < c.f.s; j++) for (let i = 0; i < c.f.s; i++) { const t2 = { x: c.f.x + i, y: c.f.y + j, c: c.ok ? HL.ok : HL.bad }; hl.push(t2); cover.push(t2); }
    }
  }
  UI.stage.classList.toggle('pointing', point);
  setHighlights(hl); setCover(cover);
}

// ---------- using a tool on a tile ----------
function applyTool(x, y, first) {
  const tool = UI.tool; UI.hoverDirty = true;
  if (tool === 'road') {
    const c = placeRoad(x, y);
    if (c.ok) sfx('road'); else if (first && !c.dup) { toast(c.why, true); sfx('err'); }
    return c.ok;
  }
  if (tool === 'doze') {
    const t = dozeTarget(x, y); if (!t) return false;
    if (t.type === 'b' && (t.b.s > 1 || t.b.lvl >= 4)) {       // big things take a second click
      if (!first) return false;
      const now = performance.now();
      if (!(UI.confirm && UI.confirm.id === t.b.id && now - UI.confirm.at < 3500)) { UI.confirm = { id: t.b.id, at: now }; toast('Click again to demolish the ' + nameOf(t.b).toLowerCase()); return false; }
    }
    const b = t.type === 'b' ? t.b : null, res = doze(x, y);
    if (res && res.ok) { sfx('doze'); if (b) { dust(b, 10 * b.s); if (UI.sel === b.id) showInspect(null); } UI.confirm = null; return true; }
    if (res && first) { toast(res.why, true); sfx('err'); }
    return false;
  }
  const res = place(tool, x, y);
  if (res.ok) { sfx('place'); refreshToolInfo(); return true; }
  if (first) { toast(res.why, true); sfx('err'); }
  return false;
}
function paintTo(t) {
  const d = UI.drag, a = d.lt; if (!a || (a.x === t.x && a.y === t.y)) return;
  if (UI.tool === 'road') {            // walk tile by tile so the road never has gaps
    let x = a.x, y = a.y, guard = 0;
    while ((x !== t.x || y !== t.y) && guard++ < 200) { if (x !== t.x) x += Math.sign(t.x - x); else y += Math.sign(t.y - y); applyTool(x, y, false); }
  } else if (PAINT[UI.tool]) applyTool(t.x, t.y, false);
  d.lt = t;
}

// ---------- camera moves ----------
function clampTarget() { VIEW.target.x = clamp(VIEW.target.x, 1, N - 1); VIEW.target.z = clamp(VIEW.target.z, 1, N - 1); VIEW.target.y = 0; }
function panBy(dx, dy) {
  VIEW.target.addScaledVector(VIEW.right, -dx / VIEW.css / VIEW.ppu).addScaledVector(VIEW.fwd, dy / VIEW.css / (VIEW.ppu * Math.sin(VIEW.elev)));
  clampTarget(); UI.hoverDirty = true;
}
function zoomBy(step, cx, cy) {
  const ni = clamp(VIEW.zoomIdx + step, 0, VIEW.zooms.length - 1); if (ni === VIEW.zoomIdx) return;
  const box = UI.stage.getBoundingClientRect(); if (cx === undefined) { cx = box.width / 2; cy = box.height / 2; }
  const a = screenToGround(cx, cy).clone();
  VIEW.zoomIdx = ni; resizeView(); updateCamera(0);
  const b = screenToGround(cx, cy);
  VIEW.target.add(a.sub(b)); clampTarget(); UI.hoverDirty = true;
}
const quarter = a => Math.PI / 4 + Math.round((a - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2);
function rotateView(dir) { UI.turnT = 0; VIEW.az = quarter(VIEW.az) + dir * Math.PI / 2; if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) VIEW.azCur = VIEW.az - 0.004 * dir; UI.hoverDirty = true; }
// Free turning under the fingers. When the gesture stops, the view settles on the nearest quarter turn,
// because only there do roads and roofs fall on clean 2:1 pixel lines.
function turnBy(da) { VIEW.az += da; VIEW.azCur = VIEW.az; R.shadowDirty = true; UI.turnT = performance.now(); UI.hoverDirty = true; }
function settleTurn() { UI.turnT = 0; VIEW.az = quarter(VIEW.az); }

// ---------- pointer input ----------
function initInput() {
  const st = UI.stage, pos = e => { const r = st.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  st.addEventListener('contextmenu', e => e.preventDefault());
  st.addEventListener('pointerdown', e => {
    audioInit();
    const [x, y] = pos(e); UI.ptr.set(e.pointerId, { x, y }); UI.mx = x; UI.my = y; UI.over = true;
    try { st.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
    if (UI.ptr.size === 2) { const [a, b] = [...UI.ptr.values()]; UI.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ang: Math.atan2(b.y - a.y, b.x - a.x), tw: 0, turning: false }; UI.drag = null; st.classList.remove('grabbing'); return; }
    if (UI.ptr.size > 2) return;
    if (e.button === 0) {            // things floating over the town take the click first
      const c = coinAt(x, y), dead = () => { UI.drag = { id: e.pointerId, dead: true }; UI.hoverDirty = true; };
      if (c) { pickCoin(c); dead(); return; }
      if (balloonAt(x, y)) { popBalloon(); dead(); return; }
      const bb = bubbleAt(x, y); if (bb) { showInspect(bb.id); sfx('click'); dead(); return; }
    }
    const pan = e.button !== 0 || UI.keys[' '] || !PAINT[UI.tool];
    UI.drag = { id: e.pointerId, x0: x, y0: y, lx: x, ly: y, pan, moved: false, btn: e.button, lt: null, key: !!UI.keys[' '] };
    if (!pan) { const t = tileAt(x, y); applyTool(t.x, t.y, true); UI.drag.lt = t; }
    e.preventDefault();
  });
  st.addEventListener('pointermove', e => {
    const [x, y] = pos(e), p = UI.ptr.get(e.pointerId); UI.mx = x; UI.my = y; UI.over = true; UI.hoverDirty = true;
    if (p) { p.x = x; p.y = y; }
    if (UI.pinch && UI.ptr.size >= 2) {
      const [a, b] = [...UI.ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      panBy(cx - UI.pinch.cx, cy - UI.pinch.cy); UI.pinch.cx = cx; UI.pinch.cy = cy;
      if (d > UI.pinch.d * 1.3) { zoomBy(1, cx, cy); UI.pinch.d = d; } else if (d < UI.pinch.d / 1.3) { zoomBy(-1, cx, cy); UI.pinch.d = d; }
      // twisting two fingers turns the map (after a small dead zone, so an ordinary pinch or drag does not)
      const ang = Math.atan2(b.y - a.y, b.x - a.x), dth = wrapPi(ang - UI.pinch.ang); UI.pinch.ang = ang; UI.pinch.tw += dth;
      if (!UI.pinch.turning && Math.abs(UI.pinch.tw) > 0.2) UI.pinch.turning = true;
      if (UI.pinch.turning) turnBy(dth);
      return;
    }
    const d = UI.drag; if (!d || d.id !== e.pointerId || d.dead) return;
    if (d.pan) {
      if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > 6) { d.moved = true; st.classList.add('grabbing'); }
      if (d.moved) panBy(x - d.lx, y - d.ly);
      d.lx = x; d.ly = y;
    } else paintTo(tileAt(x, y));
  });
  const up = e => {
    UI.ptr.delete(e.pointerId);
    if (UI.pinch) { if (UI.ptr.size < 2) UI.pinch = null; UI.drag = null; return; }
    const d = UI.drag; if (!d || d.id !== e.pointerId) return;
    UI.drag = null; st.classList.remove('grabbing'); UI.hoverDirty = true;
    if (d.pan && !d.moved && d.btn === 0 && !d.key && e.type === 'pointerup') {        // a click, not a drag
      if (UI.tool === 'look') { const b = pickBuilding(UI.mx, UI.my); showInspect(b ? b.id : null); if (b) sfx('click'); }
      else { const t = tileAt(UI.mx, UI.my); applyTool(t.x, t.y, true); }
    }
  };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  st.addEventListener('pointerleave', () => { UI.over = false; UI.hoverDirty = true; });
  // Wheel and trackpad. A trackpad's two-finger drag arrives as wheel events: sideways turns the map, up and down zooms.
  // Each gesture is locked to whichever it started as, so a turn never zooms by accident. A pinch arrives as ctrl + wheel.
  st.addEventListener('wheel', e => {
    e.preventDefault();
    const now = performance.now(), k = e.deltaMode === 1 ? 30 : e.deltaMode === 2 ? 300 : 1, g = UI.wheel; let dx = e.deltaX * k, dy = e.deltaY * k;
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }                    // shift + mouse wheel also turns
    if (now - g.t > 200) { g.mode = null; g.ax = g.ay = g.z = 0; g.steps = 0; }
    g.t = now;
    if (e.ctrlKey) g.mode = 'pinch';
    if (!g.mode) { g.ax += dx; g.ay += dy; if (Math.abs(g.ax) + Math.abs(g.ay) < 4) return; g.mode = Math.abs(g.ax) > Math.abs(g.ay) ? 'turn' : 'zoom'; }
    if (g.mode === 'turn') { turnBy(dx * TURN_PER_PX); return; }
    g.z += g.mode === 'pinch' ? dy * 6 : dy;
    if (Math.abs(g.z) >= (g.steps ? 170 : 50) && now - g.zt > 180) { const [x, y] = pos(e); zoomBy(g.z < 0 ? 1 : -1, x, y); g.z = 0; g.zt = now; g.steps++; }
  }, { passive: false });
  // Safari reports trackpad pinch and twist as gesture events instead
  let gs = 1, gr = 0;
  st.addEventListener('gesturestart', e => { e.preventDefault(); gs = 1; gr = 0; });
  st.addEventListener('gesturechange', e => {
    e.preventDefault(); if (UI.ptr.size) return;
    if (e.scale > gs * 1.25) { zoomBy(1); gs = e.scale; } else if (e.scale < gs / 1.25) { zoomBy(-1); gs = e.scale; }
    const r = (e.rotation || 0) * DEG; if (Math.abs(r) > 0.15 || UI.turnT) { turnBy(r - gr); } gr = r;
  });
  st.addEventListener('gestureend', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; UI.keys[k] = true;
    if (k === 'Escape') { if (!$('menu').hidden) closeMenu(); else if (!$('intro').hidden && APP.started) $('intro').hidden = true; else if (UI.sel) showInspect(null); else setTool('look'); return; }
    if (!$('intro').hidden || !$('menu').hidden) return;
    if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
    if (k === 'q') rotateView(-1); else if (k === 'e') rotateView(1);
    else if (k === '+' || k === '=') zoomBy(1); else if (k === '-' || k === '_') zoomBy(-1);
    else if (k === 'p') cycleSpeed(); else if (k === 'l') cycleTod(); else if (k === 'm') setSound(!SND.on);
    else if (k === 'b') setTool('doze'); else if (k === 'r') setTool('road');
    else if (k >= '0' && k <= '9') { const i = k === '0' ? 9 : +k - 1; if (TOOLS[i]) setTool(TOOLS[i].id); }
  });
  window.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; UI.keys[k] = false; });
  window.addEventListener('blur', () => { UI.keys = {}; });
}

// ---------- inspector ----------
const STREETS = ['Otter', 'Juniper', 'Mill', 'Harbor', 'Finch', 'Cedar', 'Lantern', 'Quarry', 'Clover', 'Kestrel', 'Tanner', 'Willow', 'Ferry', 'Orchard', 'Beacon', 'Marsh'], ST_KIND = ['Street', 'Lane', 'Row', 'Avenue', 'Way'];
function addr(b) { const h = Math.floor(hash2(b.x, b.y, G.seed) * 1e6); return (1 + h % 97) + ' ' + STREETS[(b.y * 3 + (h >> 3)) % STREETS.length] + ' ' + ST_KIND[(b.x + (h >> 7)) % ST_KIND.length]; }
function nameOf(b) { return LEVELS[b.kind] ? LEVELS[b.kind].names[b.lvl - 1] : KIND[b.kind].name; }
function needsOf(b) {
  const n = [], add = (ok, t, na) => n.push({ c: na ? 'na' : ok ? 'ok' : 'no', t });
  add(b.road, b.road ? 'Road beside the lot' : 'No road beside the lot');
  if (b.kind === 'home') {
    add(b.nGreen, 'Park or woodland within 3 tiles');
    add(b.nShop, unlocked('shop') ? 'Shop within 5 tiles' : 'Shop within 5 tiles (shops unlock at 30 residents)', !unlocked('shop') && !b.nShop);
    add(G.jobsOk, 'Jobs in town: ' + fmt(G.jobs) + ' of ' + fmt(Math.ceil(G.pop * JOB_RATIO)) + ' needed');
    add(!b.nSmog, b.nSmog ? 'Smog: a workshop is within 2 tiles' : 'Clean air');
    add(b.nSchool, 'School within 8 tiles (needed to merge)', !b.nSchool && b.lvl < 4);
  } else if (b.kind === 'shop') {
    const need = b.lvl < 7 ? SHOP_NEED[b.lvl - 1] : 0;
    add(!need || b.cust >= need, 'Customers within 6 tiles: ' + fmt(b.cust) + (need ? ' of ' + fmt(need) + ' for level ' + (b.lvl + 1) : ''));
  } else {
    const need = b.lvl < 7 ? WORK_NEED[b.lvl - 1] : 0;
    add(!need || G.pop >= need, 'Workers in town: ' + fmt(G.pop) + (need ? ' of ' + fmt(need) + ' for level ' + (b.lvl + 1) : ''));
  }
  if (b.s > 1 || b.lvl >= 4) { if (b.lvl < 6) add(G.hall, 'Town Hall (needed for level 6)', !G.hall && b.s === 1); if (b.s > 1 && b.lvl < 7) add(G.stadium, 'Stadium (needed for level 7)', !G.stadium && b.lvl < 6); }
  return n;
}
function hintOf(b) {
  if (!b.road) return 'Nobody can reach this lot. Lay a road beside it.';
  if (b.lvl >= 7) return 'As tall as it gets.';
  if (b.tgt > b.lvl) {
    if (b.s === 1 && b.lvl === 4) return 'Ready to merge. It needs three level-4 neighbours of the same kind in a 2×2 square, each ready too.';
    return 'Growing: ' + Math.min(99, Math.floor(b.grow / GROW_T[b.lvl] * 100)) + '%';
  }
  const no = needsOf(b).find(n => n.c === 'no');
  if (b.kind === 'home' && b.lvl === 4 && b.s === 1 && !b.nSchool) return 'To merge into a big block it needs a school within 8 tiles.';
  return no ? 'Not growing yet. Fix the item marked with a cross.' : 'Settled for now.';
}
function showInspect(id) { UI.sel = id; UI.hoverDirty = true; renderInspect(); }
function renderInspect() {
  const el = $('inspect'), b = UI.sel && G.blds.get(UI.sel);
  if (!b) { UI.sel = null; if (!el.hidden) { el.hidden = true; UI.hoverDirty = true; } return; }
  const L = LEVELS[b.kind], row = (k, v) => '<div class="row"><span>' + k + '</span><b>' + v + '</b></div>'; let h;
  if (L) {
    const pips = '<span class="pips">' + [1, 2, 3, 4, 5, 6, 7].map(i => '<i class="' + (i <= b.lvl ? 'on' : '') + '"></i>').join('') + '</span>';
    h = '<h2>' + L.names[b.lvl - 1] + '</h2><div class="sub">' + addr(b) + '</div>' + row('Level ' + b.lvl + ' of 7', pips) + row(L.unit === 'residents' ? 'Residents' : 'Jobs', fmt(b.road ? capOf(b) : 0)) + row('Earns', fmt(incomeOf(b)) + ' / min')
      + '<ul class="needs">' + needsOf(b).map(n => '<li class="' + n.c + '">' + bmp(n.c === 'ok' ? BMP.check : n.c === 'no' ? BMP.cross : BMP.dash, 2) + '<span>' + n.t + '</span></li>').join('') + '</ul><div class="hint">' + hintOf(b) + '</div>';
  } else h = '<h2>' + KIND[b.kind].name + '</h2><div class="sub">' + addr(b) + '</div><div class="hint">' + KIND[b.kind].desc + '</div>';
  h += '<div class="acts"><button class="btn danger" type="button" data-act="doze">' + (UI.confirm && UI.confirm.id === b.id ? 'Really demolish?' : 'Demolish') + '</button><button class="btn" type="button" data-act="close">Close</button></div>';
  el.hidden = false; setHtml('inspect', h);
}

// ---------- status strip ----------
function refreshHud() {
  setText('cityName', G.name); setText('statPop', fmt(G.pop));
  const need = Math.ceil(G.pop * JOB_RATIO);
  setText('statJobs', fmt(G.jobs) + ' / ' + fmt(need)); $('plJobs').classList.toggle('warn', G.jobs < need && unlocked('shop'));
  setText('statCoins', fmt(G.coins)); setText('statRate', G.rate > 0 ? '+' + fmt(G.rate) + '/min' : '');
  const rk = rankOf(G.pop), nx = RANKS[rk + 1];
  setText('rankName', RANKS[rk][1]); setText('rankNext', nx ? fmt(G.pop) + ' / ' + fmt(nx[0]) : 'top rank');
  $('rankBar').style.width = (nx ? clamp((G.pop - RANKS[rk][0]) / (nx[0] - RANKS[rk][0]), 0, 1) * 100 : 100) + '%';
  const g = currentGoal();
  if (g) { const p = g.p(); setText('goalText', g.t); setText('goalReward', '+' + fmt(g.r)); $('goalBar').style.width = clamp(p[0] / p[1], 0, 1) * 100 + '%'; }
  else { setText('goalText', 'Sandbox city: everything is unlocked. Your own town is kept safe.'); setText('goalReward', ''); $('goalBar').style.width = '100%'; }
  refreshTools(); refreshToolInfo(); renderInspect();
}
function onBuildingGrew(b) { sfx('grow'); if (b.id === UI.sel) renderInspect(); }
function onMerged() { sfx('merge'); toast('Four lots merged into one big block'); UI.hoverDirty = true; const b = G.lastMerge; if (b) fireworks(b.x + 1, 3.5, b.y + 1, 3); }
function onGoalDone(g) { sfx('goal'); toast('Goal done: +' + fmt(g.r) + ' coins'); fireworks(VIEW.target.x, 3, VIEW.target.z, 2); const el = $('goal'); el.classList.add('done'); setTimeout(() => el.classList.remove('done'), 900); }
function onRankUp(a, b) {
  if (G.sandbox) return;
  toast(G.name + ' is now a ' + RANKS[b][1].toLowerCase()); fireworks(VIEW.target.x, 3.5, VIEW.target.z, 5);
  for (const k in KIND) if (KIND[k].unlock > RANKS[a][0] && KIND[k].unlock <= RANKS[b][0]) toast('Unlocked: ' + KIND[k].name);
}

// ---------- buttons and menus ----------
function cycleSpeed() { setSpeed(G.speed === 1 ? 3 : G.speed === 3 ? 0 : 1); }
function setSpeed(s) { G.speed = s; $('bSpeed').innerHTML = bmp(s === 0 ? BMP.pause : s === 3 ? BMP.fast : BMP.play); $('bSpeed').setAttribute('aria-label', 'Game speed: ' + (s === 0 ? 'paused' : s === 3 ? 'fast' : 'normal')); syncMenu(); }
function cycleTod() { setTod(UI.tod === 'auto' ? 'day' : UI.tod === 'day' ? 'night' : 'auto'); }
function setTod(m) { UI.tod = m; $('bTime').innerHTML = bmp(m === 'auto' ? BMP.auto : m === 'day' ? BMP.sun : BMP.moon); $('bTime').setAttribute('aria-label', 'Daylight: ' + m); syncMenu(); }
function setSound(on) { SND.on = on; if (on) audioInit(); $('bSound').innerHTML = bmp(on ? BMP.sound : BMP.mute); $('bSound').setAttribute('aria-label', on ? 'Sound on' : 'Sound off'); syncMenu(); try { localStorage.setItem('microburg.sound', on ? '1' : '0'); } catch (e) { /* optional */ } }
function syncMenu() {
  document.querySelectorAll('#menu [data-speed]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.speed === G.speed ? 'true' : 'false'));
  document.querySelectorAll('#menu [data-tod]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tod === UI.tod ? 'true' : 'false'));
  document.querySelectorAll('#menu [data-snd]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.snd === '1') === SND.on ? 'true' : 'false'));
}
function openMenu() {
  $('inName').value = G.name; $('bNew').textContent = 'Start a new town'; UI.newArmed = false;
  $('bShow').textContent = G.sandbox ? (readSave() ? 'Back to my town' : 'Start my own town') : 'Visit the big city';
  $('menuNote').textContent = G.sandbox ? 'This is the sandbox city. Changes here are not saved.' : 'Your town saves itself in this browser.';
  syncMenu(); $('menu').hidden = false;
}
function closeMenu() { $('menu').hidden = true; }
function initChrome() {
  $('bRotL').innerHTML = bmp(BMP.rotL); $('bRotR').innerHTML = bmp(BMP.rotR); $('bZoomOut').innerHTML = bmp(BMP.minus); $('bZoomIn').innerHTML = bmp(BMP.plus); $('bMenu').innerHTML = bmp(BMP.menu); $('bMenuClose').innerHTML = bmp(BMP.close, 1.5);
  const on = (id, fn) => $(id).addEventListener('click', e => { audioInit(); sfx('click'); fn(e); });
  on('bRotL', () => rotateView(-1)); on('bRotR', () => rotateView(1)); on('bZoomOut', () => zoomBy(-1)); on('bZoomIn', () => zoomBy(1));
  on('bSpeed', cycleSpeed); on('bTime', cycleTod); on('bSound', () => setSound(!SND.on)); on('bMenu', openMenu); on('cityName', openMenu); on('bMenuClose', closeMenu);
  $('menu').addEventListener('pointerdown', e => { if (e.target === $('menu')) closeMenu(); });
  document.querySelectorAll('#menu [data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  document.querySelectorAll('#menu [data-tod]').forEach(b => b.addEventListener('click', () => setTod(b.dataset.tod)));
  document.querySelectorAll('#menu [data-snd]').forEach(b => b.addEventListener('click', () => setSound(b.dataset.snd === '1')));
  $('inName').addEventListener('input', e => { const v = e.target.value.trim().slice(0, 22); if (v) { G.name = v; refreshHud(); } });
  on('bNew', () => { const risky = G.sandbox ? !!readSave() : G.blds.size > 3; if (!UI.newArmed && risky) { UI.newArmed = true; $('bNew').textContent = 'Replace my town? Click again'; return; } closeMenu(); startNewTown(); });
  on('bShow', () => { closeMenu(); if (G.sandbox) backToTown(); else visitCity(); });
  on('bHelp', () => { closeMenu(); openIntro(); });
  on('bStart', () => { $('intro').hidden = true; if (G.sandbox) { if (readSave()) backToTown(); else startNewTown(); } });
  on('bTour', () => { $('intro').hidden = true; if (!G.sandbox) visitCity(); });
  $('inspect').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return; const b = UI.sel && G.blds.get(UI.sel);
    if (a.dataset.act === 'close' || !b) { showInspect(null); return; }
    if ((b.s > 1 || b.lvl >= 4) && !(UI.confirm && UI.confirm.id === b.id)) { UI.confirm = { id: b.id, at: performance.now() }; renderInspect(); return; }
    removeBuilding(b); dust(b, 10 * b.s); sfx('doze'); UI.confirm = null; showInspect(null);
  });
  let saved = null; try { saved = localStorage.getItem('microburg.sound'); } catch (e) { /* optional */ }
  SND.on = saved !== '0';
  $('bSound').innerHTML = bmp(SND.on ? BMP.sound : BMP.mute); setSpeed(1); setTod('auto');
}

// called every frame
function uiFrame(dt) {
  if (G.dirty) recalc();
  if ($('intro').hidden && $('menu').hidden) {
    const K = UI.keys, sp = 620 * dt; let dx = 0, dy = 0;
    if (K.ArrowLeft || K.a) dx += sp; if (K.ArrowRight || K.d) dx -= sp; if (K.ArrowUp || K.w) dy += sp; if (K.ArrowDown || K.s) dy -= sp;
    if (dx || dy) panBy(dx, dy);
  }
  if (UI.turnT && !UI.pinch && performance.now() - UI.turnT > 230) settleTurn();
  if (UI.confirm && performance.now() - UI.confirm.at > 3500) UI.confirm = null;
  if (UI.hoverDirty) updateHover();
  UI.hudT -= dt; if (UI.hudT <= 0) { UI.hudT = 0.25; refreshHud(); }
  UI.tickT -= dt; if (UI.tickT <= 0) { UI.tickT = 9; setText('ticker', advise()); }
}
