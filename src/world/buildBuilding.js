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
const LIGHT_SPACING = 6.5;
const LIGHT = { color: 0xfff1d8, intensity: 9, range: 10, decay: 1.2 };
// Scales every room light (including rooms with their own intensity).
const LIGHT_BRIGHTNESS = 0.75;
const LIGHT_DROP = 1; // meters below the ceiling fixture that each light sits
const CEILING_TILE = 0.6; // ceiling grid (see the ceiling surface): fixtures line up with it
const SEAM_OVERLAP = 0.01; // floor/ceiling pieces overlap by this much
const CASING = 0.07;       // door and window frame width
const CASING_DEPTH = 0.015; // how far frames stand proud of the wall
const CLADDING = 0.05;     // exterior facade panel thickness

// Fill light by area (a hemisphere light: sky color from above, ground
// bounce from below). The basement is dimmer and cooler, the executive floor
// warmer, and outside brighter.
const FILL = {
  B1: { sky: 0xd0dcec, ground: 0x6c6a64, intensity: 0.85 },
  '1F': { sky: 0xe4ecf8, ground: 0x8a7c68, intensity: 1.05 },
  '2F': { sky: 0xe8eef8, ground: 0x857a6a, intensity: 1.05 },
  '3F': { sky: 0xf4ecdf, ground: 0x8a7458, intensity: 1.1 },
  Outside: { sky: 0xcfe2f6, ground: 0x7d786c, intensity: 1.5 },
};

// Afternoon sun from the south-west (the parking lot side), through the windows.
const SUN = { color: 0xfff0d8, intensity: 1.9, direction: [-0.55, 0.65, -0.52], center: [18, 0, 8], extent: 46 };

const tmpColor = new THREE.Color();

// Builds Goob Co. HQ from BUILDING data and returns the live world.
export function buildBuilding(baseCtx) {
  const { scene, collision, materials } = baseCtx;
  const b = new StaticBuilder(materials, collision);
  const ctx = { ...baseCtx, builder: b };
  const doors = [];
  const fp = BUILDING.footprint;
  const annex = BUILDING.annex;

  // Fill light: cool from the ceiling, warm bounce from the floor (per area; see FILL).
  const fill = new THREE.HemisphereLight(FILL['2F'].sky, FILL['2F'].ground, FILL['2F'].intensity);
  scene.add(fill);

  const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
  sun.target.position.set(...SUN.center);
  sun.position.set(...SUN.center).addScaledVector(new THREE.Vector3(...SUN.direction).normalize(), 70);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -SUN.extent;
  sc.right = sc.top = SUN.extent;
  sc.near = 1;
  sc.far = 150;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  const sky = createSky();
  scene.add(sky);

  // Outside ground beyond the walls, with the building and the walkable
  // outdoor areas cut out (those draw their own ground; overlapping surfaces
  // flicker).
  for (const r of rectMinus({ x0: -60, z0: -60, x1: 110, z1: 84 }, [fp, annex, ...BUILDING.grounds])) {
    b.plane(r.x0, r.z0, r.x1, r.z1, -0.02, 'grass');
  }
  addCurbs(b, BUILDING.grounds, [fp, annex, ...BUILDING.grounds]);
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
        // Pieces overlap their neighbors by a centimeter: butted edges leave
        // hairline cracks that sparkle. (Same material, same world-aligned
        // texture, so the overlap can't be seen; walls hide room boundaries.)
        const e = SEAM_OVERLAP;
        b.plane(r.x0 - e, r.z0 - e, r.x1 + e, r.z1 + e, floor.y, room.floor);
        if (room.ceiling) b.plane(r.x0 - e, r.z0 - e, r.x1 + e, r.z1 + e, floor.y + room.ceiling, 'ceiling', true);
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
    lights,

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
    // 'none' | 'sun' | 'all' (the quality preset's shadows). Without shadows
    // the sun would shine through walls, so on Low it only lights the outdoors.
    shadows: 'none',

    setShadows(mode, renderer) {
      this.shadows = mode;
      renderer.shadowMap.enabled = mode !== 'none';
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      sun.castShadow = mode !== 'none';
      const size = mode === 'all' ? 4096 : 2048;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
      // (Ceiling lights don't cast shadows: the pool hands lights to different
      // fixtures as you move, which made their shadows jump.)
      lights.setShadows(0);
    },

    update(dt, player) {
      for (const d of doors) d.update(dt, player);
      elevator.update(dt, player);
      props.canister.goob.rotation.y += dt * 0.6;
      lights.update(player.pos);

      const area = this.areaAt(player.pos);
      const target = FILL[area] ?? FILL['1F'];
      const k = 1 - Math.exp(-4 * dt);
      fill.color.lerp(tmpColor.set(target.sky), k);
      fill.groundColor.lerp(tmpColor.set(target.ground), k);
      fill.intensity += (target.intensity - fill.intensity) * k;
      const sunOn = this.shadows !== 'none' || area === 'Outside';
      sun.intensity += ((sunOn ? SUN.intensity : 0) - sun.intensity) * k;
      sky.position.copy(player.pos);
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
    // Outside walls get facade panels on their outer face.
    if (outward && m === mat && th === t) cladding(s0, s1, yb, yt);
    return collider;
  };

  // Exterior walls (on the building's outline, above ground): which way is out.
  const outward = floor.y >= 0 && spec.mat !== 'concrete' ? outsideDirection(spec.line) : 0;
  const cladding = (s0, s1, yb, yt) => {
    const a = outward > 0 ? c + t : c - t - CLADDING;
    const bb = a + CLADDING;
    // Walls along x reach past their ends to cover the building's corners;
    // walls along z stop short, so the corner pieces never overlap (flicker).
    if (alongX) b.box(s0 - (s0 === start ? CLADDING : 0), y0 + yb, a, s1 + (s1 === end ? CLADDING : 0), y0 + yt, bb, 'facade', { collide: false, noTop: true });
    else b.box(a, y0 + yb, s0, bb, y0 + yt, s1, 'facade', { collide: false, noTop: true });
  };

  // Frame around an opening (door or window casing), on both faces, reaching
  // 1 cm into the opening so it covers the wall's cut edge. Outside, it
  // stands proud of the facade panels.
  const frame = (o, yb, yt, m) => {
    const inA = c - t - (outward < 0 ? CLADDING : 0) - CASING_DEPTH;
    const inB = c + t + (outward > 0 ? CLADDING : 0) + CASING_DEPTH;
    const bx = (s0, s1, ya, yb2) => (alongX
      ? b.box(s0, y0 + ya, inA, s1, y0 + yb2, inB, m, { collide: false })
      : b.box(inA, y0 + ya, s0, inB, y0 + yb2, s1, m, { collide: false }));
    bx(o.s0 - CASING, o.s0 + 0.01, yb, yt + CASING);
    bx(o.s1 - 0.01, o.s1 + CASING, yb, yt + CASING);
    bx(o.s0 + 0.01, o.s1 - 0.01, yt - 0.01, yt + CASING);
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
      piece(o.s0, o.s1, o.sill, o.sill + 0.03, 'counter', { collide: false }, t + 0.04 + (outward ? CLADDING : 0));
      frame(o, o.sill + 0.03, o.top, 'trim');
      // A mullion down the middle of wide windows.
      if (o.w >= 2) piece(o.at - 0.03, o.at + 0.03, o.sill + 0.03, o.top, 'trim', { collide: false }, t * 0.5);
    } else if (o.kind === 'panel') {
      piece(o.s0, o.s1, 0, o.top, o.mat, {}, t * 0.6);
      piece(o.s0, o.s1, o.top, h, mat);
    } else {
      piece(o.s0, o.s1, DOOR_HEIGHT, h, mat);
      if (o.kind === 'door') frame(o, 0, DOOR_HEIGHT, 'trim');
      if (o.kind === 'elevator') frame(o, 0, DOOR_HEIGHT, 'steel');
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

// Recessed 2-by-4 ft troffer lights spread evenly over a rect, snapped to the
// ceiling tile grid: a white frame with a glowing diffuser panel.
function addFixtures(b, r, y, mat) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const nx = Math.max(1, Math.round(w / FIXTURE_SPACING));
  const nz = Math.max(1, Math.round(d / FIXTURE_SPACING));
  const snapEdge = (v) => Math.round(v / CEILING_TILE) * CEILING_TILE;
  const snapMid = (v) => (Math.floor(v / CEILING_TILE) + 0.5) * CEILING_TILE;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      // 1.2 m along x (two tiles, edges on the grid), 0.6 m along z (one tile).
      const cx = Math.min(Math.max(snapEdge(r.x0 + (i + 0.5) * w / nx), r.x0 + 0.6), r.x1 - 0.6);
      const cz = Math.min(Math.max(snapMid(r.z0 + (j + 0.5) * d / nz), r.z0 + 0.3), r.z1 - 0.3);
      b.box(cx - 0.6, y - 0.012, cz - 0.3, cx + 0.6, y, cz + 0.3, 'fridge', { collide: false });
      b.box(cx - 0.56, y - 0.016, cz - 0.26, cx + 0.56, y - 0.012, cz + 0.26, mat, { collide: false });
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
      // A meter below the fixture: right under the ceiling, the light made a
      // glaring hot spot on the tiles above you.
      pos: new THREE.Vector3(x, y - LIGHT_DROP, z),
      color: new THREE.Color(room.lightColor ?? LIGHT.color),
      intensity: (room.lightIntensity ?? LIGHT.intensity) * LIGHT_BRIGHTNESS,
      range: room.lightRange ?? LIGHT.range,
    });
  }
}

// A fixed set of point lights handed out each frame to the room light spots
// nearest the player. The building has far more light spots than can be
// shaded per pixel cheaply; lights further away than their range don't reach
// you anyway. The count never changes, so shaders never recompile.
const POOL_SIZE = 24;
const POOL_FADE = 4; // meters over which lights at the edge of the pool fade out
class LightPool {
  constructor(scene, spots) {
    this.spots = spots;
    this.lights = Array.from({ length: Math.min(POOL_SIZE, spots.length) }, () => {
      const light = new THREE.PointLight(0xffffff, 0, 1, LIGHT.decay);
      scene.add(light);
      return light;
    });
  }

  // Real-time shadows from the n nearest lights (0 = none).
  setShadows(n) {
    this.lights.forEach((light, i) => {
      light.castShadow = i < n;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.002;
      light.shadow.normalBias = 0.03;
      light.shadow.camera.near = 0.1;
    });
  }

  // How many of the pool's lights are on (the quality preset's light count).
  // Changing it recompiles the lit materials, so it's only done from settings.
  setCount(n) {
    this.lights.forEach((light, i) => { light.visible = i < n; });
  }

  update(pos) {
    // Lights on other floors count as further away: they're behind slabs.
    for (const s of this.spots) {
      s.score = Math.hypot(s.pos.x - pos.x, s.pos.z - pos.z) + Math.abs(s.pos.y - pos.y) * 2.5;
    }
    const nearest = [...this.spots].sort((a, b) => a.score - b.score);
    // Lights fade out as they near the edge of the pool, so one taking over
    // from another as you walk never pops.
    const n = this.lights.filter((l) => l.visible).length;
    const cutoff = nearest[n]?.score ?? Infinity;
    this.lights.forEach((light, i) => {
      const s = nearest[i];
      light.position.copy(s.pos);
      light.color.copy(s.color);
      const fade = Math.min(1, Math.max(0, (cutoff - s.score) / POOL_FADE));
      light.intensity = s.intensity * fade;
      light.distance = s.range;
      light.shadow.camera.far = s.range;
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

// Sky dome: a vertical gradient that follows the player (seen outdoors and
// through windows).
function createSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0x6f9ccc) },
      uHorizon: { value: new THREE.Color(0xdde6ec) },
      uGround: { value: new THREE.Color(0x8a8e8c) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uHorizon, uGround;
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 col = y > 0.0 ? mix(uHorizon, uZenith, pow(y, 0.6)) : mix(uHorizon, uGround, min(1.0, -y * 6.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), material);
  sky.frustumCulled = false;
  sky.renderOrder = -2;
  return sky;
}

// Which way is outside for a wall on the building's outline (+1 or -1 along
// the wall's normal axis), or 0 for inside walls.
function outsideDirection([x1, z1, x2, z2]) {
  const fp = BUILDING.footprint;
  const an = BUILDING.annex;
  if (z1 === z2) {
    const lo = Math.min(x1, x2);
    const hi = Math.max(x1, x2);
    if (z1 === fp.z0 && lo >= fp.x0 - 0.01 && hi <= fp.x1 + 0.01) return -1;
    if (z1 === fp.z1 && lo >= fp.x0 - 0.01 && hi <= fp.x1 + 0.01) return 1;
    if (z1 === an.z0 && hi <= an.x1 + 0.01) return -1;
    if (z1 === an.z1 && hi <= an.x1 + 0.01) return 1;
  } else {
    const lo = Math.min(z1, z2);
    const hi = Math.max(z1, z2);
    if (x1 === fp.x0 && (hi <= an.z0 + 0.01 || lo >= an.z1 - 0.01)) return -1;
    if (x1 === fp.x1) return 1;
    if (x1 === an.x0) return -1;
  }
  return 0;
}

// Concrete curbs where the paved areas meet the grass.
function addCurbs(b, grounds, solid) {
  const W = 0.15;
  const H = 0.12;
  const inside = (x, z) => solid.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  for (const g of grounds) {
    const edges = [
      { alongX: true, c: g.z0, a: g.x0, b: g.x1, out: -1 },
      { alongX: true, c: g.z1, a: g.x0, b: g.x1, out: 1 },
      { alongX: false, c: g.x0, a: g.z0, b: g.z1, out: -1 },
      { alongX: false, c: g.x1, a: g.z0, b: g.z1, out: 1 },
    ];
    for (const e of edges) {
      let runStart = null;
      const step = 0.5;
      for (let s = e.a; s <= e.b + 1e-6; s += step) {
        const mid = Math.min(s + step / 2, e.b);
        const [px, pz] = e.alongX ? [mid, e.c + e.out * 0.3] : [e.c + e.out * 0.3, mid];
        const open = s < e.b - 1e-6 && !inside(px, pz);
        if (open && runStart === null) runStart = s;
        if ((!open || s >= e.b - 1e-6) && runStart !== null) {
          const s1 = Math.min(s, e.b);
          const c0 = e.out > 0 ? e.c - W : e.c;
          if (e.alongX) b.roundBox(runStart, -0.02, c0, s1, H, c0 + W, 'concrete', 0.02, { collide: false });
          else b.roundBox(c0, -0.02, runStart, c0 + W, H, s1, 'concrete', 0.02, { collide: false });
          runStart = null;
        }
      }
    }
  }
}
