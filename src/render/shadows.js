import * as THREE from 'three';

// Soft contact shadows: dark patches on the floor under furniture, people and
// bins. Real shadows from 30-odd room lights would cost far too much; these
// give the same "sitting on the floor" look for almost nothing.
//
// Furniture: full darkness right up to the edge of the footprint, fading out
// over a fixed distance beyond it (so a big shelf and a small plant get the
// same soft edge). Built as a small mesh with the fade in its vertex alphas.
// People and bins: a round blob, fading from the center.

const STRENGTH = 0.7;    // darkness at the edge of the footprint
const FADE = 0.55;       // meters the shadow spreads beyond the footprint

const common = {
  color: 0x000000,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide, // flat on the floor: which way the triangles wind doesn't matter
  // Drawn just in front of the floor so the two never flicker.
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -4,
};

export const shadowMaterials = {
  // Darkness comes from a gradient texture: each vertex's u coordinate says
  // how dark it is. (Per-vertex alpha and multiply blending both fail to
  // show up in this renderer; texture alpha works.)
  box: new THREE.MeshBasicMaterial({ ...common, map: gradientTexture(), opacity: STRENGTH }),
  round: new THREE.MeshBasicMaterial({ ...common, map: roundTexture(), opacity: 0.6 }),
};

// Floor shadow for a rectangular footprint: an inner rect at full alpha,
// then two rings fading to nothing FADE meters out.
// Fade the baked contact shadows (0–1): with real
// shadows on, they'd double up into dark puddles.
export function setContactShadowStrength(k) {
  shadowMaterials.box.opacity = STRENGTH * k;
  shadowMaterials.round.opacity = 0.6 * k;
}

export function boxShadowGeometry(x0, z0, x1, z1, y) {
  const rings = [
    { grow: 0, alpha: 1 },
    { grow: FADE * 0.3, alpha: 0.6 },
    { grow: FADE, alpha: 0 },
  ];
  const corners = (g) => [[x0 - g, z0 - g], [x1 + g, z0 - g], [x1 + g, z1 + g], [x0 - g, z1 + g]];
  const pos = [];
  const uv = [];
  const vert = ([x, z], a) => {
    pos.push(x, y, z);
    uv.push(a, 0.5); // u picks the darkness from the gradient texture
  };
  const quad = (p, a, q, b, r, c, s, d) => {
    vert(p, a); vert(s, d); vert(r, c);
    vert(p, a); vert(r, c); vert(q, b);
  };
  const inner = corners(0);
  quad(inner[0], 1, inner[1], 1, inner[2], 1, inner[3], 1);
  for (let i = 0; i < rings.length - 1; i++) {
    const a = corners(rings[i].grow);
    const b = corners(rings[i + 1].grow);
    for (let k = 0; k < 4; k++) {
      const n = (k + 1) % 4;
      // Band between edge k->n of the inner ring and the same edge outside.
      quad(a[k], rings[i].alpha, a[n], rings[i].alpha, b[n], rings[i + 1].alpha, b[k], rings[i + 1].alpha);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// Alpha rising left to right: u = 0 is clear, u = 1 is full darkness.
// (Square rather than 1 pixel tall: a 1-pixel-tall texture didn't show up.)
function gradientTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) data[(y * size + x) * 4 + 3] = Math.round((x / (size - 1)) * 255);
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// Round alpha falloff, as raw pixel data (a 2D canvas can lose the alpha of
// transparent black pixels on the way to the GPU).
function roundTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2;
      const k = (y * size + x) * 4;
      // Solid in the middle half, fading to nothing at the rim.
      data[k + 3] = Math.round(smooth(Math.min(1, Math.max(0, (1 - d) / 0.55))) * 255);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const roundGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

// A round shadow for something that moves (a person, a bin): add it as a child
// at the feet. size = diameter in meters.
export function blobShadow(size) {
  const m = new THREE.Mesh(roundGeometry, shadowMaterials.round);
  m.scale.set(size, 1, size);
  m.position.y = 0.004;
  m.renderOrder = -1;
  return m;
}
