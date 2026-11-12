// ---------- the fixed palette: every pixel on screen is snapped to one of these ----------
const PAL = {
  ink: '#14161f', g1: '#2a2e3a', g2: '#454a57', g3: '#646a78', g4: '#878d99', g5: '#aab0ba', g6: '#cfd3d9', white: '#f4f4ef',
  s1: '#5b544c', s2: '#857c6f', s3: '#b0a695', s4: '#d4cab6', cream: '#ece4cf',
  gr0: '#143a2a', gr1: '#1f5a34', gr2: '#2f7d3b', gr3: '#48a044', gr4: '#74c04e', gr5: '#a8d86a',
  ol1: '#5d6b2c', ol2: '#8c9440',
  b0: '#0f1f4d', b1: '#17358a', b2: '#1f55c8', b3: '#3b82e8', b4: '#7fb6f2', b5: '#c2e0f7',
  t1: '#0f4f5c', t2: '#1a8a8f', t3: '#45bdb4', t4: '#9fe3d4',
  n0: '#0b0f26', n1: '#1b1f4a', n2: '#2f3072', n3: '#4a4a9a',
  r0: '#4a1a1c', r1: '#7c2a26', r2: '#b03e2e', r3: '#d85f3c', r4: '#f08f62',
  br0: '#3a2618', br1: '#5e3d24', br2: '#875a32', br3: '#b0814a', sand1: '#d2b06e', sand2: '#ead79a',
  y1: '#b88a14', y2: '#e6bb2a', y3: '#ffe066', y4: '#fff3b0', o1: '#d9731c',
  m1: '#c43a7a', m2: '#f078a8',
};
const PALETTE_HEX = Object.values(PAL);
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

// Nearest palette colour (OKLab distance) baked into a 64x64x64 lookup, laid out as an 8x8 grid of 64x64 slices.
// The post shader then snaps a pixel with one texture read instead of looping over the palette.
function buildLut() {
  const n = PALETTE_HEX.length, lab = new Float32Array(n * 3), rgb = new Uint8Array(n * 3), S = 64;
  const lin = new Float32Array(S);
  for (let i = 0; i < S; i++) { const c = i / (S - 1); lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const s2l = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const toLab = (r, g, b, out, o) => {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    out[o] = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s; out[o + 1] = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s; out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  };
  PALETTE_HEX.forEach((h, i) => { const c = hexRgb(h); rgb[i * 3] = Math.round(c[0] * 255); rgb[i * 3 + 1] = Math.round(c[1] * 255); rgb[i * 3 + 2] = Math.round(c[2] * 255); toLab(s2l(c[0]), s2l(c[1]), s2l(c[2]), lab, i * 3); });
  const data = new Uint8Array(512 * 512 * 4), L = new Float32Array(3);
  for (let b = 0; b < S; b++) for (let g = 0; g < S; g++) for (let r = 0; r < S; r++) {
    toLab(lin[r], lin[g], lin[b], L, 0);
    let best = 1e9, bi = 0;
    for (let i = 0; i < n; i++) { const dl = lab[i * 3] - L[0], da = lab[i * 3 + 1] - L[1], db = lab[i * 3 + 2] - L[2], e = dl * dl * 1.15 + da * da + db * db; if (e < best) { best = e; bi = i; } }
    const o = (((b >> 3) * 64 + g) * 512 + (b & 7) * 64 + r) * 4;
    data[o] = rgb[bi * 3]; data[o + 1] = rgb[bi * 3 + 1]; data[o + 2] = rgb[bi * 3 + 2]; data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 512, 512, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.flipY = false; tex.needsUpdate = true;
  return tex;
}
