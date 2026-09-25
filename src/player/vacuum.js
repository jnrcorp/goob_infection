import * as THREE from 'three';

export const VACUUM = {
  capacity: 30,      // liters in the tank
  range: 3.2,        // meters
  coneDegrees: 24,   // half-angle of the suction cone
  rate: 6,           // liters per second at close range
  blowRange: 3.8,    // meters
  blowDegrees: 38,   // half-angle of the blast
  blowCooldown: 1.0, // seconds between blasts
};

const PUFFS = 48;

// The containment vacuum.
// Left mouse (hold): suck up goob in front of you into the tank.
// Right mouse (click): blast of air that knocks back and stuns infected.
export class Vacuum {
  constructor({ viewmodel, hud, scene, collision, sightIgnore }) {
    this.viewmodel = viewmodel;
    this.hud = hud;
    this.collision = collision;
    this.sightIgnore = sightIgnore;
    this.equipped = false;
    this.tank = 0;
    this.sucking = false;
    this.noisy = 0; // seconds the vacuum stays audible to infected after use
    this.cooldown = 0;
    this.nozzleWorld = new THREE.Vector3(); // where sucked-up goob flies to
    this.fullWarned = false;

    this.puffs = [];
    this.puffMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xe8f0e8, transparent: true, opacity: 0.55, depthWrite: false }),
      PUFFS
    );
    this.puffMesh.frustumCulled = false;
    this.puffMesh.count = 0;
    scene.add(this.puffMesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
  }

  reset() {
    this.equip(false);
    this.tank = 0;
    this.cooldown = 0;
    this.puffs.length = 0;
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

  update(dt, input, active, camera, player, goob, targets) {
    this.sucking = false;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.noisy = Math.max(0, this.noisy - dt);
    this.updatePuffs(dt);
    if (!this.equipped) return;

    const forward = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const down = new THREE.Vector3().crossVectors(right, forward).normalize().negate();
    this.nozzleWorld.copy(camera.position).addScaledVector(forward, 0.7).addScaledVector(right, 0.15).addScaledVector(down, 0.25);

    if (active && input.wasPressed('Mouse2') && this.cooldown <= 0) this.blow(camera.position, forward, targets);

    const trigger = active && input.down('Mouse0');
    if (trigger && this.full) {
      if (!this.fullWarned) this.hud.toast('Tank full. Empty it into a biohazard bin.', 3);
      this.fullWarned = true;
    } else if (trigger) {
      this.sucking = true;
      this.noisy = 0.5;
      const removed = goob.suck(
        camera.position, forward, VACUUM.range, Math.cos(THREE.MathUtils.degToRad(VACUUM.coneDegrees)),
        VACUUM.rate, dt, VACUUM.capacity - this.tank, this.nozzleWorld,
      );
      this.tank = Math.min(VACUUM.capacity, this.tank + removed);
    }

    this.viewmodel.updateVacuum(dt, {
      tankLevel: this.tank / VACUUM.capacity,
      sucking: this.sucking,
      bob: player.bob,
      kick: this.cooldown / VACUUM.blowCooldown,
    });
  }

  // Knock back and stun every infected in the blast cone that the nozzle can see.
  blow(origin, forward, targets) {
    this.cooldown = VACUUM.blowCooldown;
    this.noisy = 1;
    const cosCone = Math.cos(THREE.MathUtils.degToRad(VACUUM.blowDegrees));
    const flat = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    for (const npc of targets) {
      if (!npc.brain) continue;
      const chest = new THREE.Vector3(npc.pos.x, npc.pos.y + 1.1, npc.pos.z);
      const to = chest.clone().sub(origin);
      const dist = to.length();
      if (dist > VACUUM.blowRange) continue;
      to.divideScalar(dist);
      if (to.dot(forward) < cosCone && dist > 1.2) continue;
      if (this.collision.raycast(origin, to, dist, this.sightIgnore) < dist) continue;
      const away = new THREE.Vector3(npc.pos.x - origin.x, 0, npc.pos.z - origin.z);
      if (away.lengthSq() < 1e-4) away.copy(flat);
      npc.brain.stun(away.normalize());
    }
    // A cloud of air shooting out of the nozzle.
    for (let i = 0; i < 16; i++) {
      if (this.puffs.length >= PUFFS) this.puffs.shift();
      const spread = new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6);
      const vel = forward.clone().add(spread).normalize().multiplyScalar(5 + Math.random() * 4);
      this.puffs.push({ pos: this.nozzleWorld.clone(), vel, life: 0.45 + Math.random() * 0.2, spin: Math.random() * 6 });
    }
  }

  updatePuffs(dt) {
    let n = 0;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.puffs.splice(i, 1);
        continue;
      }
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.exp(-4 * dt));
      p.spin += dt * 5;
    }
    for (const p of this.puffs) {
      const size = 0.6 + (0.65 - p.life) * 3;
      this.q.setFromAxisAngle(p.vel.clone().normalize(), p.spin);
      this.m.compose(p.pos, this.q, new THREE.Vector3(size, size, size));
      this.puffMesh.setMatrixAt(n++, this.m);
    }
    this.puffMesh.count = n;
    this.puffMesh.instanceMatrix.needsUpdate = true;
  }
}
