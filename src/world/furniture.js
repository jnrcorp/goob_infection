import * as THREE from 'three';
import { toTexture } from '../render/textures.js';

// Furniture made of boxes. Each piece is described in local coordinates and
// placed with a position and a rotation in quarter turns (0–3).
// Convention: the side a person uses faces local +z.

const NC = { collide: false };

export function placer(b, x, z, rot = 0, y = 0) {
  const r = (lx, lz) => {
    switch (rot & 3) {
      case 0: return [lx, lz];
      case 1: return [lz, -lx];
      case 2: return [-lx, -lz];
      default: return [-lz, lx];
    }
  };
  const box = (lx0, ly0, lz0, lx1, ly1, lz1, mat, opts) => {
    const [ax, az] = r(lx0, lz0);
    const [bx, bz] = r(lx1, lz1);
    return b.box(x + Math.min(ax, bx), y + ly0, z + Math.min(az, bz), x + Math.max(ax, bx), y + ly1, z + Math.max(az, bz), mat, opts);
  };
  // Rounded-edge version of box (same arguments, then the edge radius).
  box.round = (lx0, ly0, lz0, lx1, ly1, lz1, mat, radius, opts) => {
    const [ax, az] = r(lx0, lz0);
    const [bx, bz] = r(lx1, lz1);
    return b.roundBox(x + Math.min(ax, bx), y + ly0, z + Math.min(az, bz), x + Math.max(ax, bx), y + ly1, z + Math.max(az, bz), mat, radius, opts);
  };
  // Any geometry, built around its own origin in local coordinates, placed at
  // local (lx, ly, lz) and turned with the rest of the piece.
  box.shape = (geometry, lx, ly, lz, mat) => {
    const [ax, az] = r(lx, lz);
    b.shape(geometry, mat, x + ax, y + ly, z + az, (rot & 3) * Math.PI / 2);
  };
  box.point = (lx, lz) => {
    const [ax, az] = r(lx, lz);
    return { x: x + ax, z: z + az };
  };
  return box;
}

// Office chair: five-star base on casters, gas lift, padded seat and back,
// and armrests. Backrest on local +z.
export function chair(b, x, z, rot = 0, y = 0) {
  const p = placer(b, x, z, rot, y);
  for (let k = 0; k < 5; k++) {
    const a = k * Math.PI * 2 / 5 + 0.3;
    const leg = new THREE.BoxGeometry(0.3, 0.035, 0.045);
    leg.translate(0.15, 0, 0);
    leg.rotateY(a);
    p.shape(leg, 0, 0.075, 0, 'plastic');
    const caster = new THREE.SphereGeometry(0.03, 8, 6);
    p.shape(caster, Math.cos(a) * 0.29, 0.03, -Math.sin(a) * 0.29, 'rubber');
  }
  p.shape(new THREE.CylinderGeometry(0.045, 0.06, 0.06, 12), 0, 0.09, 0, 'plastic');
  p.shape(new THREE.CylinderGeometry(0.022, 0.022, 0.32, 10), 0, 0.27, 0, 'steel');
  p.round(-0.25, 0.42, -0.24, 0.25, 0.5, 0.25, 'chair', 0.04, NC);
  p(-0.03, 0.44, 0.2, 0.03, 0.62, 0.24, 'plastic', NC);
  p.round(-0.23, 0.58, 0.22, 0.23, 1.04, 0.28, 'chair', 0.05, NC);
  for (const side of [-1, 1]) {
    p(side * 0.25 - 0.015, 0.5, -0.02, side * 0.25 + 0.015, 0.66, 0.02, 'plastic', NC);
    p.round(side * 0.25 - 0.035, 0.66, -0.14, side * 0.25 + 0.035, 0.69, 0.12, 'rubber', 0.012, NC);
  }
}

// A few things people keep on their desks, picked from the desk's position.
function deskClutter(p, x, z) {
  const pick = (salt) => {
    const v = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
    return v - Math.floor(v);
  };
  if (pick(1) < 0.7) {
    const mug = new THREE.CylinderGeometry(0.04, 0.036, 0.1, 14);
    p.shape(mug, -0.58 + pick(2) * 0.1, 0.81, -0.12 + pick(3) * 0.2, pick(4) < 0.5 ? 'fridge' : 'red');
  }
  if (pick(5) < 0.8) {
    const stack = 1 + Math.floor(pick(6) * 4);
    const paper = new THREE.BoxGeometry(0.21, 0.004 * stack, 0.3);
    paper.rotateY(pick(7) * 0.5 - 0.25);
    p.shape(paper, 0.52, 0.761 + 0.002 * stack, -0.05 + pick(8) * 0.15, 'fridge');
  }
  if (pick(9) < 0.45) {
    p.round(-0.62, 0.76, -0.34, -0.42, 0.82, -0.18, 'plastic', 0.015, NC); // desk phone
  }
  if (pick(10) < 0.5) {
    const holder = new THREE.CylinderGeometry(0.035, 0.035, 0.11, 12);
    p.shape(holder, 0.66, 0.815, -0.3, 'metal');
  }
}

// Desk with monitor at the back (-z) and a chair in front (+z).
// Returns the seat { x, z, rot } (rot = the desk's rotation) and the desk
// center { deskX, deskZ }.
export function desk(b, x, z, rot = 0, y = 0) {
  const p = placer(b, x, z, rot, y);
  p.round(-0.8, 0.72, -0.4, 0.8, 0.76, 0.4, 'desk', 0.012, NC);
  p(-0.8, 0, -0.4, -0.76, 0.72, 0.4, 'plastic', NC);
  p(0.76, 0, -0.4, 0.8, 0.72, 0.4, 'plastic', NC);
  p(-0.76, 0.25, -0.4, 0.76, 0.72, -0.37, 'plastic', NC);
  p(-0.8, 0, -0.4, 0.8, 0.76, 0.4, null);
  // Thin-bezel monitor on a stand. The screen sits 2 mm proud of the casing
  // so the two never flicker.
  p.round(-0.29, 0.9, -0.3, 0.29, 1.24, -0.27, 'plastic', 0.01, NC);
  p(-0.275, 0.915, -0.27, 0.275, 1.225, -0.268, 'screen', { collide: false, boxUV: true });
  p(-0.025, 0.77, -0.32, 0.025, 0.95, -0.3, 'plastic', NC);
  p.round(-0.12, 0.76, -0.38, 0.12, 0.775, -0.22, 'plastic', 0.006, NC);
  // Keyboard and mouse.
  p.round(-0.22, 0.76, -0.04, 0.22, 0.782, 0.11, 'plastic', 0.008, NC);
  p.round(0.3, 0.76, 0.0, 0.36, 0.785, 0.1, 'plastic', 0.018, NC);
  deskClutter(p, x, z);
  const seat = p.point(0, 0.75);
  chair(b, seat.x, seat.z, rot, y);
  return { ...seat, rot, deskX: x, deskZ: z, y };
}

// Four desks around a cross of cubicle partitions. Returns seat positions.
export function pod(b, x, z, y = 0) {
  const p = placer(b, x, z, 0, y);
  p(-1.73, 0, -0.03, 1.73, 1.3, 0.03, 'cubicle', { shadow: true });
  p(-0.03, 0, -0.85, 0.03, 1.3, 0.85, 'cubicle', { shadow: true });
  p(-1.73, 0, -0.85, -1.67, 1.3, 0.85, 'cubicle', { shadow: true });
  p(1.67, 0, -0.85, 1.73, 1.3, 0.85, 'cubicle', { shadow: true });
  p(-1.75, 1.3, -0.05, 1.75, 1.34, 0.05, 'metal', NC);
  return [[-0.85, 0.45, 0], [0.85, 0.45, 0], [-0.85, -0.45, 2], [0.85, -0.45, 2]]
    .map(([lx, lz, rot]) => desk(b, x + lx, z + lz, rot, y));
}

export function cabinet(b, x, z, rot = 0, y = 0) {
  const p = placer(b, x, z, rot, y);
  p.round(-0.25, 0, -0.3, 0.25, 1.3, 0.3, 'metal', 0.01, { shadow: true });
  for (const h of [0.35, 0.75, 1.15]) p(-0.08, h, 0.3, 0.08, h + 0.03, 0.33, 'plastic', NC);
}

// Potted office plant: a tapered pot with a bushy clump of leaves.
export function plant(b, x, z, y = 0) {
  b.box(x - 0.2, y, z - 0.2, x + 0.2, y + 0.45, z + 0.2, null);
  b.shape(new THREE.CylinderGeometry(0.21, 0.16, 0.45, 18), 'pot', x, y + 0.225, z);
  b.shape(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 18), 'concrete', x, y + 0.44, z);
  const clumps = [[0, 0.72, 0, 0.3], [0.14, 0.95, 0.06, 0.22], [-0.12, 1.05, -0.05, 0.2], [0.02, 1.25, 0.1, 0.16], [-0.05, 0.88, 0.16, 0.2]];
  for (const [dx, dy, dz, r] of clumps) {
    const leaves = new THREE.IcosahedronGeometry(r, 1);
    leaves.scale(1, 1.15, 1);
    b.shape(leaves, 'plant', x + dx, y + dy, z + dz, dx * 7);
  }
}

export function table(b, x, z, w, d, y = 0) {
  b.roundBox(x - w / 2, y + 0.72, z - d / 2, x + w / 2, y + 0.76, z + d / 2, 'desk', 0.015, NC);
  b.shape(new THREE.CylinderGeometry(0.045, 0.045, 0.7, 12), 'steel', x, y + 0.37, z);
  b.shape(new THREE.CylinderGeometry(0.28, 0.3, 0.03, 20), 'metal', x, y + 0.015, z);
  b.box(x - w / 2, y, z - d / 2, x + w / 2, y + 0.76, z + d / 2, null);
}

export function chairsAround(b, x, z, w, d, y = 0) {
  chair(b, x, z + d / 2 + 0.35, 0, y);
  chair(b, x, z - d / 2 - 0.35, 2, y);
  chair(b, x + w / 2 + 0.35, z, 1, y);
  chair(b, x - w / 2 - 0.35, z, 3, y);
}

export function counter(b, x0, z0, x1, z1, y = 0) {
  b.box(x0, y, z0, x1, y + 0.86, z1, 'wood', { shadow: true });
  b.roundBox(x0 - 0.02, y + 0.86, z0 - 0.02, x1 + 0.02, y + 0.9, z1 + 0.02, 'counter', 0.01, NC);
}

export function sinks(b, x0, z0, x1, z1, y = 0) {
  counter(b, x0, z0, x1, z1, y);
  const alongX = x1 - x0 > z1 - z0;
  const len = alongX ? x1 - x0 : z1 - z0;
  for (let s = 0.4; s < len - 0.2; s += 0.8) {
    const cx = alongX ? x0 + s : (x0 + x1) / 2;
    const cz = alongX ? (z0 + z1) / 2 : z0 + s;
    b.box(cx - 0.18, y + 0.9, cz - 0.15, cx + 0.18, y + 0.92, cz + 0.15, 'steel', NC);
  }
}

export function fridge(b, x0, z0, x1, z1, y = 0) {
  b.box(x0, y, z0, x1, y + 1.85, z1, 'fridge', { shadow: true });
}

export function vending(b, x0, z0, x1, z1, y = 0) {
  b.box(x0, y, z0, x1, y + 1.9, z1, 'vending', { boxUV: true, shadow: true });
}

export function lockers(b, x0, z0, x1, z1, y = 0) {
  b.box(x0, y, z0, x1, y + 0.1, z1, 'rubber', NC);
  b.shadow(x0, z0, x1, z1, y);
  b.box(x0, y + 0.1, z0, x1, y + 1.95, z1, 'locker');
}

export function bench(b, x0, z0, x1, z1, y = 0) {
  b.box(x0, y + 0.42, z0, x1, y + 0.47, z1, 'wood', NC);
  const alongX = x1 - x0 > z1 - z0;
  for (const t of [0.1, 0.9]) {
    const cx = alongX ? x0 + (x1 - x0) * t : (x0 + x1) / 2;
    const cz = alongX ? (z0 + z1) / 2 : z0 + (z1 - z0) * t;
    b.box(cx - 0.03, y, cz - 0.03, cx + 0.03, y + 0.42, cz + 0.03, 'metal', NC);
  }
  b.box(x0, y, z0, x1, y + 0.47, z1, null);
}

// Infirmary bed: metal frame, white mattress, pillow at the -z end.
export function bed(b, x0, z0, x1, z1, y = 0) {
  for (const [cx, cz] of [[x0, z0], [x1 - 0.05, z0], [x0, z1 - 0.05], [x1 - 0.05, z1 - 0.05]]) {
    b.box(cx, y, cz, cx + 0.05, y + 0.45, cz + 0.05, 'metal', NC);
  }
  b.box(x0, y + 0.4, z0, x1, y + 0.47, z1, 'metal', NC);
  b.box(x0 + 0.03, y + 0.47, z0 + 0.03, x1 - 0.03, y + 0.6, z1 - 0.03, 'fridge', NC);
  b.box(x0 + 0.15, y + 0.6, z0 + 0.08, x1 - 0.15, y + 0.7, z0 + 0.45, 'counter', NC);
  b.box(x0, y, z0 - 0.04, x1, y + 1.0, z0, 'metal', NC); // headboard
  b.box(x0, y, z0 - 0.04, x1, y + 0.7, z1, null);
}

// Row of toilet stalls. Local: back wall at z = 0, stalls open toward +z.
export function stallRow(b, x, z, rot, count, y = 0) {
  const p = placer(b, x, z, rot, y);
  const W = 1.2;
  const D = 1.5;
  for (let i = 0; i <= count; i++) p(i * W - 0.02, 0.15, 0, i * W + 0.02, 1.9, D, 'stall');
  for (let i = 0; i < count; i++) {
    p(i * W, 0.15, D - 0.02, i * W + 0.2, 1.9, D + 0.02, 'stall');
    p(i * W + 1.0, 0.15, D - 0.02, (i + 1) * W, 1.9, D + 0.02, 'stall');
    p(i * W + 0.4, 0, 0.05, i * W + 0.8, 0.45, 0.65, 'fridge', { shadow: true });
    p(i * W + 0.35, 0.45, 0.05, i * W + 0.85, 0.8, 0.2, 'fridge', NC);
  }
}

// Metal shelving with random cardboard boxes.
export function shelf(b, x0, z0, x1, z1, h, rng, y = 0) {
  const alongX = x1 - x0 > z1 - z0;
  for (const cx of [x0, x1 - 0.06]) {
    for (const cz of [z0, z1 - 0.06]) b.box(cx, y, cz, cx + 0.06, y + h, cz + 0.06, 'metal', NC);
  }
  for (let level = 0.1; level < h - 0.3; level += 0.6) {
    b.box(x0, y + level - 0.03, z0, x1, y + level, z1, 'metal', NC);
    const len = alongX ? x1 - x0 : z1 - z0;
    let s = 0.05;
    while (s < len - 0.35) {
      const size = 0.28 + rng() * 0.22;
      if (s + size > len - 0.05) break;
      if (rng() < 0.75) {
        const bh = Math.min(0.5, size * (0.8 + rng() * 0.4));
        const depth = alongX ? z1 - z0 : x1 - x0;
        const inset = (depth - Math.min(depth - 0.04, size)) / 2;
        if (alongX) b.box(x0 + s, y + level, z0 + inset, x0 + s + size, y + level + bh, z1 - inset, 'cardboard', NC);
        else b.box(x0 + inset, y + level, z0 + s, x1 - inset, y + level + bh, z0 + s + size, 'cardboard', NC);
      }
      s += size + 0.04;
    }
  }
  b.box(x0, y, z0, x1, y + h, z1, null);
}

// Tall pallet rack for the loading dock.
export function palletRack(b, x0, z0, x1, z1, rng, y = 0) {
  const h = 5.2;
  for (const [cx, cz] of [[x0, z0], [x1 - 0.1, z0], [x0, z1 - 0.1], [x1 - 0.1, z1 - 0.1]]) {
    b.box(cx, y, cz, cx + 0.1, y + h, cz + 0.1, 'suit', NC);
  }
  for (const level of [0.15, 1.9, 3.65]) {
    // Beams run between the uprights (not flush with their ends, which flickers).
    b.box(x0 + 0.1, y + level - 0.12, z0 + 0.01, x1 - 0.1, y + level, z0 + 0.08, 'red', NC);
    b.box(x0 + 0.1, y + level - 0.12, z1 - 0.08, x1 - 0.1, y + level, z1 - 0.01, 'red', NC);
    let s = x0 + 0.15;
    while (s < x1 - 1.1) {
      if (rng() < 0.8) {
        b.box(s, y + level, z0 + 0.1, s + 1.0, y + level + 0.14, z1 - 0.1, 'wood', NC);
        b.box(s + 0.05, y + level + 0.14, z0 + 0.15, s + 0.95, y + level + 0.14 + 0.6 + rng() * 0.8, z1 - 0.15, 'cardboard', NC);
      }
      s += 1.15;
    }
  }
  b.box(x0, y, z0, x1, y + h, z1, null);
}

export function crate(b, x, z, s, h = s, y = 0) {
  b.box(x - s / 2, y, z - s / 2, x + s / 2, y + h, z + s / 2, 'cardboard', { shadow: true });
}

export function pallet(b, x, z, w, d, y = 0) {
  b.box(x - w / 2, y, z - d / 2, x + w / 2, y + 0.14, z + d / 2, 'wood', NC);
}

// Forks point toward local +z.
export function forklift(b, x, z, rot = 0, y = 0) {
  const p = placer(b, x, z, rot, y);
  p(-0.6, 0.2, -1.0, 0.6, 1.2, 0.6, 'suit', NC);
  for (const [px, pz] of [[-0.58, -0.9], [0.52, -0.9], [-0.58, 0.3], [0.52, 0.3]]) p(px, 1.2, pz, px + 0.06, 2.1, pz + 0.06, 'rubber', NC);
  p(-0.62, 2.1, -0.95, 0.62, 2.15, 0.4, 'rubber', NC);
  p(-0.5, 0, 0.6, 0.5, 2.4, 0.7, 'rubber', NC);
  p(-0.4, 0.1, 0.7, -0.3, 0.15, 1.8, 'metal', NC);
  p(0.3, 0.1, 0.7, 0.4, 0.15, 1.8, 'metal', NC);
  for (const [px, pz] of [[-0.68, -0.9], [0.6, -0.9], [-0.68, 0.1], [0.6, 0.1]]) p(px, 0, pz, px + 0.08, 0.4, pz + 0.4, 'rubber', NC);
  p(-0.68, 0, -1.0, 0.68, 2.2, 0.7, null);
}

// Hanging hazmat suit, visor facing local +z.
export function hazmatSuit(b, x, z, rot = 0, y = 0) {
  const p = placer(b, x, z, rot, y);
  p(-0.2, 0.2, -0.12, -0.03, 0.95, 0.12, 'suit', NC);
  p(0.03, 0.2, -0.12, 0.2, 0.95, 0.12, 'suit', NC);
  p(-0.25, 0.95, -0.15, 0.25, 1.55, 0.15, 'suit', NC);
  p(-0.36, 0.95, -0.1, -0.25, 1.5, 0.1, 'suit', NC);
  p(0.25, 0.95, -0.1, 0.36, 1.5, 0.1, 'suit', NC);
  p(-0.17, 1.55, -0.17, 0.17, 1.9, 0.17, 'suit', NC);
  p(-0.12, 1.62, 0.17, 0.12, 1.8, 0.18, 'visor', NC);
  p(-0.02, 1.9, -0.02, 0.02, 2.05, 0.02, 'metal', NC);
}

// Builder stand-in that creates separate meshes inside a group instead of
// merged static geometry, for props that move, hide or get picked up.
export function groupBuilder(group, materials) {
  return {
    box(x0, y0, z0, x1, y1, z1, mat) {
      if (!mat) return null;
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), materials.get(mat));
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      group.add(m);
      return null;
    },
  };
}

// A hazmat suit you can take off the rack.
export function hazmatSuitProp(scene, materials, x, y, z, rot) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  hazmatSuit(groupBuilder(group, materials), 0, 0, rot);
  scene.add(group);
  return { group, meshes: [...group.children] };
}

// Couch with the backrest on local +z.
export function couch(b, x, z, rot, len, y = 0) {
  const p = placer(b, x, z, rot, y);
  p(-len / 2, 0, -0.4, len / 2, 0.3, 0.4, null);
  p.round(-len / 2, 0.08, -0.4, len / 2, 0.3, 0.4, 'cubicle', 0.05, { collide: false, shadow: true });
  // Seat cushions, back cushion and arms.
  const inner = len - 0.3;
  const n = Math.max(1, Math.round(inner / 0.7));
  for (let i = 0; i < n; i++) {
    const c0 = -inner / 2 + (i * inner) / n;
    p.round(c0 + 0.005, 0.3, -0.38, c0 + inner / n - 0.005, 0.45, 0.2, 'cubicle', 0.06, NC);
  }
  p.round(-len / 2 + 0.15, 0.3, 0.2, len / 2 - 0.15, 0.9, 0.4, 'cubicle', 0.08, NC);
  p.round(-len / 2, 0.3, -0.4, -len / 2 + 0.15, 0.65, 0.4, 'cubicle', 0.06, NC);
  p.round(len / 2 - 0.15, 0.3, -0.4, len / 2, 0.65, 0.4, 'cubicle', 0.06, NC);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    p(sx * (len / 2 - 0.08) - 0.02, 0, sz * 0.32 - 0.02, sx * (len / 2 - 0.08) + 0.02, 0.08, sz * 0.32 + 0.02, 'rubber', NC);
  }
}

export function printer(b, x, z, rot = 0, y = 0) {
  const p = placer(b, x, z, rot, y);
  p(-0.35, 0, -0.3, 0.35, 0.9, 0.3, 'plastic', { shadow: true });
  p(-0.33, 0.9, -0.28, 0.33, 1.0, 0.28, 'desk', NC);
}

export function waterCooler(b, x, z, y = 0) {
  b.roundBox(x - 0.18, y, z - 0.18, x + 0.18, y + 1.0, z + 0.18, 'fridge', 0.03, { shadow: true });
  b.shape(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 20), 'glass', x, y + 1.2, z);
}

export function bin(b, x, z, y = 0) {
  b.shape(new THREE.CylinderGeometry(0.15, 0.12, 0.4, 16, 1, true), 'plastic', x, y + 0.2, z);
  b.shape(new THREE.CylinderGeometry(0.12, 0.12, 0.01, 16), 'plastic', x, y + 0.005, z);
}

// Flat text sign. facing: which way the readable side points (n = +z, s = -z, e = +x, w = -x).
const FACING = { n: 0, s: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
export function sign(scene, text, x, y, z, facing, { w = 1.6, h = 0.35, bg = '#1c2a22', fg = '#dfe8d4' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.max(32, Math.round(512 * h / w));
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = fg;
  g.font = `bold ${Math.round(canvas.height * 0.6)}px "Courier New", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 24);
  const map = toTexture(canvas);
  map.magFilter = THREE.LinearFilter; // smooth lettering up close
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.25 })
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = FACING[facing];
  scene.add(mesh);
  return mesh;
}

// The goob canister: a glass cylinder of glowing green goob.
export function goobCanister(scene, materials, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const part = (geo, mat, py) => {
    const m = new THREE.Mesh(geo, materials.get(mat));
    m.position.y = py;
    group.add(m);
    return m;
  };
  part(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), 'steel', 0.03);
  part(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), 'steel', 0.47);
  const goob = part(new THREE.CylinderGeometry(0.11, 0.11, 0.36, 8), 'goob', 0.25);
  part(new THREE.CylinderGeometry(0.14, 0.14, 0.38, 10), 'glass', 0.25);
  const meshes = [...group.children];
  const glow = new THREE.PointLight(0x66ff44, 2.5, 3.5, 1.5);
  glow.position.y = 0.3;
  group.add(glow);
  scene.add(group);
  return { group, goob, meshes, glow };
}
