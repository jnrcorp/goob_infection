import * as THREE from 'three';
import { BUILDING, DOOR_HEIGHT } from './building.js';
import { StaticBuilder } from './staticBuilder.js';
import { rectMinus, inRect } from './rects.js';
import { Door } from './door.js';
import { Elevator } from './elevator.js';
import { furnish } from './furnish.js';
import { reportOverlappingFaces } from './debugOverlaps.js';

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
  const annex = BUILDING.annex;

  scene.add(new THREE.AmbientLight(0xd8dcff, 1.6));

  // Outside ground beyond the walls, with the building and the walkable
  // outdoor areas cut out (those draw their own ground; overlapping surfaces
  // flicker).
  for (const r of rectMinus({ x0: -60, z0: -60, x1: 110, z1: 84 }, [fp, annex, ...BUILDING.grounds])) {
    b.plane(r.x0, r.z0, r.x1, r.z1, -0.02, 'asphalt');
  }
  for (const g of BUILDING.grounds) b.box(g.x0, -0.3, g.z0, g.x1, 0, g.z1, null);

  // Structural slabs: colliders only, since every room draws its own floor,
  // plus a visible underside for where you can see them from below.
  b.box(annex.x0, -0.3, annex.z0, annex.x1, 0, annex.z1, null);
  b.box(annex.x0 - 0.1, annex.roofY, annex.z0 - 0.1, annex.x1, annex.roofY + 0.3, annex.z1 + 0.1, 'concrete');
  for (const floor of BUILDING.floors) {
    for (const r of rectMinus(floor.slab, floor.voids)) {
      b.box(r.x0, floor.y - 0.3, r.z0, r.x1, floor.y, r.z1, null);
      b.plane(r.x0, r.z0, r.x1, r.z1, floor.y - 0.3, 'concrete', true);
    }
  }
  for (const r of BUILDING.roofs) b.box(r.x0 - 0.1, r.y, r.z0 - 0.1, r.x1 + 0.1, r.y + 0.3, r.z1 + 0.1, 'concrete');

  // Walls, doors and windows
  for (const floor of BUILDING.floors) {
    for (const w of floor.walls) buildWall(ctx, floor, w, doors);
  }

  // Floors, ceilings and lighting per room. A room's floor skips holes in the
  // slab (stairs, the elevator shaft), and either every other room on the
  // floor (excludeOthers: the open-plan areas) or the rects in `minus`.
  const rooms = [];
  const lightSpots = [];
  for (const [index, floor] of BUILDING.floors.entries()) {
    for (const room of floor.rooms) {
      const holes = [
        ...(room.excludeOthers ? floor.rooms.filter((o) => o !== room).map((o) => o.rect) : []),
        ...(room.minus ?? []),
      ];
      const rects = rectMinus(room.rect, [...holes, ...floor.voids]);
      rooms.push({ ...room, floorIndex: index, floorId: floor.id, rects });
      const lightY = floor.y + (room.lightY ?? (room.ceiling ? room.ceiling - 0.02 : floor.wallHeight - 0.3));
      for (const r of rects) {
        b.plane(r.x0, r.z0, r.x1, r.z1, floor.y, room.floor);
        if (room.ceiling) b.plane(r.x0, r.z0, r.x1, r.z1, floor.y + room.ceiling, 'ceiling', true);
        const fixture = 'fixture' in room ? room.fixture : 'light';
        if (fixture) addFixtures(b, r, lightY, fixture);
      }
      addLights(lightSpots, room, rects, lightY);
    }
  }
  const lights = new LightPool(scene, lightSpots);

  for (const flight of BUILDING.flights) buildStairs(b, collision, flight);
  const elevator = new Elevator(ctx, BUILDING.elevator);
  const props = furnish(ctx);
  const check = new URLSearchParams(location.search).get('checkfaces');
  if (check !== null) reportOverlappingFaces(b.records, check);
  b.finish(scene);

  const elevatorRect = { x0: BUILDING.elevator.x0, z0: BUILDING.elevator.z0, x1: BUILDING.elevator.x1, z1: BUILDING.elevator.z1 };

  return {
    spawn: BUILDING.spawn,
    rooms,
    doors,
    elevator,
    props,

    // Put everything back the way it was at the start of the chapter.
    reset() {
      for (const d of doors) d.reset();
      elevator.reset();
      props.suit.group.visible = true;
      this.setCanisterVisible(true);
    },

    // Toggle meshes and dim the light rather than hiding the group: changing
    // how many lights are visible forces every shader to recompile (a stutter).
    setCanisterVisible(visible) {
      for (const m of props.canister.meshes) m.visible = visible;
      props.canister.glow.intensity = visible ? 2.5 : 0;
    },

    doorByLabel(label) {
      return doors.find((d) => d.label === label);
    },

    // Shove open any shut (unlocked) door the NPC has walked up to.
    openDoorsNear(npc) {
      for (const d of doors) {
        if (d.isOpen || d.locked) continue;
        if (Math.abs(npc.pos.y - d.pivot.position.y) > 1) continue;
        if (Math.hypot(npc.pos.x - d.x, npc.pos.z - d.z) < 0.9) d.openFrom(npc.pos);
      }
    },
    update(dt, player) {
      for (const d of doors) d.update(dt, player);
      elevator.update(dt, player);
      props.canister.goob.rotation.y += dt * 0.6;
      lights.update(player.pos);
    },

    // Which floor a height is on (the highest floor at or below it).
    floorIndexAt(y) {
      let index = 0;
      BUILDING.floors.forEach((f, i) => { if (y >= f.y - 0.6) index = i; });
      return index;
    },

    // The area for per-floor tallies: 'B1', '1F', '2F', '3F', or 'Outside'.
    areaAt(pos) {
      const floorIndex = this.floorIndexAt(pos.y);
      const room = rooms.find((r) => r.floorIndex === floorIndex && r.rects.some((rect) => inRect(rect, pos.x, pos.z)));
      return room?.outdoor ? 'Outside' : BUILDING.floors[floorIndex].id;
    },

    locationAt(pos) {
      const floorIndex = this.floorIndexAt(pos.y);
      const floorId = BUILDING.floors[floorIndex].id;
      if (inRect(elevatorRect, pos.x, pos.z)) return `${floorId} · Elevator`;
      if (inRect(BUILDING.stairwell, pos.x, pos.z)) return `${floorId} · Stairwell`;
      const room = rooms.find((r) => r.floorIndex === floorIndex && r.rects.some((rect) => inRect(rect, pos.x, pos.z)));
      if (!room) return floorId;
      return room.outdoor ? `Outside · ${room.name}` : `${floorId} · ${room.name}`;
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
  // Wall tops are never seen (floors, ceilings and sills cover them) and would
  // flicker against the floor above, so pieces skip their top face by default.
  const wallOpts = spec.showTop ? {} : { noTop: true };
  // Colliders are tagged as walls, which the vacuum can't pull goob through.
  const piece = (s0, s1, yb, yt, m, opts = wallOpts, th = t) => {
    const collider = alongX
      ? b.box(s0, y0 + yb, c - th, s1, y0 + yt, c + th, m, opts)
      : b.box(c - th, y0 + yb, s0, c + th, y0 + yt, s1, m, opts);
    if (collider) collider.wall = true;
    return collider;
  };

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
      piece(o.s0, o.s1, o.sill, o.sill + 0.03, 'counter', { collide: false }, t + 0.04);
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

// Light positions on a coarse grid over the room, skipping spots outside its
// rects. (The actual lights come from the LightPool.)
function addLights(spots, room, rects, y) {
  const r = room.rect;
  const spacing = room.lightSpacing ?? LIGHT_SPACING;
  const nx = Math.max(1, Math.round((r.x1 - r.x0) / spacing));
  const nz = Math.max(1, Math.round((r.z1 - r.z0) / spacing));
  const points = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x = r.x0 + (i + 0.5) * (r.x1 - r.x0) / nx;
      const z = r.z0 + (j + 0.5) * (r.z1 - r.z0) / nz;
      if (rects.some((rect) => inRect(rect, x, z))) points.push([x, z]);
    }
  }
  if (!points.length) {
    const big = rects.reduce((a, c) => ((c.x1 - c.x0) * (c.z1 - c.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? c : a));
    points.push([(big.x0 + big.x1) / 2, (big.z0 + big.z1) / 2]);
  }
  for (const [x, z] of points) {
    spots.push({
      pos: new THREE.Vector3(x, y - 0.3, z),
      color: new THREE.Color(room.lightColor ?? LIGHT.color),
      intensity: room.lightIntensity ?? LIGHT.intensity,
      range: room.lightRange ?? LIGHT.range,
    });
  }
}

// A fixed set of point lights handed out each frame to the room light spots
// nearest the player. The building has far more light spots than can be
// shaded per pixel cheaply; lights further away than their range don't reach
// you anyway. The count never changes, so shaders never recompile.
const POOL_SIZE = 24;
class LightPool {
  constructor(scene, spots) {
    this.spots = spots;
    this.lights = Array.from({ length: Math.min(POOL_SIZE, spots.length) }, () => {
      const light = new THREE.PointLight(0xffffff, 0, 1, LIGHT.decay);
      scene.add(light);
      return light;
    });
  }

  update(pos) {
    // Lights on other floors count as further away: they're behind slabs.
    for (const s of this.spots) {
      s.score = Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z) + Math.abs(s.pos.y - pos.y) * 2.5;
    }
    const nearest = [...this.spots].sort((a, b) => a.score - b.score);
    this.lights.forEach((light, i) => {
      const s = nearest[i];
      light.position.copy(s.pos);
      light.color.copy(s.color);
      light.intensity = s.intensity;
      light.distance = s.range;
    });
  }
}

// Solid concrete steps with yellow nosing, plus a ramp collider to walk on.
// f: { x0, x1, z0, z1, yLow, yHigh, rises: 'n' | 's', steps }.
function buildStairs(b, collision, f) {
  const run = (f.z1 - f.z0) / f.steps;
  const rise = (f.yHigh - f.yLow) / f.steps;
  for (let i = 0; i < f.steps; i++) {
    const top = f.yLow + (i + 1) * rise;
    // Step i from the bottom; its front edge faces down the stairs.
    const z0 = f.rises === 'n' ? f.z0 + i * run : f.z1 - (i + 1) * run;
    const z1 = z0 + run;
    b.box(f.x0, f.yLow, z0, f.x1, top, z1, 'concrete', { collide: false });
    // Yellow strip on the riser at the front of each step (not on the tread,
    // so it doesn't sit flush with the surface you walk on).
    if (f.rises === 'n') b.box(f.x0, top - 0.06, z0 - 0.02, f.x1, top, z0, 'hazard', { collide: false });
    else b.box(f.x0, top - 0.06, z1, f.x1, top, z1 + 0.02, 'hazard', { collide: false });
  }
  collision.addRamp({
    minX: f.x0, maxX: f.x1, minZ: f.z0, maxZ: f.z1, yLow: f.yLow, yHigh: f.yHigh, rises: f.rises, offset: rise / 2,
  });
}
