import * as THREE from 'three';
import { createRng } from '../core/random.js';
import { BUILDING } from './building.js';
import { toTexture } from '../render/textures.js';
import {
  bed, bench, bin, cabinet, chair, chairsAround, counter, couch, crate, desk, forklift, fridge, goobCanister,
  hazmatSuit, hazmatSuitProp, lockers, pallet, palletRack, plant, pod, printer, shelf, sign, sinks, stallRow, table,
  vending, waterCooler,
} from './furniture.js';

const NC = { collide: false };
const LOGO = { bg: '#102414', fg: '#6cff4a' };
const HAZARD = { bg: '#e2ba24', fg: '#1e1e1e' };
const DANGER = { bg: '#8e1f1f', fg: '#f4e6e6' };
const MEDICAL = { bg: '#f2f2ee', fg: '#b0282a' };

// Places furniture, props and signs. Returns objects the game needs later.
export function furnish({ builder: b, scene, materials }) {
  const rng = createRng(42);
  const out = {};

  // ---------- 1F ----------
  // Locker room
  lockers(b, 0.1, 1, 0.6, 9);
  lockers(b, 1, 0.1, 7, 0.6);
  bench(b, 2.5, 4.8, 5.5, 5.2);
  b.box(7.55, 2.05, 2.2, 7.65, 2.1, 6.2, 'metal', NC);
  for (const z of [2.2, 6.1]) b.box(7.55, 0, z, 7.65, 2.1, z + 0.1, 'metal', NC);
  hazmatSuit(b, 7.6, 2.9, 3);
  hazmatSuit(b, 7.6, 5.5, 3);
  out.suit = hazmatSuitProp(scene, materials, 7.6, 0, 4.2, 3);
  b.box(7.2, 0, 2.2, 7.9, 2.1, 6.2, null);
  sign(scene, 'LOCKERS', 4, 2.55, 10.12, 'n', { w: 1.2, h: 0.28 });

  // Restroom
  stallRow(b, 8.14, 0.1, 0, 3);
  sinks(b, 13.35, 3, 13.9, 6.2);
  sign(scene, 'RESTROOM', 11, 2.55, 10.12, 'n', { w: 1.2, h: 0.28 });

  // Lobby
  counter(b, 17.6, 6, 20.4, 6.6);
  b.box(18.8, 0.9, 6.35, 19.3, 1.2, 6.42, 'plastic', NC);
  chair(b, 19, 7.2, 0);
  couch(b, 14.55, 3.2, 3, 2.4);
  plant(b, 14.5, 0.5);
  plant(b, 23.5, 0.5);
  plant(b, 14.6, 9.3);
  sign(scene, 'GOOB CO.', 15.8, 2.0, 9.88, 's', { w: 2.6, h: 0.7, ...LOGO });

  // Mail room (lobby corner)
  shelf(b, 23.3, 6.4, 23.9, 9.6, 2, rng);
  counter(b, 21.3, 6.2, 23.0, 6.8);
  b.box(21.4, 0, 8.6, 22.2, 0.9, 9.6, 'cardboard'); // mail cart
  sign(scene, 'MAIL', 20.88, 2.55, 8, 'w', { w: 0.8, h: 0.28 });

  // Corridor
  b.box(8.5, 1.0, 10.1, 8.7, 1.5, 10.25, 'red', NC);
  b.box(9, 1.3, 12.87, 11, 2.1, 12.9, 'cardboard', NC);
  waterCooler(b, 0.4, 10.35);
  bin(b, 23.5, 10.4);
  sign(scene, 'BREAK ROOM', 6, 2.55, 12.88, 's', { w: 1.3, h: 0.28 });
  sign(scene, 'STAIRS', 13.5, 2.55, 12.88, 's', { w: 1.0, h: 0.28 });
  sign(scene, 'ELEVATOR', 16.5, 2.55, 12.88, 's', { w: 1.2, h: 0.28 });
  sign(scene, 'INFIRMARY', 21, 2.55, 12.88, 's', { w: 1.3, h: 0.28, ...MEDICAL });
  sign(scene, 'STORAGE', 0.12, 2.55, 11.3, 'e', { w: 1.1, h: 0.28 });
  sign(scene, 'LOADING DOCK', 23.88, 2.6, 11.5, 'w', { w: 1.8, h: 0.35, ...HAZARD });

  // Break room
  for (const [x, z] of [[3.5, 17], [3.5, 21], [8, 19]]) {
    table(b, x, z, 1.2, 1.2);
    chairsAround(b, x, z, 1.2, 1.2);
  }
  vending(b, 0.4, 23.1, 1.3, 23.9);
  vending(b, 1.5, 23.1, 2.4, 23.9);
  counter(b, 5, 23.3, 10.4, 23.9);
  b.box(6, 0.9, 23.4, 6.5, 1.2, 23.8, 'plastic', NC);
  b.box(7.2, 0.9, 23.5, 7.5, 1.3, 23.8, 'plastic', NC);
  fridge(b, 10.6, 23.1, 11.8, 23.9);
  couch(b, 11.45, 17, 1, 2.2);

  // Stairwell
  sign(scene, '1F', 14.88, 2.2, 14, 'w', { w: 0.6, h: 0.4 });

  // Janitor closet
  shelf(b, 15.15, 17, 15.65, 23, 2, rng);
  b.box(17.2, 0, 17, 17.6, 0.35, 17.4, 'suit', NC);
  b.box(15.2, 0, 23.3, 16.2, 0.6, 23.9, 'fridge');

  // Infirmary (the old storage room)
  bed(b, 22.9, 14.3, 23.85, 16.3);
  bed(b, 22.9, 17.3, 23.85, 19.3);
  b.box(18.12, 0, 21.6, 18.6, 1.9, 23.2, 'fridge'); // medicine cabinet
  sign(scene, '+', 18.62, 1.5, 22.4, 'e', { w: 0.4, h: 0.4, ...MEDICAL });
  counter(b, 19.3, 23.3, 22.5, 23.9);
  sign(scene, 'INFIRMARY', 21, 2.3, 23.88, 's', { w: 1.6, h: 0.35, ...MEDICAL });

  // Storage (the annex off the west end of the corridor)
  shelf(b, -6.8, 8.3, -6.2, 15.7, 2.2, rng);
  shelf(b, -5.2, 8.3, -0.8, 8.9, 2.2, rng);
  shelf(b, -5.2, 15.1, -0.8, 15.7, 2.2, rng);
  shelf(b, -4.4, 10.8, -3.8, 13.8, 2.2, rng);

  // Loading dock
  palletRack(b, 25, 0.2, 31, 1.4, rng);
  palletRack(b, 25, 22.6, 30.8, 23.8, rng);
  crate(b, 28, 7, 1, 1);
  crate(b, 28.1, 7.05, 0.8, 0.7, 1.0);
  crate(b, 27.5, 14.5, 1.2, 1.0);
  pallet(b, 29.5, 18, 1.2, 1.0);
  crate(b, 29.5, 18, 0.9, 0.8, 0.14);
  forklift(b, 32, 10, 1);
  b.plane(34.5, 4, 35.9, 8, 0.04, 'hazard');
  b.plane(34.5, 10, 35.9, 14, 0.04, 'hazard');
  crate(b, 33.5, 15.2, 1.2, 1.1);
  sign(scene, 'TO: MARS', 32.88, 0.7, 15.2, 'w', { w: 0.9, h: 0.3, ...HAZARD });
  sign(scene, 'GOOB CO. INTERPLANETARY SHIPPING', 28, 6.2, 23.88, 's', { w: 6, h: 0.7, ...LOGO });
  sign(scene, 'SECURE FREEZER', 30.88, 2.75, 20.5, 'w', { w: 2, h: 0.4, ...DANGER });
  b.box(31, 3.2, 17, 36, 3.4, 24, 'freezer'); // freezer roof

  // Freezer
  shelf(b, 35.3, 17.6, 35.9, 23.2, 2.4, rng);
  shelf(b, 31.6, 23.3, 35.2, 23.9, 2.4, rng);
  b.box(33.2, 0, 20.2, 33.8, 1.0, 20.8, 'steel');
  out.canister = goobCanister(scene, materials, 33.5, 1.0, 20.5);

  // ---------- 2F ----------
  const y = 4;
  out.desks = [[9, 3.5], [14, 3.5], [9, 9], [14, 9], [3, 9.5], [3, 17], [8, 17]]
    .flatMap(([x, z]) => pod(b, x, z, y));

  // Manager's office
  out.managerDesk = desk(b, 2.8, 3, 3, y);
  chair(b, 3.95, 2.6, 1, y);
  chair(b, 3.95, 3.4, 1, y);
  cabinet(b, 0.45, 5.3, 1, y);
  plant(b, 5.4, 0.6, y);
  sign(scene, 'MANAGER', 6.12, y + 2.5, 4.5, 'e', { w: 1.2, h: 0.28 });

  // Meeting room
  table(b, 21, 3.5, 3, 1.4, y);
  for (const x of [20, 21, 22]) {
    chair(b, x, 2.45, 2, y);
    chair(b, x, 4.55, 0, y);
  }
  b.box(18.1, y + 1.0, 1, 18.14, y + 2.2, 4, 'fridge', NC);
  sign(scene, 'MEETING', 17.88, y + 2.5, 5.5, 'w', { w: 1.2, h: 0.28 });

  // Conference room (northwest corner, across from the stairwell door)
  table(b, 4.8, 21.5, 5.6, 1.5, y);
  for (const x of [2.6, 4.0, 5.4, 6.8]) {
    chair(b, x, 20.4, 2, y);
    chair(b, x, 22.6, 0, y);
  }
  chair(b, 1.65, 21.5, 3, y);
  b.box(4.35, y + 1.0, 23.84, 6.15, y + 2.2, 23.88, 'fridge', NC); // whiteboard, between the windows
  b.box(8.6, y, 23.3, 9.8, y + 0.9, 23.9, 'wood');                // credenza
  b.box(8.8, y + 0.9, 23.5, 9.2, y + 1.3, 23.8, 'plastic', NC);    // speakerphone
  plant(b, 9.4, 19.5, y);
  sign(scene, 'CONFERENCE', 10.12, y + 2.5, 22.5, 'e', { w: 1.4, h: 0.28 });

  // Kitchenette
  counter(b, 18.2, 23.3, 22.7, 23.9, y);
  fridge(b, 22.9, 23.1, 23.8, 23.9, y);
  b.box(19, y + 0.9, 23.4, 19.4, y + 1.3, 23.8, 'plastic', NC);
  table(b, 20.5, 19.5, 1.2, 1.2, y);
  chairsAround(b, 20.5, 19.5, 1.2, 1.2, y);
  waterCooler(b, 23.5, 17, y);

  // Restroom
  stallRow(b, 17.86, 23.9, 2, 2, y);
  sinks(b, 15.1, 17, 15.6, 19, y);

  // Open office extras
  printer(b, 11.5, 12.3, 0, y);
  waterCooler(b, 0.4, 12.5, y);
  cabinet(b, 0.4, 13.6, 1, y);
  cabinet(b, 0.4, 14.2, 1, y);
  plant(b, 11.5, 0.5, y);
  plant(b, 17.5, 0.5, y);
  plant(b, 11.5, 23.5, y);
  sign(scene, 'STAIRS', 11.88, y + 2.5, 22.5, 'w', { w: 1.0, h: 0.28 });
  sign(scene, '2F', 14.88, y + 2.2, 22.5, 'w', { w: 0.6, h: 0.4 });

  // Copy room
  b.box(21.8, y, 7.2, 23.6, y + 1.05, 8.2, 'plastic', { shadow: true }); // copier
  b.box(21.75, y + 1.05, 7.15, 23.65, y + 1.1, 8.25, 'desk', NC);
  shelf(b, 18.3, 10.3, 20.5, 10.9, 1.6, rng, y);
  counter(b, 23.3, 8.6, 23.9, 10.6, y);
  sign(scene, 'COPY ROOM', 17.88, y + 2.5, 9, 'w', { w: 1.2, h: 0.28 });

  // IT closet
  for (const z of [11.4, 13.2]) serverRack(b, 23.1, z, 23.9, z + 1.5, y);
  shelf(b, 20.3, 15.2, 22.5, 15.8, 2, rng, y);
  sign(scene, 'IT', 19.88, y + 2.5, 13.5, 'w', { w: 0.5, h: 0.28 });

  furnishBasement(b, scene, rng, out);
  furnishExecutive(b, scene, out);
  furnishOutdoors(b, scene, rng);
  furnishHome(b, scene);

  // Air vent grilles, low on the walls.
  for (const v of BUILDING.vents) vent(b, v);

  return out;
}

// A rack of blinking servers (screens as status lights).
function serverRack(b, x0, z0, x1, z1, y) {
  b.box(x0, y, z0, x1, y + 2.1, z1, 'plastic', { shadow: true });
  const alongZ = z1 - z0 > x1 - x0;
  for (let h = 0.3; h < 2; h += 0.35) {
    if (alongZ) b.box(x0 - 0.01, y + h, z0 + 0.1, x0, y + h + 0.08, z1 - 0.1, 'screen', { collide: false, boxUV: true });
    else b.box(x0 + 0.1, y + h, z0 - 0.01, x1 - 0.1, y + h + 0.08, z0, 'screen', { collide: false, boxUV: true });
  }
}

// B1: server room, goob lab, vat room, halls.
function furnishBasement(b, scene, rng, out) {
  const y = -4;
  // Server room: rows of racks, Terry's desk at the far end.
  for (const x of [5, 7.5, 10]) {
    serverRack(b, x - 0.3, 14, x + 0.3, 16.1, y);
    serverRack(b, x - 0.3, 16.4, x + 0.3, 18.5, y);
  }
  out.serverDesk = desk(b, 7.5, 20.1, 2, y);
  sign(scene, 'SERVER ROOM', 2.88, y + 2.5, 17, 'w', { w: 1.4, h: 0.28 });

  // Goob lab: two bench islands, a wall bench, specimen jars, Dr. Ivo's desk.
  counter(b, 20, 16.5, 22, 18.5, y);
  counter(b, 20, 20.5, 22, 22.5, y);
  counter(b, 23.3, 14, 23.9, 23, y);
  for (const [x, z] of [[20.4, 17], [21.5, 18], [20.6, 21.9], [23.6, 15], [23.6, 17.2], [23.6, 20.4], [23.6, 22.3]]) {
    b.box(x - 0.1, y + 0.9, z - 0.1, x + 0.1, y + 1.2, z + 0.1, 'glass', NC);
    b.box(x - 0.07, y + 0.9, z - 0.07, x + 0.07, y + 0.9 + 0.05 + rng() * 0.2, z + 0.07, 'goob', NC);
  }
  out.labDesk = desk(b, 19.2, 14.2, 0, y);
  sign(scene, 'GOOB LAB', 21, y + 2.55, 12.88, 's', { w: 1.2, h: 0.28, ...LOGO });
  sign(scene, 'AUTHORIZED PERSONNEL ONLY', 21, y + 2.25, 12.88, 's', { w: 2, h: 0.2, ...DANGER });

  // Vat room: steel vats of goob.
  for (const z of [16.4, 18.4, 21.2]) {
    b.box(15.25, y, z, 16.95, y + 1.6, z + 1.6, 'steel', { shadow: true });
    b.box(15.35, y + 1.6, z + 0.1, 16.85, y + 1.63, z + 1.5, 'goob', NC);
  }
  sign(scene, 'VAT ROOM', 18.12, y + 2.5, 20, 'e', { w: 1.1, h: 0.28 });

  // Halls: pipes along the ceiling, a few old crates.
  b.box(0.2, y + 2.7, 10.3, 23.8, y + 2.85, 10.45, 'metal', NC);
  b.box(0.2, y + 2.55, 10.6, 23.8, y + 2.7, 10.75, 'red', NC);
  crate(b, 1.2, 22.8, 0.9, 0.9, y);
  crate(b, 2.3, 23.1, 0.7, 0.6, y);
  sign(scene, 'B1', 14.88, y + 2.2, 22.5, 'w', { w: 0.6, h: 0.4 });
}

// 3F: CEO's office, boardroom, lounge, records room, reception.
function furnishExecutive(b, scene, out) {
  const y = 8;
  // CEO's office
  out.ceoDesk = desk(b, 4, 4, 3, y);
  couch(b, 8.5, 7.2, 0, 2.4, y);
  plant(b, 9.4, 0.6, y);
  plant(b, 0.6, 7.4, y);
  cabinet(b, 0.45, 1.2, 1, y);
  cabinet(b, 0.45, 1.8, 1, y);
  sign(scene, 'CEO', 10.12, y + 2.5, 4.5, 'e', { w: 0.6, h: 0.28, ...LOGO });

  // Reception alcove outside the CEO's office
  out.assistantDesk = desk(b, 12, 3, 0, y);
  plant(b, 13.4, 0.6, y);

  // Boardroom: long table, chairs down both sides.
  table(b, 19, 4, 6, 1.6, y);
  for (let x = 16.5; x <= 21.6; x += 1.25) {
    chair(b, x, 2.65, 2, y);
    chair(b, x, 5.35, 0, y);
  }
  chair(b, 22.55, 4, 1, y);
  sign(scene, 'BOARDROOM', 13.88, y + 2.5, 5, 'w', { w: 1.3, h: 0.28 });

  // Executive lounge: bar, couches, a coffee table.
  counter(b, 23, 15, 23.8, 20, y);
  couch(b, 19.5, 23.2, 0, 2.6, y);
  couch(b, 15.8, 20.5, 3, 2.2, y);
  table(b, 19.5, 21, 1.1, 1.1, y);
  plant(b, 23.4, 23.4, y);
  sign(scene, 'LOUNGE', 21, y + 2.55, 12.88, 's', { w: 1, h: 0.28 });

  // Records room: rows of shelves.
  shelf(b, 1, 18.5, 11, 19.1, 2.2, createRng(9), y);
  shelf(b, 1, 21, 11, 21.6, 2.2, createRng(10), y);
  sign(scene, 'RECORDS', 6, y + 2.55, 15.88, 's', { w: 1.1, h: 0.28 });

  // Executive floor hall
  plant(b, 0.6, 8.6, y);
  couch(b, 0.55, 14.6, 3, 2.2, y);
  sign(scene, '3F', 14.88, y + 2.2, 14, 'w', { w: 0.6, h: 0.4 });
}

// Parking lot and loading yard.
function furnishOutdoors(b, scene, rng) {
  // Parking lot: painted stalls in two rows (north z -8..-3, south z
  // -21..-16) with an 8 m aisle between them that runs from the entrance on
  // the west to the far end, some cars, lamp posts behind the south row, a
  // bench.
  for (let x = -6; x <= 34; x += 2.8) {
    b.plane(x - 0.05, -8, x + 0.05, -3, 0.03, 'fridge');
    b.plane(x - 0.05, -21, x + 0.05, -16, 0.03, 'fridge');
  }
  const cars = [[-4.6, -5.5, 'paintRed'], [1, -5.5, 'paintSilver'], [6.6, -5.5, 'paintYellow'], [23.4, -5.5, 'paintBlack'],
    [-1.8, -18.5, 'paintSilver'], [9.4, -18.5, 'paintBlue'], [15, -18.5, 'paintBlack'], [29, -18.5, 'paintYellow']];
  for (const [x, z, color] of cars) car(b, x, z, color);
  for (const x of [2, 16, 30]) lampPost(b, x, -23.5, 1);
  bench(b, 4.5, -0.8, 6.5, -0.4);
  sign(scene, 'GOOB CO.', 19, 3.1, -0.12, 's', { w: 3.2, h: 0.8, ...LOGO });
  sign(scene, 'VISITOR PARKING', 14, 1.9, -25.88, 'n', { w: 2.2, h: 0.35 });

  // Loading yard: the delivery truck, dumpsters, pallets, lamps.
  truck(b, scene);
  for (const z of [22, 24.2]) b.box(47.6, 0, z, 49.6, 1.4, z + 1.8, 'plant', { shadow: true });
  for (const [x, z] of [[40, -10], [42, -10], [44, 20]]) {
    pallet(b, x, z, 1.2, 1.0);
    crate(b, x, z, 0.9, 0.7 + rng() * 0.4, 0.14);
  }
  for (const z of [-8, 10, 24]) lampPost(b, 42.5, z);
  b.plane(36.2, 14.7, 38, 16.3, 0.04, 'hazard');
  sign(scene, 'DELIVERIES', 36.12, 2.6, 15.5, 'e', { w: 1.4, h: 0.3, ...HAZARD });
}

// Parked car, pointing along z: body, cabin, wheels.
// A parked sedan (nose toward -z): rounded body, glass cabin, wheels, lights.
function car(b, x, z, paint) {
  b.box(x - 0.9, 0, z - 2.15, x + 0.9, 1.5, z + 2.15, null);
  b.roundBox(x - 0.9, 0.28, z - 2.15, x + 0.9, 0.95, z + 2.15, paint, 0.2, NC);
  b.roundBox(x - 0.78, 0.9, z - 1.0, x + 0.78, 1.46, z + 1.05, 'tint', 0.14, NC);
  b.roundBox(x - 0.8, 1.42, z - 0.9, x + 0.8, 1.52, z + 0.95, paint, 0.05, NC);
  for (const [sx, dz] of [[-1, -1.35], [1, -1.35], [-1, 1.35], [1, 1.35]]) {
    const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 20);
    wheel.rotateZ(Math.PI / 2);
    b.shape(wheel, 'rubber', x + sx * 0.82, 0.33, z + dz);
    const hub = new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16);
    hub.rotateZ(Math.PI / 2);
    b.shape(hub, 'steel', x + sx * 0.94, 0.33, z + dz);
  }
  for (const sx of [-1, 1]) {
    b.roundBox(x + sx * 0.62 - 0.14, 0.66, z - 2.17, x + sx * 0.62 + 0.14, 0.76, z - 2.1, 'light', 0.02, NC);
    b.roundBox(x + sx * 0.66 - 0.12, 0.7, z + 2.1, x + sx * 0.66 + 0.12, 0.8, z + 2.17, 'red', 0.02, NC);
  }
}

// Tall sodium lamp. dir: which way (along z) the arm reaches, -1 or 1.
function lampPost(b, x, z, dir = -1) {
  b.box(x - 0.1, 0, z - 0.1, x + 0.1, 6, z + 0.1, 'metal');
  b.box(x - 0.1, 5.9, Math.min(z, z + dir * 0.8) - 0.1, x + 0.1, 6, Math.max(z, z + dir * 0.8) + 0.1, 'metal', NC);
  b.box(x - 0.25, 5.8, Math.min(z + dir * 0.6, z + dir * 1.1), x + 0.25, 5.9, Math.max(z + dir * 0.6, z + dir * 1.1), 'light', NC);
}

// The Mars delivery truck, backed up to the yard.
function truck(b, scene) {
  b.box(38.5, 0.9, 2, 46.5, 4.1, 4.6, 'fridge', { shadow: true }); // trailer
  b.box(46.6, 0.6, 2.1, 49, 3.2, 4.5, 'red', { shadow: true });    // cab
  b.box(48.95, 2, 2.3, 49.02, 2.9, 4.3, 'glass', NC);
  for (const x of [39.5, 44.5, 47.8]) {
    b.box(x - 0.45, 0, 1.85, x + 0.45, 0.9, 2.05, 'rubber', NC);
    b.box(x - 0.45, 0, 4.55, x + 0.45, 0.9, 4.75, 'rubber', NC);
  }
  b.box(38.5, 0, 2, 49, 0.9, 4.6, null);
  sign(scene, 'GOOB CO. · MARS EXPRESS', 42.5, 2.6, 4.62, 'n', { w: 5, h: 0.6, ...LOGO });
}

// A 50x30 cm grille standing 3 cm off the wall.
function vent(b, { x, y, z, facing }) {
  const hw = 0.25;
  const hh = 0.15;
  const t = 0.03;
  const opts = { collide: false, boxUV: true };
  if (facing === 'n') b.box(x - hw, y - hh, z, x + hw, y + hh, z + t, 'shutter', opts);
  else if (facing === 's') b.box(x - hw, y - hh, z - t, x + hw, y + hh, z, 'shutter', opts);
  else if (facing === 'e') b.box(x, y - hh, z - hw, x + t, y + hh, z + hw, 'shutter', opts);
  else b.box(x - t, y - hh, z - hw, x, y + hh, z + hw, 'shutter', opts);
}

// Your house (see BUILDING's home rooms). The things you use in the morning
// (alarm clock, sink, shower, coffee maker, toaster, wardrobe, key hook) are
// added by the morning routine (story/morning.js); this is the rest.
function furnishHome(b, scene) {
  // Bedroom: a double bed with its head against the south wall, a
  // nightstand, a rug and a wardrobe.
  b.box(-59.6, 0, -25.95, -58.0, 0.6, -23.9, null);
  b.roundBox(-59.6, 0.12, -25.95, -58.0, 0.38, -23.9, 'wood', 0.03, { collide: false, shadow: true });
  b.roundBox(-59.55, 0.38, -25.9, -58.05, 0.58, -23.95, 'fridge', 0.06, NC);                 // mattress
  b.roundBox(-59.5, 0.56, -24.9, -58.1, 0.62, -23.97, 'cubicle', 0.03, NC);                   // duvet
  for (const x of [-59.2, -58.4]) b.roundBox(x - 0.3, 0.58, -25.85, x + 0.3, 0.7, -25.45, 'fridge', 0.05, NC); // pillows
  b.roundBox(-59.6, 0, -26, -58.0, 1.05, -25.92, 'wood', 0.02, NC);                           // headboard
  b.roundBox(-57.9, 0, -25.95, -57.4, 0.55, -25.45, 'wood', 0.02, { shadow: true });          // nightstand
  b.plane(-58.8, -23.7, -56.4, -21.8, 0.005, 'carpetRed');                                    // rug
  b.roundBox(-59.9, 0, -20.7, -58.2, 2.05, -20.12, 'wood', 0.02, { shadow: true });            // wardrobe
  // Bathroom: vanity with a basin (the faucet is the "brush your teeth"
  // prop in story/morning.js), mirror, toilet, shower stall.
  b.roundBox(-53.1, 0, -25.95, -52.1, 0.85, -25.45, 'wood', 0.02, { shadow: true });
  b.roundBox(-53.12, 0.85, -25.97, -52.08, 0.9, -25.43, 'counter', 0.01, NC);
  // Oval basin sitting on the counter: a bowl with a rim and a drain.
  const bowl = new THREE.LatheGeometry(
    [[0, 0.012], [0.14, 0.012], [0.16, 0.04], [0.17, 0.12], [0.19, 0.12], [0.18, 0.03], [0.15, 0], [0, 0]]
      .map(([r, y]) => new THREE.Vector2(r, y)), 32);
  bowl.scale(1, 1, 0.72);
  // (Lifted 5 mm off the counter: the basin's base sitting exactly on the
  // counter top flickered against it.)
  b.shape(bowl, 'fridge', -52.6, 0.905, -25.69);
  b.shape(new THREE.CylinderGeometry(0.025, 0.025, 0.004, 16), 'steel', -52.6, 0.922, -25.69);
  b.box(-53.0, 1.2, -25.97, -52.2, 1.9, -25.92, 'glass', NC);
  b.roundBox(-51.4, 0, -25.95, -50.95, 0.42, -25.3, 'fridge', 0.08, { shadow: true });         // toilet
  b.roundBox(-51.4, 0.42, -25.97, -50.95, 0.8, -25.78, 'fridge', 0.04, NC);
  // Shower: a tray in the corner, a fixed glass screen on the north side,
  // and a glass door on the west side (built with the doors, in
  // buildBuilding), which closes it in completely.
  b.box(-49.5, 0, -25.9, -48.1, 0.08, -24.5, 'tile');                                         // shower tray
  b.box(-49.5, 0, -24.53, -48.1, 2.1, -24.47, 'glass');                                       // fixed screen
  // Kitchen: counter along the south wall (coffee maker and toaster on the
  // west end; see story/morning.js), a cooktop over an oven, a sink between
  // the cooktop and the fridge, and a table.
  const SINK = { x0: -50.45, x1: -49.85, z0: -21.85, z1: -21.45, bottom: 0.7 };
  // Cabinets and counter top, built around the sink's hole.
  b.box(-53.8, 0, -21.95, -49.6, 0.86, -21.35, null);
  b.roundBox(-53.8, 0, -21.95, SINK.x0, 0.86, -21.35, 'wood', 0.02, { collide: false, shadow: true });
  b.roundBox(SINK.x1, 0, -21.95, -49.6, 0.86, -21.35, 'wood', 0.02, { collide: false });
  b.box(SINK.x0, 0, SINK.z1, SINK.x1, 0.86, -21.35, 'wood', NC);
  b.box(SINK.x0, 0, -21.95, SINK.x1, 0.86, SINK.z0, 'wood', NC);
  b.roundBox(-53.82, 0.86, -21.97, SINK.x0, 0.9, -21.33, 'counter', 0.01, NC);
  b.roundBox(SINK.x1, 0.86, -21.97, -49.58, 0.9, -21.33, 'counter', 0.01, NC);
  b.box(SINK.x0, 0.86, SINK.z1, SINK.x1, 0.9, -21.33, 'counter', NC);
  b.box(SINK.x0, 0.86, -21.97, SINK.x1, 0.9, SINK.z0, 'counter', NC);
  // Stainless basin set into the hole: a bottom, four sides, a thin rim and
  // a drain.
  const w = 0.012;
  b.box(SINK.x0, SINK.bottom - 0.01, SINK.z0, SINK.x1, SINK.bottom, SINK.z1, 'steel', NC);
  b.box(SINK.x0, SINK.bottom, SINK.z0, SINK.x0 + w, 0.9, SINK.z1, 'steel', NC);
  b.box(SINK.x1 - w, SINK.bottom, SINK.z0, SINK.x1, 0.9, SINK.z1, 'steel', NC);
  b.box(SINK.x0 + w, SINK.bottom, SINK.z0, SINK.x1 - w, 0.9, SINK.z0 + w, 'steel', NC);
  b.box(SINK.x0 + w, SINK.bottom, SINK.z1 - w, SINK.x1 - w, 0.9, SINK.z1, 'steel', NC);
  for (const [x0, z0, x1, z1] of [[SINK.x0 - 0.02, SINK.z0 - 0.02, SINK.x1 + 0.02, SINK.z0], [SINK.x0 - 0.02, SINK.z1, SINK.x1 + 0.02, SINK.z1 + 0.02],
    [SINK.x0 - 0.02, SINK.z0, SINK.x0, SINK.z1], [SINK.x1, SINK.z0, SINK.x1 + 0.02, SINK.z1]]) {
    b.box(x0, 0.9, z0, x1, 0.905, z1, 'steel', NC);
  }
  const sinkX = (SINK.x0 + SINK.x1) / 2;
  b.shape(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 16), 'rubber', sinkX, SINK.bottom + 0.002, (SINK.z0 + SINK.z1) / 2);
  // Gooseneck faucet behind the sink: a tall pipe arching over the basin.
  b.shape(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 16), 'steel', sinkX, 0.92, -21.9);
  b.shape(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 12), 'steel', sinkX, 1.075, -21.9);
  const arch = new THREE.TorusGeometry(0.09, 0.014, 8, 20, Math.PI);
  arch.rotateY(Math.PI / 2);
  b.shape(arch, 'steel', sinkX, 1.245, -21.81);
  b.shape(new THREE.CylinderGeometry(0.016, 0.014, 0.07, 12), 'steel', sinkX, 1.21, -21.72);
  b.roundBox(sinkX + 0.05, 0.93, -21.93, sinkX + 0.14, 0.95, -21.89, 'steel', 0.006, NC); // handle
  // Cooktop: a black glass top with four burners, over an oven with a
  // window, a handle and control knobs.
  const COOK = { x0: -51.55, x1: -50.85, z0: -21.9, z1: -21.4 };
  b.roundBox(COOK.x0, 0.9, COOK.z0, COOK.x1, 0.906, COOK.z1, 'rubber', 0.003, NC);
  for (const [dx, dz, r] of [[0.18, 0.13, 0.085], [0.52, 0.13, 0.065], [0.18, 0.37, 0.065], [0.52, 0.37, 0.085]]) {
    for (const k of [1, 0.6]) {
      const ring = new THREE.TorusGeometry(r * k, 0.004, 4, 32);
      ring.rotateX(Math.PI / 2);
      b.shape(ring, 'metal', COOK.x0 + dx, 0.907, COOK.z0 + dz);
    }
  }
  b.box(COOK.x0, 0.08, -21.35, COOK.x1, 0.84, -21.33, 'plastic', NC);                        // oven front
  b.box(COOK.x0 + 0.08, 0.2, -21.33, COOK.x1 - 0.08, 0.56, -21.325, 'tint', NC);               // oven window
  b.roundBox(COOK.x0 + 0.08, 0.62, -21.33, COOK.x1 - 0.08, 0.64, -21.29, 'steel', 0.008, NC);  // handle
  for (let i = 0; i < 4; i++) {
    const knob = new THREE.CylinderGeometry(0.02, 0.022, 0.025, 14);
    knob.rotateX(Math.PI / 2);
    b.shape(knob, 'steel', COOK.x0 + 0.12 + i * 0.153, 0.76, -21.318);
  }
  b.roundBox(-49.45, 0, -21.95, -48.6, 1.85, -21.25, 'fridge', 0.03, { shadow: true });
  table(b, -50.8, -18.6, 1.1, 0.8);
  chair(b, -50.8, -18.0, 0);
  chair(b, -50.8, -19.2, 2);
  // Living room: a sofa facing the TV on the west wall (clear of the bedroom
  // door to the south and the front door to the north), and the TV, which
  // has crashed.
  couch(b, -57.3, -18.2, 1, 1.8);
  b.roundBox(-59.9, 0, -18.9, -59.45, 0.5, -17.1, 'wood', 0.02, { shadow: true });
  b.box(-59.8, 0.55, -18.6, -59.74, 1.25, -17.4, 'plastic', NC);
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.64), new THREE.MeshBasicMaterial({ map: toTexture(drawBlueScreen()) }));
  tv.position.set(-59.735, 0.9, -18);
  tv.rotation.y = Math.PI / 2; // facing east, into the room
  scene.add(tv);
  plant(b, -54.6, -16.6);
  // Mailbox by the road and a sign for Goob Co. where the road meets the lot.
  // (The road runs along z -14..-10.)
  b.box(-47.2, 0, -9.4, -47.1, 1.0, -9.3, 'metal', NC);
  b.roundBox(-47.35, 1.0, -9.55, -46.95, 1.25, -9.15, 'red', 0.05, NC);
  sign(scene, 'GOOB CO. →', -14, 1.6, -9.25, 'n', { w: 1.6, h: 0.4, ...LOGO });
  b.box(-14.05, 0, -9.3, -13.95, 1.4, -9.2, 'metal');
}

// A crashed Windows-style "blue screen" for the TV at home.
function drawBlueScreen() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 596;
  const g = c.getContext('2d');
  g.fillStyle = '#0a6fc9';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#ffffff';
  g.textBaseline = 'top';
  g.font = '150px "Segoe UI", system-ui, sans-serif';
  g.fillText(':(', 70, 40);
  g.font = '34px "Segoe UI", system-ui, sans-serif';
  const lines = [
    "Your PC ran into a problem and needs to restart. We're",
    "just collecting some error info, and then we'll restart for you.",
  ];
  lines.forEach((t, i) => g.fillText(t, 70, 230 + i * 46));
  g.fillText('0% complete', 70, 350);
  // QR code: a scatter of squares in a frame.
  const qx = 70;
  const qy = 420;
  g.fillRect(qx, qy, 130, 130);
  g.fillStyle = '#0a6fc9';
  g.fillRect(qx + 8, qy + 8, 114, 114);
  g.fillStyle = '#ffffff';
  let seed = 7;
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      seed = (seed * 16807) % 2147483647;
      if (seed % 3 === 0) g.fillRect(qx + 12 + x * 10.6, qy + 12 + y * 10.6, 10, 10);
    }
  }
  g.font = '22px "Segoe UI", system-ui, sans-serif';
  g.fillText('For more information about this issue and possible fixes, visit', 230, 430);
  g.fillText('https://www.goob.co/stopcode', 230, 460);
  g.fillText('If you call a support person, give them this info:', 230, 510);
  g.fillText('Stop code: GOOB_IN_THE_MACHINE', 230, 540);
  return c;
}
