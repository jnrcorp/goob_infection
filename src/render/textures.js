import * as THREE from 'three';
import { createRng } from '../core/random.js';

// Procedural 64x64 textures, drawn per pixel. Nearest filtering and no
// mipmaps keep them crunchy like PS1 textures.
const SIZE = 64;

function makeTexture(fn, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d');
  const img = g.createImageData(SIZE, SIZE);
  const rng = createRng(seed);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = fn(x, y, rng);
      const k = (y * SIZE + x) * 4;
      img.data[k] = c[0];
      img.data[k + 1] = c[1];
      img.data[k + 2] = c[2];
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return toTexture(canvas);
}

export function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const noise = (rng, amount) => (rng() - 0.5) * amount;
const shade = (c, v) => [c[0] + v, c[1] + v, c[2] + v];
const flat = (color, amount) => (x, y, r) => shade(color, noise(r, amount));

// Canvas row 63 is the bottom of the texture (v = 0), which sits at floor
// level on walls.
const DRAW = {
  wall: (x, y, r) => (y >= 60 ? shade([92, 84, 70], noise(r, 8)) : shade([186, 180, 158], noise(r, 10))),
  carpet: (x, y, r) => shade([70, 80, 96], noise(r, 16) + (r() < 0.08 ? -22 : r() < 0.05 ? 18 : 0)),
  carpetRed: (x, y, r) => shade([104, 52, 50], noise(r, 16) + (r() < 0.08 ? -20 : 0)),
  ceiling: (x, y, r) => (x % 32 === 0 || y % 32 === 0 ? [146, 144, 136] : shade([212, 209, 198], noise(r, 8) + (r() < 0.03 ? -40 : 0))),
  linoleum: (x, y, r) => (((x >> 4) + (y >> 4)) % 2 ? shade([204, 197, 172], noise(r, 8)) : shade([148, 144, 130], noise(r, 8))),
  tile: (x, y, r) => (x % 8 === 0 || y % 8 === 0 ? [148, 152, 150] : shade([218, 222, 220], noise(r, 6))),
  concrete: flat([124, 123, 117], 18),
  steel: (x, y, r) => shade([152, 158, 164], noise(r, 6) + Math.sin(y * 1.7) * 4),
  locker: (x, y, r) => {
    if (x < 2 || x > 61 || (y >= 6 && y <= 16 && x >= 18 && x <= 46 && y % 3 === 0)) return [44, 56, 64];
    if (x >= 50 && x <= 53 && y >= 26 && y <= 36) return [190, 190, 190];
    return shade([86, 110, 126], noise(r, 6));
  },
  wood: (x, y, r) => shade([136, 100, 64], Math.sin((y + Math.sin(x * 0.2) * 3) * 0.9) * 8 + noise(r, 6)),
  desk: flat([198, 191, 172], 5),
  plastic: flat([66, 68, 74], 6),
  screen: (x, y) => {
    if (x < 4 || x > 59 || y < 4 || y > 59) return [20, 22, 26];
    if (y % 6 === 2 && x > 8 && x < 12 + ((y * 37) % 40)) return [150, 200, 255];
    return shade([28, 58, 108], y % 2 ? -6 : 0);
  },
  cubicle: flat([100, 106, 122], 22),
  chair: flat([38, 40, 48], 10),
  metal: flat([112, 116, 122], 10),
  door: (x, y, r) => {
    const inset = ((x === 10 || x === 53) && y >= 6 && y <= 57) || ((y === 6 || y === 57) && x >= 10 && x <= 53);
    return inset ? [96, 70, 44] : shade([140, 104, 66], Math.sin((x + Math.sin(y * 0.15) * 2) * 0.8) * 6 + noise(r, 5));
  },
  stall: flat([116, 136, 124], 6),
  freezer: (x, y, r) => (x % 16 === 0 ? [170, 180, 184] : shade([214, 224, 228], noise(r, 5))),
  freezerFloor: (x, y, r) => {
    const bump = (x % 8 < 4) ? (x + y) % 8 === 0 : (x - y + 64) % 8 === 0;
    return bump ? [176, 182, 186] : shade([128, 134, 138], noise(r, 8));
  },
  hazard: (x, y) => (((x + y) >> 3) % 2 ? [226, 186, 36] : [30, 30, 30]),
  shutter: (x, y, r) => shade(y % 4 < 2 ? [142, 142, 136] : [108, 108, 102], noise(r, 4)),
  cardboard: (x, y, r) => (x >= 28 && x <= 35 ? shade([196, 168, 116], noise(r, 4)) : shade([166, 128, 78], noise(r, 10))),
  asphalt: flat([50, 52, 54], 22),
  suit: flat([220, 188, 38], 10),
  counter: flat([178, 168, 148], 6),
  fridge: flat([222, 222, 216], 4),
  vending: (x, y, r) => {
    if (x > 8 && x < 44 && y > 8 && y < 50) return y % 10 < 2 ? [40, 40, 40] : shade([60, 90, 110], noise(r, 20));
    return shade([156, 36, 40], noise(r, 6));
  },
  red: flat([168, 34, 34], 8),
  plant: flat([58, 108, 56], 40),
  pot: flat([122, 78, 56], 8),
  rubber: flat([34, 34, 36], 6),
};

export function createTextures() {
  const textures = {};
  let seed = 1;
  for (const [name, fn] of Object.entries(DRAW)) textures[name] = makeTexture(fn, seed++);
  return textures;
}
