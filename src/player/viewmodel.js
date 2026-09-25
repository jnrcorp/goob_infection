import * as THREE from 'three';

// Things held in front of the camera: the vacuum, and the goob canister during
// the spill. They live in their own small scene with its own camera and
// lights, drawn over the world.
export class Viewmodel {
  constructor(materials) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const key = new THREE.DirectionalLight(0xfff4e0, 1.6);
    key.position.set(0.5, 1, 0.6);
    this.scene.add(key);

    const box = (group, w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.get(mat));
      m.position.set(x, y, z);
      group.add(m);
      return m;
    };

    // Vacuum held low on the right, nozzle pointing ahead.
    this.vacuum = new THREE.Group();
    box(this.vacuum, 0.22, 0.26, 0.42, 'suit', 0, 0, 0);
    box(this.vacuum, 0.16, 0.05, 0.3, 'rubber', 0, 0.155, -0.02);
    this.tankWindow = box(this.vacuum, 0.012, 0.16, 0.26, 'glass', -0.116, 0.01, 0);
    this.tankFill = box(this.vacuum, 0.01, 0.15, 0.25, 'goob', -0.112, 0, 0);
    box(this.vacuum, 0.07, 0.07, 0.34, 'rubber', -0.05, -0.02, -0.36);
    this.nozzle = box(this.vacuum, 0.14, 0.09, 0.12, 'rubber', -0.07, -0.03, -0.58);
    this.nozzleGlow = box(this.vacuum, 0.1, 0.05, 0.01, 'goob', -0.07, -0.03, -0.645);
    this.vacuum.position.set(0.3, -0.3, -0.72);
    this.vacuum.rotation.y = 0.12;
    this.vacuum.scale.setScalar(0.72);
    this.vacuum.visible = false;
    this.scene.add(this.vacuum);
    this.vacuumRest = this.vacuum.position.clone();

    // Goob canister cradled in both hands (spill cinematic).
    this.canister = new THREE.Group();
    const cyl = (r, h, mat, y) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), materials.get(mat));
      m.position.y = y;
      this.canister.add(m);
    };
    cyl(0.16, 0.06, 'steel', -0.22);
    cyl(0.16, 0.06, 'steel', 0.22);
    cyl(0.11, 0.36, 'goob', 0);
    cyl(0.14, 0.38, 'glass', 0);
    box(this.canister, 0.12, 0.1, 0.16, 'suit', -0.2, -0.05, 0.02);
    box(this.canister, 0.12, 0.1, 0.16, 'suit', 0.2, -0.05, 0.02);
    this.canister.position.set(0, -0.42, -0.8);
    this.canister.scale.setScalar(0.75);
    this.canister.visible = false;
    this.scene.add(this.canister);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // tankLevel 0..1; sucking jiggles the vacuum; bob follows the player's step;
  // kick 1..0 is the recoil after a blast.
  updateVacuum(dt, { tankLevel, sucking, bob, kick = 0 }) {
    const v = this.vacuum;
    this.tankFill.scale.y = Math.max(0.001, tankLevel);
    this.tankFill.position.y = -0.075 + 0.075 * tankLevel;
    this.nozzleGlow.visible = sucking;
    const shake = sucking ? 0.006 : 0;
    v.position.set(
      this.vacuumRest.x + Math.cos(bob) * 0.008 + (Math.random() - 0.5) * shake,
      this.vacuumRest.y + Math.abs(Math.sin(bob)) * 0.01 + (Math.random() - 0.5) * shake,
      this.vacuumRest.z + (sucking ? 0.02 : 0) + kick * kick * 0.08,
    );
    v.rotation.x = kick * kick * 0.25;
  }
}
