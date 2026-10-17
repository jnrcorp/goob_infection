import * as THREE from 'three';
import { LAUNCH } from './building.js';
import { chair, crate, desk, forklift, pallet, sign } from './furniture.js';

const NC = { collide: false };
const LOGO = { bg: '#102414', fg: '#6cff4a' };
const HAZARD = { bg: '#e2ba24', fg: '#1e1e1e' };
const DANGER = { bg: '#8e1f1f', fg: '#f4e6e6' };

// The launch site's fixed scenery (see LAUNCH in building.js): the road, the
// guard post, the hangar, the fuel depot, the bunker, and Mars 7 on its pad
// with the gantry tower. What the story moves or uses (pods, valves, the
// abort console) is built in story/launch.js; this returns where those go.
export function furnishLaunchSite(b, scene, rng) {
  const L = LAUNCH;
  const out = {};

  // Road: a dashed center line, and lamps along the way.
  for (let x = L.road.x0 + 1; x < L.road.x1; x += 3) b.plane(x, 8.95, x + 1.5, 9.05, 0.03, 'fridge');
  for (const [x, z, dir] of [[58, 11.7, -1], [72, -1.6, 1], [78, 19.6, -1]]) lampPost(b, x, z, dir);
  sign(scene, 'GOOB CO. LAUNCH SITE', 79.85, 3.4, 13.5, 'w', { w: 3.4, h: 0.6, ...LOGO });
  sign(scene, 'NO UNAUTHORIZED PERSONNEL', 79.85, 2.1, 4.2, 'w', { w: 2.6, h: 0.35, ...DANGER });

  // Guard post: a desk with monitors facing the north wall, a gate control
  // panel on the west wall, a coffee machine.
  const gp = L.guardPost;
  out.guardDesk = desk(b, 72.6, 18.25, 2);
  b.box(74.6, 0, 18.2, 75.8, 1.9, 18.9, 'metal', { shadow: true });
  b.box(74.65, 1.0, 18.18, 75.75, 1.8, 18.2, 'screen', NC);
  b.roundBox(75.2, 0, 14.4, 75.8, 1.1, 15, 'vending', 0.03, { shadow: true });
  out.gatePanel = { x: gp.x0 + 0.12, y: 1.3, z: 16.4 };
  sign(scene, 'GUARD POST', 73, 2.55, 13.88, 's', { w: 1.4, h: 0.28 });

  // Site lamps.
  for (const [x, z, dir] of [[82.5, 0, 1], [82.5, 20, -1], [106, 20, -1], [108.5, 39, -1], [104, -24, 1], [128, -14, 1], [128, 18, -1]]) lampPost(b, x, z, dir);
  // A few crates and drums out in the open, for cover.
  for (const [x, z] of [[88, 12], [96, 8], [102, -4], [91, -6], [108, 22.5], [119, 19]]) {
    pallet(b, x, z, 1.2, 1.0);
    crate(b, x, z, 1, 0.8 + rng() * 0.5, 0.14);
  }
  for (const [x, z] of [[86, 4], [86.8, 4.4], [99, 16], [110.5, 32], [127, 21]]) {
    b.shape(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), 'hazard', x, 0.45, z);
    b.box(x - 0.3, 0, z - 0.3, x + 0.3, 0.9, z + 0.3, null);
  }

  // Cargo hangar: racks of pods (story), crates along the walls, a forklift,
  // roof trusses and a manifest whiteboard by the door.
  const h = L.hangar;
  for (const x of [87, 91, 95, 99]) b.box(x, 6.4, h.z0 + 0.1, x + 0.25, 6.7, h.z1 - 0.1, 'metal', NC);
  for (const [x, z] of [[102.4, 26.2], [102.4, 27.6], [102.4, 36.5], [85.6, 36.5]]) crate(b, x, z, 1.2, 1.2);
  forklift(b, 102.6, 32.6, 0);
  out.whiteboard = { x: h.x0 + 0.12, y: 1.6, z: 27.2 };
  b.box(h.x0 + 0.1, 0.9, 26.2, h.x0 + 0.16, 2.3, 28.2, 'fridge', NC);
  sign(scene, 'CARGO · MARS 7', 94, 3.2, h.z0 - 0.12, 's', { w: 2.6, h: 0.5, ...LOGO });
  sign(scene, 'LIVE CARGO · HANDLE WITH CARE', 94, 5.6, h.z1 - 0.12, 's', { w: 4, h: 0.5, ...HAZARD });
  // Pods stand in two rows across a center aisle (story/launch.js puts them there).
  out.pods = [];
  for (const [z, yaw] of [[34.6, Math.PI], [29, 0]]) {
    for (const x of [88, 92, 96, 100]) {
      out.pods.push({ x, z, yaw });
      b.plane(x - 0.9, z - 0.9, x + 0.9, z + 0.9, 0.02, 'hazard');
    }
  }

  // Fuel depot: three big tanks, pipes along the north wall to three valves,
  // a desk by the door.
  const d = L.depot;
  for (const x of [115.5, 119, 122.5]) {
    b.shape(new THREE.CylinderGeometry(1.3, 1.3, 3.8, 28), 'steel', x, 1.9 + 0.1, 30.5);
    b.shape(new THREE.SphereGeometry(1.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 'steel', x, 3.9, 30.5);
    b.box(x - 1.3, 0, 29.2, x + 1.3, 5, 31.8, null);
    b.box(x - 1.32, 1.6, 29.18, x + 1.32, 1.9, 31.82, 'hazard', NC);
    b.box(x - 0.08, 0.2, 31.8, x + 0.08, 0.36, d.z1 - 0.1, 'metal', NC); // pipe to the wall
  }
  b.box(d.x0 + 0.5, 2.6, d.z1 - 0.35, d.x1 - 0.5, 2.78, d.z1 - 0.17, 'metal', NC);
  out.valves = [{ x: 115.5, color: 'red' }, { x: 119, color: 'blue' }, { x: 122.5, color: 'yellow' }].map((v) => ({ ...v, y: 1.35, z: d.z1 - 0.3 }));
  for (const v of out.valves) b.box(v.x - 0.09, 0.3, v.z - 0.09, v.x + 0.09, 2.7, v.z + 0.09, 'metal', NC);
  out.depotDesk = desk(b, 113.5, 26, 3);
  sign(scene, 'FUEL · NO SMOKING · NO GOOB', d.x0 - 0.12, 3.6, 31, 'w', { w: 2.8, h: 0.4, ...DANGER });

  // Control bunker: rows of consoles facing south (a long window of screens),
  // the abort console in front.
  const k = L.bunker;
  for (const x of [87, 90.2, 93.8, 97]) {
    b.box(x - 1.2, 0, -19.6, x + 1.2, 0.85, -18.8, 'metal', { shadow: true });
    b.box(x - 1.1, 0.85, -19.55, x + 1.1, 1.25, -19.45, 'screen', NC);
    chair(b, x, -18.1, 0);
  }
  b.box(k.x0 + 0.5, 1.2, k.z0 + 0.1, k.x1 - 0.5, 2.9, k.z0 + 0.14, 'screen', NC);
  out.abortConsole = { x: 92, y: 1.05, z: -15.6 };
  out.countdownScreen = { x: 92, y: 2.3, z: k.z0 + 0.16 };
  sign(scene, 'LAUNCH CONTROL', 92, 3.05, k.z1 + 0.12, 'n', { w: 2.2, h: 0.32 });
  out.bunkerKeypad = { x: 93, y: 1.25, z: k.z1 + 0.13 };

  // The launch pad: a flame trench, hazard rings, and Mars 7.
  const r = L.rocket;
  b.box(r.x - 3.6, -0.02, r.z - 6, r.x + 3.6, 0.01, r.z - 3.3, 'asphalt', NC);
  const ring = new THREE.RingGeometry(r.r + 0.8, r.r + 1.3, 48);
  ring.rotateX(-Math.PI / 2);
  b.shape(ring, 'hazard', r.x, 0.03, r.z);
  b.shape(new THREE.CylinderGeometry(r.r + 0.4, r.r + 0.7, 0.6, 40), 'concrete', r.x, 0.3, r.z);
  b.shape(new THREE.CylinderGeometry(r.r, r.r, r.h, 40), 'fridge', r.x, 0.6 + r.h / 2, r.z);
  b.shape(new THREE.ConeGeometry(r.r, 7, 40), 'fridge', r.x, 0.6 + r.h + 3.5, r.z);
  for (const y of [7, 18.5]) b.shape(new THREE.CylinderGeometry(r.r + 0.02, r.r + 0.02, 1, 40), 'goob', r.x, y, r.z);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.BoxGeometry(0.16, 4, 1.8);
    fin.translate(0, 0, r.r + 0.8);
    b.shape(fin, 'red', r.x, 2.6, r.z, (i * Math.PI) / 2 + Math.PI / 4);
  }
  for (const s of [-1, 1]) {
    b.shape(new THREE.CylinderGeometry(0.85, 0.85, 16, 24), 'fridge', r.x, 8.6, r.z + s * (r.r + 0.85));
    b.shape(new THREE.ConeGeometry(0.85, 2.4, 24), 'fridge', r.x, 17.8, r.z + s * (r.r + 0.85));
  }
  b.box(r.x - r.r - 0.7, 0, r.z - r.r - 0.7, r.x + r.r + 0.7, 0.6, r.z + r.r + 0.7, null);
  b.box(r.x - r.r, 0, r.z - r.r - 1.7, r.x + r.r, r.h, r.z + r.r + 1.7, null);
  // The hatch, level with the gantry platform, and the crew access arm.
  b.box(r.x - r.r - 0.04, 12.1, r.z - 0.6, r.x - r.r + 0.2, 14.2, r.z + 0.6, 'steel', NC);
  b.box(L.top.x1, 11.8, r.z - 0.7, r.x - r.r, 12, r.z + 0.7, 'metal', NC);
  sign(scene, 'MARS 7', r.x - r.r - 0.06, 22, r.z, 'w', { w: 2.2, h: 1.2, ...LOGO });

  // The gantry: a steel lattice around the lift shaft holding up the
  // platform, with hazard bands, and the platform's deck.
  const t = L.top;
  for (const x of [t.x0, (t.x0 + t.x1) / 2, t.x1]) {
    for (const z of [t.z0, t.z1]) b.box(x - 0.15, 0, z - 0.15, x + 0.15, 11.7, z + 0.15, 'metal');
  }
  for (let y = 2.5; y < 11.5; y += 3) {
    b.box(t.x0 - 0.1, y, t.z0 - 0.1, t.x1 + 0.1, y + 0.2, t.z0 + 0.1, 'hazard', NC);
    b.box(t.x0 - 0.1, y, t.z1 - 0.1, t.x1 + 0.1, y + 0.2, t.z1 + 0.1, 'hazard', NC);
  }
  b.plane(t.x0, t.z0, t.x1, t.z1, 11.68, 'metal', true);
  sign(scene, 'GANTRY LIFT', 111.5, 2.6, L.shaft.z0 - 0.12, 's', { w: 1.4, h: 0.28, ...HAZARD });
  sign(scene, 'CREW ACCESS', 111.5, 14.6, L.shaft.z0 - 0.12, 's', { w: 1.4, h: 0.28, ...HAZARD });
  return out;
}

// Tall sodium lamp (as in the parking lot). dir: which way (along z) the arm reaches.
function lampPost(b, x, z, dir = -1) {
  b.box(x - 0.1, 0, z - 0.1, x + 0.1, 6, z + 0.1, 'metal');
  b.box(x - 0.1, 5.9, Math.min(z, z + dir * 0.8) - 0.1, x + 0.1, 6, Math.max(z, z + dir * 0.8) + 0.1, 'metal', NC);
  b.box(x - 0.25, 5.8, Math.min(z + dir * 0.6, z + dir * 1.1), x + 0.25, 5.9, Math.max(z + dir * 0.6, z + dir * 1.1), 'light', NC);
}
