import * as THREE from 'three';

// Freezer floor, and where loaded bins line up inside it (along the front wall).
const FREEZER = { x0: 31.3, z0: 17.3, x1: 35.7, z1: 23.7, maxY: 1 };
const SLOTS = [
  { x: 31.9, z: 17.85 }, { x: 32.8, z: 17.85 }, { x: 33.7, z: 17.85 }, { x: 34.6, z: 17.85 },
  { x: 32.35, z: 18.85 }, { x: 34.15, z: 18.85 },
];
const HOLD_DISTANCE = 0.95; // how far in front of you a bin rolls
const BIN_RADIUS = 0.36;

// Wheeling biohazard bins into the secure freezer. Grab a bin (E), it rolls
// along in front of you (slower walk, no vacuuming), Q lets go, and a bin
// pushed into the freezer is loaded and parked against the wall.
export class BinHauler {
  constructor({ bins, player, collision, sightIgnore, hud, onLoaded }) {
    Object.assign(this, { bins, player, collision, hud, onLoaded });
    this.ignore = new Set([...sightIgnore, ...bins.map((b) => b.collider)]);
    this.carried = null;
    this.canSend = () => false; // main.js turns this on in debug mode
    this.reset();
  }

  reset() {
    this.drop();
    for (const bin of this.bins) {
      bin.loaded = false;
      this.place(bin, bin.spot.x, bin.spot.y, bin.spot.z);
    }
  }

  get loadedCount() {
    return this.bins.filter((b) => b.loaded).length;
  }

  get carrying() {
    return !!this.carried;
  }

  grab(bin) {
    if (bin.loaded) return;
    this.carried = bin;
    bin.collider.enabled = false;
    this.player.speedScale = 0.65;
    this.hud.toast('Push it into the secure freezer. Q lets go.', 3);
  }

  drop() {
    if (!this.carried) return;
    const bin = this.carried;
    this.carried = null;
    this.player.speedScale = 1;
    const p = bin.group.position;
    this.place(bin, p.x, p.y, p.z);
  }

  place(bin, x, y, z) {
    bin.group.position.set(x, y, z);
    const c = bin.collider;
    c.minX = x - BIN_RADIUS; c.maxX = x + BIN_RADIUS;
    c.minZ = z - BIN_RADIUS; c.maxZ = z + BIN_RADIUS;
    c.minY = y; c.maxY = y + 0.94;
    c.enabled = true;
  }

  // Bins you're not pushing rest on whatever is under them, so a bin left
  // in the elevator rides up and down with the car.
  settle() {
    for (const bin of this.bins) {
      if (bin === this.carried || bin.loaded) continue;
      const p = bin.group.position;
      const ground = this.collision.groundAt(p.x, p.z, p.y, 0.2, 0.45, new Set([bin.collider]));
      if (ground > -Infinity && Math.abs(ground - p.y) > 1e-4) this.place(bin, p.x, ground, p.z);
    }
  }

  update(dt, input, active) {
    this.settle();
    const bin = this.carried;
    if (!bin) return;
    if (active && input.wasPressed('KeyQ')) {
      this.drop();
      return;
    }
    // Debug (backquote mode only): R sends the bin straight to the freezer.
    if (active && this.canSend() && input.wasPressed('KeyR')) {
      this.load(bin);
      return;
    }
    // Roll along in front of you, stopping short of walls.
    const p = this.player.pos;
    const forward = new THREE.Vector3(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
    const from = new THREE.Vector3(p.x, p.y + 0.5, p.z);
    const room = this.collision.raycast(from, forward, HOLD_DISTANCE + BIN_RADIUS, this.ignore) - BIN_RADIUS;
    const d = Math.max(0.5, Math.min(HOLD_DISTANCE, room));
    const target = new THREE.Vector3(p.x + forward.x * d, p.y, p.z + forward.z * d);
    bin.group.position.lerp(target, 1 - Math.exp(-14 * dt));
    bin.group.position.y = p.y;
    bin.group.rotation.y += dt * this.player.vel.length() * 0.6;

    const b = bin.group.position;
    if (b.x > FREEZER.x0 && b.x < FREEZER.x1 && b.z > FREEZER.z0 && b.z < FREEZER.z1 && b.y < FREEZER.maxY) this.load(bin);
  }

  load(bin) {
    this.carried = null;
    this.player.speedScale = 1;
    bin.loaded = true;
    const slot = SLOTS[this.loadedCount - 1] ?? SLOTS[SLOTS.length - 1];
    this.place(bin, slot.x, 0, slot.z);
    this.onLoaded?.(bin, this.loadedCount);
  }

  // Checkpoints: where each bin is and whether it's loaded.
  snapshot() {
    return this.bins.map((b) => ({ x: b.group.position.x, y: b.group.position.y, z: b.group.position.z, loaded: b.loaded }));
  }

  restore(list) {
    this.drop();
    list.forEach((s, i) => {
      const bin = this.bins[i];
      bin.loaded = s.loaded;
      this.place(bin, s.x, s.y, s.z);
    });
  }
}
