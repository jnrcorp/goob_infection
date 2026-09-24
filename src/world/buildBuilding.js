import * as THREE from 'three';
import { BUILDING, DOOR_HEIGHT } from './building.js';
import { StaticBuilder } from './staticBuilder.js';
import { rectMinus, inRect } from './rects.js';
import { Door } from './door.js';
import { Elevator } from './elevator.js';
import { furnish } from './furnish.js';

const WALL_T = 0.2;
const FIXTURE_SPACING = 3.5;
const LIGHT_SPACING = 9;
const LIGHT = { color: 0xfff1d8, intensity: 14, range: 12, decay: 1.3 };

// Builds Goob Co. HQ from BUILDING data and returns the live world.
export function buildBuilding(baseCtx) {
  const { scene, collision, materials } = baseCtx;
  const b = new StaticBuilder(materials, collision);
  const ctx = { ...baseCtx, builder: b };
  const doors = [];
  const fp = BUILDING.footprint;

  scene.add(new THREE.AmbientLight(0xd8dcff, 1.6));

  // Outside ground and structural slabs
  b.plane(-60, -60, 96, 84, -0.02, 'asphalt');
  b.box(fp.x0, -0.3, fp.z0, fp.x1, 0, fp.z1, 'concrete');
  for (const floor of BUILDING.floors) {
    if (!floor.slab) continue;
    for (const r of rectMinus(floor.slab, floor.voids)) b.box(r.x0, floor.y - 0.3, r.z0, r.x1, floor.y, r.z1, 'concrete');
  }
  b.box(fp.x0 - 0.1, BUILDING.roofY, fp.z0 - 0.1, fp.x1 + 0.1, BUILDING.roofY + 0.3, fp.z1 + 0.1, 'concrete');

  // Walls, doors and windows
  for (const floor of BUILDING.floors) {
    for (const w of floor.walls) buildWall(ctx, floor, w, doors);
  }

  // Floors, ceilings and lighting per room
  const rooms = [];
  for (const [index, floor] of BUILDING.floors.entries()) {
    for (const room of floor.rooms) {
      const holes = room.excludeOthers
        ? floor.rooms.filter((o) => o !== room).map((o) => o.rect).concat(floor.voids)
        : [];
      const rects = rectMinus(room.rect, holes);
      rooms.push({ ...room, floorIndex: index, floorId: floor.id, rects });
      const lightY = floor.y + (room.lightY ?? (room.ceiling ? room.ceiling - 0.02 : floor.wallHeight - 0.3));
      for (const r of rects) {
        b.plane(r.x0, r.z0, r.x1, r.z1, floor.y + 0.01, room.floor);
        if (room.ceiling) b.plane(r.x0, r.z0, r.x1, r.z1, floor.y + room.ceiling, 'ceiling', true);
        addFixtures(b, r, lightY, room.fixture ?? 'light');
      }
      addLights(scene, room, rects, lightY);
    }
  }

  buildStairs(b, collision, BUILDING.stairs);
  const elevator = new Elevator(ctx, BUILDING.elevator);
  const props = furnish(ctx);
  b.finish(scene);

  const elevatorRect = { x0: BUILDING.elevator.x0, z0: BUILDING.elevator.z0, x1: BUILDING.elevator.x1, z1: BUILDING.elevator.z1 };

  return {
    spawn: BUILDING.spawn,
    rooms,
    doors,
    elevator,
    props,

    update(dt, player) {
      for (const d of doors) d.update(dt);
      elevator.update(dt, player);
      props.canister.goob.rotation.y += dt * 0.6;
    },

    locationAt(pos) {
      const floorIndex = pos.y > 3 ? 1 : 0;
      const floorId = BUILDING.floors[floorIndex].id;
      if (inRect(elevatorRect, pos.x, pos.z)) return `${floorId} · Elevator`;
      if (inRect(BUILDING.stairwell, pos.x, pos.z)) return 'Stairwell';
      const room = rooms.find((r) => r.floorIndex === floorIndex && r.rects.some((rect) => inRect(rect, pos.x, pos.z)));
      return room ? `${floorId} · ${room.name}` : floorId;
    },
  };
}

// A straight wall with door, window, gap and panel openings.
function buildWall(ctx, floor, spec, doors) {
  const b = ctx.builder;
  const [x1, z1, x2, z2] = spec.line;
  const y0 = floor.y;
  const h = spec.h ?? floor.wallHeight;
  const mat = spec.mat ?? 'wall';
  const t = WALL_T / 2;
  const alongX = z1 === z2;
  const c = alongX ? z1 : x1;
  const start = Math.min(alongX ? x1 : z1, alongX ? x2 : z2) - t;
  const end = Math.max(alongX ? x1 : z1, alongX ? x2 : z2) + t;

  // Box spanning s0..s1 along the wall, yb..yt above the floor, with half-thickness th.
  const piece = (s0, s1, yb, yt, m, opts, th = t) => (alongX
    ? b.box(s0, y0 + yb, c - th, s1, y0 + yt, c + th, m, opts)
    : b.box(c - th, y0 + yb, s0, c + th, y0 + yt, s1, m, opts));

  const openings = (spec.openings ?? [])
    .map((o) => ({ ...o, s0: o.at - o.w / 2, s1: o.at + o.w / 2 }))
    .sort((a, b2) => a.s0 - b2.s0);

  let cursor = start;
  for (const o of openings) {
    piece(cursor, o.s0, 0, h, mat);
    if (o.kind === 'window') {
      piece(o.s0, o.s1, 0, o.sill, mat);
      piece(o.s0, o.s1, o.top, h, mat);
      piece(o.s0, o.s1, o.sill, o.top, 'glass', {}, 0.02);
      piece(o.s0, o.s1, o.sill - 0.03, o.sill, 'counter', { collide: false }, t + 0.04);
    } else if (o.kind === 'panel') {
      piece(o.s0, o.s1, 0, o.top, o.mat, {}, t * 0.6);
      piece(o.s0, o.s1, o.top, h, mat);
    } else {
      piece(o.s0, o.s1, DOOR_HEIGHT, h, mat);
      if (o.kind === 'door') {
        doors.push(new Door(ctx, {
          x: alongX ? o.at : c,
          y: y0,
          z: alongX ? c : o.at,
          axis: alongX ? 'x' : 'z',
          w: o.w,
          mat: o.mat ?? 'door',
          label: o.label,
          locked: o.locked ?? null,
        }));
      }
    }
    cursor = o.s1;
  }
  piece(cursor, end, 0, h, mat);
}

// Flat light panels, spread evenly over a rect.
function addFixtures(b, r, y, mat) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const nx = Math.max(1, Math.round(w / FIXTURE_SPACING));
  const nz = Math.max(1, Math.round(d / FIXTURE_SPACING));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const cx = r.x0 + (i + 0.5) * w / nx;
      const cz = r.z0 + (j + 0.5) * d / nz;
      b.box(cx - 0.6, y - 0.03, cz - 0.3, cx + 0.6, y, cz + 0.3, mat, { collide: false });
    }
  }
}

// Point lights on a coarse grid over the room, skipping spots outside its rects.
function addLights(scene, room, rects, y) {
  const r = room.rect;
  const nx = Math.max(1, Math.round((r.x1 - r.x0) / LIGHT_SPACING));
  const nz = Math.max(1, Math.round((r.z1 - r.z0) / LIGHT_SPACING));
  const spots = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = r.x0 + (i + 0.5) * (r.x1 - r.x0) / nx;
      const z = r.z0 + (j + 0.5) * (r.z1 - r.z0) / nz;
      if (rects.some((rect) => inRect(rect, x, z))) spots.push([x, z]);
    }
  }
  if (!spots.length) {
    const big = rects.reduce((a, c) => ((c.x1 - c.x0) * (c.z1 - c.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? c : a));
    spots.push([(big.x0 + big.x1) / 2, (big.z0 + big.z1) / 2]);
  }
  for (const [x, z] of spots) {
    const light = new THREE.PointLight(
      room.lightColor ?? LIGHT.color,
      room.lightIntensity ?? LIGHT.intensity,
      room.lightRange ?? LIGHT.range,
      LIGHT.decay
    );
    light.position.set(x, y - 0.3, z);
    scene.add(light);
  }
}

// Solid concrete steps with yellow nosing, plus a ramp collider to walk on.
function buildStairs(b, collision, s) {
  const run = (s.z1 - s.z0) / s.steps;
  const rise = (s.y1 - s.y0) / s.steps;
  for (let i = 0; i < s.steps; i++) {
    const z = s.z0 + i * run;
    const top = s.y0 + (i + 1) * rise;
    b.box(s.x0, s.y0, z, s.x1, top, z + run, 'concrete', { collide: false });
    b.box(s.x0, top, z, s.x1, top + 0.008, z + 0.06, 'hazard', { collide: false });
  }
  collision.addRamp({ minX: s.x0, maxX: s.x1, minZ: s.z0, maxZ: s.z1, y0: s.y0, y1: s.y1, offset: rise / 2 });
}
