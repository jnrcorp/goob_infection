import * as THREE from 'three';
import { sfx } from '../core/sound.js';

// The slow-motion spill, seen in first person:
//   you turn toward the freezer door holding the canister; it slips; time
//   slows while it falls; it smashes and goob splatters the freezer; globs fly
//   out the door and hit Hank, who turns. Then time speeds back up.
// Times below are real seconds from the start.
const SLIP_AT = 1.3;
const FALL_TIME = 2.0;       // real seconds (slowed down)
const FLIGHT_TIME = 1.5;     // globs flying out of the freezer
const SPEED_UP_AT = 2.4;     // after impact
const DONE_AT = 3.6;         // after impact
const SLOW = 0.2;            // time scale while slowed
const GRAVITY = 9.8;

export class Spill {
  constructor({ scene, materials, player, camera, viewmodel, goob, fx, hud, world, cast }) {
    Object.assign(this, { scene, materials, player, camera, viewmodel, goob, fx, hud, world, cast });
    this.running = false;
    this.timeScale = 1;
    this.debris = new THREE.Group();
    scene.add(this.debris);
  }

  reset() {
    this.running = false;
    this.timeScale = 1;
    this.debris.clear();
  }

  start(onDone) {
    this.reset();
    this.running = true;
    this.onDone = onDone;
    this.t = 0;
    this.impactAt = null;
    this.falling = null;
    this.shards = [];
    this.globs = [];

    this.world.setCanisterVisible(false);
    this.viewmodel.canister.visible = true;
    const door = this.world.doorByLabel('freezer door');
    if (!door.isOpen) door.setOpen(-1);

    // Hank is waiting just outside the freezer door, watching.
    this.hank = this.cast.all.find((n) => n.name === 'Hank');
    this.hank.path = null;
    this.hank.pos.set(29.3, 0, 20.8);
    this.hank.yaw = Math.PI / 2;

    this.player.lookTarget = new THREE.Vector3(29.5, 1.3, 20.6);
  }

  update(dt) {
    if (!this.running) return;
    this.t += dt;
    const scaledDt = dt * this.timeScale;

    if (!this.falling && this.t >= SLIP_AT) this.slip();
    if (this.falling && this.impactAt === null) this.updateFall();
    if (this.impactAt !== null) {
      const since = this.t - this.impactAt;
      if (since > 0.5 && this.player.lookTarget !== this.hankHead) this.player.lookTarget = this.hankHead;
      if (since > SPEED_UP_AT) this.timeScale = Math.min(1, this.timeScale + dt * 1.5);
      this.updateGlobs();
      if (since > DONE_AT) this.finish();
    }
    this.updateShards(scaledDt);
  }

  slip() {
    this.timeScale = SLOW;
    this.viewmodel.canister.visible = false;
    this.hud.toast('HANK: Careful with th—', 2.5);

    // A world copy of the canister (without the gloves) takes over from the held one.
    const canister = this.viewmodel.canister.clone();
    canister.children.splice(4);
    this.debris.add(canister);

    this.camera.updateMatrixWorld();
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    const flat = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    const start = this.camera.position.clone().addScaledVector(forward, 0.6);
    start.y -= 0.35;
    const end = this.player.pos.clone().addScaledVector(flat, 0.8);
    end.y = this.player.pos.y + 0.12;
    canister.position.copy(start);
    this.falling = { canister, start, end, spin: new THREE.Vector3(2.5, 0.6, 1.2) };
    this.player.lookTarget = canister.position;
  }

  updateFall() {
    const f = this.falling;
    const u = Math.min(1, (this.t - SLIP_AT) / FALL_TIME);
    // Tips forward off the gloves, then drops.
    f.canister.position.lerpVectors(f.start, f.end, u * u);
    f.canister.position.y += Math.sin(u * Math.PI) * 0.12;
    f.canister.rotation.set(f.spin.x * u, f.spin.y * u, f.spin.z * u);
    if (u >= 1) this.impact(f.end);
  }

  impact(point) {
    this.impactAt = this.t;
    this.falling.canister.visible = false;
    this.player.lookTarget = point.clone().setY(point.y + 0.2);
    this.player.shakeFor(1.2);
    this.fx.flash('#6cff4a', 0.8);
    sfx.smash();

    // Glass and steel shards.
    const glass = this.materials.get('glass');
    const steel = this.materials.get('steel');
    for (let i = 0; i < 18; i++) {
      const size = 0.03 + Math.random() * 0.05;
      const m = new THREE.Mesh(new THREE.BoxGeometry(size, 0.01 + Math.random() * 0.02, size * 1.6), i < 14 ? glass : steel);
      m.position.copy(point);
      this.debris.add(m);
      const a = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      this.shards.push({ mesh: m, vel: new THREE.Vector3(Math.cos(a) * speed, 1.5 + Math.random() * 2.5, Math.sin(a) * speed), floor: this.player.pos.y });
    }

    // Goob splatters the freezer.
    this.goob.splat(point, 2.6, 3.2, 9);

    // Globs fly out the open door: one hits Hank, the rest land in the dock.
    this.hankHead = new THREE.Vector3(this.hank.pos.x, 1.5, this.hank.pos.z);
    const targets = [
      { pos: this.hankHead.clone(), hitsHank: true },
      { pos: new THREE.Vector3(28.2, 0, 19.2) },
      { pos: new THREE.Vector3(27.4, 0, 21.9) },
      { pos: new THREE.Vector3(29.8, 0, 17.6) },
    ];
    const gm = this.materials.get('goob');
    for (const [i, target] of targets.entries()) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), gm);
      const from = point.clone().setY(point.y + 0.3);
      const via = from.clone().lerp(target.pos, 0.5);
      via.y += 1.2 + i * 0.2;
      mesh.position.copy(from);
      this.debris.add(mesh);
      this.globs.push({ mesh, from, via, to: target.pos, hitsHank: target.hitsHank, delay: 0.15 * i, landed: false });
    }
  }

  updateGlobs() {
    const since = this.t - this.impactAt;
    for (const g of this.globs) {
      if (g.landed) continue;
      const u = Math.max(0, Math.min(1, (since - g.delay) / FLIGHT_TIME));
      // Quadratic Bezier arc.
      const a = g.from.clone().lerp(g.via, u);
      const b = g.via.clone().lerp(g.to, u);
      g.mesh.position.copy(a.lerp(b, u));
      if (u < 1) continue;
      g.landed = true;
      g.mesh.visible = false;
      sfx.squelch(g.to);
      if (g.hitsHank) {
        this.hank.infect();
        sfx.moan(this.hank.pos, 0.9);
        this.goob.splat(new THREE.Vector3(this.hank.pos.x, 0, this.hank.pos.z), 1.2, 1.5, 1);
      } else {
        this.goob.splat(g.to, 1.4, 2.5, 2);
      }
    }
  }

  updateShards(dt) {
    for (const s of this.shards) {
      if (!s.vel) continue;
      s.vel.y -= GRAVITY * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += dt * 9;
      s.mesh.rotation.z += dt * 6;
      if (s.mesh.position.y <= s.floor + 0.015) {
        s.mesh.position.y = s.floor + 0.015;
        s.mesh.rotation.set(0, s.mesh.rotation.y, 0);
        s.vel = null; // settled on the floor
      }
    }
  }

  finish() {
    this.running = false;
    this.timeScale = 1;
    for (const s of this.shards) {
      if (s.vel) {
        s.mesh.position.y = s.floor + 0.015;
        s.vel = null;
      }
    }
    this.player.lookTarget = null;
    this.onDone?.();
  }
}
