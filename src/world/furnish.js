import { createRng } from '../core/random.js';
import {
  bench, bin, cabinet, chair, chairsAround, counter, couch, crate, desk, forklift, fridge, goobCanister,
  hazmatSuit, lockers, pallet, palletRack, plant, pod, printer, shelf, sign, sinks, stallRow, table,
  vending, waterCooler,
} from './furniture.js';

const NC = { collide: false };
const LOGO = { bg: '#102414', fg: '#6cff4a' };
const HAZARD = { bg: '#e2ba24', fg: '#1e1e1e' };
const DANGER = { bg: '#8e1f1f', fg: '#f4e6e6' };

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
  for (const z of [2.9, 4.2, 5.5]) hazmatSuit(b, 7.6, z, 3);
  b.box(7.2, 0, 2.2, 7.9, 2.1, 6.2, null);
  sign(scene, 'LOCKERS', 4, 2.55, 10.12, 'n', { w: 1.2, h: 0.28 });

  // Restroom
  stallRow(b, 8.1, 0.1, 0, 3);
  sinks(b, 13.35, 3, 13.9, 6.2);
  sign(scene, 'RESTROOM', 11, 2.55, 10.12, 'n', { w: 1.2, h: 0.28 });

  // Lobby
  counter(b, 17.6, 6, 20.4, 6.6);
  b.box(18.8, 0.9, 6.35, 19.3, 1.2, 6.42, 'plastic', NC);
  chair(b, 19, 7.2, 0);
  couch(b, 14.55, 3.2, 3, 2.4);
  plant(b, 14.5, 0.5);
  plant(b, 23.5, 0.5);
  plant(b, 23.5, 9.4);
  sign(scene, 'GOOB CO.', 22, 2.0, 9.88, 's', { w: 2.6, h: 0.7, ...LOGO });

  // Corridor
  b.box(8.5, 1.0, 10.1, 8.7, 1.5, 10.25, 'red', NC);
  b.box(9, 1.3, 12.87, 11, 2.1, 12.9, 'cardboard', NC);
  waterCooler(b, 0.4, 11.5);
  bin(b, 23.5, 10.4);
  sign(scene, 'BREAK ROOM', 6, 2.55, 12.88, 's', { w: 1.3, h: 0.28 });
  sign(scene, 'STAIRS', 13.5, 2.55, 12.88, 's', { w: 1.0, h: 0.28 });
  sign(scene, 'ELEVATOR', 16.5, 2.55, 12.88, 's', { w: 1.2, h: 0.28 });
  sign(scene, 'STORAGE', 21, 2.55, 12.88, 's', { w: 1.1, h: 0.28 });
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

  // Storage
  shelf(b, 19.3, 16.2, 23.8, 16.8, 2.2, rng);
  shelf(b, 19.3, 19.2, 23.8, 19.8, 2.2, rng);
  shelf(b, 19.3, 23.2, 23.8, 23.8, 2.2, rng);

  // Loading dock
  palletRack(b, 25, 0.2, 31, 1.4, rng);
  palletRack(b, 25, 22.6, 30.8, 23.8, rng);
  crate(b, 28, 7, 1, 1);
  crate(b, 28.1, 7.05, 0.8, 0.7, 1.0);
  crate(b, 27.5, 14.5, 1.2, 1.0);
  pallet(b, 29.5, 18, 1.2, 1.0);
  crate(b, 29.5, 18, 0.9, 0.8, 0.14);
  forklift(b, 32, 10, 1);
  b.box(34.5, 0, 4, 35.9, 0.012, 8, 'hazard', NC);
  b.box(34.5, 0, 10, 35.9, 0.012, 14, 'hazard', NC);
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
  out.desks = [[9, 3.5], [14, 3.5], [9, 9], [14, 9], [3, 9.5], [3, 17], [8, 17], [3, 21], [8, 21]]
    .flatMap(([x, z]) => pod(b, x, z, y));

  // Manager's office
  desk(b, 2.8, 3, 3, y);
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

  // Kitchenette
  counter(b, 18.2, 23.3, 22.7, 23.9, y);
  fridge(b, 22.9, 23.1, 23.8, 23.9, y);
  b.box(19, y + 0.9, 23.4, 19.4, y + 1.3, 23.8, 'plastic', NC);
  table(b, 20.5, 19.5, 1.2, 1.2, y);
  chairsAround(b, 20.5, 19.5, 1.2, 1.2, y);
  waterCooler(b, 23.5, 17, y);

  // Restroom
  stallRow(b, 17.9, 23.9, 2, 2, y);
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

  return out;
}
