import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Things held in front of the camera: the vacuum, and the goob canister during
// the spill. They live in their own small scene with its own camera and
// lights, drawn over the world.
export class Viewmodel {
  constructor(materials) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff4e0, 1.4);
    key.position.set(0.5, 1, 0.6);
    this.scene.add(key);

    const box = (group, w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof mat === 'string' ? materials.get(mat) : mat);
      m.position.set(x, y, z);
      group.add(m);
      return m;
    };
    const round = (group, w, h, d, r, mat, x, y, z) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), typeof mat === 'string' ? materials.get(mat) : mat);
      m.position.set(x, y, z);
      group.add(m);
      return m;
    };
    // A cylinder lying along z (hoses, nozzles), or standing up (upright).
    const tube = (group, r0, r1, len, mat, x, y, z, upright = false) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 20), typeof mat === 'string' ? materials.get(mat) : mat);
      if (!upright) m.rotation.x = Math.PI / 2;
      m.position.set(x, y, z);
      group.add(m);
      return m;
    };
    const shell = new THREE.MeshLambertMaterial({ color: 0xe2b42a });
    const glove = new THREE.MeshLambertMaterial({ color: 0xd9ae2c });

    // Containment vacuum held low on the right, nozzle pointing ahead.
    this.vacuum = new THREE.Group();
    round(this.vacuum, 0.22, 0.26, 0.42, 0.05, shell, 0, 0, 0);
    round(this.vacuum, 0.228, 0.05, 0.3, 0.02, 'hazard', 0, -0.08, 0.02);
    // Carry handle on top, held by a gloved hand.
    round(this.vacuum, 0.045, 0.045, 0.26, 0.02, 'rubber', 0, 0.2, -0.02);
    for (const z of [-0.13, 0.09]) tube(this.vacuum, 0.016, 0.016, 0.08, 'steel', 0, 0.16, z, true);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), glove);
    hand.scale.set(1.25, 0.9, 1.5);
    hand.position.set(0.02, 0.22, -0.01);
    this.vacuum.add(hand);
    // Tank window on the left side, showing how full it is.
    this.tankWindow = round(this.vacuum, 0.012, 0.16, 0.26, 0.005, 'glass', -0.116, 0.01, 0);
    this.tankFill = box(this.vacuum, 0.01, 0.15, 0.25, 'goob', -0.112, 0, 0);
    // Status light.
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), materials.get('lightBlue'));
    led.position.set(-0.07, 0.11, -0.21);
    this.vacuum.add(led);
    // Hose and flared nozzle.
    tube(this.vacuum, 0.035, 0.035, 0.34, 'rubber', -0.05, -0.02, -0.36);
    for (let i = 0; i < 5; i++) tube(this.vacuum, 0.039, 0.039, 0.012, 'rubber', -0.05, -0.02, -0.24 - i * 0.055);
    this.nozzle = tube(this.vacuum, 0.078, 0.042, 0.13, 'steel', -0.07, -0.03, -0.58);
    this.nozzleGlow = tube(this.vacuum, 0.068, 0.068, 0.006, 'goob', -0.07, -0.03, -0.648);

    // Antidote sprayer clipped to the top of the vacuum, toward the far side,
    // so it stays small on screen (hidden until found).
    this.sprayer = new THREE.Group();
    const can = new THREE.MeshLambertMaterial({ color: 0xd8ecff });
    tube(this.sprayer, 0.035, 0.035, 0.2, can, 0.05, 0.215, 0.02);
    tube(this.sprayer, 0.036, 0.036, 0.03, 'lightBlue', 0.05, 0.215, -0.02);
    tube(this.sprayer, 0.01, 0.012, 0.16, 'steel', 0.05, 0.215, -0.16);
    this.sprayGlow = tube(this.sprayer, 0.016, 0.016, 0.008, 'lightBlue', 0.05, 0.215, -0.245);
    this.sprayGlow.visible = false;
    this.sprayer.visible = false;
    this.vacuum.add(this.sprayer);

    this.vacuum.position.set(0.3, -0.3, -0.72);
    this.vacuum.rotation.y = 0.12;
    this.vacuum.scale.setScalar(0.72);
    this.vacuum.visible = false;
    this.scene.add(this.vacuum);
    this.vacuumRest = this.vacuum.position.clone();

    // Goob canister cradled in both hands (spill cinematic).
    this.canister = new THREE.Group();
    const cyl = (r, h, mat, y) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), materials.get(mat));
      m.position.y = y;
      this.canister.add(m);
    };
    cyl(0.16, 0.06, 'steel', -0.22);
    cyl(0.16, 0.06, 'steel', 0.22);
    cyl(0.11, 0.36, 'goob', 0);
    cyl(0.14, 0.38, 'glass', 0);
    for (const side of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), glove);
      g.scale.set(1.1, 0.8, 1.4);
      g.position.set(side * 0.19, -0.05, 0.02);
      this.canister.add(g);
    }
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
