import * as THREE from 'three';

export const ANTIDOTE = {
  range: 3.0,        // meters
  coneDegrees: 26,   // half-angle of the spray
  cureTime: 1.5,     // seconds of spray to cure someone
  fade: 0.4,         // cure progress lost per second when not being sprayed
};

const MIST = 60;

// The antidote sprayer clipped onto the vacuum. Hold F to spray a blue mist;
// an infected coworker who gets about 1.5 s of it is cured.
export class Antidote {
  constructor({ viewmodel, hud, scene, collision, sightIgnore }) {
    Object.assign(this, { viewmodel, hud, collision, sightIgnore });
    this.equipped = false;
    this.spraying = false;
    this.onCure = null;
    this.progress = new Map(); // npc -> seconds of spray so far

    this.mist = [];
    this.mistMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.5, depthWrite: false }),
      MIST
    );
    this.mistMesh.frustumCulled = false;
    this.mistMesh.count = 0;
    scene.add(this.mistMesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
  }

  reset() {
    this.equip(false);
    this.progress.clear();
    this.mist.length = 0;
  }

  equip(on) {
    this.equipped = on;
    this.viewmodel.sprayer.visible = on;
  }

  update(dt, input, active, camera, targets, nozzle) {
    this.spraying = this.equipped && active && input.down('KeyF');
    this.updateMist(dt);
    // Everyone not being sprayed slowly loses progress.
    for (const [npc, t] of this.progress) {
      const left = t - ANTIDOTE.fade * dt;
      if (left <= 0) this.progress.delete(npc);
      else this.progress.set(npc, left);
    }
    this.viewmodel.sprayGlow.visible = this.spraying;
    if (!this.spraying) return;

    const forward = camera.getWorldDirection(new THREE.Vector3());
    const origin = camera.position;
    const cosCone = Math.cos(THREE.MathUtils.degToRad(ANTIDOTE.coneDegrees));
    let focus = null;
    for (const npc of targets) {
      if (!npc.infected) continue;
      const chest = new THREE.Vector3(npc.pos.x, npc.pos.y + 1.1, npc.pos.z);
      const to = chest.clone().sub(origin);
      const dist = to.length();
      if (dist > ANTIDOTE.range) continue;
      to.divideScalar(dist);
      if (to.dot(forward) < cosCone && dist > 1) continue;
      if (this.collision.raycast(origin, to, dist, this.sightIgnore) < dist) continue;
      // + fade cancels the drop applied above, since they're being sprayed.
      const t = (this.progress.get(npc) ?? 0) + dt * (1 + ANTIDOTE.fade);
      if (t >= ANTIDOTE.cureTime) {
        this.progress.delete(npc);
        this.onCure?.(npc);
      } else {
        this.progress.set(npc, t);
        if (!focus || t > focus.t) focus = { npc, t };
      }
    }
    if (focus) this.hud.toast(`Curing ${focus.npc.name}... ${Math.floor((focus.t / ANTIDOTE.cureTime) * 100)}%`, 0.25);

    // Mist streaming out of the sprayer.
    for (let i = 0; i < 3; i++) {
      if (this.mist.length >= MIST) this.mist.shift();
      const spread = new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.35);
      const vel = forward.clone().add(spread).normalize().multiplyScalar(4 + Math.random() * 2);
      this.mist.push({ pos: nozzle.clone(), vel, life: 0.6 + Math.random() * 0.2, spin: Math.random() * 6 });
    }
  }

  updateMist(dt) {
    let n = 0;
    for (let i = this.mist.length - 1; i >= 0; i--) {
      const p = this.mist[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.mist.splice(i, 1);
        continue;
      }
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.exp(-2.5 * dt));
      p.spin += dt * 4;
    }
    for (const p of this.mist) {
      const size = 0.5 + (0.8 - p.life) * 2.5;
      this.q.setFromAxisAngle(p.vel.clone().normalize(), p.spin);
      this.m.compose(p.pos, this.q, this.s.set(size, size, size));
      this.mistMesh.setMatrixAt(n++, this.m);
    }
    this.mistMesh.count = n;
    this.mistMesh.instanceMatrix.needsUpdate = true;
  }
}
