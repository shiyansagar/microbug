// ---------- Geo: merges many small primitives into one vertex-coloured BufferGeometry ----------
// Models are designed in art pixels: U is one pixel along a wall, V is one pixel up a wall (at the 32 px tile scale),
// so a window that is 2U x 2V always lands on exactly 2 x 2 screen pixels.
const U = 1 / 16, V = 1 / 19.6, EPS = 0.004, H0 = 0.03;
const _icoCache = [null, null];
function faceN(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
class Geo {
  // lod: 0 = always drawn, 1 = fine detail drawn only at the closer zoom levels, 2 = only at the closest. out: extra push off a wall for decals on decals.
  constructor() { this.p = []; this.n = []; this.c = []; this.gl = []; this.ld = []; this.i = []; this._c = {}; this.glow = 0; this.lod = 0; this.out = 0; }
  rgb(c) { return typeof c === 'string' ? (this._c[c] || (this._c[c] = hexRgb(c))) : c; }
  vtx(P, n, col, k) { this.p.push(P[0], P[1], P[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col[0] * k, col[1] * k, col[2] * k); this.gl.push(this.glow); this.ld.push(this.lod); return this.p.length / 3 - 1; }
  // quad a,b,c,d counter-clockwise seen from outside; k = optional per-corner brightness
  quad(a, b, c, d, color, n, k) {
    const col = this.rgb(color); n = n || faceN(a, b, d);
    const i0 = this.vtx(a, n, col, k ? k[0] : 1), i1 = this.vtx(b, n, col, k ? k[1] : 1), i2 = this.vtx(c, n, col, k ? k[2] : 1), i3 = this.vtx(d, n, col, k ? k[3] : 1);
    this.i.push(i0, i1, i2, i0, i2, i3); return this;
  }
  tri(a, b, c, color, n) {
    const col = this.rgb(color); n = n || faceN(a, b, c);
    const i0 = this.vtx(a, n, col, 1), i1 = this.vtx(b, n, col, 1), i2 = this.vtx(c, n, col, 1);
    this.i.push(i0, i1, i2); return this;
  }
  // axis box; color is a hex string or {s: sides, t: top, zp/zn/xp/xn: single faces}; skip lists faces to leave out (t b n s e w)
  box(x0, y0, z0, x1, y1, z1, color, skip) {
    skip = skip || '';
    const o = typeof color === 'object' && !Array.isArray(color) ? color : null, cs = o ? o.s : color, ct = o ? (o.t || o.s) : color;
    if (!skip.includes('t')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], ct, [0, 1, 0]);
    if (!skip.includes('b')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], cs, [0, -1, 0]);
    if (!skip.includes('s')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], o && o.zp || cs, [0, 0, 1]);
    if (!skip.includes('n')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], o && o.zn || cs, [0, 0, -1]);
    if (!skip.includes('e')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], o && o.xp || cs, [1, 0, 0]);
    if (!skip.includes('w')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], o && o.xn || cs, [-1, 0, 0]);
    return this;
  }
  // box from a footprint centre, base height, width (x), height (y), depth (z)
  boxc(cx, y0, cz, w, h, d, color, skip) { return this.box(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, color, skip === undefined ? 'b' : skip); }
  // decals: flat on the ground, or on a wall facing south (+z), north, east (+x), west
  flat(x0, z0, x1, z1, y, color) { return this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color, [0, 1, 0]); }
  rs(xa, xb, ya, yb, z, color) { const e = EPS + this.out; return this.quad([xa, ya, z + e], [xb, ya, z + e], [xb, yb, z + e], [xa, yb, z + e], color, [0, 0, 1]); }
  rn(xa, xb, ya, yb, z, color) { const e = EPS + this.out; return this.quad([xb, ya, z - e], [xa, ya, z - e], [xa, yb, z - e], [xb, yb, z - e], color, [0, 0, -1]); }
  re(za, zb, ya, yb, x, color) { const e = EPS + this.out; return this.quad([x + e, ya, zb], [x + e, ya, za], [x + e, yb, za], [x + e, yb, zb], color, [1, 0, 0]); }
  rw(za, zb, ya, yb, x, color) { const e = EPS + this.out; return this.quad([x - e, ya, za], [x - e, ya, zb], [x - e, yb, zb], [x - e, yb, za], color, [-1, 0, 0]); }
  // a rect on side sd ('s','n','e','w') of a footprint, a..b measured left to right as you look at that wall
  wall(sd, x0, z0, x1, z1, a, b, ya, yb, color) {
    if (sd === 's') return this.rs(x0 + a, x0 + b, ya, yb, z1, color);
    if (sd === 'n') return this.rn(x1 - b, x1 - a, ya, yb, z0, color);
    if (sd === 'e') return this.re(z1 - b, z1 - a, ya, yb, x1, color);
    return this.rw(z0 + a, z0 + b, ya, yb, x0, color);
  }
  // punched windows on the walls of a footprint. o: ww wh gap sill mar sides col alt lit rnd skip(sd, floor, col, cols)
  windows(x0, z0, x1, z1, y0, floors, fh, o) {
    const ww = o.ww || 2 * U, wh = o.wh || 2 * V, gap = o.gap || 2 * U, sill = o.sill === undefined ? (fh - wh) / 2 : o.sill, mar = o.mar === undefined ? U : o.mar;
    const sides = o.sides || 'senw', rnd = o.rnd, lit = o.lit === undefined ? 0.5 : o.lit, col = o.col || PAL.g1;
    for (const sd of sides) {
      const L = (sd === 's' || sd === 'n') ? x1 - x0 : z1 - z0, cols = Math.floor((L - 2 * mar + gap + 1e-6) / (ww + gap));
      if (cols < 1) continue;
      const start = (L - (cols * ww + (cols - 1) * gap)) / 2;
      for (let f = 0; f < floors; f++) {
        const ya = y0 + f * fh + sill;
        for (let c = 0; c < cols; c++) {
          if (o.skip && o.skip(sd, f, c, cols)) continue;
          this.glow = rnd() < lit * 0.72 ? 0.12 + rnd() * 0.85 : 0;
          const a = start + c * (ww + gap);
          this.wall(sd, x0, z0, x1, z1, a, a + ww, ya, ya + wh, o.alt && rnd() < 0.14 ? o.alt : col);
          // close up, each window gets a sill and a sash bar
          this.glow = 0; this.lod = 1; this.wall(sd, x0, z0, x1, z1, a - 0.5 * U, a + ww + 0.5 * U, ya - 0.5 * V, ya, PAL.g3);
          if (wh >= 3 * V - 1e-6) { this.out = EPS; this.wall(sd, x0, z0, x1, z1, a, a + ww, ya + V, ya + 1.5 * V, PAL.g3); this.out = 0; }
          this.lod = 0;
        }
      }
    }
    this.glow = 0; return this;
  }
  // ribbon windows: one strip per floor, cut into segments so parts of a floor light up separately. o: wh sill mar seg mul col alt lit rnd sides
  bands(x0, z0, x1, z1, y0, floors, fh, o) {
    const wh = o.wh || fh - 2 * V, sill = o.sill === undefined ? (fh - wh) / 2 : o.sill, mar = o.mar === undefined ? U : o.mar, seg = o.seg || 4 * U, mul = o.mul || 0;
    const sides = o.sides || 'senw', rnd = o.rnd, lit = o.lit === undefined ? 0.45 : o.lit, col = o.col || PAL.g1;
    for (const sd of sides) {
      const L = ((sd === 's' || sd === 'n') ? x1 - x0 : z1 - z0) - 2 * mar, n = Math.max(1, Math.round(L / seg)), sl = L / n;
      if (L <= 0) continue;
      for (let f = 0; f < floors; f++) {
        const ya = y0 + f * fh + sill;
        for (let c = 0; c < n; c++) {
          this.glow = rnd() < lit * 0.72 ? 0.12 + rnd() * 0.85 : 0;
          this.wall(sd, x0, z0, x1, z1, mar + c * sl + mul / 2, mar + (c + 1) * sl - mul / 2, ya, ya + wh, o.alt && rnd() < 0.14 ? o.alt : col);
          if (sl >= 3 * U) { this.glow = 0; this.lod = 1; this.out = EPS; this.wall(sd, x0, z0, x1, z1, mar + (c + 0.5) * sl - 0.25 * U, mar + (c + 0.5) * sl + 0.25 * U, ya, ya + wh, PAL.g3); this.out = 0; this.lod = 0; }
        }
        this.glow = 0; this.lod = 1; this.wall(sd, x0, z0, x1, z1, mar, mar + L, ya - 0.5 * V, ya, PAL.g3); this.lod = 0;
      }
    }
    this.glow = 0; return this;
  }
  // vertical (optionally tapered) prism; flat facets. o: rTop, cap (default true), top (colour), a0, sz (z squash), inner (faces point inward)
  cyl(cx, y, cz, r0, h, seg, color, o) {
    o = o || {};
    const r1 = o.rTop === undefined ? r0 : o.rTop, sz = o.sz || 1, a0 = o.a0 === undefined ? Math.PI / seg : o.a0;
    for (let i = 0; i < seg; i++) {
      const a = a0 + i / seg * TAU, b = a0 + (i + 1) / seg * TAU, ca = Math.cos(a), sa = Math.sin(a) * sz, cb = Math.cos(b), sb = Math.sin(b) * sz;
      const A0 = [cx + ca * r0, y, cz + sa * r0], B0 = [cx + cb * r0, y, cz + sb * r0], A1 = [cx + ca * r1, y + h, cz + sa * r1], B1 = [cx + cb * r1, y + h, cz + sb * r1];
      if (o.inner) { if (r0 < 1e-4) this.tri(A0, B1, A1, color); else this.quad(A0, B0, B1, A1, color); }
      else if (r1 < 1e-4) this.tri(B0, A0, A1, color); else this.quad(B0, A0, A1, B1, color);
      if (o.cap !== false && r1 > 1e-4 && !o.inner) this.tri([cx, y + h, cz], B1, A1, o.top || color, [0, 1, 0]);
    }
    return this;
  }
  cone(cx, y, cz, r, h, seg, color, o) { return this.cyl(cx, y, cz, r, h, seg, color, Object.assign({ rTop: 0, cap: false }, o || {})); }
  // gable roof on a w (x) by d (z) footprint; ridge along x when alongX; e = colour of the two wall triangles
  gable(cx, y, cz, w, d, h, color, alongX, over, e) {
    over = over === undefined ? 0.6 * U : over; e = e || color;
    if (alongX) {
      const hw = w / 2 + over, zz = d / 2 + over;
      this.quad([cx - hw, y, cz + zz], [cx + hw, y, cz + zz], [cx + hw, y + h, cz], [cx - hw, y + h, cz], color);
      this.quad([cx + hw, y, cz - zz], [cx - hw, y, cz - zz], [cx - hw, y + h, cz], [cx + hw, y + h, cz], color);
      this.tri([cx + w / 2, y, cz + d / 2], [cx + w / 2, y, cz - d / 2], [cx + w / 2, y + h, cz], e, [1, 0, 0]);
      this.tri([cx - w / 2, y, cz - d / 2], [cx - w / 2, y, cz + d / 2], [cx - w / 2, y + h, cz], e, [-1, 0, 0]);
    } else {
      const hd = d / 2 + over, xx = w / 2 + over;
      this.quad([cx + xx, y, cz + hd], [cx + xx, y, cz - hd], [cx, y + h, cz - hd], [cx, y + h, cz + hd], color);
      this.quad([cx - xx, y, cz - hd], [cx - xx, y, cz + hd], [cx, y + h, cz + hd], [cx, y + h, cz - hd], color);
      this.tri([cx - w / 2, y, cz + d / 2], [cx + w / 2, y, cz + d / 2], [cx, y + h, cz + d / 2], e, [0, 0, 1]);
      this.tri([cx + w / 2, y, cz - d / 2], [cx - w / 2, y, cz - d / 2], [cx, y + h, cz - d / 2], e, [0, 0, -1]);
    }
    return this;
  }
  // hip roof (a pyramid when w == d)
  hip(cx, y, cz, w, d, h, color, over) {
    over = over || 0;
    const hw = w / 2 + over, hd = d / 2 + over, rl = Math.max(0, (w - d) / 2), rd = Math.max(0, (d - w) / 2);
    this.quad([cx - hw, y, cz + hd], [cx + hw, y, cz + hd], [cx + rl, y + h, cz + rd], [cx - rl, y + h, cz + rd], color);
    this.quad([cx + hw, y, cz - hd], [cx - hw, y, cz - hd], [cx - rl, y + h, cz - rd], [cx + rl, y + h, cz - rd], color);
    this.quad([cx + hw, y, cz + hd], [cx + hw, y, cz - hd], [cx + rl, y + h, cz - rd], [cx + rl, y + h, cz + rd], color);
    this.quad([cx - hw, y, cz - hd], [cx - hw, y, cz + hd], [cx - rl, y + h, cz + rd], [cx - rl, y + h, cz - rd], color);
    return this;
  }
  // faceted ball for tree crowns and domes; sy squashes it
  blob(cx, cy, cz, r, color, sy, detail) {
    const k = detail ? 1 : 0;
    if (!_icoCache[k]) { let t = new THREE.IcosahedronGeometry(1, k); if (t.index) t = t.toNonIndexed(); _icoCache[k] = Array.from(t.attributes.position.array); }
    const P = _icoCache[k]; sy = sy || 1;
    for (let i = 0; i < P.length; i += 9) this.tri([cx + P[i] * r, cy + P[i + 1] * r * sy, cz + P[i + 2] * r], [cx + P[i + 3] * r, cy + P[i + 4] * r * sy, cz + P[i + 5] * r], [cx + P[i + 6] * r, cy + P[i + 7] * r * sy, cz + P[i + 8] * r], color);
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry(), nv = this.p.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('glow', new THREE.Float32BufferAttribute(this.gl, 1));
    g.setAttribute('lod', new THREE.Float32BufferAttribute(this.ld, 1));
    g.setIndex(nv > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
