import * as THREE from 'three';
import { Person } from '../npc/person.js';

// Facility security guards (chapter 2): they walk a patrol route with a
// flashlight, and notice you if you're in their beam for long enough. Being
// closer, standing up or moving fills their suspicion faster; crouching (C)
// halves how far they can see. A vacuum blast knocks them out for a while.

export const GUARD = {
  sight: 10,        // meters they can see you standing
  crouchSight: 5,   // ... and crouching
  cone: 38,         // degrees either side of straight ahead
  walk: 1.15,       // m/s on patrol
  turn: 4,          // turn rate
  notice: 0.3,      // suspicion at which they stop and stare
  fade: 0.35,       // suspicion lost per second out of sight
  knockout: 9,      // seconds out cold after a vacuum blast
};

const EYE = 1.6;
const tmpTo = new THREE.Vector3();
const tmpOrigin = new THREE.Vector3();

export class Guard {
  // route: [{ x, z, wait? }] on the floor at height y (a loop).
  constructor(scene, { name, y, route, look, collision }) {
    this.name = name;
    this.y = y;
    this.route = route;
    this.person = new Person({
      shirt: 0x26324e, pants: 0x161b28, skin: look.skin, hair: look.hair, tie: 0x0d1220,
      shoes: 0x0b0b0b, seed: name, hairStyle: look.hairStyle ?? 'buzz',
    });
    scene.add(this.person.root);
    this.pos = new THREE.Vector3();
    // A body you can't walk through (the player isn't shoved out of it).
    this.collider = collision.addBox(0, 0, 0, 0, 0, 0);
    this.collider.person = true;

    // Flashlight beam: a faint cone reaching out from chest height.
    const length = GUARD.sight;
    const radius = Math.tan(THREE.MathUtils.degToRad(GUARD.cone)) * length * 0.32;
    const cone = new THREE.ConeGeometry(radius, length, 24, 1, true);
    cone.translate(0, -length / 2, 0);
    cone.rotateX(-Math.PI / 2); // apex at the origin, opening toward +z (the way the model faces)
    this.beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.beam = new THREE.Mesh(cone, this.beamMaterial);
    this.beam.position.set(0.18, 1.25, 0.25);
    this.person.root.add(this.beam);

    // For the vacuum's blast (see Vacuum.blow): it stuns anything with a brain.
    this.brain = { stun: () => this.knockOut(), state: 'patrol' };
    this.reset();
  }

  reset() {
    const start = this.route[0];
    this.pos.set(start.x, this.y, start.z);
    this.next = 1 % this.route.length;
    this.wait = start.wait ?? 0;
    this.yaw = this.headingTo(this.route[this.next]);
    this.suspicion = 0;
    this.out = 0;
    this.brain.state = 'patrol';
    this.person.action = null;
    this.setVisible(true);
    this.sync();
  }

  setVisible(on) {
    this.person.root.visible = on;
    this.active = on;
    this.collider.enabled = on;
  }

  headingTo(p) {
    return Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
  }

  knockOut() {
    if (!this.active) return;
    this.out = GUARD.knockout;
    this.suspicion = 0;
    this.brain.state = 'stunned';
    this.person.action = 'stunned';
  }

  // Can they see the player right now? Returns how fast suspicion builds
  // (0 = not seen).
  sees(player, collision, ignore) {
    const eyeY = this.pos.y + EYE;
    if (Math.abs(player.pos.y - this.pos.y) > 2) return 0;
    tmpOrigin.set(this.pos.x, eyeY, this.pos.z);
    tmpTo.set(player.pos.x, player.eyeY - 0.2, player.pos.z).sub(tmpOrigin);
    const dist = tmpTo.length();
    const range = player.crouching ? GUARD.crouchSight : GUARD.sight;
    if (dist > range || dist < 0.01) return 0;
    const flat = Math.hypot(tmpTo.x, tmpTo.z);
    const facing = (Math.sin(this.yaw) * tmpTo.x + Math.cos(this.yaw) * tmpTo.z) / Math.max(flat, 1e-4);
    if (facing < Math.cos(THREE.MathUtils.degToRad(GUARD.cone)) && dist > 1.2) return 0;
    tmpTo.divideScalar(dist);
    if (collision.raycast(tmpOrigin, tmpTo, dist - 0.3, ignore) < dist - 0.3) return 0;
    // Closer is faster; moving makes you easier to spot.
    const moving = Math.hypot(player.vel.x, player.vel.z) > 0.5 ? 1.4 : 1;
    return moving * (1.6 / (0.6 + dist * 0.35));
  }

  update(dt, player, collision, ignore) {
    if (!this.active) return 0;
    if (this.out > 0) {
      this.out -= dt;
      if (this.out <= 0) {
        this.brain.state = 'patrol';
        this.person.action = null;
      }
      this.beam.visible = false;
      this.person.update(dt, 0);
      this.sync();
      return 0;
    }
    this.beam.visible = true;
    // The beam stops at the first wall in front (instead of shining
    // through into the next room).
    tmpOrigin.set(this.pos.x, this.pos.y + 1.25, this.pos.z);
    tmpTo.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const reach = collision.raycast(tmpOrigin, tmpTo, GUARD.sight, ignore);
    this.beam.scale.setScalar(Math.max(0.15, reach / GUARD.sight));

    const rate = this.sees(player, collision, ignore);
    if (rate > 0) this.suspicion = Math.min(1, this.suspicion + rate * dt);
    else this.suspicion = Math.max(0, this.suspicion - GUARD.fade * dt);

    let moving = false;
    if (this.suspicion >= GUARD.notice && rate > 0) {
      // Stop and stare at whatever that was.
      this.turnTowards(this.headingTo(player.pos), dt);
    } else if (this.suspicion < GUARD.notice) {
      if (this.wait > 0) {
        this.wait -= dt;
        this.yaw += Math.sin(performance.now() * 0.0008) * dt * 0.6; // looking around
      } else {
        const target = this.route[this.next];
        const dx = target.x - this.pos.x;
        const dz = target.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.1) {
          this.wait = target.wait ?? 0;
          this.next = (this.next + 1) % this.route.length;
        } else {
          this.turnTowards(Math.atan2(dx, dz), dt);
          const step = Math.min(dist, GUARD.walk * dt);
          this.pos.x += (dx / dist) * step;
          this.pos.z += (dz / dist) * step;
          moving = true;
        }
      }
    }
    // The beam warms from pale yellow to red as they get suspicious.
    this.beamMaterial.color.setRGB(1, 0.95 - this.suspicion * 0.75, 0.69 - this.suspicion * 0.6);
    this.beamMaterial.opacity = 0.06 + this.suspicion * 0.08;
    this.person.pose = moving ? 'walk' : 'stand';
    this.person.update(dt, GUARD.walk);
    this.sync();
    return this.suspicion;
  }

  turnTowards(yaw, dt) {
    const d = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    this.yaw += d * Math.min(1, GUARD.turn * dt);
  }

  sync() {
    this.person.root.position.copy(this.pos);
    this.person.root.rotation.y = this.yaw;
    const c = this.collider;
    c.minX = this.pos.x - 0.25; c.maxX = this.pos.x + 0.25;
    c.minZ = this.pos.z - 0.25; c.maxZ = this.pos.z + 0.25;
    c.minY = this.pos.y; c.maxY = this.pos.y + 1.75;
  }
}
