import * as THREE from 'three';

const RADIUS = 0.3;
const HEIGHT = 1.75;
const EYE = 1.6;
const STEP = 0.4;      // highest ledge you walk up without jumping
const SNAP = 0.45;     // how far you stick to the ground going down stairs/ramps
const GRAVITY = 20;
const JUMP = 5.2;
const WALK = 3.4;
const RUN = 5.6;
const FLY = 8;
const LOOK = 0.0022;
const SKIN = 0.001;

// First-person player: a vertical box (radius x height) moved against the
// collision world one axis at a time.
export class Player {
  constructor(camera, collision) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.collision = collision;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = false;
    this.noclip = false;
    this.bob = 0;
    this.spawnPoint = null;
    this.suited = false;
    this.suit = 100; // hazard suit integrity, percent
    this.shake = 0;
    // When set ({ x, y, z }), the camera turns smoothly to look at this point.
    this.lookTarget = null;
  }

  get eyeY() {
    return this.pos.y + EYE;
  }

  spawn({ x, y, z, yaw = 0 }) {
    this.spawnPoint = { x, y, z, yaw };
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.updateCamera();
  }

  update(dt, input, active) {
    if (this.lookTarget) {
      this.turnTowards(this.lookTarget, dt);
    } else if (active) {
      this.yaw -= input.mouseDX * LOOK;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - input.mouseDY * LOOK));
    }
    const axis = (pos, neg) => (active ? (input.down(pos) ? 1 : 0) - (input.down(neg) ? 1 : 0) : 0);
    const forward = axis('KeyW', 'KeyS');
    const strafe = axis('KeyD', 'KeyA');
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    if (this.noclip) {
      const cp = Math.cos(this.pitch);
      const sp = Math.sin(this.pitch);
      const up = axis('Space', 'KeyC');
      this.pos.x += (-sin * cp * forward + cos * strafe) * FLY * dt;
      this.pos.z += (-cos * cp * forward - sin * strafe) * FLY * dt;
      this.pos.y += (sp * forward + up) * FLY * dt;
      this.vel.set(0, 0, 0);
      this.updateCamera(dt);
      return;
    }

    let wx = -sin * forward + cos * strafe;
    let wz = -cos * forward - sin * strafe;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = running ? RUN : WALK;
    const k = 1 - Math.exp(-(this.grounded ? 14 : 3) * dt);
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;

    const dx = this.vel.x * dt;
    const dz = this.vel.z * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.15));
    for (let i = 0; i < steps; i++) {
      this.moveAxis('x', dx / steps);
      this.moveAxis('z', dz / steps);
    }

    if (active && input.wasPressed('Space') && this.grounded) {
      this.vel.y = JUMP;
      this.grounded = false;
    }
    this.moveVertical(dt);
    if (this.pos.y < -20) this.spawn(this.spawnPoint);

    const horizontal = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && horizontal > 0.5) this.bob += dt * horizontal * 2.2;
    this.updateCamera(dt);
  }

  turnTowards(t, dt) {
    const dx = t.x - this.pos.x;
    const dz = t.z - this.pos.z;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(t.y - this.eyeY, Math.hypot(dx, dz));
    const k = 1 - Math.exp(-6 * dt);
    this.yaw += Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw)) * k;
    this.pitch += (pitch - this.pitch) * k;
  }

  overlapsXZ(b, r = RADIUS) {
    const p = this.pos;
    return p.x + r > b.minX && p.x - r < b.maxX && p.z + r > b.minZ && p.z - r < b.maxZ;
  }

  moveAxis(axis, d) {
    if (!d) return;
    const p = this.pos;
    p[axis] += d;
    for (const b of this.collision.boxes) {
      if (!b.enabled || !this.overlapsXZ(b)) continue;
      // Low enough to step onto, or entirely overhead: not a wall.
      if (b.maxY <= p.y + STEP || b.minY >= p.y + HEIGHT) continue;
      // Were we already inside this box before moving (a door or elevator
      // closed on us)? Then escape by the shortest way out, never through it.
      p[axis] -= d;
      const wasInside = this.overlapsXZ(b);
      p[axis] += d;
      if (wasInside) this.escape(b);
      else if (axis === 'x') p.x = d > 0 ? b.minX - RADIUS - SKIN : b.maxX + RADIUS + SKIN;
      else p.z = d > 0 ? b.minZ - RADIUS - SKIN : b.maxZ + RADIUS + SKIN;
    }
    for (const r of this.collision.ramps) {
      if (p.x < r.minX || p.x > r.maxX || p.z < r.minZ || p.z > r.maxZ) continue;
      if (r.heightAt(p.z) > p.y + STEP) {
        p[axis] -= d;
        break;
      }
    }
  }

  // Push out of box b along whichever side needs the smallest move.
  escape(b) {
    const p = this.pos;
    const options = [
      ['x', b.minX - RADIUS - SKIN], ['x', b.maxX + RADIUS + SKIN],
      ['z', b.minZ - RADIUS - SKIN], ['z', b.maxZ + RADIUS + SKIN],
    ];
    let best = options[0];
    for (const o of options) if (Math.abs(o[1] - p[o[0]]) < Math.abs(best[1] - p[best[0]])) best = o;
    p[best[0]] = best[1];
  }

  groundHeight() {
    const p = this.pos;
    let best = -Infinity;
    for (const b of this.collision.boxes) {
      if (b.enabled && b.maxY <= p.y + STEP && b.maxY > best && this.overlapsXZ(b, RADIUS * 0.8)) best = b.maxY;
    }
    for (const r of this.collision.ramps) {
      if (p.x < r.minX || p.x > r.maxX || p.z < r.minZ || p.z > r.maxZ) continue;
      const h = r.heightAt(p.z);
      if (h <= p.y + STEP && h > best) best = h;
    }
    return best;
  }

  moveVertical(dt) {
    const p = this.pos;
    const ground = this.groundHeight();
    this.vel.y -= GRAVITY * dt;
    let y = p.y + this.vel.y * dt;

    if (this.vel.y <= 0 && y <= ground) {
      y = ground;
      this.vel.y = 0;
      this.grounded = true;
    } else if (this.grounded && this.vel.y <= 0 && p.y - ground <= SNAP) {
      y = ground;
      this.vel.y = 0;
    } else {
      this.grounded = false;
    }

    if (this.vel.y > 0) {
      for (const b of this.collision.boxes) {
        if (!b.enabled || !this.overlapsXZ(b)) continue;
        if (b.minY >= p.y + HEIGHT - 0.05 && y + HEIGHT > b.minY) {
          y = b.minY - HEIGHT;
          this.vel.y = 0;
        }
      }
    }
    p.y = y;
  }

  // Shoved: horizontal push away from `from` (an attacker's position).
  knockFrom(from, strength) {
    const dx = this.pos.x - from.x;
    const dz = this.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.x += (dx / d) * strength;
    this.vel.z += (dz / d) * strength;
  }

  // Camera shake: seconds remaining; strength fades out with it.
  shakeFor(seconds) {
    this.shake = Math.max(this.shake ?? 0, seconds);
  }

  updateCamera(dt = 0) {
    const bob = this.noclip ? 0 : Math.sin(this.bob * 2) * 0.03;
    this.camera.position.set(this.pos.x, this.pos.y + EYE + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = Math.min(1, this.shake) * 0.05;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.rotation.z = (Math.random() - 0.5) * s;
    }
  }
}
