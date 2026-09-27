import * as THREE from 'three';

// Procedural surfaces, generated on the GPU at load. Each surface is a GLSL
// function of the texture coordinate (0–1, tiling seamlessly) that returns a
// color (sRGB, 0–1), a height (0–1, for the normal map) and a roughness.
// Two textures come out per surface: color (with roughness in alpha, unused
// now that every surface is matte) and a normal map worked out from the height.
//
// Coordinates: v = 0 is the bottom of the texture (floor level on walls).
// Features are laid out in fractions of one repeat; TILE in materials.js
// says how many meters one repeat covers.

const LIB = /* glsl */ `
  uniform float uSeed;
  #define RGB(r, g, b) (vec3(r, g, b) / 255.0)

  float hash(vec2 p) {
    p = fract(p * vec2(0.1031, 0.1030) + uSeed * 0.0137);
    p += dot(p, p.yx + 33.33);
    return fract((p.x + p.y) * p.x * 43.17 + p.y * 17.3);
  }
  vec2 hash2(vec2 p) { return vec2(hash(p), hash(p + 17.17)); }

  // Value noise that repeats every per cells (per must be a whole number).
  float vnoise(vec2 p, vec2 per) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(mod(i, per));
    float b = hash(mod(i + vec2(1.0, 0.0), per));
    float c = hash(mod(i + vec2(0.0, 1.0), per));
    float d = hash(mod(i + vec2(1.0, 1.0), per));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  // Fractal noise over the whole texture: freq cells across, doubling per octave.
  float fbm(vec2 uv, float freq, int octaves) {
    float sum = 0.0, amp = 0.5, norm = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      sum += amp * vnoise(uv * freq, vec2(freq));
      norm += amp;
      freq *= 2.0;
      amp *= 0.5;
    }
    return sum / norm;
  }
  // Stretched noise (brushed metal, wood grain): different frequency per axis.
  float fbm2(vec2 uv, vec2 freq, int octaves) {
    float sum = 0.0, amp = 0.5, norm = 0.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      sum += amp * vnoise(uv * freq, freq);
      norm += amp;
      freq *= 2.0;
      amp *= 0.5;
    }
    return sum / norm;
  }
  // Cellular noise: distance to the nearest random point (x) and the cell's id (y).
  vec2 worley(vec2 uv, float freq) {
    vec2 p = uv * freq;
    vec2 i = floor(p);
    float best = 9.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell = i + vec2(x, y);
        vec2 point = cell + hash2(mod(cell, vec2(freq)));
        float d = length(point - p);
        if (d < best) { best = d; id = hash(mod(cell, vec2(freq)) + 3.1); }
      }
    }
    return vec2(best, id);
  }
  // Distance (in uv) to the nearest line of a grid with n cells across.
  float gridDist(float x, float n) {
    float f = fract(x * n);
    return min(f, 1.0 - f) / n;
  }
  // 1 inside a line of half-width w (uv) around each grid line, soft-edged.
  float gridLine(vec2 uv, vec2 n, float w) {
    float d = min(gridDist(uv.x, n.x), gridDist(uv.y, n.y));
    return 1.0 - smoothstep(w * 0.6, w, d);
  }
  // Random value per cell of an n-by-n grid. Cells wrap at the texture's
  // edge (uv 0 and 1 are the same cell row), so the texture tiles seamlessly.
  float cellRand(vec2 uv, vec2 n, float salt) {
    return hash(mod(floor(uv * n), n) + salt);
  }
  // Fine per-texel speckle (fibers, grit) that tiles seamlessly.
  float speckle(vec2 uv, float n, float salt) {
    return hash(mod(floor(uv * n), vec2(n)) + salt);
  }
`;

// Each surface: size ('big' surfaces get the full texture size, props half),
// depth (how tall the height map is, in fractions of one repeat) and GLSL.
const SURFACES = {
  wall: {
    size: 'big', depth: 0.0006,
    glsl: `
      // Painted drywall with an orange-peel finish, scuffed near the floor,
      // and a dark baseboard along the bottom.
      float peel = fbm(uv, 96.0, 3);
      float blotch = fbm(uv, 4.0, 3);
      col = RGB(190.0, 184.0, 162.0) * (0.97 + blotch * 0.06);
      h = 0.4 + peel * 0.25;
      r = 0.82 + peel * 0.08;
      float scuff = smoothstep(0.6, 0.85, fbm2(uv + 0.3, vec2(24.0, 6.0), 3)) * (1.0 - smoothstep(0.07, 0.16, uv.y));
      col *= 1.0 - scuff * 0.08;
      if (uv.y < 0.0625) {
        float top = smoothstep(0.05, 0.0625, uv.y);
        col = RGB(88.0, 80.0, 66.0) * (0.95 + fbm(uv, 64.0, 2) * 0.1);
        h = 1.0 - top * 0.6;
        r = 0.45;
      }
    `,
  },
  carpet: {
    size: 'big', depth: 0.0012,
    glsl: `
      // Commercial carpet tiles (3 per repeat), laid quarter-turned, with
      // fibers and faint seams.
      vec2 t = uv * 3.0;
      float turn = mod(floor(t.x) + floor(t.y), 2.0);
      float fiber = speckle(uv, 768.0, 0.0) * 0.6 + fbm(turn > 0.5 ? uv.yx : uv, 128.0, 2) * 0.4;
      float loops = fbm2(turn > 0.5 ? uv.yx : uv, vec2(48.0, 192.0), 2);
      col = RGB(70.0, 80.0, 98.0) * (0.88 + fiber * 0.2 + loops * 0.05 + turn * 0.015);
      col *= 0.97 + fbm(uv, 3.0, 3) * 0.06;
      // Seams are a few texture pixels wide: thinner lines land on some
      // pixels and not others, and the bump map turns that into sparkling dots.
      float seam = gridLine(uv, vec2(3.0), 0.004);
      col *= 1.0 - seam * 0.2;
      h = fiber * 0.35 + loops * 0.45 - seam * 0.3;
      r = 0.97;
    `,
  },
  carpetRed: {
    size: 'big', depth: 0.0012,
    glsl: `
      // Executive carpet: plush burgundy with a subtle diamond pattern.
      float fiber = speckle(uv, 768.0, 0.0) * 0.3 + fbm(uv, 128.0, 2) * 0.7;
      vec2 d = abs(fract(uv * 6.0 + vec2(uv.y * 6.0, 0.0)) - 0.5);
      float diamond = smoothstep(0.02, 0.0, abs(d.x + d.y - 0.45));
      col = RGB(106.0, 50.0, 50.0) * (0.86 + fiber * 0.22 - diamond * 0.1);
      col *= 0.97 + fbm(uv, 3.0, 3) * 0.06;
      h = fiber - diamond * 0.4;
      r = 0.97;
    `,
  },
  ceiling: {
    size: 'big', depth: 0.004,
    glsl: `
      // Acoustic ceiling tiles (2 by 2 per repeat) with fissures, in a white T-bar grid.
      float bar = gridLine(uv, vec2(2.0), 0.011);
      vec2 pits = worley(uv, 48.0);
      float fissure = smoothstep(0.55, 0.75, fbm2(uv, vec2(24.0, 6.0), 4)) * 0.6 + (1.0 - smoothstep(0.0, 0.18, pits.x)) * 0.5;
      col = RGB(218.0, 215.0, 206.0) * (1.0 - fissure * 0.16) * (0.98 + fbm(uv, 8.0, 2) * 0.04);
      h = 0.35 - fissure * 0.25 + fbm(uv, 256.0, 2) * 0.08;
      r = 0.95;
      if (bar > 0.0) {
        col = mix(col, RGB(236.0, 236.0, 232.0), bar);
        h = mix(h, 1.0, bar);
        r = mix(r, 0.45, bar);
      }
    `,
  },
  linoleum: {
    size: 'big', depth: 0.0008,
    glsl: `
      // Vinyl composition tile (4 by 4 per repeat) in two colors, with chips.
      vec2 t = uv * 4.0;
      float checker = mod(floor(t.x) + floor(t.y), 2.0);
      vec3 base = checker > 0.5 ? RGB(206.0, 199.0, 174.0) : RGB(150.0, 146.0, 132.0);
      float chips = fbm(uv, 256.0, 2);
      float tint = cellRand(uv, vec2(4.0), 1.0);
      col = base * (0.94 + chips * 0.1 + tint * 0.04);
      col = mix(col, col * 0.8, smoothstep(0.72, 0.8, speckle(uv, 512.0, 0.0)) * 0.5);
      float seam = gridLine(uv, vec2(4.0), 0.003);
      col *= 1.0 - seam * 0.3;
      h = 0.6 - seam * 0.35 + chips * 0.1;
      r = 0.38 + fbm(uv, 6.0, 3) * 0.2 + seam * 0.3;
    `,
  },
  tile: {
    size: 'big', depth: 0.002,
    glsl: `
      // White ceramic tiles (8 by 8 per repeat) with grey grout.
      vec2 t = uv * 8.0;
      vec2 f = fract(t);
      float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      float grout = 1.0 - smoothstep(0.02, 0.035, edge);
      float tint = cellRand(uv, vec2(8.0), 2.0);
      col = RGB(222.0, 226.0, 224.0) * (0.96 + tint * 0.05 + fbm(uv, 64.0, 2) * 0.03);
      col = mix(col, RGB(150.0, 154.0, 150.0) * (0.9 + fbm(uv, 256.0, 2) * 0.2), grout);
      h = mix(0.8 + smoothstep(0.02, 0.1, edge) * 0.2, 0.2, grout);
      r = mix(0.22 + tint * 0.08, 0.85, grout);
    `,
  },
  concrete: {
    size: 'big', depth: 0.0015,
    glsl: `
      // Poured concrete: mottled, with pores, stains and hairline cracks.
      float mottle = fbm(uv, 6.0, 5);
      vec2 pores = worley(uv, 96.0);
      float pore = 1.0 - smoothstep(0.0, 0.12, pores.x);
      float crack = smoothstep(0.004, 0.0, abs(fbm(uv + 0.5, 3.0, 4) - 0.5)) * smoothstep(0.62, 0.7, fbm(uv, 2.0, 2));
      float stain = smoothstep(0.58, 0.75, fbm(uv + 1.7, 4.0, 4));
      col = RGB(128.0, 127.0, 121.0) * (0.88 + mottle * 0.2) * (1.0 - stain * 0.12) * (1.0 - pore * 0.2 - crack * 0.2);
      h = 0.5 + mottle * 0.3 + fbm(uv, 192.0, 2) * 0.2 - pore * 0.4 - crack * 0.3;
      r = 0.88 + fbm(uv, 32.0, 2) * 0.08;
    `,
  },
  steel: {
    size: 'small', depth: 0.0003,
    glsl: `
      // Brushed stainless steel.
      float brush = fbm2(uv, vec2(4.0, 512.0), 3);
      col = RGB(160.0, 166.0, 172.0) * (0.9 + brush * 0.16) * (0.97 + fbm(uv, 4.0, 2) * 0.06);
      h = brush;
      r = 0.28 + brush * 0.12 + fbm(uv, 8.0, 3) * 0.06;
    `,
  },
  metal: {
    size: 'small', depth: 0.0004,
    glsl: `
      // Painted metal (shelving, fixtures), a little worn.
      float peel = fbm(uv, 64.0, 3);
      float wear = smoothstep(0.66, 0.8, fbm(uv, 16.0, 4));
      col = mix(RGB(112.0, 116.0, 122.0), RGB(150.0, 152.0, 156.0), wear) * (0.95 + peel * 0.08);
      h = 0.5 + peel * 0.3 - wear * 0.2;
      r = mix(0.45, 0.3, wear);
    `,
  },
  locker: {
    size: 'big', depth: 0.004,
    glsl: `
      // One steel locker door per repeat: edge seams, vent slots near the top
      // and a latch handle.
      vec2 px = vec2(uv.x, 1.0 - uv.y) * 64.0; // canvas-style: y down from the top
      float peel = fbm(uv, 96.0, 2);
      col = RGB(88.0, 112.0, 128.0) * (0.95 + peel * 0.08);
      h = 0.6 + peel * 0.1;
      r = 0.42;
      if (px.x < 1.5 || px.x > 62.5) { col = RGB(40.0, 50.0, 58.0); h = 0.0; r = 0.6; }
      if (px.y > 6.0 && px.y < 17.0 && px.x > 18.0 && px.x < 46.0 && fract(px.y / 3.0) < 0.4) { col = RGB(28.0, 34.0, 40.0); h = 0.1; }
      if (px.x > 49.5 && px.x < 53.5 && px.y > 25.0 && px.y < 37.0) { col = RGB(196.0, 198.0, 200.0); h = 1.0; r = 0.25; }
    `,
  },
  wood: {
    size: 'big', depth: 0.0006,
    glsl: `
      // Varnished wood, grain running along x.
      float warp = fbm(uv, 4.0, 3);
      float grain = fract((uv.y + warp * 0.15) * 22.0 + fbm2(uv, vec2(2.0, 24.0), 3) * 1.5);
      float ring = smoothstep(0.0, 0.25, grain) * smoothstep(1.0, 0.6, grain);
      float fiber = fbm2(uv, vec2(8.0, 256.0), 2);
      col = RGB(140.0, 102.0, 64.0) * (0.78 + ring * 0.2 + fiber * 0.1);
      h = ring * 0.5 + fiber * 0.5;
      r = 0.5 + fiber * 0.12;
    `,
  },
  desk: {
    size: 'big', depth: 0.0002,
    glsl: `
      // Light laminate desktop with a faint wood print.
      float grain = fbm2(uv, vec2(3.0, 48.0), 4);
      col = RGB(202.0, 194.0, 174.0) * (0.95 + grain * 0.08) * (0.98 + fbm(uv, 256.0, 2) * 0.03);
      h = fbm(uv, 256.0, 2);
      r = 0.46 + grain * 0.08;
    `,
  },
  plastic: {
    size: 'small', depth: 0.0003,
    glsl: `
      // Dark textured plastic (monitors, phones, trim).
      float grit = fbm(uv, 256.0, 2);
      col = RGB(64.0, 66.0, 72.0) * (0.95 + grit * 0.08);
      h = grit;
      r = 0.42 + grit * 0.1;
    `,
  },
  screen: {
    size: 'small', depth: 0.0,
    glsl: `
      // A monitor showing lines of text.
      vec2 px = vec2(uv.x, 1.0 - uv.y) * 64.0;
      col = RGB(26.0, 56.0, 108.0) * (0.92 + 0.08 * step(0.5, fract(px.y * 2.0)));
      float row = floor(px.y);
      if (mod(row, 6.0) > 1.5 && mod(row, 6.0) < 3.0 && px.x > 8.0 && px.x < 12.0 + mod(row * 37.0, 40.0)) col = RGB(150.0, 200.0, 255.0);
      if (px.x < 4.0 || px.x > 60.0 || px.y < 4.0 || px.y > 60.0) col = RGB(18.0, 20.0, 24.0);
      h = 0.5;
      r = 0.2;
    `,
  },
  cubicle: {
    size: 'big', depth: 0.0015,
    glsl: `
      // Woven fabric cubicle panels.
      vec2 w = uv * 320.0;
      float weave = sin(w.x * 3.14159) * sin(w.y * 3.14159);
      float slub = fbm2(uv, vec2(64.0, 8.0), 3);
      col = RGB(100.0, 106.0, 124.0) * (0.86 + slub * 0.2 + weave * 0.04) * (0.97 + fbm(uv, 4.0, 3) * 0.06);
      h = 0.5 + weave * 0.3 + slub * 0.2;
      r = 0.96;
    `,
  },
  chair: {
    size: 'small', depth: 0.0012,
    glsl: `
      // Dark mesh upholstery.
      vec2 w = uv * 160.0;
      float weave = abs(sin(w.x * 3.14159)) * abs(sin(w.y * 3.14159));
      col = RGB(40.0, 42.0, 50.0) * (0.85 + weave * 0.25 + fbm(uv, 32.0, 2) * 0.08);
      h = weave;
      r = 0.8;
    `,
  },
  door: {
    size: 'big', depth: 0.004,
    glsl: `
      // Wood door with a raised inset panel.
      vec2 px = vec2(uv.x, 1.0 - uv.y) * 64.0;
      float warp = fbm(uv, 3.0, 3);
      float grain = fract((uv.x + warp * 0.1) * 26.0 + fbm2(uv, vec2(24.0, 2.0), 3));
      float ring = smoothstep(0.0, 0.25, grain) * smoothstep(1.0, 0.6, grain);
      col = RGB(142.0, 106.0, 68.0) * (0.8 + ring * 0.18 + fbm2(uv, vec2(256.0, 8.0), 2) * 0.08);
      vec2 d = min(px - vec2(10.0, 6.0), vec2(53.0, 57.0) - px);
      float inside = min(d.x, d.y);
      float groove = smoothstep(1.5, 0.0, abs(inside)) ;
      h = 0.5 + smoothstep(0.0, 2.5, inside) * 0.4 - groove * 0.4;
      col *= 1.0 - groove * 0.35;
      r = 0.5;
    `,
  },
  stall: {
    size: 'small', depth: 0.0003,
    glsl: `
      // Restroom stall laminate.
      float speck = fbm(uv, 192.0, 2);
      col = RGB(118.0, 138.0, 126.0) * (0.95 + speck * 0.08);
      h = speck;
      r = 0.4;
    `,
  },
  freezer: {
    size: 'big', depth: 0.003,
    glsl: `
      // Insulated freezer panels with vertical seams every quarter.
      float seam = 1.0 - smoothstep(0.003, 0.006, gridDist(uv.x, 4.0));
      float rib = sin(uv.x * 4.0 * 6.2832 * 8.0) * 0.5 + 0.5;
      col = mix(RGB(216.0, 226.0, 230.0) * (0.97 + fbm(uv, 16.0, 3) * 0.05), RGB(160.0, 170.0, 176.0), seam);
      h = 0.6 + rib * 0.15 - seam * 0.6;
      r = mix(0.38, 0.6, seam);
    `,
  },
  freezerFloor: {
    size: 'big', depth: 0.004,
    glsl: `
      // Diamond-plate steel floor.
      vec2 t = uv * 10.0;
      vec2 c = fract(t) - 0.5;
      float flip = mod(floor(t.x) + floor(t.y), 2.0);
      vec2 a = flip > 0.5 ? vec2(c.x + c.y, c.x - c.y) : vec2(c.x - c.y, c.x + c.y);
      float lozenge = 1.0 - smoothstep(0.08, 0.13, length(vec2(a.x * 0.35, a.y * 1.6)));
      float scratch = fbm2(uv, vec2(3.0, 200.0), 2);
      col = mix(RGB(126.0, 132.0, 136.0), RGB(170.0, 176.0, 180.0), lozenge) * (0.92 + scratch * 0.12);
      h = lozenge + scratch * 0.1;
      r = mix(0.5, 0.35, lozenge);
    `,
  },
  hazard: {
    size: 'small', depth: 0.0006,
    glsl: `
      // Worn yellow and black hazard stripes.
      float stripe = step(0.5, fract((uv.x + uv.y) * 4.0));
      float wear = smoothstep(0.62, 0.72, fbm(uv, 12.0, 5));
      col = stripe > 0.5 ? RGB(228.0, 188.0, 38.0) : RGB(30.0, 30.0, 30.0);
      col = mix(col, RGB(120.0, 118.0, 112.0), wear * 0.8);
      h = 0.6 - wear * 0.4;
      r = mix(0.55, 0.85, wear);
    `,
  },
  shutter: {
    size: 'small', depth: 0.004,
    glsl: `
      // Roll-up shutter slats (16 per repeat).
      float s = fract(uv.y * 16.0);
      float profile = sin(s * 3.14159);
      col = mix(RGB(106.0, 106.0, 100.0), RGB(146.0, 146.0, 140.0), profile) * (0.95 + fbm2(uv, vec2(4.0, 64.0), 3) * 0.1);
      h = profile;
      r = 0.5;
    `,
  },
  cardboard: {
    size: 'small', depth: 0.0006,
    glsl: `
      // Cardboard box with a strip of packing tape down the middle.
      float flute = sin(uv.x * 6.2832 * 48.0) * 0.5 + 0.5;
      float fiber = fbm(uv, 128.0, 3);
      col = RGB(168.0, 130.0, 80.0) * (0.88 + fiber * 0.18);
      h = flute * 0.3 + fiber * 0.3;
      r = 0.88;
      if (uv.x > 0.44 && uv.x < 0.55) {
        col = RGB(198.0, 172.0, 122.0) * (0.95 + fbm(uv, 64.0, 2) * 0.08);
        h = 0.8;
        r = 0.35;
      }
    `,
  },
  asphalt: {
    size: 'big', depth: 0.0015,
    glsl: `
      // Asphalt with aggregate stones and a few cracks.
      vec2 stones = worley(uv, 160.0);
      float stone = 1.0 - smoothstep(0.2, 0.45, stones.x);
      float crack = smoothstep(0.01, 0.0, abs(fbm(uv + 2.0, 4.0, 5) - 0.5)) * step(0.6, fbm(uv, 2.0, 3));
      col = RGB(52.0, 54.0, 56.0) * (0.8 + stone * (stones.y * 0.5) + fbm(uv, 8.0, 3) * 0.2) * (1.0 - crack * 0.5);
      h = stone * 0.6 + fbm(uv, 256.0, 2) * 0.4 - crack * 0.5;
      r = 0.93;
    `,
  },
  suit: {
    size: 'small', depth: 0.001,
    glsl: `
      // Yellow hazmat fabric with soft creases.
      float crease = fbm2(uv, vec2(3.0, 12.0), 4);
      vec2 w = uv * 200.0;
      float weave = sin(w.x * 3.14159) * sin(w.y * 3.14159);
      col = RGB(222.0, 190.0, 40.0) * (0.84 + crease * 0.24 + weave * 0.02);
      h = crease * 0.8 + weave * 0.1;
      r = 0.5 + crease * 0.1;
    `,
  },
  counter: {
    size: 'big', depth: 0.0003,
    glsl: `
      // Speckled stone-look countertop.
      float speck = speckle(uv, 512.0, 0.0);
      float cloud = fbm(uv, 8.0, 4);
      col = RGB(180.0, 170.0, 150.0) * (0.9 + cloud * 0.14);
      col = mix(col, RGB(90.0, 84.0, 74.0), step(0.9, speck) * 0.6);
      col = mix(col, RGB(236.0, 230.0, 216.0), step(0.96, speckle(uv, 512.0, 7.0)) * 0.6);
      h = cloud;
      r = 0.3 + cloud * 0.1;
    `,
  },
  fridge: {
    size: 'small', depth: 0.0002,
    glsl: `
      // White enameled appliance.
      float peel = fbm(uv, 128.0, 2);
      col = RGB(226.0, 226.0, 220.0) * (0.98 + peel * 0.03);
      h = peel;
      r = 0.28;
    `,
  },
  vending: {
    size: 'small', depth: 0.002,
    glsl: `
      // Vending machine front: red cabinet and a window of snack rows.
      vec2 px = vec2(uv.x, 1.0 - uv.y) * 64.0;
      col = RGB(158.0, 36.0, 40.0) * (0.95 + fbm(uv, 64.0, 2) * 0.08);
      h = 0.6;
      r = 0.35;
      if (px.x > 8.0 && px.x < 44.0 && px.y > 8.0 && px.y < 50.0) {
        if (mod(px.y, 10.0) < 2.0) { col = RGB(40.0, 40.0, 40.0); r = 0.4; }
        else {
          float item = hash(floor(vec2(px.x / 4.0, px.y / 10.0)));
          col = 0.35 + 0.6 * vec3(fract(item * 7.1), fract(item * 3.7), fract(item * 5.3));
          r = 0.15;
        }
        h = 0.2;
      }
    `,
  },
  red: {
    size: 'small', depth: 0.0003,
    glsl: `
      float peel = fbm(uv, 96.0, 2);
      col = RGB(170.0, 34.0, 34.0) * (0.95 + peel * 0.08);
      h = peel;
      r = 0.45;
    `,
  },
  plant: {
    size: 'small', depth: 0.003,
    glsl: `
      // Overlapping leaves with veins.
      vec2 leaf = worley(uv, 12.0);
      float vein = smoothstep(0.03, 0.0, abs(fract(uv.x * 12.0 + uv.y * 6.0) - 0.5) - 0.46);
      col = RGB(56.0, 110.0, 54.0) * (0.65 + leaf.y * 0.5) * (1.0 - smoothstep(0.35, 0.55, leaf.x) * 0.4);
      col = mix(col, col * 1.3, vein * 0.4);
      h = 1.0 - leaf.x;
      r = 0.55 + leaf.y * 0.2;
    `,
  },
  pot: {
    size: 'small', depth: 0.0005,
    glsl: `
      // Terracotta.
      float speck = fbm(uv, 192.0, 2);
      col = RGB(128.0, 80.0, 56.0) * (0.9 + speck * 0.16 + fbm(uv, 6.0, 2) * 0.06);
      h = speck;
      r = 0.7;
    `,
  },
  trim: {
    size: 'small', depth: 0.0002,
    glsl: `
      // Semi-gloss white paint on door and window frames.
      float peel = fbm(uv, 128.0, 2);
      col = RGB(232.0, 230.0, 222.0) * (0.97 + peel * 0.04);
      h = peel;
      r = 0.35;
    `,
  },
  facade: {
    size: 'big', depth: 0.003,
    glsl: `
      // Precast concrete facade panels (one wide, two tall per repeat) with
      // recessed joints and faint weathering streaks.
      float jointX = 1.0 - smoothstep(0.004, 0.007, gridDist(uv.x, 1.0));
      float jointY = 1.0 - smoothstep(0.008, 0.013, gridDist(uv.y, 2.0));
      float joint = max(jointX, jointY);
      float grain = fbm(uv, 64.0, 3);
      float streak = fbm2(uv, vec2(18.0, 2.0), 3);
      col = RGB(212.0, 206.0, 194.0) * (0.92 + grain * 0.1) * (1.0 - smoothstep(0.55, 0.8, streak) * 0.08);
      col = mix(col, RGB(120.0, 116.0, 108.0), joint);
      h = 0.6 + grain * 0.2 - joint * 0.6;
      r = mix(0.85, 0.9, joint);
    `,
  },
  grass: {
    size: 'big', depth: 0.002,
    glsl: `
      // Mown lawn: blades, clumps and a few worn patches.
      float blade = speckle(uv, 1024.0, 0.0);
      float clump = fbm(uv, 24.0, 4);
      float patchy = smoothstep(0.62, 0.75, fbm(uv + 3.0, 4.0, 4));
      col = RGB(78.0, 116.0, 54.0) * (0.72 + blade * 0.3 + clump * 0.25);
      col = mix(col, RGB(128.0, 120.0, 78.0), patchy * 0.5);
      h = blade * 0.6 + clump * 0.4;
      r = 0.9;
    `,
  },
  rubber: {
    size: 'small', depth: 0.0003,
    glsl: `
      float grit = fbm(uv, 256.0, 2);
      col = RGB(34.0, 34.0, 36.0) * (0.92 + grit * 0.12);
      h = grit;
      r = 0.75;
    `,
  },
};

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

function fragmentShader(glsl) {
  return /* glsl */ `
    ${LIB}
    uniform float uMode;   // 0: color + roughness, 1: normal
    uniform float uTexel;  // one pixel, in uv
    uniform float uDepth;  // height map depth, in uv
    varying vec2 vUv;

    void surface(vec2 uv, out vec3 col, out float h, out float r) {
      ${glsl}
    }

    vec3 toLinear(vec3 c) {
      return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
    }

    void main() {
      vec3 col;
      float h, r;
      if (uMode < 0.5) {
        surface(vUv, col, h, r);
        gl_FragColor = vec4(toLinear(clamp(col, 0.0, 1.0)), clamp(r, 0.04, 1.0));
        return;
      }
      float hl, hr, hd, hu;
      surface(fract(vUv - vec2(uTexel, 0.0)), col, hl, r);
      surface(fract(vUv + vec2(uTexel, 0.0)), col, hr, r);
      surface(fract(vUv - vec2(0.0, uTexel)), col, hd, r);
      surface(fract(vUv + vec2(0.0, uTexel)), col, hu, r);
      float k = uDepth / (2.0 * uTexel);
      vec3 n = normalize(vec3((hl - hr) * k, (hd - hu) * k, 1.0));
      gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
    }
  `;
}

function target(size, colorSpace, anisotropy) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    colorSpace,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    anisotropy,
  });
  return rt;
}

// Generates every surface's textures. Returns { name: { map, normalMap } }
// (normalMap is null when normal maps are off) and a dispose() for when the
// quality preset changes.
export function generateSurfaces(renderer, { size = 1024, normalMaps = true, anisotropy = 1 } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);

  const previous = renderer.getRenderTarget();
  const out = {};
  const targets = [];
  let seed = 1;
  for (const [name, surface] of Object.entries(SURFACES)) {
    const px = surface.size === 'big' ? size : Math.max(128, size / 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: fragmentShader(surface.glsl),
      uniforms: {
        uSeed: { value: seed++ },
        uMode: { value: 0 },
        uTexel: { value: 1 / px },
        uDepth: { value: surface.depth },
      },
      depthTest: false,
      depthWrite: false,
    });
    quad.material = material;

    const color = target(px, THREE.SRGBColorSpace, anisotropy);
    renderer.setRenderTarget(color);
    renderer.render(scene, camera);
    targets.push(color);

    let normal = null;
    if (normalMaps && surface.depth > 0) {
      normal = target(px, THREE.NoColorSpace, anisotropy);
      material.uniforms.uMode.value = 1;
      renderer.setRenderTarget(normal);
      renderer.render(scene, camera);
      targets.push(normal);
    }
    material.dispose();
    out[name] = { map: color.texture, normalMap: normal?.texture ?? null };
  }
  renderer.setRenderTarget(previous);
  quad.geometry.dispose();

  return {
    surfaces: out,
    dispose() {
      for (const t of targets) t.dispose();
    },
  };
}
