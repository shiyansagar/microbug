// ---------- models: every building is built from boxes, prisms and roofs in code. Nothing is a sprite. ----------
// A lot is centred on the origin and spans +-size/2; its front (door side) faces +z. Sizes are in art pixels (U along, V up).
function slab(g, s, col) { g.box(-s / 2, 0, -s / 2, s / 2, H0, s / 2, col, 'b'); }
function treeRound(g, x, z, sc, col, y) {
  sc = sc || 1; y = y === undefined ? H0 : y;
  g.boxc(x, y, z, 1 * U * sc, 3 * V * sc, 1 * U * sc, PAL.br1);
  g.blob(x, y + 5.2 * V * sc, z, 2.7 * U * sc, col || PAL.gr2, 0.95);
}
function treePine(g, x, z, sc, col, y) {
  sc = sc || 1; y = y === undefined ? H0 : y;
  g.boxc(x, y, z, 1 * U * sc, 2 * V * sc, 1 * U * sc, PAL.br1);
  g.cone(x, y + 2 * V * sc, z, 2.7 * U * sc, 6 * V * sc, 6, col || PAL.gr1);
  g.cone(x, y + 5.5 * V * sc, z, 1.9 * U * sc, 5 * V * sc, 6, col || PAL.gr1);
}
function hedge(g, x0, z0, x1, z1) { g.box(x0, H0, z0, x1, H0 + 1.6 * V, z1, PAL.gr1, 'b'); }
// fine detail, only drawn at the closer zoom levels
function fence(g, x0, x1, z, col) { g.lod = 1; for (let x = x0; x < x1 - 0.4 * U; x += 1.5 * U) g.box(x, H0, z - 0.25 * U, x + 0.5 * U, H0 + 1.7 * V, z + 0.25 * U, col || PAL.white, 'b'); g.box(x0, H0 + 0.8 * V, z - 0.12 * U, x1, H0 + 1.2 * V, z + 0.12 * U, col || PAL.white, 'b'); g.lod = 0; }
function flowers(g, r, x0, z0, x1, z1, n, y) { g.lod = 1; for (let i = 0; i < n; i++) { const fx = x0 + r() * (x1 - x0), fz = z0 + r() * (z1 - z0); g.flat(fx, fz, fx + 0.5 * U, fz + 0.5 * U, (y === undefined ? H0 : y) + 0.004, pick(r, [PAL.m2, PAL.y3, PAL.white, PAL.r3])); } g.lod = 0; }
function parapet(g, x0, z0, x1, z1, y, col, ph) {
  const t = 0.8 * U; ph = ph || V;
  g.box(x0, y, z1 - t, x1, y + ph, z1, col, 'b'); g.box(x0, y, z0, x1, y + ph, z0 + t, col, 'b');
  g.box(x0, y, z0 + t, x0 + t, y + ph, z1 - t, col, 'bns'); g.box(x1 - t, y, z0 + t, x1, y + ph, z1 - t, col, 'bns');
  return y + ph;
}
function antenna(g, x, y, z, h) {
  g.boxc(x, y, z, 0.7 * U, h, 0.7 * U, PAL.g3);
  g.glow = 2.0; g.boxc(x, y + h, z, 1 * U, 1 * V, 1 * U, PAL.r3); g.glow = 0;
  return y + h + V;
}
function awning(g, x0, x1, y, z, out, drop, col) {
  const n = Math.max(2, Math.round((x1 - x0) / (2 * U)));
  for (let i = 0; i < n; i++) {
    const a = x0 + (x1 - x0) * i / n, b = x0 + (x1 - x0) * (i + 1) / n, c = i % 2 ? PAL.white : col;
    g.quad([a, y - drop, z + out], [b, y - drop, z + out], [b, y, z], [a, y, z], c);
    g.quad([a, y - drop - V, z + out], [b, y - drop - V, z + out], [b, y - drop, z + out], [a, y - drop, z + out], c, [0, 0, 1]);
  }
}
function sawtooth(g, x0, z0, x1, z1, y, n, h, roof, glass, wall, r) {
  const dz = (z1 - z0) / n;
  for (let j = 0; j < n; j++) {
    const za = z0 + j * dz, zb = za + dz;
    g.glow = r() < 0.4 ? 0.3 + r() * 0.5 : 0; g.quad([x0, y, zb], [x1, y, zb], [x1, y + h, zb], [x0, y + h, zb], glass, [0, 0, 1]); g.glow = 0;
    g.quad([x1, y, za], [x0, y, za], [x0, y + h, zb], [x1, y + h, zb], roof);
    g.tri([x1, y, zb], [x1, y, za], [x1, y + h, zb], wall, [1, 0, 0]);
    g.tri([x0, y, za], [x0, y, zb], [x0, y + h, zb], wall, [-1, 0, 0]);
  }
  return y + h;
}
function stack(g, x, z, w, h, y0, col) {          // striped chimney; returns the smoke point
  const y1 = y0 + h, sh = 2 * V;
  g.boxc(x, y0, z, w, h - 3 * sh, w, col || PAL.r1);
  g.boxc(x, y1 - 3 * sh, z, w, sh, w, PAL.white, 'bt'); g.boxc(x, y1 - 2 * sh, z, w, sh, w, PAL.r2, 'bt'); g.boxc(x, y1 - sh, z, w, sh, w, PAL.white, 'b');
  g.flat(x - w * 0.3, z - w * 0.3, x + w * 0.3, z + w * 0.3, y1 + 0.002, PAL.g1);
  return [x, y1 + 0.05, z];
}
// a box with windows. o: style grid|band|none, glass, alt, top, cap, base, wh, ww, gap, seg, mul, lit, sides, skip, mar
function block(g, r, x0, z0, x1, z1, y0, floors, fh, wall, o) {
  o = o || {};
  const y1 = y0 + floors * fh + (o.cap === undefined ? V : o.cap), yb = y0 + (o.base || 0);
  g.box(x0, y0, z0, x1, y1, z1, { s: wall, t: o.top || PAL.g4 }, 'b');
  const w = { rnd: r, col: o.glass || PAL.g1, alt: o.alt, lit: o.lit, sides: o.sides, skip: o.skip, mar: o.mar, sill: o.sill };
  if (o.style === 'band') g.bands(x0, z0, x1, z1, yb, floors, fh, Object.assign(w, { wh: o.wh || fh - 2 * V, seg: o.seg, mul: o.mul }));
  else if (o.style !== 'none') g.windows(x0, z0, x1, z1, yb, floors, fh, Object.assign(w, { ww: o.ww, wh: o.wh || (fh >= 5 * V - 1e-6 ? 3 * V : 2 * V), gap: o.gap }));
  return y1;
}
// rooftop clutter. items: ac bulk tank ant heli garden pool
function roofKit(g, r, x0, z0, x1, z1, y, items, pcol) {
  let top = parapet(g, x0, z0, x1, z1, y, pcol || PAL.g5);
  const w = x1 - x0, d = z1 - z0, px = t => x0 + U + (w - 2 * U) * t, pz = t => z0 + U + (d - 2 * U) * t;
  g.lod = 1; for (let i = 0; i < 2; i++) g.boxc(px(0.1 + r() * 0.8), y, pz(0.1 + r() * 0.8), 1 * U, 1 * V, 1 * U, { s: PAL.g3, t: PAL.g4 }); g.lod = 0;       // vents
  for (const it of items || []) {
    if (it === 'ac') { const n = 1 + Math.floor(r() * 3); for (let i = 0; i < n; i++) g.boxc(px(0.15 + r() * 0.7), y, pz(0.15 + r() * 0.7), 2 * U, 1.5 * V, 1.5 * U, { s: PAL.g5, t: PAL.g6 }); top = Math.max(top, y + 1.5 * V); }
    else if (it === 'bulk') { g.boxc(px(0.25 + r() * 0.5), y, pz(0.2 + r() * 0.3), 3.5 * U, 3 * V, 3 * U, { s: PAL.g4, t: PAL.g3 }); top = Math.max(top, y + 3 * V); }
    else if (it === 'tank') { const tx = px(0.2 + r() * 0.6), tz = pz(0.3 + r() * 0.5); g.boxc(tx, y, tz, 2 * U, 1.5 * V, 2 * U, PAL.g2); g.cyl(tx, y + 1.5 * V, tz, 1.7 * U, 3 * V, 6, PAL.br2, { top: PAL.br1 }); g.cone(tx, y + 4.5 * V, tz, 1.9 * U, 1.5 * V, 6, PAL.br1); top = Math.max(top, y + 6 * V); }
    else if (it === 'ant') top = Math.max(top, antenna(g, px(0.3 + r() * 0.4), y, pz(0.3 + r() * 0.4), (7 + r() * 6) * V));
    else if (it === 'heli') { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rr = Math.min(w, d) * 0.36; g.cyl(cx, y, cz, rr, 0.5 * V, 12, PAL.g2, { top: PAL.g3 }); g.cyl(cx, y + 0.5 * V, cz, rr * 0.82, 0.02, 12, PAL.y2, { top: PAL.y2 }); g.cyl(cx, y + 0.5 * V + 0.02, cz, rr * 0.62, 0.01, 12, PAL.g3, { top: PAL.g3 }); g.flat(cx - rr * 0.3, cz - rr * 0.35, cx - rr * 0.14, cz + rr * 0.35, y + 0.5 * V + 0.04, PAL.white); g.flat(cx + rr * 0.14, cz - rr * 0.35, cx + rr * 0.3, cz + rr * 0.35, y + 0.5 * V + 0.04, PAL.white); g.flat(cx - rr * 0.14, cz - rr * 0.08, cx + rr * 0.14, cz + rr * 0.08, y + 0.5 * V + 0.04, PAL.white); }
    else if (it === 'garden') { g.flat(x0 + 1.5 * U, z0 + 1.5 * U, x1 - 1.5 * U, z1 - 1.5 * U, y + 0.004, PAL.gr3); treeRound(g, px(0.25), pz(0.3), 0.7, PAL.gr2, y); treeRound(g, px(0.75), pz(0.7), 0.7, PAL.gr4, y); top = Math.max(top, y + 6 * V); }
    else if (it === 'pool') { g.flat(px(0.15), pz(0.2), px(0.85), pz(0.8), y + 0.004, PAL.g6); g.flat(px(0.25), pz(0.3), px(0.75), pz(0.7), y + 0.008, PAL.b3); }
  }
  return top;
}
const WALLS = [PAL.cream, PAL.s4, PAL.sand2, PAL.g6, PAL.white, PAL.b5, PAL.r4, PAL.s3], BRICK = [PAL.r2, PAL.r1, PAL.br2, PAL.s2, PAL.sand1, PAL.g4];
const ROOFS = [PAL.r2, PAL.r1, PAL.br1, PAL.g2, PAL.b1, PAL.t1], SIGNS = [PAL.m1, PAL.y2, PAL.t3, PAL.r3, PAL.b3, PAL.o1];

// ---------- homes ----------
function mHome1(g, r) {
  slab(g, 1, PAL.gr4);
  const wall = pick(r, WALLS), roof = pick(r, ROOFS), w = 9 * U, d = 7 * U, h = 5 * V, cz = -1.5 * U, y = H0, zf = cz + d / 2, xe = w / 2;
  g.boxc(0, y, cz, w, h, d, wall, 'bt');
  g.gable(0, y + h, cz, w, d, 4 * V, roof, true, 0.7 * U, wall);
  g.rs(-1 * U, 1 * U, y, y + 3 * V, zf, PAL.br1);
  g.glow = 0.25 + r() * 0.5; g.rs(-3.7 * U, -2 * U, y + 1.5 * V, y + 3.5 * V, zf, PAL.g1);
  g.glow = r() < 0.6 ? 0.25 + r() * 0.6 : 0; g.rs(2 * U, 3.7 * U, y + 1.5 * V, y + 3.5 * V, zf, PAL.g1);
  g.glow = r() < 0.5 ? 0.3 + r() * 0.5 : 0; g.re(cz - 1 * U, cz + 1 * U, y + 1.5 * V, y + 3.5 * V, xe, PAL.g1); g.glow = 0;
  g.boxc(2.5 * U, y + h + 1 * V, cz - 1 * U, 1.4 * U, 4.5 * V, 1.4 * U, PAL.r1);
  g.flat(-0.8 * U, zf, 0.8 * U, 0.5, y + 0.002, PAL.s4);
  if (r() < 0.5) treeRound(g, -5.5 * U, 5 * U, 1, pick(r, [PAL.gr2, PAL.gr3])); else treePine(g, 5.5 * U, 5 * U, 0.9);
  if (r() < 0.6) hedge(g, -0.5 + U, 0.5 - 1.6 * U, -2 * U, 0.5 - 0.4 * U); else fence(g, -0.5 + U, -2 * U, 0.5 - 0.6 * U);
  fence(g, 2 * U, 0.5 - U, 0.5 - 0.6 * U); flowers(g, r, -7 * U, 2.5 * U, 7 * U, 6.5 * U, 5);
  g.lod = 1; g.boxc(1.6 * U, y, zf + 1 * U, 0.5 * U, 2 * V, 0.5 * U, PAL.g2); g.boxc(1.6 * U, y + 2 * V, zf + 1 * U, 1 * U, 1 * V, 0.8 * U, PAL.r2); g.lod = 0;      // letterbox
  return { h: y + h + 5.5 * V };
}
function mHome2(g, r) {
  slab(g, 1, PAL.gr4);
  const wall = pick(r, WALLS), roof = pick(r, ROOFS), y = H0, x0 = -6 * U, x1 = 3.5 * U, z0 = -6.5 * U, z1 = 2 * U, h = 9.5 * V;
  g.box(x0, y, z0, x1, y + h, z1, wall, 'bt');
  if (r() < 0.5) g.gable((x0 + x1) / 2, y + h, (z0 + z1) / 2, x1 - x0, z1 - z0, 4.5 * V, roof, true, 0.7 * U, wall); else g.hip((x0 + x1) / 2, y + h, (z0 + z1) / 2, x1 - x0, z1 - z0, 4.5 * V, roof, 0.7 * U);
  g.windows(x0, z0, x1, z1, y, 2, 4.75 * V, { rnd: r, wh: 2.2 * V, ww: 2 * U, gap: 2 * U, lit: 0.6, sill: 1.6 * V, skip: (sd, f, c, cols) => sd === 's' && f === 0 && c === Math.floor(cols / 2) });
  g.rs((x0 + x1) / 2 - 1.5 * U, (x0 + x1) / 2 + 0.5 * U, y, y + 3.4 * V, z1, PAL.br0);
  g.box(x1, y, z0 + 1 * U, x1 + 3.5 * U, y + 4.5 * V, z1 - 1 * U, { s: wall, t: PAL.g4 }, 'bw');            // garage
  g.rs(x1 + 0.5 * U, x1 + 3 * U, y, y + 3.4 * V, z1 - 1 * U, PAL.g5);
  g.flat(x1 + 0.5 * U, z1 - 1 * U, x1 + 3 * U, 0.5, y + 0.002, PAL.g4);
  g.flat((x0 + x1) / 2 - 1.3 * U, z1, (x0 + x1) / 2 + 0.3 * U, 0.5, y + 0.002, PAL.s4);
  g.boxc(x0 + 2 * U, y + h + 1.5 * V, z0 + 2.5 * U, 1.5 * U, 5 * V, 1.5 * U, PAL.r1);
  treeRound(g, -5.5 * U, 5.8 * U, 1, pick(r, [PAL.gr2, PAL.gr3, PAL.gr1]));
  if (r() < 0.6) hedge(g, -0.5 + 0.5 * U, -0.5 + 0.4 * U, 0.5 - 0.5 * U, -0.5 + 1.3 * U);
  fence(g, -0.5 + U, (x0 + x1) / 2 - 2 * U, 0.5 - 0.6 * U); flowers(g, r, -7 * U, 3 * U, 2 * U, 6.5 * U, 5);
  return { h: y + h + 6 * V };
}
function mHome3(g, r) {
  slab(g, 1, PAL.gr4); g.flat(-0.5, 0.5 - 2.6 * U, 0.5, 0.5, H0 + 0.002, PAL.g5);
  const wall = pick(r, BRICK), x0 = -6.5 * U, x1 = 6.5 * U, z0 = -7 * U, z1 = 4.5 * U;
  const y = block(g, r, x0, z0, x1, z1, H0, 3, 5 * V, wall, { top: PAL.g3, alt: PAL.b4, lit: 0.6, skip: (sd, f, c, cols) => sd === 's' && f === 0 && c === Math.floor(cols / 2) });
  g.rs(-1.5 * U, 0.5 * U, H0, H0 + 4 * V, z1, PAL.br0); g.box(-2.5 * U, H0 + 4 * V, z1, 1.5 * U, H0 + 5 * V, z1 + 1.2 * U, PAL.g6, 'b');
  let top = roofKit(g, r, x0, z0, x1, z1, y, r() < 0.5 ? ['bulk'] : ['bulk', 'ac'], wall);
  treeRound(g, -6.3 * U, 6.4 * U, 0.8); treeRound(g, 6.3 * U, 6.4 * U, 0.8, PAL.gr3);
  return { h: top };
}
function mHome4(g, r) {
  slab(g, 1, PAL.g5);
  const wall = pick(r, WALLS), x0 = -7 * U, x1 = 7 * U, z0 = -7 * U, z1 = 5.5 * U, fh = 5 * V;
  const y = block(g, r, x0, z0, x1, z1, H0, 6, fh, wall, { top: PAL.g3, alt: PAL.b4, lit: 0.6, skip: (sd, f, c, cols) => sd === 's' && f === 0 && c === Math.floor(cols / 2) });
  const bc = pick(r, [PAL.g6, PAL.white, PAL.t3, PAL.r3]);
  for (let f = 1; f < 6; f++) { g.box(x0 + 1 * U, H0 + f * fh, z1, x0 + 5 * U, H0 + f * fh + 1.6 * V, z1 + 1.2 * U, bc, 'b'); g.box(x1 - 5 * U, H0 + f * fh, z1, x1 - 1 * U, H0 + f * fh + 1.6 * V, z1 + 1.2 * U, bc, 'b'); }
  g.rs(-1.5 * U, 0.5 * U, H0, H0 + 4 * V, z1, PAL.br0); g.box(-3 * U, H0 + 4 * V, z1, 2 * U, H0 + 5 * V, z1 + 1.8 * U, PAL.g6, 'b');
  const top = roofKit(g, r, x0, z0, x1, z1, y, r() < 0.5 ? ['tank', 'bulk'] : ['bulk', 'ac', 'ant'], wall);
  treeRound(g, -6.5 * U, 7 * U, 0.75); treeRound(g, 6.5 * U, 7 * U, 0.75, PAL.gr3);
  return { h: top };
}
function mHome5(g, r) {
  slab(g, 2, PAL.g5);
  const c1 = pick(r, WALLS), c2 = pick(r, BRICK), fh = 5 * V, kind = Math.floor(r() * 3), o = { top: PAL.g3, alt: PAL.b4, lit: 0.6 };
  let top = 0;
  if (kind === 0) {              // twin slabs around a garden
    g.flat(-4 * U, -8 * U, 4 * U, 15 * U, H0 + 0.002, PAL.gr4);
    const ya = block(g, r, -14 * U, -13 * U, -4 * U, 13 * U, H0, 9, fh, c1, o), yb = block(g, r, 4 * U, -13 * U, 14 * U, 13 * U, H0, 7, fh, c1, o);
    const yc = block(g, r, -4 * U, -13 * U, 4 * U, -8 * U, H0, 2, fh, c2, { style: 'band', glass: PAL.t2, top: PAL.g3 });
    top = Math.max(roofKit(g, r, -14 * U, -13 * U, -4 * U, 13 * U, ya, ['bulk', 'tank'], c1), roofKit(g, r, 4 * U, -13 * U, 14 * U, 13 * U, yb, ['garden'], c1));
    parapet(g, -4 * U, -13 * U, 4 * U, -8 * U, yc, c2);
    treeRound(g, 0, -2 * U, 1); treeRound(g, 0, 5 * U, 1, PAL.gr3); treePine(g, 0, 11.5 * U, 0.9);
  } else if (kind === 1) {       // U-shaped block with a courtyard pool
    g.flat(-5 * U, -5 * U, 5 * U, 15 * U, H0 + 0.002, PAL.gr4); g.flat(-3 * U, 0, 3 * U, 7 * U, H0 + 0.006, PAL.g6); g.flat(-2 * U, 1 * U, 2 * U, 6 * U, H0 + 0.01, PAL.b3);
    const ya = block(g, r, -14 * U, -14 * U, 14 * U, -5 * U, H0, 8, fh, c1, o), yb = block(g, r, -14 * U, -5 * U, -5 * U, 12 * U, H0, 6, fh, c1, Object.assign({ sides: 'sew' }, o)), yc = block(g, r, 5 * U, -5 * U, 14 * U, 12 * U, H0, 6, fh, c1, Object.assign({ sides: 'sew' }, o));
    top = roofKit(g, r, -14 * U, -14 * U, 14 * U, -5 * U, ya, ['bulk', 'tank', 'ac'], c1); roofKit(g, r, -14 * U, -5 * U, -5 * U, 12 * U, yb, ['ac'], c1); roofKit(g, r, 5 * U, -5 * U, 14 * U, 12 * U, yc, ['garden'], c1);
    treeRound(g, -3 * U, 11 * U, 0.9); treeRound(g, 3.5 * U, 12 * U, 0.9, PAL.gr3);
  } else {                       // stepped block with roof terraces
    const ya = block(g, r, -14 * U, -14 * U, 14 * U, 14 * U, H0, 4, fh, c2, o); g.flat(-13 * U, -13 * U, 13 * U, 13 * U, ya + 0.004, PAL.gr3); parapet(g, -14 * U, -14 * U, 14 * U, 14 * U, ya, c2);
    const yb = block(g, r, -10.5 * U, -10.5 * U, 10.5 * U, 10.5 * U, ya, 3, fh, c1, o); g.flat(-9.5 * U, -9.5 * U, 9.5 * U, 9.5 * U, yb + 0.004, PAL.gr4); parapet(g, -10.5 * U, -10.5 * U, 10.5 * U, 10.5 * U, yb, c1);
    const yc = block(g, r, -7 * U, -7 * U, 7 * U, 7 * U, yb, 3, fh, c1, o);
    top = roofKit(g, r, -7 * U, -7 * U, 7 * U, 7 * U, yc, ['bulk', 'ant'], c1);
    treeRound(g, -12 * U, 12 * U, 0.7, PAL.gr2, ya); treeRound(g, 12 * U, 12 * U, 0.7, PAL.gr2, ya); treeRound(g, 12 * U, -12 * U, 0.7, PAL.gr4, ya);
  }
  return { h: top };
}
function podium(g, r, s, floors, wall, glass) {
  const y = block(g, r, -s, -s, s, s, H0, floors, 5 * V, wall, { style: 'band', glass: glass || PAL.t2, wh: 3 * V, top: PAL.g4, lit: 0.8, cap: 0 });
  parapet(g, -s, -s, s, s, y, wall); return y;
}
function mHome6(g, r) {
  slab(g, 2, PAL.g5);
  const wall = pick(r, WALLS), fh = 5 * V, yp = podium(g, r, 14 * U, 2, pick(r, [PAL.g5, PAL.s3, PAL.s4]));
  g.flat(-13 * U, 10 * U, 13 * U, 13 * U, yp + 0.004, PAL.gr3); treeRound(g, -11.5 * U, 11.8 * U, 0.7, PAL.gr2, yp); treeRound(g, 11.5 * U, 11.8 * U, 0.7, PAL.gr4, yp); g.flat(-4 * U, 10.5 * U, 4 * U, 12.6 * U, yp + 0.008, PAL.b3);
  const band = r() < 0.5, x0 = -10 * U, x1 = 10 * U, z0 = -12 * U, z1 = 8 * U;
  const y = block(g, r, x0, z0, x1, z1, yp, 17, fh, wall, band ? { style: 'band', glass: pick(r, [PAL.g1, PAL.b1, PAL.t1]), alt: PAL.b4, wh: 3 * V, seg: 4 * U, mul: U, lit: 0.6, top: PAL.g3 } : { alt: PAL.b4, lit: 0.6, top: PAL.g3 });
  const bc = pick(r, [PAL.g6, PAL.white, PAL.t3, PAL.r3, PAL.y2]);
  if (!band) for (let f = 1; f < 17; f++) { g.box(x0 + 2 * U, yp + f * fh, z1, x0 + 8 * U, yp + f * fh + 1.5 * V, z1 + 1.2 * U, bc, 'b'); g.box(x1 - 8 * U, yp + f * fh, z1, x1 - 2 * U, yp + f * fh + 1.5 * V, z1 + 1.2 * U, bc, 'b'); }
  else { g.box(x0 - 0.5 * U, yp, z1 - 3 * U, x0, y, z1 - 1 * U, bc, 'b'); g.box(x1, yp, z1 - 3 * U, x1 + 0.5 * U, y, z1 - 1 * U, bc, 'b'); }
  return { h: roofKit(g, r, x0, z0, x1, z1, y, ['bulk', 'ac', 'ant'], wall) };
}
function mHome7(g, r) {
  slab(g, 2, PAL.g6);
  const sty = pick(r, [[PAL.white, PAL.b2, PAL.b4], [PAL.sand2, PAL.g1, PAL.b4], [PAL.g1, PAL.t3, PAL.t4], [PAL.cream, PAL.r1, PAL.r4], [PAL.b5, PAL.b1, PAL.b4]]), fh = 4 * V;
  const yp = podium(g, r, 14 * U, 2, pick(r, [PAL.g5, PAL.s3, PAL.g4]), sty[1]);
  treeRound(g, -12 * U, 12 * U, 0.7, PAL.gr2, yp); treeRound(g, 12 * U, 12 * U, 0.7, PAL.gr3, yp);
  const o = { style: 'band', glass: sty[1], alt: sty[2], wh: 2 * V, seg: 3 * U, mul: U, lit: 0.6, top: PAL.g3 };
  const y1 = block(g, r, -10 * U, -10 * U, 10 * U, 10 * U, yp, 20, fh, sty[0], o); parapet(g, -10 * U, -10 * U, 10 * U, 10 * U, y1, sty[0]);
  g.flat(-9 * U, 7.5 * U, 9 * U, 9.2 * U, y1 + 0.004, PAL.b3);                                             // sky pool
  const y2 = block(g, r, -7 * U, -8 * U, 7 * U, 6 * U, y1, 8, fh, sty[0], o);
  let top;
  if (r() < 0.5) { g.hip(0, y2, -1 * U, 14 * U, 14 * U, 9 * V, sty[1] === PAL.g1 ? PAL.t2 : sty[1]); top = antenna(g, 0, y2 + 8 * V, -1 * U, 10 * V); }
  else top = roofKit(g, r, -7 * U, -8 * U, 7 * U, 6 * U, y2, ['heli', 'ant'], sty[0]);
  return { h: top };
}

// ---------- shops and offices ----------
function shopSign(g, x0, x1, y0, y1, z, col) { g.glow = 2.0; g.box(x0, y0, z - 0.8 * U, x1, y1, z, col, 'b'); g.glow = 0; g.box(x0 + 1 * U, y0 - 1 * V, z - 0.6 * U, x0 + 1.6 * U, y0, z - 0.2 * U, PAL.g2, 'bt'); g.box(x1 - 1.6 * U, y0 - 1 * V, z - 0.6 * U, x1 - 1 * U, y0, z - 0.2 * U, PAL.g2, 'bt'); }
function mShop1(g, r) {
  slab(g, 1, PAL.g6);
  const wall = pick(r, WALLS), aw = pick(r, [PAL.r2, PAL.b2, PAL.gr2, PAL.o1, PAL.m1]), x0 = -6 * U, x1 = 6 * U, z0 = -7 * U, z1 = 2.5 * U, y = H0, h = 6 * V;
  g.box(x0, y, z0, x1, y + h, z1, { s: wall, t: PAL.g4 }, 'b'); parapet(g, x0, z0, x1, z1, y + h, wall);
  g.glow = 0.14; g.rs(x0 + 1 * U, -1.5 * U, y + 1 * V, y + 3.8 * V, z1, PAL.t2); g.rs(1.5 * U, x1 - 1 * U, y + 1 * V, y + 3.8 * V, z1, PAL.t2);
  g.glow = r() < 0.6 ? 0.2 : 0; g.re(z0 + 2 * U, z0 + 5 * U, y + 1.5 * V, y + 3.8 * V, x1, PAL.g1); g.glow = 0;
  g.rs(-1 * U, 1 * U, y, y + 3.8 * V, z1, PAL.br0);
  awning(g, x0, x1, y + 5.2 * V, z1, 2.4 * U, 1.3 * V, aw);
  shopSign(g, -4 * U, 4 * U, y + h + 2 * V, y + h + 5 * V, z1 - 1 * U, pick(r, SIGNS));
  g.boxc(4.8 * U, y, 5.5 * U, 2 * U, 2 * V, 2 * U, PAL.br2); g.boxc(-5 * U, y, 6 * U, 2 * U, 1.2 * V, 2 * U, PAL.s2); g.blob(-5 * U, y + 2.4 * V, 6 * U, 1.5 * U, PAL.gr2);
  return { h: y + h + 5 * V };
}
function mShop2(g, r) {
  slab(g, 1, PAL.g6);
  const wall = pick(r, WALLS.concat(BRICK)), aw = pick(r, [PAL.r2, PAL.b2, PAL.gr2, PAL.o1, PAL.m1, PAL.t2]), x0 = -6.5 * U, x1 = 6.5 * U, z0 = -7 * U, z1 = 3 * U, y = H0, h = 11.5 * V;
  g.box(x0, y, z0, x1, y + h, z1, { s: wall, t: PAL.g4 }, 'b');
  g.glow = 0.14; g.rs(x0 + 1 * U, -1.5 * U, y + 1 * V, y + 4 * V, z1, PAL.t2); g.rs(1.5 * U, x1 - 1 * U, y + 1 * V, y + 4 * V, z1, PAL.t2); g.glow = 0;
  g.rs(-1 * U, 1 * U, y, y + 4 * V, z1, PAL.br0);
  awning(g, x0, x1, y + 5.6 * V, z1, 2.4 * U, 1.3 * V, aw);
  g.windows(x0, z0, x1, z1, y + 6.5 * V, 1, 4 * V, { rnd: r, wh: 3 * V, ww: 2 * U, gap: 2 * U, lit: 0.6, alt: PAL.b4 });
  g.windows(x0, z0, x1, z1, y + 0.5 * V, 1, 5 * V, { rnd: r, wh: 3 * V, ww: 2 * U, gap: 2 * U, lit: 0.5, sides: 'enw' });
  const top = roofKit(g, r, x0, z0, x1, z1, y + h, ['ac'], wall);
  if (r() < 0.7) shopSign(g, -4.5 * U, 4.5 * U, y + h + 2 * V, y + h + 5.5 * V, z1 - 1 * U, pick(r, SIGNS));
  g.boxc(-5.2 * U, y, 6 * U, 2 * U, 1.2 * V, 2 * U, PAL.s2); g.blob(-5.2 * U, y + 2.4 * V, 6 * U, 1.5 * U, PAL.gr2); g.boxc(5.2 * U, y, 6 * U, 2 * U, 1.2 * V, 2 * U, PAL.s2); g.blob(5.2 * U, y + 2.4 * V, 6 * U, 1.5 * U, PAL.gr3);
  return { h: Math.max(top, y + h + 5.5 * V) };
}
function mShop3(g, r) {
  slab(g, 1, PAL.g6);
  const wall = pick(r, WALLS), x0 = -7 * U, x1 = 7 * U, z0 = -7 * U, z1 = 5 * U, fh = 5 * V, gl = pick(r, [PAL.t2, PAL.b2, PAL.g1]);
  g.box(x0, H0, z0, x1, H0 + fh, z1, { s: PAL.g2, t: PAL.g4 }, 'bt');
  g.bands(x0, z0, x1, z1, H0, 1, fh, { rnd: r, col: PAL.t3, wh: 3.4 * V, sill: 0.8 * V, seg: 3 * U, mul: U, lit: 0.9 });
  g.box(x0 - 0.5 * U, H0 + fh - 1 * V, z1, x1 + 0.5 * U, H0 + fh, z1 + 1.5 * U, pick(r, SIGNS), 'b');
  const y = block(g, r, x0, z0, x1, z1, H0 + fh, 3, fh, wall, { style: 'band', glass: gl, alt: PAL.b4, wh: 3 * V, seg: 3 * U, mul: U, lit: 0.55 });
  const top = roofKit(g, r, x0, z0, x1, z1, y, ['ac', 'bulk'], wall);
  shopSign(g, -5 * U, 5 * U, y + 2.5 * V, y + 7 * V, z1 - 2 * U, pick(r, SIGNS));
  return { h: Math.max(top, y + 7 * V) };
}
function mShop4(g, r) {
  slab(g, 1, PAL.g6);
  const sty = pick(r, [[PAL.g6, PAL.t2, PAL.t4], [PAL.b1, PAL.b3, PAL.b5], [PAL.cream, PAL.g1, PAL.b4], [PAL.g2, PAL.t3, PAL.t4], [PAL.s4, PAL.b1, PAL.b4]]), x0 = -7 * U, x1 = 7 * U, z0 = -7 * U, z1 = 6 * U, fh = 5 * V;
  g.box(x0, H0, z0, x1, H0 + fh, z1, { s: PAL.g3, t: PAL.g4 }, 'bt');
  g.bands(x0, z0, x1, z1, H0, 1, fh, { rnd: r, col: PAL.t3, wh: 3.4 * V, sill: 0.8 * V, seg: 3 * U, mul: U, lit: 0.9 });
  const y = block(g, r, x0, z0, x1, z1, H0 + fh, 6, fh, sty[0], { style: 'band', glass: sty[1], alt: sty[2], wh: 3 * V, seg: 3 * U, mul: U, lit: 0.6, top: PAL.g3 });
  return { h: roofKit(g, r, x0, z0, x1, z1, y, r() < 0.5 ? ['ac', 'ant'] : ['bulk', 'ac'], sty[0]) };
}
function tinyCar(g, x, z, col, along) { const w = along ? 3.4 * U : 1.8 * U, d = along ? 1.8 * U : 3.4 * U; g.boxc(x, H0, z, w, 1.3 * V, d, col); g.boxc(x, H0 + 1.3 * V, z, w * 0.55, 1 * V, d * 0.8, PAL.g1); }
function mShop5(g, r) {
  slab(g, 2, PAL.g5);
  const wall = pick(r, WALLS), y = H0, x0 = -15 * U, x1 = 15 * U, z0 = -15 * U, z1 = 4 * U, h = 9 * V;
  g.flat(-16 * U, 5 * U, 16 * U, 16 * U, y + 0.002, PAL.g2);                                              // car park
  for (let i = -3; i <= 3; i++) g.flat(i * 4.2 * U - 0.2 * U, 6 * U, i * 4.2 * U + 0.2 * U, 10 * U, y + 0.006, PAL.g6);
  for (let i = -3; i < 3; i++) if (r() < 0.7) tinyCar(g, i * 4.2 * U + 2.1 * U, 8 * U, pick(r, [PAL.r2, PAL.b3, PAL.white, PAL.y2, PAL.g5, PAL.t2]), false);
  g.box(x0, y, z0, x1, y + h, z1, { s: wall, t: PAL.g4 }, 'b'); parapet(g, x0, z0, x1, z1, y + h, wall);
  g.bands(x0, z0, x1, z1, y, 1, h, { rnd: r, col: PAL.t2, wh: 3.5 * V, sill: 1 * V, seg: 4 * U, mul: U, lit: 0.9, sides: 'sew' });
  g.gable(-1 * U, y + h + V, -6 * U, 20 * U, 8 * U, 4 * V, PAL.t3, true, 0, PAL.t2);                       // skylight
  g.box(-5 * U, y, z1, 5 * U, y + 7 * V, z1 + 2 * U, { s: PAL.g6, t: PAL.g5 }, 'b'); g.glow = 0.13; g.rs(-3.5 * U, 3.5 * U, y, y + 4.5 * V, z1 + 2 * U, PAL.t3); g.glow = 0;
  shopSign(g, -7 * U, 7 * U, y + h + 2 * V, y + h + 6.5 * V, z1 - 1 * U, pick(r, SIGNS));
  const yo = block(g, r, 5 * U, -15 * U, 15 * U, -8 * U, y + h, 6, 5 * V, pick(r, WALLS), { style: 'band', glass: PAL.b2, alt: PAL.b4, wh: 3 * V, seg: 3 * U, mul: U, lit: 0.6 });
  const top = roofKit(g, r, 5 * U, -15 * U, 15 * U, -8 * U, yo, ['ac', 'ant'], PAL.g5);
  treeRound(g, -14 * U, 14 * U, 0.9); treeRound(g, 14 * U, 14 * U, 0.9, PAL.gr3); treeRound(g, 0, 14 * U, 0.8, PAL.gr2);
  return { h: top };
}
function mShop6(g, r) {
  slab(g, 2, PAL.g6);
  const sty = pick(r, [[PAL.g2, PAL.t3, PAL.t4], [PAL.b1, PAL.b3, PAL.b5], [PAL.n2, PAL.b4, PAL.b5], [PAL.t1, PAL.t3, PAL.t4], [PAL.g6, PAL.b2, PAL.b4], [PAL.s4, PAL.g1, PAL.b4]]), fh = 5 * V;
  const x0 = -11 * U, x1 = 11 * U, z0 = -13 * U, z1 = 9 * U;
  g.box(x0, H0, z0, x1, H0 + 7 * V, z1, { s: PAL.g3, t: PAL.g4 }, 'bt');
  g.bands(x0, z0, x1, z1, H0, 1, 7 * V, { rnd: r, col: PAL.t3, wh: 5 * V, sill: 1 * V, seg: 4 * U, mul: U, lit: 0.95 });
  g.box(-4 * U, H0 + 5 * V, z1, 4 * U, H0 + 6 * V, z1 + 2.5 * U, PAL.g6, 'b');
  const y = block(g, r, x0, z0, x1, z1, H0 + 7 * V, 17, fh, sty[0], { style: 'band', glass: sty[1], alt: sty[2], wh: 4 * V, sill: 0.5 * V, seg: 3 * U, mul: U, mar: 0.5 * U, lit: 0.6, top: PAL.g3, cap: 2 * V });
  g.box(x0 - 0.3 * U, y - 2 * V, z0 - 0.3 * U, x1 + 0.3 * U, y, z1 + 0.3 * U, sty[2], 'bt');                // crown band
  const top = roofKit(g, r, x0, z0, x1, z1, y, r() < 0.4 ? ['heli'] : ['bulk', 'ac', 'ant'], sty[0]);
  treeRound(g, -13.5 * U, 13 * U, 0.9); treeRound(g, 13.5 * U, 13 * U, 0.9, PAL.gr3);
  g.cyl(0, H0, 12.5 * U, 2.6 * U, 1.2 * V, 8, PAL.s4, { top: PAL.b3 });
  return { h: top };
}
function mShop7(g, r) {
  slab(g, 2, PAL.g6);
  const sty = pick(r, [[PAL.s4, PAL.g1, PAL.b4, 'grid'], [PAL.g1, PAL.t2, PAL.t4, 'band'], [PAL.b1, PAL.b3, PAL.b5, 'band'], [PAL.white, PAL.b2, PAL.b4, 'band'], [PAL.sand2, PAL.br0, PAL.y3, 'grid'], [PAL.n1, PAL.n3, PAL.b4, 'band']]), fh = 4 * V;
  const o = sty[3] === 'band' ? { style: 'band', glass: sty[1], alt: sty[2], wh: 2 * V, seg: 3 * U, mul: U, lit: 0.62, top: PAL.g3 } : { glass: sty[1], alt: sty[2], wh: 2 * V, lit: 0.62, top: PAL.g3 };
  g.box(-13 * U, H0, -13 * U, 13 * U, H0 + 7 * V, 13 * U, { s: PAL.g3, t: PAL.g4 }, 'bt');
  g.bands(-13 * U, -13 * U, 13 * U, 13 * U, H0, 1, 7 * V, { rnd: r, col: PAL.t3, wh: 5 * V, sill: 1 * V, seg: 4 * U, mul: U, lit: 0.95 });
  const y1 = block(g, r, -13 * U, -13 * U, 13 * U, 13 * U, H0 + 7 * V, 11, fh, sty[0], o); parapet(g, -13 * U, -13 * U, 13 * U, 13 * U, y1, sty[0]);
  const y2 = block(g, r, -10 * U, -10 * U, 10 * U, 10 * U, y1, 10, fh, sty[0], o); parapet(g, -10 * U, -10 * U, 10 * U, 10 * U, y2, sty[0]);
  const y3 = block(g, r, -7 * U, -7 * U, 7 * U, 7 * U, y2, 8, fh, sty[0], o);
  const sc = pick(r, SIGNS); g.glow = 2.0; g.rs(-5 * U, 5 * U, y3 - 5 * V, y3 - 1.5 * V, 7 * U, sc); g.re(-5 * U, 5 * U, y3 - 5 * V, y3 - 1.5 * V, 7 * U, sc); g.glow = 0;
  let top;
  if (r() < 0.6) { g.hip(0, y3, 0, 14 * U, 14 * U, 8 * V, sty[1] === PAL.g1 || sty[1] === PAL.br0 ? PAL.t2 : sty[1]); top = antenna(g, 0, y3 + 7 * V, 0, 13 * V); }
  else { top = roofKit(g, r, -7 * U, -7 * U, 7 * U, 7 * U, y3, ['bulk', 'ant'], sty[0]); }
  return { h: top };
}

// ---------- workshops and industry ----------
function crates(g, r, x, z, n) { for (let i = 0; i < n; i++) g.boxc(x + (r() - 0.5) * 3 * U, H0, z + (r() - 0.5) * 2 * U, 2 * U, (1.5 + r()) * V, 2 * U, pick(r, [PAL.br2, PAL.br3, PAL.s2])); }
function mWork1(g, r) {
  slab(g, 1, PAL.s3);
  const wall = pick(r, [PAL.g5, PAL.b4, PAL.t3, PAL.sand1, PAL.r4, PAL.s4]), x0 = -6.5 * U, x1 = 4.5 * U, z0 = -7 * U, z1 = 1 * U, h = 5 * V, y = H0;
  g.box(x0, y, z0, x1, y + h, z1, wall, 'bt');
  g.gable((x0 + x1) / 2, y + h, (z0 + z1) / 2, x1 - x0, z1 - z0, 2.6 * V, pick(r, [PAL.g3, PAL.g2, PAL.r1, PAL.b1]), true, 0.6 * U, wall);
  g.rs(x0 + 1.5 * U, x0 + 6.5 * U, y, y + 4 * V, z1, PAL.g2); g.rs(x0 + 1.5 * U, x0 + 6.5 * U, y + 2 * V, y + 2.4 * V, z1 + 0.001, PAL.g3);
  g.rs(x1 - 3 * U, x1 - 1.2 * U, y, y + 3.2 * V, z1, PAL.br0);
  g.glow = r() < 0.6 ? 0.3 : 0; g.re(z0 + 2 * U, z0 + 5 * U, y + 2 * V, y + 4 * V, x1, PAL.g1); g.glow = 0;
  crates(g, r, 5.5 * U, 4 * U, 3); g.cyl(-5 * U, y, 5 * U, 1.1 * U, 2.2 * V, 6, PAL.b2, { top: PAL.b1 }); g.cyl(-2.5 * U, y, 6 * U, 1.1 * U, 2.2 * V, 6, PAL.r2, { top: PAL.r1 });
  return { h: y + h + 3 * V };
}
function mWork2(g, r) {
  slab(g, 1, PAL.s3);
  const wall = pick(r, [PAL.g5, PAL.b4, PAL.s4, PAL.sand1, PAL.t3]), x0 = -7 * U, x1 = 7 * U, z0 = -7 * U, z1 = 2 * U, h = 6.5 * V, y = H0;
  g.box(x0, y, z0, x1, y + h, z1, wall, 'bt');
  g.gable(0, y + h, (z0 + z1) / 2, x1 - x0, z1 - z0, 2.5 * V, pick(r, [PAL.g3, PAL.g4, PAL.b1, PAL.r1]), true, 0.5 * U, wall);
  g.rs(x0 + 1.5 * U, x0 + 5.5 * U, y, y + 4.5 * V, z1, PAL.g2); g.rs(x1 - 5.5 * U, x1 - 1.5 * U, y, y + 4.5 * V, z1, PAL.g2);
  g.box(x0, y + 5 * V, z0, x1, y + 5.8 * V, z1 + 0.01, pick(r, [PAL.b2, PAL.r2, PAL.y2, PAL.o1]), 'btn');
  const tc = pick(r, [PAL.r2, PAL.b2, PAL.y2, PAL.gr2]);                                                      // parked truck
  g.box(-5 * U, y + 0.6 * V, 4.6 * U, 1 * U, y + 4 * V, 7 * U, PAL.white, 'b'); g.box(1.3 * U, y + 0.6 * V, 4.7 * U, 3.6 * U, y + 3.2 * V, 6.9 * U, tc, 'b'); g.re(5 * U, 6.6 * U, y + 1.8 * V, y + 2.8 * V, 3.6 * U, PAL.g1);
  crates(g, r, 5.8 * U, 5.5 * U, 2);
  return { h: y + h + 3 * V };
}
function mWork3(g, r) {
  slab(g, 1, PAL.s3);
  const wall = pick(r, BRICK), x0 = -7 * U, x1 = 4 * U, z0 = -7 * U, z1 = 4 * U, h = 6.5 * V, y = H0;
  g.box(x0, y, z0, x1, y + h, z1, wall, 'bt');
  g.windows(x0, z0, x1, z1, y, 1, h, { rnd: r, wh: 2.5 * V, ww: 2 * U, gap: 2 * U, sill: 3 * V, lit: 0.6, alt: PAL.b4 });
  g.rs(x0 + 1 * U, x0 + 4.5 * U, y, y + 3 * V, z1, PAL.g2);
  const top = sawtooth(g, x0, z0, x1, z1, y + h, 3, 3 * V, PAL.g3, PAL.b4, wall, r);
  const s = stack(g, 6 * U, -5 * U, 2.2 * U, 19 * V, y, PAL.r1);
  crates(g, r, 5.8 * U, 4 * U, 3);
  return { h: Math.max(top, s[1]), smoke: [s] };
}
function mWork4(g, r) {
  slab(g, 1, PAL.s3);
  const wall = pick(r, BRICK), x0 = -7 * U, x1 = 2.5 * U, z0 = -7 * U, z1 = 5 * U, h = 8 * V, y = H0;
  g.box(x0, y, z0, x1, y + h, z1, { s: wall, t: PAL.g3 }, 'b');
  g.windows(x0, z0, x1, z1, y, 2, 4 * V, { rnd: r, wh: 2 * V, ww: 2 * U, gap: 2 * U, lit: 0.6, alt: PAL.b4 });
  parapet(g, x0, z0, x1, z1, y + h, wall);
  g.box(x0 + 2 * U, y + h, z0 + 2 * U, x1 - 1 * U, y + h + 1.5 * V, z0 + 3 * U, PAL.g5, 'b');
  const s1 = stack(g, x0 + 2.5 * U, 2 * U, 2 * U, 13 * V, y + h, PAL.r1), s2 = stack(g, x0 + 5.5 * U, 2 * U, 2 * U, 10 * V, y + h, PAL.r1);
  g.cyl(5.2 * U, y, -3.5 * U, 2.3 * U, 9 * V, 8, PAL.g6, { top: PAL.g5 }); g.cyl(5.2 * U, y, 2.5 * U, 2.3 * U, 6 * V, 8, PAL.g6, { top: PAL.g5 });
  g.box(4.8 * U, y + 5 * V, -1.5 * U, 5.6 * U, y + 5.8 * V, 0.5 * U, PAL.g4, 'b');
  return { h: s1[1], smoke: [s1, s2] };
}
function mWork5(g, r) {
  slab(g, 2, PAL.s3);
  const wall = pick(r, BRICK), y = H0, x0 = -15 * U, x1 = 2 * U, z0 = -15 * U, z1 = 5 * U, h = 9 * V;
  g.box(x0, y, z0, x1, y + h, z1, wall, 'bt');
  g.windows(x0, z0, x1, z1, y, 1, h, { rnd: r, wh: 3 * V, ww: 2 * U, gap: 2 * U, sill: 4.5 * V, lit: 0.6, alt: PAL.b4 });
  g.rs(x0 + 2 * U, x0 + 7 * U, y, y + 4 * V, z1, PAL.g2); g.rs(x0 + 9 * U, x0 + 14 * U, y, y + 4 * V, z1, PAL.g2);
  sawtooth(g, x0, z0, x1, z1, y + h, 4, 3.5 * V, PAL.g3, PAL.b4, wall, r);
  const yo = block(g, r, 5 * U, -15 * U, 15 * U, -7 * U, y, 3, 5 * V, pick(r, WALLS), { style: 'band', glass: PAL.g1, alt: PAL.b4, wh: 3 * V, seg: 3 * U, mul: U });
  parapet(g, 5 * U, -15 * U, 15 * U, -7 * U, yo, PAL.g5);
  for (const [sx, sz] of [[7.5 * U, -1.5 * U], [12.5 * U, 1 * U]]) { g.cyl(sx, y, sz, 2.8 * U, 13 * V, 8, PAL.g6, { top: PAL.g5 }); g.cone(sx, y + 13 * V, sz, 2.8 * U, 2.5 * V, 8, PAL.g5); }
  const s = stack(g, 11.5 * U, 8 * U, 2.8 * U, 30 * V, y, PAL.r1);
  const cc = [PAL.r2, PAL.b2, PAL.gr2, PAL.o1, PAL.y2, PAL.t2, PAL.white];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const cx = -12 * U + i * 5.6 * U, cz = 9 * U + j * 3.2 * U, n = 1 + Math.floor(r() * 2.4); for (let k = 0; k < n; k++) g.boxc(cx, y + k * 2.6 * V, cz, 5 * U, 2.6 * V, 2.4 * U, pick(r, cc)); }
  return { h: s[1], smoke: [s] };
}
function mWork6(g, r) {
  slab(g, 2, PAL.s3);
  const y = H0, wall = pick(r, [PAL.g5, PAL.s4, PAL.b4]);
  g.cyl(-7 * U, y, -6.5 * U, 7.5 * U, 13 * V, 10, PAL.g6, { rTop: 5 * U, cap: false }); g.cyl(-7 * U, y + 13 * V, -6.5 * U, 5 * U, 9 * V, 10, PAL.g6, { rTop: 5.8 * U, cap: false }); g.cyl(-7 * U, y + 21.5 * V, -6.5 * U, 5.4 * U, 0.01, 10, PAL.g2, { top: PAL.g2 });
  g.cyl(8 * U, y, -9 * U, 5.5 * U, 10 * V, 10, PAL.g6, { rTop: 3.8 * U, cap: false }); g.cyl(8 * U, y + 10 * V, -9 * U, 3.8 * U, 7 * V, 10, PAL.g6, { rTop: 4.4 * U, cap: false }); g.cyl(8 * U, y + 16.5 * V, -9 * U, 4 * U, 0.01, 10, PAL.g2, { top: PAL.g2 });
  const x0 = -14 * U, x1 = 3 * U, z0 = 3 * U, z1 = 14 * U, h = 8 * V;
  g.box(x0, y, z0, x1, y + h, z1, { s: wall, t: PAL.g4 }, 'b'); g.box(x0, y + 5.5 * V, z0, x1, y + 6.5 * V, z1 + 0.01, PAL.o1, 'btn'); parapet(g, x0, z0, x1, z1, y + h, wall);
  g.rs(x0 + 2 * U, x0 + 7 * U, y, y + 4.5 * V, z1, PAL.g2); g.windows(x0, z0, x1, z1, y, 1, h, { rnd: r, wh: 2 * V, ww: 2 * U, gap: 2 * U, sill: 2.5 * V, lit: 0.6, sides: 'ew' });
  g.box(-2 * U, y + 3 * V, -2 * U, -1 * U, y + 4 * V, 3 * U, PAL.g4, 'b'); g.box(3 * U, y + 3 * V, 6 * U, 8 * U, y + 4 * V, 7 * U, PAL.g4, 'b');
  const s1 = stack(g, 9 * U, 5 * U, 2.6 * U, 36 * V, y, PAL.g5), s2 = stack(g, 12.5 * U, 9.5 * U, 2.6 * U, 30 * V, y, PAL.g5);
  return { h: s1[1], smoke: [s1, s2, [-7 * U, y + 22 * V, -6.5 * U, 1], [8 * U, y + 17 * V, -9 * U, 1]] };
}
function mWork7(g, r) {
  slab(g, 2, PAL.gr4);
  const y = H0; g.flat(-1.5 * U, -2 * U, 0.5 * U, 16 * U, y + 0.002, PAL.s4); g.flat(-16 * U, 10.5 * U, 16 * U, 12 * U, y + 0.002, PAL.s4);
  const o = { style: 'band', glass: PAL.t3, alt: PAL.t4, wh: 3 * V, seg: 3 * U, mul: U, lit: 0.7, top: PAL.g6 };
  const ya = block(g, r, -14 * U, -14 * U, 6 * U, -3 * U, y, 3, 5 * V, PAL.white, o); parapet(g, -14 * U, -14 * U, 6 * U, -3 * U, ya, PAL.white);
  g.box(-14 * U, ya, -14 * U, 6 * U, ya + 0.6 * V, -3 * U, PAL.b3, 'bt');
  const yb = block(g, r, -14 * U, -3 * U, -4 * U, 9 * U, y, 2, 5 * V, PAL.white, o); roofKit(g, r, -14 * U, -3 * U, -4 * U, 9 * U, yb, ['ac'], PAL.white);
  g.cyl(10.5 * U, y, -9 * U, 5 * U, 2.5 * V, 10, PAL.g6, { top: PAL.g5 }); g.blob(10.5 * U, y + 2.5 * V, -9 * U, 4.6 * U, PAL.white, 0.9, 1);
  for (let i = 0; i < 3; i++) { const z = 1 * U + i * 3 * U; g.quad([2 * U, y + 0.5 * V, z + 2 * U], [14 * U, y + 0.5 * V, z + 2 * U], [14 * U, y + 2.4 * V, z], [2 * U, y + 2.4 * V, z], PAL.b1); g.box(2 * U, y, z, 14 * U, y + 2.4 * V, z + 0.3 * U, PAL.g4, 'bts'); }
  const top = antenna(g, 11 * U, y, 13.5 * U, 26 * V); g.cyl(11 * U, y + 18 * V, 13.5 * U, 1.8 * U, 0.8 * V, 8, PAL.g6, { top: PAL.g5 });
  treeRound(g, -8 * U, 13.5 * U, 0.9); treeRound(g, 4 * U, 13.5 * U, 0.9, PAL.gr3); treePine(g, -13.5 * U, 13.5 * U, 0.9);
  return { h: top };
}

// ---------- civic ----------
function mPark(g, r) {
  slab(g, 1, PAL.gr4);
  const y = H0, k = Math.floor(r() * 4);
  if (k === 0) { g.flat(-0.5, -1 * U, 0.5, 1 * U, y + 0.002, PAL.sand2); g.flat(-1 * U, -0.5, 1 * U, 0.5, y + 0.002, PAL.sand2); treeRound(g, -4.5 * U, -4.5 * U, 1.1); treeRound(g, 4.5 * U, -4.5 * U, 1, PAL.gr3); treeRound(g, -4.5 * U, 4.5 * U, 1, PAL.gr3); treePine(g, 4.5 * U, 4.5 * U, 1); }
  else if (k === 1) { g.cyl(1 * U, y, 1 * U, 4.2 * U, 0.004, 10, PAL.sand2, { top: PAL.sand2, sz: 0.8 }); g.cyl(1 * U, y + 0.004, 1 * U, 3.5 * U, 0.004, 10, PAL.b3, { top: PAL.b3, sz: 0.8 }); treeRound(g, -5 * U, -5 * U, 1.2); treePine(g, 5.5 * U, -5.5 * U, 1); treeRound(g, -5.5 * U, 5 * U, 0.9, PAL.gr3); g.boxc(5.5 * U, y, 6 * U, 2.5 * U, 1 * V, 1 * U, PAL.br2); }
  else if (k === 2) { g.flat(-0.5, 5 * U, 0.5, 6.5 * U, y + 0.002, PAL.sand2); for (let i = 0; i < 3; i++) { g.box(-6.5 * U + i * 4.6 * U, y, -1 * U, -3.5 * U + i * 4.6 * U, y + 0.8 * V, 3 * U, PAL.gr2, 'b'); g.flat(-6 * U + i * 4.6 * U, -0.5 * U, -4 * U + i * 4.6 * U, 2.5 * U, y + 0.8 * V + 0.002, pick(r, [PAL.m2, PAL.y3, PAL.r3, PAL.white])); } treeRound(g, -5 * U, -5.5 * U, 1.1, PAL.gr3); treeRound(g, 0.5 * U, -5.5 * U, 1.2); treeRound(g, 5.5 * U, -5.5 * U, 1, PAL.gr3); }
  else { treePine(g, -5 * U, -5 * U, 1.1); treePine(g, 0, -3 * U, 1.3); treePine(g, 5 * U, -5.5 * U, 1); treePine(g, -3.5 * U, 2 * U, 1); treePine(g, 4.5 * U, 1.5 * U, 1.2); g.flat(-0.5, 5 * U, 0.5, 6.5 * U, y + 0.002, PAL.sand2); g.boxc(-1 * U, y, 4.2 * U, 2.5 * U, 1 * V, 1 * U, PAL.br2); }
  flowers(g, r, -7 * U, -7 * U, 7 * U, 7 * U, 9);
  return { h: y + 9 * V };
}
function mFountain(g, r) {
  slab(g, 1, PAL.g6);
  const y = H0; g.flat(-6.5 * U, -6.5 * U, 6.5 * U, 6.5 * U, y + 0.002, PAL.s4);
  g.cyl(0, y, 0, 5 * U, 1.6 * V, 10, PAL.g5, { top: PAL.g6 }); g.cyl(0, y + 1.6 * V, 0, 4.2 * U, 0.004, 10, PAL.b3, { top: PAL.b3 });
  g.cyl(0, y, 0, 1 * U, 4.5 * V, 6, PAL.g5, { top: PAL.g6 }); g.cyl(0, y + 4.5 * V, 0, 2.2 * U, 0.8 * V, 8, PAL.g6, { top: PAL.b4 });
  g.boxc(0, y + 5.3 * V, 0, 0.8 * U, 3 * V, 0.8 * U, PAL.b5);
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.boxc(px * 6.3 * U, y, pz * 6.3 * U, 2 * U, 1.2 * V, 2 * U, PAL.s2); g.blob(px * 6.3 * U, y + 2.3 * V, pz * 6.3 * U, 1.5 * U, px * pz > 0 ? PAL.gr2 : PAL.gr3); }
  return { h: y + 8.5 * V };
}
function mSchool(g, r) {
  slab(g, 2, PAL.gr4);
  const y = H0, wall = PAL.r2, fh = 5.5 * V, o = { top: PAL.g3, alt: PAL.b4, lit: 0.3, wh: 3 * V };
  g.flat(-16 * U, 6 * U, 16 * U, 16 * U, y + 0.002, PAL.g5);                                               // forecourt
  const ya = block(g, r, -14 * U, -14 * U, 8 * U, -3 * U, y, 2, fh, wall, o); g.gable(-3 * U, ya, -8.5 * U, 22 * U, 11 * U, 4 * V, PAL.g2, true, 0.6 * U, wall);
  const yb = block(g, r, -14 * U, -3 * U, -5 * U, 5 * U, y, 2, fh, wall, Object.assign({ sides: 'sew' }, o)); g.gable(-9.5 * U, yb, 1 * U, 9 * U, 8 * U, 4 * V, PAL.g2, false, 0.6 * U, wall);
  const yt = block(g, r, 0, -3 * U, 5 * U, 2 * U, y, 3, fh, PAL.cream, { style: 'none', top: PAL.g3 });     // clock tower
  g.rs(1.5 * U, 3.5 * U, y, y + 4 * V, 2 * U, PAL.br0); g.rs(1.5 * U, 3.5 * U, yt - 4 * V, yt - 1.5 * V, 2 * U, PAL.white); g.re(-1.5 * U, 0.5 * U, yt - 4 * V, yt - 1.5 * V, 5 * U, PAL.white);
  g.hip(2.5 * U, yt, -0.5 * U, 5 * U, 5 * U, 5 * V, PAL.t2, 0.5 * U);
  g.flat(7 * U, -12 * U, 15 * U, 3 * U, y + 0.002, PAL.o1); g.flat(7.5 * U, -4.8 * U, 14.5 * U, -4.2 * U, y + 0.006, PAL.white); g.flat(7.5 * U, -11.5 * U, 14.5 * U, -11 * U, y + 0.006, PAL.white); g.flat(7.5 * U, 2 * U, 14.5 * U, 2.5 * U, y + 0.006, PAL.white);
  g.boxc(11 * U, y, -12.5 * U, 0.6 * U, 5 * V, 0.6 * U, PAL.g3); g.boxc(11 * U, y, 3.5 * U, 0.6 * U, 5 * V, 0.6 * U, PAL.g3);
  g.box(-10 * U, y + 0.6 * V, 8.5 * U, -2.5 * U, y + 4 * V, 11.5 * U, PAL.y2, 'b'); g.rs(-9.5 * U, -3.5 * U, y + 2.2 * V, y + 3.4 * V, 11.5 * U, PAL.g1); g.re(9 * U, 11 * U, y + 2.2 * V, y + 3.4 * V, -2.5 * U, PAL.g1);     // school bus
  g.boxc(8 * U, y, 9 * U, 0.6 * U, 12 * V, 0.6 * U, PAL.g5); g.box(8.3 * U, y + 9 * V, 8.9 * U, 11.5 * U, y + 12 * V, 9.1 * U, PAL.b2, '');
  treeRound(g, 13.5 * U, 13 * U, 1); treeRound(g, -13.5 * U, 13.5 * U, 1, PAL.gr3);
  return { h: yt + 5 * V };
}
function mHall(g, r) {
  slab(g, 2, PAL.g6);
  const y = H0, st = PAL.cream;
  g.flat(-16 * U, -16 * U, 16 * U, 16 * U, y + 0.002, PAL.s4);
  for (let i = 0; i < 3; i++) g.box(-9 * U, y + i * V, 6 * U, 9 * U, y + (i + 1) * V, 12 * U - i * 1.3 * U, PAL.g6, 'b');
  const y0 = y + 3 * V, yb = block(g, r, -13 * U, -13 * U, 13 * U, 6 * U, y, 2, 6 * V, st, { top: PAL.g5, wh: 3.5 * V, lit: 0.4, cap: 2 * V, sides: 'enw' });
  parapet(g, -13 * U, -13 * U, 13 * U, 6 * U, yb, st);
  for (let i = 0; i < 6; i++) g.cyl(-7.5 * U + i * 3 * U, y0, 8.5 * U, 0.9 * U, 9.5 * V, 6, PAL.white);
  g.box(-9 * U, y0 + 9.5 * V, 6 * U, 9 * U, y0 + 11 * V, 9.6 * U, PAL.white, 'b');
  g.gable(0, y0 + 11 * V, 7.8 * U, 18 * U, 3.6 * U, 4 * V, PAL.g5, false, 0, PAL.white);
  g.rs(-2 * U, 2 * U, y0, y0 + 6 * V, 6 * U, PAL.br0); g.glow = 0.2; g.rs(-6.5 * U, -4 * U, y0 + 2 * V, y0 + 6 * V, 6 * U, PAL.g1); g.rs(4 * U, 6.5 * U, y0 + 2 * V, y0 + 6 * V, 6 * U, PAL.g1); g.glow = 0;
  g.cyl(0, yb, -4 * U, 6.5 * U, 5 * V, 10, st);
  g.cyl(0, yb + 5 * V, -4 * U, 6.8 * U, 1 * V, 10, PAL.white);
  g.cyl(0, yb + 6 * V, -4 * U, 6.2 * U, 3.5 * V, 10, PAL.t2, { rTop: 4.6 * U, cap: false }); g.cyl(0, yb + 9.5 * V, -4 * U, 4.6 * U, 2.6 * V, 10, PAL.t2, { rTop: 2.4 * U, cap: false }); g.cyl(0, yb + 12.1 * V, -4 * U, 2.4 * U, 1.4 * V, 10, PAL.t3, { rTop: 0.6 * U, top: PAL.t3 });
  g.boxc(0, yb + 13.5 * V, -4 * U, 0.7 * U, 5 * V, 0.7 * U, PAL.y2); g.glow = 2.0; g.boxc(0, yb + 18.5 * V, -4 * U, 1.2 * U, 1.2 * V, 1.2 * U, PAL.y3); g.glow = 0;
  for (const sx of [-1, 1]) { g.boxc(sx * 13.5 * U, y, 12.5 * U, 2.4 * U, 1.2 * V, 2.4 * U, PAL.s2); g.blob(sx * 13.5 * U, y + 2.6 * V, 12.5 * U, 1.8 * U, PAL.gr2); treeRound(g, sx * 13.5 * U, 7.5 * U, 0.9, sx > 0 ? PAL.gr3 : PAL.gr2); }
  g.boxc(11 * U, y, 13.5 * U, 0.6 * U, 14 * V, 0.6 * U, PAL.g5); g.box(11.3 * U, y + 11 * V, 13.4 * U, 14.5 * U, y + 14 * V, 13.6 * U, PAL.r2, '');
  return { h: yb + 19.5 * V };
}
function mStadium(g, r) {
  slab(g, 3, PAL.g5);
  const y = H0, rx = 1.36, sz = 0.84, H = 11 * V, seg = 20, seats = [PAL.b2, PAL.b3, PAL.r2, PAL.b2, PAL.y2];
  g.cyl(0, y, 0, rx, H, seg, PAL.g6, { rTop: rx + 0.04, cap: false, sz });
  for (let i = 0; i < seg; i++) {                 // outer arcade + the bowl of seats facing in
    const a = Math.PI / seg + i / seg * TAU, b = Math.PI / seg + (i + 1) / seg * TAU, ca = Math.cos(a), sa = Math.sin(a) * sz, cb = Math.cos(b), sb = Math.sin(b) * sz, ro = rx + 0.04, ri = 0.80;
    g.quad([cb * ro, y + H, sb * ro], [ca * ro, y + H, sa * ro], [ca * (ro - 0.07), y + H, sa * (ro - 0.07)], [cb * (ro - 0.07), y + H, sb * (ro - 0.07)], PAL.white, [0, 1, 0]);
    const mid = 1.08;
    g.quad([ca * ri, y + 2 * V, sa * ri], [cb * ri, y + 2 * V, sb * ri], [cb * mid, y + 6 * V, sb * mid], [ca * mid, y + 6 * V, sa * mid], seats[i % 5]);
    g.quad([ca * mid, y + 6 * V, sa * mid], [cb * mid, y + 6 * V, sb * mid], [cb * (ro - 0.07), y + H, sb * (ro - 0.07)], [ca * (ro - 0.07), y + H, sa * (ro - 0.07)], seats[(i + 2) % 5]);
    const m = (a + b) / 2, cm = Math.cos(m), sm = Math.sin(m) * sz, rr = rx + 0.022;
    g.glow = r() < 0.5 ? 0.2 + r() * 0.3 : 0; const t0 = 0.3, t1 = 0.7;
    g.quad([lerp(cb, ca, t0) * rr, y + 2 * V, lerp(sb, sa, t0) * rr], [lerp(cb, ca, t1) * rr, y + 2 * V, lerp(sb, sa, t1) * rr], [lerp(cb, ca, t1) * (rr + 0.012), y + 6 * V, lerp(sb, sa, t1) * (rr + 0.012)], [lerp(cb, ca, t0) * (rr + 0.012), y + 6 * V, lerp(sb, sa, t0) * (rr + 0.012)], PAL.g2, [cm, 0, sm]); g.glow = 0;
  }
  g.cyl(0, y + 2 * V - 0.01, 0, 0.80, 0.01, seg, PAL.gr3, { top: PAL.gr3, sz });
  for (let i = -3; i <= 3; i += 2) g.flat(i * 0.14 - 0.07, -0.34, i * 0.14 + 0.07, 0.34, y + 2 * V + 0.004, PAL.gr4);
  g.flat(-0.5, -0.36, -0.48, 0.36, y + 2 * V + 0.008, PAL.white); g.flat(0.48, -0.36, 0.5, 0.36, y + 2 * V + 0.008, PAL.white); g.flat(-0.5, -0.36, 0.5, -0.34, y + 2 * V + 0.008, PAL.white); g.flat(-0.5, 0.34, 0.5, 0.36, y + 2 * V + 0.008, PAL.white); g.flat(-0.01, -0.36, 0.01, 0.36, y + 2 * V + 0.008, PAL.white);
  for (const [sx, sz2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const mx = sx * 1.3, mz = sz2 * 1.3; g.boxc(mx, y, mz, 1 * U, 20 * V, 1 * U, PAL.g4); g.glow = 2.0; g.boxc(mx - sx * 0.04, y + 20 * V, mz - sz2 * 0.04, 3 * U, 2.5 * V, 3 * U, PAL.y4); g.glow = 0; }
  g.box(-0.3, y, 1.14, 0.3, y + 7 * V, 1.3, { s: PAL.g6, t: PAL.g5 }, 'b'); g.glow = 0.15; g.rs(-0.2, 0.2, y, y + 4.5 * V, 1.3, PAL.g1); g.glow = 2.0; g.rs(-0.26, 0.26, y + 5 * V, y + 6.6 * V, 1.3, PAL.r2); g.glow = 0;
  return { h: y + 22.5 * V };
}

// ---------- extras used for tool pictures ----------
function mRoadIcon(g) {
  g.box(-0.5, 0, -0.5, 0.5, 0.012, 0.5, PAL.g2, 'b');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box(sx > 0 ? 0.5 - 2 * U : -0.5, 0, sz > 0 ? 0.5 - 2 * U : -0.5, sx > 0 ? 0.5 : -0.5 + 2 * U, H0, sz > 0 ? 0.5 : -0.5 + 2 * U, { s: PAL.g4, t: PAL.g5 }, 'b');
  for (const o of [-6, -1.5, 3.5]) { g.flat(o * U, -1 * U, (o + 2.5) * U, 1 * U, 0.016, PAL.y3); g.flat(-1 * U, o * U, 1 * U, (o + 2.5) * U, 0.016, PAL.y3); }
  return { h: 0.1 };
}
function mDozer(g) {
  const y = 0;
  g.box(-5 * U, y, -4 * U, 4 * U, y + 2.5 * V, -2 * U, PAL.g1, 'b'); g.box(-5 * U, y, 2 * U, 4 * U, y + 2.5 * V, 4 * U, PAL.g1, 'b');           // tracks
  g.box(-4.5 * U, y + 1.5 * V, -2.5 * U, 3.5 * U, y + 5 * V, 2.5 * U, PAL.y2, 'b');                                                             // body
  g.box(-4 * U, y + 5 * V, -2 * U, 0, y + 9 * V, 2 * U, { s: PAL.y2, t: PAL.y1 }, 'b'); g.re(-1.5 * U, 1.5 * U, y + 6 * V, y + 8.2 * V, 0, PAL.g1); g.rs(-3.3 * U, -0.7 * U, y + 6 * V, y + 8.2 * V, 2 * U, PAL.g1);
  g.box(5 * U, y, -5 * U, 6 * U, y + 5 * V, 5 * U, { s: PAL.g4, t: PAL.g5 }, 'b'); g.box(3.5 * U, y + 2 * V, -1 * U, 5 * U, y + 3 * V, 1 * U, PAL.g3, 'b');   // blade
  g.boxc(-3 * U, y + 9 * V, -1.2 * U, 0.8 * U, 2.5 * V, 0.8 * U, PAL.g2);
  return { h: 0.6 };
}

const MODEL_FN = {
  home: [mHome1, mHome2, mHome3, mHome4, mHome5, mHome6, mHome7], shop: [mShop1, mShop2, mShop3, mShop4, mShop5, mShop6, mShop7], work: [mWork1, mWork2, mWork3, mWork4, mWork5, mWork6, mWork7],
  park: [mPark], fountain: [mFountain], school: [mSchool], hall: [mHall], stadium: [mStadium], road: [mRoadIcon], dozer: [mDozer],
};
const VARIANTS = 6, MODELS = {};
function getModel(kind, lvl, v) {
  const fns = MODEL_FN[kind], l = Math.min(lvl, fns.length), nv = fns.length > 1 || kind === 'park' ? VARIANTS : 1, key = kind + l + '_' + (v % nv);
  let m = MODELS[key];
  if (!m) { const g = new Geo(), info = fns[l - 1](g, rng(l * 977 + (v % nv) * 131 + kind.length * 17 + kind.charCodeAt(0))); m = MODELS[key] = { geo: g.build(), h: info.h, smoke: info.smoke || null }; }
  return m;
}
