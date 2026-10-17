import * as THREE from 'three';
import { Person } from '../npc/person.js';
import { createGoobMaterial } from '../goob/goobMaterial.js';
import { sfx } from '../core/sound.js';

// The final fight on the roof: Victoria in a goob-powered executive suit.
// She keeps her distance, circling, and lobs globs of goob at you. A vacuum
// blast (right mouse) knocks her off balance for a few seconds; while she's
// stunned, the antidote (F) eats through a layer of her goob armor. Three
// layers and she's done.
//
// The same fight, bigger, ends the chapter on the launch site's gantry (see
// launch.js): opts give it its own arena, tuning and a slam attack (she rears
// up when you're close, then hits the deck: get clear, or blast her first).

const BOSS = {
  scale: 1.3,
  speed: 2.2,            // m/s circling
  keepAway: 7,           // meters she likes to stay from you
  throwEvery: [2.2, 1.9, 1.6, 1.35, 1.15], // seconds between globs, by layers lost
  spreadFrom: 2,         // layers lost before she throws three at once
  dashRange: 3.6,        // closer than this and she dashes away
  dashSpeed: 7,
  dashCooldown: 2.5,
  globSpeed: 9,
  gravity: 4,
  hitRadius: 0.75,
  stunned: 2.8,          // seconds after a blast
  armor: 5,
  slam: false,           // the gantry fight: a ground slam when you're close (instead of dashing away)
  slamRange: 4.2,        // closer than this and she winds up
  slamRadius: 5.5,       // how far the shockwave rolls
  slamWindup: 1.0,
  slamCooldown: 4.5,
  slamDamage: 14,
};
const ROOF = { x0: 1, z0: 1, x1: 23, z1: 23, y: 12 };
// Places she can't stand: the launch pad, the elevator headhouse, AC units.
const BLOCKED = [
  { x: 7, z: 9, r: 4.2 },
  { x0: 14.4, z0: 12.4, x1: 18.6, z1: 16.6 },
  { x0: 19.2, z0: 2.9, x1: 21.8, z1: 8.6 },
  { x0: 1.7, z0: 18.9, x1: 8.3, z1: 21.6 },
  { x0: 21.2, z0: 21.2, x1: 22.2, z1: 22.2 },
];

export class GoobExec {
  // opts: { arena: { x0, z0, x1, z1, y }, blocked: [rects or circles], tuning: overrides for BOSS }
  constructor(scene, look, opts = {}) {
    this.scene = scene;
    this.tuning = { ...BOSS, ...opts.tuning };
    this.arena = opts.arena ?? ROOF;
    this.blockers = opts.blocked ?? BLOCKED;
    this.person = new Person({ ...look, seed: 'Victoria' });
    this.person.root.scale.setScalar(this.tuning.scale);
    this.person.setInfected(true); // green skin, glowing eyes, wet goob
    this.root = this.person.root;
    scene.add(this.root);
    // Armor: three big goob plates (chest, back, shoulders).
    const mat = createGoobMaterial({ amplitude: 0.03 });
    this.plates = [
      [0, 1.25, 0.16, 0.24, 0.3, 0.12],
      [0, 1.25, -0.16, 0.24, 0.3, 0.12],
      [0, 1.48, 0, 0.42, 0.12, 0.2],
    ].map(([x, y, z, sx, sy, sz]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      this.root.add(m);
      return m;
    });
    this.globMaterial = createGoobMaterial({ amplitude: 0.04 });
    this.globs = [];
    // The slam's shockwave: a flat ring of goob rolling over the deck.
    this.wave = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 48), new THREE.MeshBasicMaterial({
      color: 0x6cff4a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.wave.rotation.x = -Math.PI / 2;
    this.wave.visible = false;
    scene.add(this.wave);
    this.waveT = -1;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    // For the vacuum's blast (Vacuum.blow): it stuns anything with a brain.
    this.brain = { stun: (dir) => this.stun(dir), state: 'boss' };
    this.name = 'Victoria';
    this.active = false;
    this.root.visible = false;
  }

  // The antidote only works on her while she's stunned (Antidote.update
  // sprays anything that's "infected").
  get infected() {
    return this.active && this.stunnedFor > 0;
  }

  start(x, z) {
    this.active = true;
    this.root.visible = true;
    this.pos.set(x, this.arena.y, z);
    this.armor = this.tuning.armor;
    for (const p of this.plates) p.visible = true;
    this.stunnedFor = 0;
    this.dashFor = 0;
    this.dashCooldown = 0;
    this.throwIn = 2.5;
    this.dir = 1;
    this.turnIn = 4;
    this.windup = 0;
    this.slamCooldown = 2;
    this.person.root.scale.setScalar(this.tuning.scale);
    this.clearGlobs();
    this.sync();
  }

  stop() {
    this.active = false;
    this.root.visible = false;
    this.clearGlobs();
  }

  clearGlobs() {
    for (const g of this.globs) this.scene.remove(g.mesh);
    this.globs = [];
    this.wave.visible = false;
    this.waveT = -1;
  }

  stun(dir) {
    if (!this.active || this.stunnedFor > 0) return;
    this.stunnedFor = this.tuning.stunned;
    this.windup = 0; // (a blast interrupts a slam)
    this.knock = new THREE.Vector3(dir?.x ?? 0, 0, dir?.z ?? 0).multiplyScalar(4);
    this.person.action = 'stunned';
    sfx.hurt();
  }

  // A layer of armor gone (the antidote got through). Returns true when
  // she's beaten.
  hit() {
    this.armor -= 1;
    // The three plates come off evenly as the layers go (at 4, 2 and 0 of five).
    const per = this.tuning.armor / this.plates.length;
    this.plates.forEach((p, i) => { p.visible = this.armor > i * per; });
    this.stunnedFor = Math.min(this.stunnedFor, 0.6);
    sfx.squelch(this.pos);
    return this.armor <= 0;
  }

  blocked(x, z) {
    const a = this.arena;
    if (x < a.x0 || x > a.x1 || z < a.z0 || z > a.z1) return true;
    return this.blockers.some((b) => (b.r ? Math.hypot(x - b.x, z - b.z) < b.r : x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1));
  }

  // Each frame. onHit(amount?): a glob (or the slam) hit the player.
  update(dt, player, onHit) {
    if (!this.active) return;
    const T = this.tuning;
    const y = this.arena.y;
    const toPlayer = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = toPlayer.length() || 1;
    toPlayer.divideScalar(dist);
    this.updateWave(dt, player, onHit);

    if (this.stunnedFor > 0) {
      this.stunnedFor -= dt;
      if (this.knock) {
        const nx = this.pos.x + this.knock.x * dt;
        const nz = this.pos.z + this.knock.z * dt;
        if (!this.blocked(nx, nz)) this.pos.set(nx, y, nz);
        this.knock.multiplyScalar(Math.exp(-4 * dt));
      }
      if (this.stunnedFor <= 0) this.person.action = null;
      this.person.pose = 'stand';
    } else if (this.windup > 0) {
      // Rearing up for a slam: she stands still and swells (a chance to blast her).
      this.windup -= dt;
      this.person.pose = 'stand';
      this.root.scale.setScalar(T.scale * (1 + 0.14 * (1 - this.windup / T.slamWindup)));
      if (this.windup <= 0) this.slam();
    } else {
      // Close: on the gantry she rears up for a slam; on the roof she dashes
      // away (diagonally, so she doesn't back into a wall).
      this.slamCooldown -= dt;
      this.dashCooldown -= dt;
      if (T.slam && dist < T.slamRange && this.slamCooldown <= 0) {
        this.windup = T.slamWindup;
        this.slamCooldown = T.slamCooldown;
        sfx.moan(this.pos, 1);
      } else if (!T.slam && dist < T.dashRange && this.dashCooldown <= 0) {
        this.dashFor = 0.45;
        this.dashCooldown = T.dashCooldown;
        this.dashDir = new THREE.Vector3(-toPlayer.x - toPlayer.z * this.dir, 0, -toPlayer.z + toPlayer.x * this.dir).normalize();
        sfx.blast();
      }
      if (this.dashFor > 0) {
        this.dashFor -= dt;
        const nx = this.pos.x + this.dashDir.x * T.dashSpeed * dt;
        const nz = this.pos.z + this.dashDir.z * T.dashSpeed * dt;
        if (!this.blocked(nx, nz)) this.pos.set(nx, y, nz);
        else this.dashFor = 0;
      }
      // Circle around you at her favorite distance, now and then switching direction.
      this.turnIn -= dt;
      if (this.turnIn <= 0) { this.dir *= -1; this.turnIn = 3 + Math.random() * 3; }
      const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(this.dir);
      const want = side.clone().addScaledVector(toPlayer, (dist - T.keepAway) * 0.35);
      if (want.lengthSq() > 1) want.normalize();
      const nx = this.pos.x + want.x * T.speed * dt;
      const nz = this.pos.z + want.z * T.speed * dt;
      if (!this.blocked(nx, nz)) this.pos.set(nx, y, nz);
      else this.dir *= -1;
      this.person.pose = 'walk';
      this.root.scale.setScalar(T.scale);
      // Throw.
      this.throwIn -= dt;
      if (this.throwIn <= 0) {
        const lost = T.armor - this.armor;
        this.throwIn = T.throwEvery[lost] ?? 0.85;
        this.throwGlob(player, 0);
        if (lost >= T.spreadFrom) {
          this.throwGlob(player, -1.6);
          this.throwGlob(player, 1.6);
        }
      }
    }
    this.yaw = Math.atan2(toPlayer.x, toPlayer.z);
    this.person.update(dt, T.speed);
    this.sync();
    this.updateGlobs(dt, player, onHit);
  }

  // She hits the deck: a ring of goob rolls out from her.
  slam() {
    this.root.scale.setScalar(this.tuning.scale);
    this.waveT = 0;
    this.waveHit = false;
    this.wave.position.set(this.pos.x, this.arena.y + 0.05, this.pos.z);
    this.wave.visible = true;
    sfx.crash();
    sfx.squelch(this.pos);
  }

  updateWave(dt, player, onHit) {
    if (this.waveT < 0) return;
    const T = this.tuning;
    this.waveT += dt;
    const k = Math.min(1, this.waveT / 0.5);
    const r = 0.6 + k * (T.slamRadius - 0.6);
    this.wave.scale.setScalar(r);
    this.wave.material.opacity = 0.65 * (1 - k * 0.7);
    // Caught as the ring rolls past you.
    const c = this.wave.position;
    const d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
    if (!this.waveHit && Math.abs(player.pos.y - this.arena.y) < 1 && d < r) {
      this.waveHit = true;
      onHit(T.slamDamage);
    }
    if (k >= 1) {
      this.wave.visible = false;
      this.waveT = -1;
    }
  }

  // offset: meters to the side of where she's aiming (for spreads).
  throwGlob(player, offset = 0) {
    const from = new THREE.Vector3(this.pos.x, this.pos.y + 1.45 * this.tuning.scale, this.pos.z);
    // Aim where you'll be (roughly), at chest height.
    const target = new THREE.Vector3(player.pos.x + player.vel.x * 0.5, player.pos.y + 1.1, player.pos.z + player.vel.z * 0.5);
    if (offset) {
      const side = new THREE.Vector3(-(target.z - from.z), 0, target.x - from.x).normalize();
      target.addScaledVector(side, offset);
    }
    const flat = Math.hypot(target.x - from.x, target.z - from.z);
    const t = flat / this.tuning.globSpeed;
    const vel = new THREE.Vector3((target.x - from.x) / t, (target.y - from.y) / t + 0.5 * this.tuning.gravity * t, (target.z - from.z) / t);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), this.globMaterial);
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.globs.push({ mesh, vel, life: 4 });
    sfx.lunge(this.pos);
  }

  updateGlobs(dt, player, onHit) {
    for (const g of [...this.globs]) {
      g.vel.y -= this.tuning.gravity * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      g.life -= dt;
      const p = g.mesh.position;
      const dx = p.x - player.pos.x;
      const dz = p.z - player.pos.z;
      const dy = p.y - (player.pos.y + 1.1);
      const hit = Math.hypot(dx, dy, dz) < this.tuning.hitRadius;
      if (hit) onHit();
      if (hit || g.life <= 0 || p.y < this.arena.y) {
        if (!hit) sfx.squelch(p);
        this.scene.remove(g.mesh);
        this.globs.splice(this.globs.indexOf(g), 1);
      }
    }
  }

  sync() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
}
