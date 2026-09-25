import * as THREE from 'three';
import { Person } from './person.js';
import { InfectedBrain, INFECTED } from './infectedBrain.js';

const WALK_SPEED = 1.3;
const TURN_RATE = 6;
const STEP = 0.45;
const RADIUS = 0.25;
const HEIGHT = 1.75;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// A coworker: a Person plus simple behavior (sit, stand, patrol a route,
// or walk a one-off path), a collider, and a "Talk to" interaction.
// def: { name, look, x, y, z, yaw, mode: 'stand'|'sit'|'type'|'route', route?, lines? }
export class NPC {
  constructor(ctx, def) {
    const { scene, collision, interactions } = ctx;
    this.def = def;
    this.name = def.name;
    this.collision = collision;
    this.person = new Person(def.look);
    scene.add(this.person.root);
    this.pos = new THREE.Vector3();
    this.home = new THREE.Vector3();
    this.collider = collision.addBox(0, 0, 0, 0, 0, 0);
    this.onTalk = null;
    this.talkable = true;

    interactions.add({
      mesh: this.person.meshes,
      ignore: [this.collider],
      label: () => `Talk to ${this.name}`,
      enabled: () => this.talkable && !this.path && !!this.onTalk,
      use: () => this.onTalk(this),
    });
    this.reset();
  }

  reset() {
    const d = this.def;
    this.pos.set(d.x, d.y, d.z);
    this.yaw = d.yaw ?? 0;
    this.mode = d.mode ?? 'stand';
    this.lines = [...(d.lines ?? [])];
    this.lineIndex = 0;
    this.routeIndex = 0;
    this.pause = 0;
    this.path = null;
    this.onArrive = null;
    this.talking = false;
    this.talkable = true;
    this.speed = WALK_SPEED;
    this.brain = null;
    this.person.action = null;
    this.person.setInfected(false);
  }

  // Shared world info for infected behavior (set once by the cast).
  // { player, nav, collision, moveIgnore, sightIgnore, isHostile, isNoisy, onHit, attackers,
  //   canOpenDoors, openDoorsNear }
  setEnv(env) {
    this.env = env;
  }

  // Turned by the goob: stops talking, and from now on the infected brain
  // decides what to do (dazed at first, then hunting the player).
  infect() {
    this.mode = 'infected';
    this.path = null;
    this.onArrive = null;
    this.talking = false;
    this.talkable = false;
    this.speed = INFECTED.wanderSpeed;
    this.home.copy(this.pos);
    this.pause = Math.random() * 2;
    this.person.setInfected(true);
    this.brain = new InfectedBrain(this, this.env);
  }

  // Walk with collision against the building and doors (not other people),
  // and follow the floor up and down steps and stairs.
  move(dx, dz) {
    const p = this.pos;
    const ignore = this.env.moveIgnore;
    const overlaps = (b) => p.x + RADIUS > b.minX && p.x - RADIUS < b.maxX && p.z + RADIUS > b.minZ && p.z - RADIUS < b.maxZ;
    for (const [axis, d] of [['x', dx], ['z', dz]]) {
      if (!d) continue;
      p[axis] += d;
      for (const b of this.collision.boxes) {
        if (!b.enabled || ignore.has(b) || !overlaps(b)) continue;
        if (b.maxY <= p.y + STEP || b.minY >= p.y + HEIGHT) continue;
        // Already inside before this step (a door shut on them): out the
        // shortest way, never through to the far side.
        p[axis] -= d;
        const wasInside = overlaps(b);
        p[axis] += d;
        if (wasInside) this.escape(b);
        else if (axis === 'x') p.x = d > 0 ? b.minX - RADIUS - 0.001 : b.maxX + RADIUS + 0.001;
        else p.z = d > 0 ? b.minZ - RADIUS - 0.001 : b.maxZ + RADIUS + 0.001;
      }
    }
    const ground = this.collision.groundAt(p.x, p.z, p.y, 0.15, STEP, ignore);
    if (ground > -Infinity) p.y = ground;
    // Hard difficulty: infected shove doors open as they reach them.
    if (this.infected && this.env.canOpenDoors?.()) this.env.openDoorsNear?.(this);
  }

  escape(b) {
    const p = this.pos;
    const options = [
      ['x', b.minX - RADIUS - 0.001], ['x', b.maxX + RADIUS + 0.001],
      ['z', b.minZ - RADIUS - 0.001], ['z', b.maxZ + RADIUS + 0.001],
    ];
    let best = options[0];
    for (const o of options) if (Math.abs(o[1] - p[o[0]]) < Math.abs(best[1] - p[best[0]])) best = o;
    p[best[0]] = best[1];
  }

  // Infected idle: short strolls around where they were infected.
  stepWander(dt) {
    if (!this.path) {
      this.pause -= dt;
      if (this.pause <= 0) this.wander();
      return false;
    }
    const t = this.path[this.pathIndex];
    const dx = t.x - this.pos.x;
    const dz = t.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      this.arrive(this.path);
      return false;
    }
    const step = Math.min(dist, INFECTED.wanderSpeed * dt);
    this.move((dx / dist) * step, (dz / dist) * step);
    this.turnTowards(Math.atan2(dx, dz), dt);
    return true;
  }

  get infected() {
    return this.mode === 'infected';
  }

  // Pick a nearby spot with a clear straight line to it.
  wander() {
    const a = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.random() * 1.5;
    const target = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
    const from = new THREE.Vector3(this.pos.x, this.pos.y + 0.5, this.pos.z);
    const dir = new THREE.Vector3(target.x - this.pos.x, 0, target.z - this.pos.z);
    const dist = dir.length();
    dir.normalize();
    const clear = this.collision.raycast(from, dir, dist + RADIUS, new Set([this.collider])) >= dist + RADIUS;
    const rest = () => { this.pause = 2 + Math.random() * 4; };
    if (clear) {
      this.pause = 0;
      this.walkPath([target], rest);
    } else {
      rest();
    }
  }

  get seated() {
    return this.mode === 'sit' || this.mode === 'type';
  }

  // Head height, for the player camera to look at.
  get headPoint() {
    return { x: this.pos.x, y: this.pos.y + (this.seated ? 1.25 : 1.6), z: this.pos.z };
  }

  nextLine() {
    if (!this.lines.length) return '...';
    const line = this.lines[this.lineIndex % this.lines.length];
    this.lineIndex++;
    return line;
  }

  // Walk through the points in order, then call onArrive(npc).
  walkPath(points, onArrive = null) {
    this.path = points.map((p) => ({ x: p.x, z: p.z }));
    this.pathIndex = 0;
    this.onArrive = onArrive;
  }

  update(dt, player) {
    let moving = false;
    const targets = this.brain ? null : this.path ?? (this.mode === 'route' ? this.def.route : null);
    if (this.brain) moving = this.brain.update(dt);

    if (targets && !this.talking) {
      if (this.pause > 0) {
        this.pause -= dt;
      } else {
        const index = this.path ? this.pathIndex : this.routeIndex;
        const t = targets[index];
        const dx = t.x - this.pos.x;
        const dz = t.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.05) {
          this.arrive(targets);
        } else if (!this.blockedBy(player, dx, dz)) {
          const step = Math.min(dist, this.speed * dt);
          this.pos.x += (dx / dist) * step;
          this.pos.z += (dz / dist) * step;
          this.turnTowards(Math.atan2(dx, dz), dt);
          moving = true;
        }
      }
    }

    const person = this.person;
    person.headYaw = null;
    if (this.talking) {
      const toPlayer = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      if (this.seated) person.headYaw = Math.max(-1.1, Math.min(1.1, wrapAngle(toPlayer - this.yaw)));
      else this.turnTowards(toPlayer, dt);
    }

    person.pose = moving ? 'walk' : this.seated ? this.mode : 'stand';
    person.talking = this.talking;
    person.root.position.copy(this.pos);
    person.root.rotation.y = this.yaw;
    person.update(dt, this.brain?.state === 'chase' ? INFECTED.chaseSpeed : this.speed);

    const c = this.collider;
    c.minX = this.pos.x - RADIUS; c.maxX = this.pos.x + RADIUS;
    c.minZ = this.pos.z - RADIUS; c.maxZ = this.pos.z + RADIUS;
    c.minY = this.pos.y; c.maxY = this.pos.y + HEIGHT;
  }

  arrive(targets) {
    if (this.path) {
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.path = null;
        const done = this.onArrive;
        this.onArrive = null;
        done?.(this);
      }
    } else {
      this.routeIndex = (this.routeIndex + 1) % targets.length;
      this.pause = 1.5 + Math.random() * 2;
    }
  }

  // Stop rather than walk into the player.
  blockedBy(player, dx, dz) {
    if (Math.abs(player.pos.y - this.pos.y) > 1.5) return false;
    const px = player.pos.x - this.pos.x;
    const pz = player.pos.z - this.pos.z;
    return Math.hypot(px, pz) < 0.85 && px * dx + pz * dz > 0;
  }

  turnTowards(yaw, dt) {
    this.yaw += wrapAngle(yaw - this.yaw) * Math.min(1, TURN_RATE * dt);
  }
}
