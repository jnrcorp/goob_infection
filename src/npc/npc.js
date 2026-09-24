import * as THREE from 'three';
import { Person } from './person.js';

const WALK_SPEED = 1.3;
const TURN_RATE = 6;
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
    this.person = new Person(def.look);
    scene.add(this.person.root);
    this.pos = new THREE.Vector3();
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
    const targets = this.path ?? (this.mode === 'route' ? this.def.route : null);

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
          const step = Math.min(dist, WALK_SPEED * dt);
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
    person.update(dt, WALK_SPEED);

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
