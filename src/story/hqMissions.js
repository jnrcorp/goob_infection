import * as THREE from 'three';
import { Person } from '../npc/person.js';
import { Guard } from './guards.js';
import { createGoobMaterial } from '../goob/goobMaterial.js';
import { VACUUM } from '../player/vacuum.js';
import { difficulty } from '../core/settings.js';
import { sfx } from '../core/sound.js';

// Two more missions in chapter 2's hunt through HQ (see part2.js):
//
//   C2_BLOB      after the cleanup: the restarted vats spat out Batch 8, a
//                goob blob the size of a hatchback, in the B1 goob lab.
//                Vacuum it down (more than one tank's worth: empty it in the
//                hall bin and come back). It lunges and spits; a blast
//                stuns it, and a stunned blob comes up faster.
//   C2_HOSTAGES  after the evidence: her security took hostages, one on each
//                of 1F, 2F and 3F, each with a guard. Untie all three.

// ---------- Batch 8 ----------

const LAB = { x0: 18.9, z0: 13.9, x1: 23.1, z1: 23.1, y: -4 };
const BLOB_START = { x: 21, z: 21.5 };
const BLOB = {
  volume: { easy: 55, normal: 70, hard: 85 }, // liters (the tank holds 45)
  speed: 0.8,          // m/s creeping toward you
  lungeRange: 1.9,
  lungeHit: 2.2,
  windup: 0.6,
  lungeCooldown: 2.4,
  lungeDamage: 8,
  spitEvery: 3.4,
  spitDamage: 5,
  puddleEvery: 8,
  stunned: 3,
  stunnedBonus: 1.8,   // faster to vacuum while it's stunned
  globSpeed: 8,
  gravity: 4,
};

export class Batch8 {
  constructor(part2, scene) {
    this.part2 = part2;
    this.scene = scene;
    this.mat = createGoobMaterial({ amplitude: 0.06 });
    this.body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), this.mat);
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd8ff40).multiplyScalar(1.5) });
    this.eyes = [-1, 1].map((s) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeMat);
      e.position.set(s * 0.28, 0.35, 0.86);
      return e;
    });
    this.root = new THREE.Group();
    this.root.add(this.body, ...this.eyes);
    this.root.visible = false;
    scene.add(this.root);
    this.globMat = createGoobMaterial({ amplitude: 0.04 });
    this.globs = [];
    this.pos = new THREE.Vector3();
    this.active = false;
    this.name = 'Batch 8';
    // For the vacuum's blast (Vacuum.blow): it stuns anything with a brain.
    this.brain = { stun: (dir) => this.stun(dir), state: 'blob' };
  }

  get ch1() {
    return this.part2.ch1;
  }

  // (The antidote does nothing to it: it's not a person.)
  get infected() {
    return false;
  }

  get radius() {
    return 0.45 + 0.013 * this.volume;
  }

  start() {
    const d = difficulty();
    this.harm = !d.infectedAttack ? 0.5 : 1; // (Easy: it hits half as hard)
    this.max = !d.infectedAttack ? BLOB.volume.easy : d.infectedOpenDoors ? BLOB.volume.hard : BLOB.volume.normal;
    this.volume = this.max;
    this.pos.set(BLOB_START.x, LAB.y, BLOB_START.z);
    this.active = true;
    this.root.visible = true;
    this.stunnedFor = 0;
    this.windup = 0;
    this.lungeIn = 1.5;
    this.spitIn = 2.5;
    this.puddleIn = BLOB.puddleEvery;
    this.time = 0;
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
  }

  stun(dir) {
    if (!this.active) return;
    this.stunnedFor = BLOB.stunned;
    this.windup = 0;
    if (dir) {
      this.pos.x += dir.x * 0.6;
      this.pos.z += dir.z * 0.6;
      this.clamp();
    }
    sfx.squelch(this.pos);
  }

  clamp() {
    const r = Math.min(this.radius, 1.6) * 0.7;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, LAB.x0 + r, LAB.x1 - r);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, LAB.z0 + r, LAB.z1 - r);
  }

  // Each frame. Returns true once it's all been vacuumed up.
  update(dt, player, vacuum, camera, collision, damage) {
    if (!this.active) return false;
    this.time += dt;
    const to = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = to.length() || 1;
    to.divideScalar(dist);
    const hurt = (amount) => damage(amount * this.harm);
    const inLab = Math.abs(player.pos.y - LAB.y) < 1.5 && player.pos.x > LAB.x0 - 0.5 && player.pos.z > LAB.z0 - 1.5;

    // Being vacuumed: you're sucking, it's in front of the nozzle and in range.
    if (vacuum.sucking && !vacuum.full) {
      const center = new THREE.Vector3(this.pos.x, this.pos.y + this.radius * 0.8, this.pos.z);
      const dir = center.clone().sub(camera.position);
      const d = dir.length();
      dir.divideScalar(d);
      const forward = camera.getWorldDirection(new THREE.Vector3());
      const reach = VACUUM.range + this.radius;
      // (Up close it fills your view: anywhere roughly ahead counts.)
      const cone = d < this.radius + 1.5 ? 0.35 : Math.cos(THREE.MathUtils.degToRad(VACUUM.coneDegrees + 10));
      if (d < reach && dir.dot(forward) > cone
        && collision.raycastWalls(camera.position, dir, d - this.radius) >= d - this.radius - 0.01) {
        const rate = VACUUM.rate * (this.stunnedFor > 0 ? BLOB.stunnedBonus : 1);
        const amount = Math.min(rate * dt, vacuum.infinite ? Infinity : VACUUM.capacity - vacuum.tank, this.volume);
        this.volume -= amount;
        if (!vacuum.infinite) vacuum.tank += amount;
        if (Math.random() < dt * 4) sfx.squelch(this.pos);
      }
    }
    if (this.volume <= 0.5) {
      this.stop();
      return true;
    }

    if (this.stunnedFor > 0) {
      this.stunnedFor -= dt;
    } else if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        // The lunge lands (if you're still there).
        this.pos.addScaledVector(to, Math.max(0, Math.min(dist - this.radius - 0.5, 1)));
        this.clamp();
        sfx.lunge(this.pos);
        if (dist < BLOB.lungeHit + this.radius * 0.5 && Math.abs(player.pos.y - LAB.y) < 1.5) hurt(BLOB.lungeDamage);
        this.lungeIn = BLOB.lungeCooldown;
      }
    } else if (inLab) {
      // Creep toward you, lunge up close, spit from further off.
      if (dist > this.radius + 0.6) {
        this.pos.addScaledVector(to, BLOB.speed * dt);
        this.clamp();
      }
      this.lungeIn -= dt;
      if (dist < BLOB.lungeRange + this.radius * 0.5 && this.lungeIn <= 0) {
        this.windup = BLOB.windup;
        sfx.moan(this.pos, 0.5);
      }
      this.spitIn -= dt;
      if (this.spitIn <= 0 && dist > 2.2) {
        this.spitIn = BLOB.spitEvery;
        this.spit(player);
      }
      // Bits of it slop off onto the floor.
      this.puddleIn -= dt;
      if (this.puddleIn <= 0) {
        this.puddleIn = BLOB.puddleEvery;
        this.part2.dropGoob(this.pos);
      }
    }
    this.updateGlobs(dt, player, hurt);
    this.sync(dist > 0 ? Math.atan2(to.x, to.z) : 0);
    return false;
  }

  spit(player) {
    const from = new THREE.Vector3(this.pos.x, this.pos.y + this.radius * 1.4, this.pos.z);
    const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.1, player.pos.z);
    const flat = Math.hypot(target.x - from.x, target.z - from.z);
    const t = flat / BLOB.globSpeed;
    const vel = new THREE.Vector3((target.x - from.x) / t, (target.y - from.y) / t + 0.5 * BLOB.gravity * t, (target.z - from.z) / t);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), this.globMat);
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.globs.push({ mesh, vel, life: 3 });
    sfx.lunge(this.pos);
  }

  updateGlobs(dt, player, damage) {
    for (const g of [...this.globs]) {
      g.vel.y -= BLOB.gravity * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      g.life -= dt;
      const p = g.mesh.position;
      const hit = Math.hypot(p.x - player.pos.x, p.y - (player.pos.y + 1.1), p.z - player.pos.z) < 0.7;
      if (hit) damage(BLOB.spitDamage);
      if (hit || g.life <= 0 || p.y < LAB.y) {
        this.scene.remove(g.mesh);
        this.globs.splice(this.globs.indexOf(g), 1);
      }
    }
  }

  sync(yaw = this.root.rotation.y) {
    const r = this.radius;
    const wobble = 1 + Math.sin(this.time * 5) * 0.04;
    const swell = this.windup > 0 ? 1 + 0.25 * (1 - this.windup / BLOB.windup) : 1;
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
    this.body.scale.set(r * wobble * swell, r * 0.8 / wobble * swell, r * wobble * swell);
    this.body.position.y = r * 0.8 * swell;
    for (const e of this.eyes) e.position.set(Math.sign(e.position.x) * r * 0.3, r * 1.2 * swell, r * 0.85 * swell);
  }
}

// ---------- The hostages ----------

const HOSTAGES = [
  {
    name: 'Officer Diaz', officer: 0, x: 3.5, y: 4, z: 21.6, yaw: Math.PI / 2, where: '2F conference room',
    guard: { name: 'Guard Rook', look: { skin: 0xe0ac69, hair: 0x111111 }, route: [{ x: 8.4, z: 20.2, wait: 3 }, { x: 8.4, z: 23.3, wait: 3 }] },
    line: 'Champ! They jumped me on the stairs. Kim’s holding the lobby? Good. I’ll get down there. Watch yourself.',
  },
  {
    name: 'Leon', look: { shirt: 0xc8302a, pants: 0x2d3142, skin: 0x8d5524, hair: 0x111111, hairStyle: 'buzz' }, x: 22.7, y: 8, z: 6.8, yaw: -Math.PI / 2, where: '3F boardroom',
    guard: { name: 'Guard Vex', look: { skin: 0xf1c27d, hair: 0x5a3a1a, hairStyle: 'short' }, route: [{ x: 16, z: 2, wait: 3 }, { x: 16, z: 6.8, wait: 3 }] },
    line: 'I delivered a pizza. ONE pizza. To the boardroom. At 2 a.m. I should have known.',
  },
  {
    name: 'Marguerite', look: { shirt: 0x4f7ea8, pants: 0x3b3b3b, skin: 0xf1c27d, hair: 0xa8a8a8 }, x: 22.4, y: 0, z: 21.5, yaw: Math.PI, where: '1F infirmary',
    guard: { name: 'Guard Lusk', look: { skin: 0x6b4226, hair: 0x111111 }, route: [{ x: 19.4, z: 16.2, wait: 3 }, { x: 22.8, z: 16.2, wait: 3 }] },
    line: 'Thirty years cleaning this building, and they tie me to a chair with my own mop cord. Thank you, dear.',
  },
];

export class Hostages {
  constructor(part2, { scene, interactions, materials, collision }) {
    this.part2 = part2;
    this.collision = collision;
    this.active = false;
    this.list = HOSTAGES.map((h) => {
      const person = h.officer !== undefined ? null : new Person({ ...h.look, seed: h.name });
      if (person) {
        person.root.visible = false;
        scene.add(person.root);
      }
      // A chair, and rope around them.
      const chair = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), materials.get('plastic'));
      seat.position.y = 0.45;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), materials.get('plastic'));
      back.position.set(0, 0.72, -0.23);
      const rope = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 6, 20), new THREE.MeshLambertMaterial({ color: 0xc8a868 }));
      rope.rotation.x = Math.PI / 2;
      rope.position.y = 0.95;
      const pick = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.y = 0.7;
      chair.add(seat, back, rope, pick);
      chair.position.set(h.x, h.y, h.z);
      chair.rotation.y = h.yaw;
      chair.visible = false;
      scene.add(chair);
      const guard = new Guard(scene, { ...h.guard, y: h.y, collision });
      guard.setVisible(false);
      part2.ch2.sightIgnore.add(guard.collider);
      const item = { ...h, person, chair, guard, freed: false };
      interactions.add({
        mesh: [seat, back, rope, pick],
        label: `Untie ${h.name}`,
        enabled: () => this.active && chair.visible && !item.freed && this.part2.state === 'C2_HOSTAGES' && !this.part2.ch1.busy,
        use: () => this.untie(item),
      });
      return item;
    });
  }

  personOf(h) {
    return h.person ?? this.part2.ch2.after.officers[h.officer];
  }

  // Guards the vacuum blast can knock out.
  get targets() {
    return this.active ? this.list.map((h) => h.guard).filter((g) => g.active) : [];
  }

  get left() {
    return this.list.filter((h) => !h.freed);
  }

  // freed: names already untied.
  setup(freed = []) {
    this.active = true;
    for (const h of this.list) {
      h.freed = freed.includes(h.name);
      const p = this.personOf(h);
      h.chair.visible = !h.freed;
      p.root.visible = !h.freed;
      p.root.position.set(h.x, h.y, h.z);
      p.root.rotation.y = h.yaw; // (sitting, facing away from the chair back)
      p.pose = 'sit';
      p.action = null;
      p.update(0.016, 0);
      if (h.freed) h.guard.setVisible(false);
      else h.guard.reset();
    }
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    for (const h of this.list) {
      h.chair.visible = false;
      h.guard.setVisible(false);
      const p = this.personOf(h);
      if (h.person) p.root.visible = false;
      else if (!h.freed) p.root.visible = false;
      p.pose = 'stand';
    }
  }

  async untie(h) {
    const ch1 = this.part2.ch1;
    const token = ch1.token;
    ch1.busy = true;
    sfx.rustle();
    const p = this.personOf(h);
    p.pose = 'stand';
    p.update(0.016, 0);
    await ch1.dialogue.play([{ speaker: h.name, text: h.line }]);
    if (token !== ch1.token) return;
    await ch1.fx.fade(1, 0.35);
    if (token !== ch1.token) return;
    h.freed = true;
    h.chair.visible = false;
    p.root.visible = false;
    h.guard.setVisible(false);
    ch1.busy = false;
    await ch1.fx.fade(0, 0.35);
    this.part2.hostageFreed(h);
  }

  // Returns the guards' highest suspicion.
  update(dt, player, sightIgnore, watching) {
    if (!this.active) return 0;
    let worst = 0;
    for (const h of this.list) {
      const s = h.guard.update(dt, player, this.collision, sightIgnore);
      if (watching) worst = Math.max(worst, s);
    }
    return worst;
  }
}
