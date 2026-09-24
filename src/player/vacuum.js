import * as THREE from 'three';

export const VACUUM = {
  capacity: 30,      // liters in the tank
  range: 3.2,        // meters
  coneDegrees: 24,   // half-angle of the suction cone
  rate: 6,           // liters per second at close range
};

// The containment vacuum. Hold the left mouse button to suck up goob in front
// of you; the tank fills and has to be emptied at a biohazard bin.
export class Vacuum {
  constructor(viewmodel, hud) {
    this.viewmodel = viewmodel;
    this.hud = hud;
    this.equipped = false;
    this.tank = 0;
    this.sucking = false;
    this.nozzleWorld = new THREE.Vector3(); // where sucked-up goob flies to
    this.fullWarned = false;
  }

  reset() {
    this.equip(false);
    this.tank = 0;
  }

  equip(on) {
    this.equipped = on;
    this.viewmodel.vacuum.visible = on;
  }

  get full() {
    return this.tank >= VACUUM.capacity - 1e-3;
  }

  // Empty the tank; returns how much was in it.
  empty() {
    const amount = this.tank;
    this.tank = 0;
    this.fullWarned = false;
    return amount;
  }

  update(dt, input, active, camera, player, goob) {
    this.sucking = false;
    if (!this.equipped) return;

    const forward = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const down = new THREE.Vector3().crossVectors(right, forward).normalize().negate();
    this.nozzleWorld.copy(camera.position).addScaledVector(forward, 0.7).addScaledVector(right, 0.15).addScaledVector(down, 0.25);

    const trigger = active && input.down('Mouse0');
    if (trigger && this.full) {
      if (!this.fullWarned) this.hud.toast('Tank full. Empty it into a biohazard bin.', 3);
      this.fullWarned = true;
    } else if (trigger) {
      this.sucking = true;
      const removed = goob.suck(
        camera.position, forward, VACUUM.range, Math.cos(THREE.MathUtils.degToRad(VACUUM.coneDegrees)),
        VACUUM.rate, dt, VACUUM.capacity - this.tank, this.nozzleWorld,
      );
      this.tank = Math.min(VACUUM.capacity, this.tank + removed);
    }

    this.viewmodel.updateVacuum(dt, { tankLevel: this.tank / VACUUM.capacity, sucking: this.sucking, bob: player.bob });
  }
}
