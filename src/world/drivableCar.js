import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { sfx, setEngine } from '../core/sound.js';

// Your car: park it, get in (E), drive (W gas, S brake / reverse, A/D steer,
// Space handbrake), get out (E, when stopped). Arcade handling: a simple
// bicycle model with drag, bouncing off anything solid.
//
// Heading follows the player's yaw convention: 0 faces -z, and turning left
// increases it. The model is built nose toward -z.
const CAR = {
  length: 4.3,
  width: 1.8,
  wheelbase: 2.7,
  maxSpeed: 14,       // m/s forward (about 50 km/h)
  maxReverse: 4,
  accel: 6,           // m/s² with the gas down
  brake: 14,
  coast: 2.5,         // slowing down with no pedal
  maxSteer: 0.55,     // radians at the front wheels
  steerRate: 3,       // how fast the wheel turns
  hitRadius: 0.95,    // two circles along the body, for bumping into things
};
const SEAT = { right: -0.38, back: 0.15, eye: 1.2 }; // driver's eye, relative to the car

export class DrivableCar {
  constructor({ scene, collision, interactions, materials }, { x, z, heading, paint = 'paintBlue' }) {
    Object.assign(this, { collision });
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.driver = null;
    this.onUse = null;          // what E on the car does (set by the morning)
    this.label = () => 'Get in your car';

    this.group = new THREE.Group();
    const add = (geometry, mat, px, py, pz) => {
      const m = new THREE.Mesh(geometry, typeof mat === 'string' ? materials.get(mat) : mat);
      m.position.set(px, py, pz);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    const L = CAR.length / 2;
    const W = CAR.width / 2;
    const body = [
      add(new RoundedBoxGeometry(CAR.width, 0.67, CAR.length, 3, 0.2), paint, 0, 0.615, 0),
      add(new RoundedBoxGeometry(1.56, 0.56, 2.05, 3, 0.14), 'tint', 0, 1.18, 0.02),
      add(new RoundedBoxGeometry(1.6, 0.1, 1.85, 2, 0.05), paint, 0, 1.47, 0.02),
    ];
    this.wheels = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * (W - 0.08), 0.33, sz * 1.35);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 20), materials.get('rubber'));
      tire.rotation.z = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.23, 14), materials.get('steel'));
      hub.rotation.z = Math.PI / 2;
      pivot.add(tire, hub);
      this.group.add(pivot);
      this.wheels.push({ pivot, front: sz < 0 });
    }
    for (const sx of [-1, 1]) {
      add(new RoundedBoxGeometry(0.28, 0.1, 0.07, 1, 0.02), 'light', sx * 0.62, 0.71, -L - 0.01);
      add(new RoundedBoxGeometry(0.24, 0.1, 0.07, 1, 0.02), 'red', sx * 0.66, 0.75, L + 0.01);
    }
    // Inside: dashboard and steering wheel (seen from the driver's seat).
    add(new THREE.BoxGeometry(1.5, 0.12, 0.35), 'plastic', 0, 1.02, -0.72);
    const wheel = add(new THREE.TorusGeometry(0.17, 0.022, 8, 24), 'rubber', SEAT.right, 1.05, -0.5);
    wheel.rotation.x = -0.35;
    this.steeringWheel = wheel;
    scene.add(this.group);

    // Keeps people from walking through it (axis-aligned around the body).
    this.collider = collision.addBox(0, 0, 0, 0, 0, 0);
    this.sync();

    interactions.add({
      mesh: body,
      ignore: [this.collider],
      label: () => (this.driver ? null : this.label()),
      enabled: () => !this.driver && !!this.onUse,
      use: () => this.onUse?.(),
    });
  }

  get forward() {
    return new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
  }

  // Put the car somewhere (stopped).
  place(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.sync();
  }

  // The player gets in: the car carries them and takes over W/A/S/D.
  enter(player) {
    this.driver = player;
    this.collider.enabled = false;
    player.rig = this;
    player.yaw = this.heading;
    player.pitch = -0.12;
    sfx.carDoor();
  }

  // Out the driver's door (the left side), onto the ground.
  exit() {
    const player = this.driver;
    if (!player) return;
    this.driver = null;
    player.rig = null;
    this.speed = 0;
    this.collider.enabled = true;
    const f = this.forward;
    const right = new THREE.Vector3(-f.z, 0, f.x);
    // Out the driver's side, or the other side if that's against a wall.
    // (Checked at knee and head height, a body's width out from the car.)
    const clear = (side) => [0.5, 1.5].every((y) => [-0.35, 0, 0.35].every((k) => !this.collision.pointInside(
      new THREE.Vector3(this.pos.x + right.x * side * 1.5 + f.x * k, y, this.pos.z + right.z * side * 1.5 + f.z * k), new Set([this.collider]))));
    const side = clear(-1) || !clear(1) ? -1 : 1;
    player.spawn({ x: this.pos.x + right.x * side * 1.5, y: 0, z: this.pos.z + right.z * side * 1.5, yaw: this.heading });
    sfx.carDoor();
    setEngine(0);
    this.sync();
  }

  // Rig update (while someone's driving): input, physics, then the driver's view.
  update(dt, input, active, player) {
    const down = (code) => active && input.down(code);
    const gas = down('KeyW');
    const back = down('KeyS');
    const hand = down('Space');
    let v = this.speed;
    if (gas) v = Math.min(CAR.maxSpeed, v + CAR.accel * dt);
    if (back) v = v > 0.2 ? Math.max(0, v - CAR.brake * dt) : Math.max(-CAR.maxReverse, v - CAR.accel * 0.6 * dt);
    if (!gas && !back) v -= Math.sign(v) * Math.min(Math.abs(v), CAR.coast * dt);
    if (hand) v -= Math.sign(v) * Math.min(Math.abs(v), CAR.brake * 1.3 * dt);
    v -= v * 0.05 * dt; // air drag

    const steerIn = (down('KeyA') ? 1 : 0) - (down('KeyD') ? 1 : 0);
    // Less steering at speed, so it doesn't spin out.
    const target = steerIn * CAR.maxSteer / (1 + Math.abs(v) * 0.06);
    this.steer += (target - this.steer) * Math.min(1, CAR.steerRate * dt);

    const turn = (v * Math.tan(this.steer) / CAR.wheelbase) * dt;
    const f = this.forward;
    const next = this.pos.clone().addScaledVector(f, v * dt);
    // (Already touching something, e.g. parked close to a wall: it can still
    // drive away.)
    if (this.hits(next, this.heading + turn) && !this.hits(this.pos, this.heading)) {
      if (Math.abs(v) > 3) {
        sfx.crash();
        player.shakeFor(0.25);
      }
      v = -v * 0.25; // bounce back a little
    } else {
      this.pos.copy(next);
      this.heading += turn;
      player.yaw += turn; // the view turns with the car
    }
    this.speed = v;
    setEngine(Math.min(1, Math.abs(v) / CAR.maxSpeed + (gas ? 0.15 : 0)));

    // Wheels roll and the front ones steer.
    for (const w of this.wheels) {
      w.pivot.children[0].rotation.x -= (v * dt) / 0.33;
      w.pivot.rotation.y = w.front ? this.steer : 0;
    }
    this.steeringWheel.rotation.z = this.steer * 3;
    this.sync();

    // The driver's eye, and a look range that stays inside the car.
    const right = new THREE.Vector3(-f.z, 0, f.x);
    const seat = this.pos.clone().addScaledVector(right, SEAT.right).addScaledVector(f, -SEAT.back);
    player.pos.set(seat.x, 0, seat.z);
    player.eyeHeight = SEAT.eye;
    const rel = Math.atan2(Math.sin(player.yaw - this.heading), Math.cos(player.yaw - this.heading));
    player.yaw = this.heading + Math.max(-1.8, Math.min(1.8, rel));
  }

  // Would the car at (pos, heading) touch anything solid?
  hits(pos, heading) {
    const f = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
    const r = CAR.hitRadius;
    const centers = [-1.25, 0, 1.25].map((k) => pos.clone().addScaledVector(f, k));
    for (const b of this.collision.boxes) {
      if (!b.enabled || b === this.collider || b.person) continue;
      if (b.maxY <= 0.3 || b.minY >= 1.5) continue; // ground, curbs, overhead
      for (const c of centers) {
        const dx = Math.max(b.minX - c.x, 0, c.x - b.maxX);
        const dz = Math.max(b.minZ - c.z, 0, c.z - b.maxZ);
        if (dx * dx + dz * dz < r * r) return true;
      }
    }
    return false;
  }

  sync() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    const f = this.forward;
    const ex = Math.abs(f.x) * CAR.length / 2 + Math.abs(f.z) * CAR.width / 2;
    const ez = Math.abs(f.z) * CAR.length / 2 + Math.abs(f.x) * CAR.width / 2;
    const c = this.collider;
    c.minX = this.pos.x - ex; c.maxX = this.pos.x + ex;
    c.minZ = this.pos.z - ez; c.maxZ = this.pos.z + ez;
    c.minY = 0; c.maxY = 1.5;
  }
}
