import * as THREE from 'three';
import { BUILDING } from '../world/building.js';

// Spots where goob can sit, and which spots it can spread between.
// Floor spots cover every room on a grid; extra "hiding" spots sit on
// ceilings, in vents and under desks. Goob buds from a spot to a linked one.

const SPACING = 1.6;      // grid spacing on floors
const INSET = 0.45;       // keep grid points off the walls
const LINK = 2.4;         // max distance between linked floor spots
const HIDE_LINK = 4.2;    // hiding spots link to floor spots up to this far
const HIDE_LINKS = 3;     // ...and to this many of them

const NORMALS = {
  floor: new THREE.Vector3(0, 1, 0),
  ceiling: new THREE.Vector3(0, -1, 0),
  n: new THREE.Vector3(0, 0, 1),
  s: new THREE.Vector3(0, 0, -1),
  e: new THREE.Vector3(1, 0, 0),
  w: new THREE.Vector3(-1, 0, 0),
};

export class GoobGraph {
  // passable: colliders ignored when deciding which spots are neighbors (doors
  //   and people), so rooms still connect through their doorways.
  // doors: door colliders (enabled while shut). Goob can't spread across a
  //   link while a door on it is shut.
  // people: colliders that never block goob.
  constructor(collision, passable, { doors = [], people = new Set() } = {}) {
    this.collision = collision;
    this.passable = passable;
    this.doors = doors;
    this.people = people;
    this.nodes = [];
  }

  addNode(x, y, z, normal = NORMALS.floor, kind = 'floor') {
    const node = {
      id: this.nodes.length, pos: new THREE.Vector3(x, y, z), normal: normal.clone(), kind,
      links: [], doorsTo: new Map(), clearance: 1,
    };
    this.nodes.push(node);
    return node;
  }

  // Can goob spread from a to b right now? Not through a shut door.
  canSpread(a, b) {
    const doors = a.doorsTo.get(b);
    return !doors || doors.every((d) => !d.enabled);
  }

  // Spots within `radius` of a point with a clear line to it (for splats).
  visibleFrom(point, radius) {
    const from = new THREE.Vector3(point.x, point.y + 0.3, point.z);
    return this.nodesNear(point, radius).filter((n) => {
      const to = n.pos.clone().addScaledVector(n.normal, 0.2);
      return this.clearLine(from, to, this.people) && this.clearLine(to, from, this.people);
    });
  }

  build(world) {
    const floorNodes = [];

    // Floor grid in every room
    for (const room of world.rooms) {
      const y = BUILDING.floors[room.floorIndex].y;
      const rects = room.goobRect ? [room.goobRect] : room.rects;
      for (const r of rects) {
        for (const x of spread(r.x0 + INSET, r.x1 - INSET)) {
          for (const z of spread(r.z0 + INSET, r.z1 - INSET)) {
            if (this.blocked(x, y, z)) continue;
            floorNodes.push(this.addNode(x, y, z));
          }
        }
      }
    }

    // A spot on each side of every doorway, so rooms always connect through
    // their doors however the grid happens to line up.
    for (const door of world.doors) {
      const y = door.pivot.position.y;
      for (const side of [-0.5, 0.5]) {
        const x = door.axis === 'z' ? door.x + side : door.x;
        const z = door.axis === 'x' ? door.z + side : door.z;
        if (!this.blocked(x, y, z)) floorNodes.push(this.addNode(x, y, z));
      }
    }

    // Up the stairs
    const s = BUILDING.stairs;
    const ramp = this.collision.ramps[0];
    for (let z = s.z0 + 0.6; z < s.z1; z += 1.3) {
      floorNodes.push(this.addNode((s.x0 + s.x1) / 2, ramp.heightAt(z), z));
    }

    this.linkFloors(floorNodes);

    // Hiding spots
    const hiding = [];
    for (const v of BUILDING.vents) {
      const n = NORMALS[v.facing];
      hiding.push(this.addNode(v.x + n.x * 0.02, v.y, v.z + n.z * 0.02, n, 'vent'));
    }
    for (const room of world.rooms) {
      if (!room.ceiling || room.goobRect) continue;
      const big = room.rects.reduce((a, c) => ((c.x1 - c.x0) * (c.z1 - c.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? c : a));
      const y = BUILDING.floors[room.floorIndex].y + room.ceiling;
      hiding.push(this.addNode((big.x0 + big.x1) / 2 + 0.7, y, (big.z0 + big.z1) / 2 + 0.4, NORMALS.ceiling, 'ceiling'));
    }
    for (const d of world.props.desks) {
      hiding.push(this.addNode(d.deskX, 4, d.deskZ, NORMALS.floor, 'desk'));
    }
    for (const node of hiding) this.linkHidingSpot(node);
    for (const node of this.nodes) this.measureClearance(node);
    return this;
  }

  // Add a spot after building (e.g. the jammed elevator) and link it in.
  addHidingSpot(x, y, z, kind) {
    const node = this.addNode(x, y, z, NORMALS.floor, kind);
    this.linkHidingSpot(node);
    this.measureClearance(node);
    return node;
  }

  // How far the goob here can spread along its surface before hitting a wall,
  // door or furniture. Blobs are drawn no bigger than this, so they never
  // poke through to the other side of a wall.
  measureClearance(node) {
    const n = node.normal;
    const t1 = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    t1.sub(n.clone().multiplyScalar(t1.dot(n))).normalize();
    const t2 = new THREE.Vector3().crossVectors(n, t1);
    const origin = node.pos.clone().addScaledVector(n, 0.08);
    const reach = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dir = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
      reach.push({ i, dir, dist: this.collision.raycast(origin, dir, 1.6, this.people, origin) });
    }
    node.clearance = Math.min(...reach.map((r) => r.dist));
    // The two roomiest directions that aren't next to each other, for the
    // smaller lumps of goob to spread toward.
    const byRoom = [...reach].sort((a, b) => b.dist - a.dist);
    const first = byRoom[0];
    const second = byRoom.find((r) => Math.min((r.i - first.i + 8) % 8, (first.i - r.i + 8) % 8) >= 2) ?? byRoom[1];
    node.openDirs = [first, second];
  }

  // Grid points inside furniture or under the stairs are skipped.
  blocked(x, y, z) {
    const p = new THREE.Vector3(x, y + 0.3, z);
    if (this.collision.pointInside(p, this.passable)) return true;
    return this.collision.ramps.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ && r.heightAt(z) > y + 0.3);
  }

  linkFloors(nodes) {
    // Spatial hash so each spot only checks its neighbors.
    const cell = (v) => Math.floor(v / LINK);
    const grid = new Map();
    for (const n of nodes) {
      const key = `${cell(n.pos.x)},${cell(n.pos.z)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(n);
    }
    for (const a of nodes) {
      const cx = cell(a.pos.x);
      const cz = cell(a.pos.z);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          for (const b of grid.get(`${cx + i},${cz + j}`) ?? []) {
            if (b.id <= a.id || a.pos.distanceTo(b.pos) > LINK || Math.abs(a.pos.y - b.pos.y) > 1.2) continue;
            if (this.canSee(a, b)) this.link(a, b);
          }
        }
      }
    }
  }

  linkHidingSpot(node) {
    const candidates = this.nodes
      .filter((n) => n.kind === 'floor' && n !== node && Math.abs(n.pos.y - node.pos.y) < 3.5 && n.pos.distanceTo(node.pos) < HIDE_LINK)
      .sort((a, b) => a.pos.distanceTo(node.pos) - b.pos.distanceTo(node.pos));
    let linked = 0;
    for (const c of candidates) {
      if (linked >= HIDE_LINKS) break;
      if (this.canSee(node, c)) {
        this.link(node, c);
        linked++;
      }
    }
  }

  // Clear line between two spots (lifted off their surfaces). Colliders that
  // contain either end (a desk over an under-desk spot) don't count.
  canSee(a, b) {
    const pa = a.pos.clone().addScaledVector(a.normal, 0.25);
    const pb = b.pos.clone().addScaledVector(b.normal, 0.25);
    const mid = pa.clone().lerp(pb, 0.5);
    return this.clearLine(pa, mid) && this.clearLine(pb, mid);
  }

  clearLine(from, to, ignore = this.passable) {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 1e-4) return true;
    dir.divideScalar(dist);
    return this.collision.raycast(from, dir, dist, ignore, from) >= dist;
  }

  // Link two spots, remembering any doors between them.
  link(a, b) {
    if (a.links.includes(b)) return;
    a.links.push(b);
    b.links.push(a);
    const pa = a.pos.clone().addScaledVector(a.normal, 0.25);
    const pb = b.pos.clone().addScaledVector(b.normal, 0.25);
    const doors = this.doors.filter((d) => this.collision.segmentHits(d, pa, pb));
    if (doors.length) {
      a.doorsTo.set(b, doors);
      b.doorsTo.set(a, doors);
    }
  }

  nodesNear(point, radius) {
    return this.nodes.filter((n) => n.pos.distanceTo(point) <= radius);
  }
}

// Evenly spaced values from a to b, about SPACING apart (at least one).
function spread(a, b) {
  if (b <= a) return [(a + b) / 2];
  const count = Math.max(1, Math.round((b - a) / SPACING) + 1);
  if (count === 1) return [(a + b) / 2];
  return Array.from({ length: count }, (_, i) => a + (b - a) * (i / (count - 1)));
}
