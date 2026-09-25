import * as THREE from 'three';
import { ps1ify } from '../render/ps1.js';

// A blocky office worker with jointed limbs. The model faces +z, with its
// origin at the feet. Poses: 'stand', 'walk', 'sit', 'type'.
// Parts touch but never overlap: overlapping faces a centimeter apart flicker.

const HIP = 0.88;
const THIGH = 0.44;
const SHIN = 0.38;
const SHOE = 0.06; // THIGH + SHIN + SHOE = HIP
const SEAT_HIP = 0.5;
const materials = new Map();

function mat(color) {
  if (!materials.has(color)) materials.set(color, ps1ify(new THREE.MeshLambertMaterial({ color })));
  return materials.get(color);
}

const GOOB_COLOR = 0x4cd62e;
const INFECTED_SKIN = 0x7fae5a;
const glowingEyes = ps1ify(new THREE.MeshBasicMaterial({ color: 0xb6ff6a }));

function part(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

export class Person {
  constructor({ shirt, pants, skin, hair, tie = null, shoes = 0x222222 }) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    this.legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.11, HIP, 0);
      const knee = new THREE.Group();
      knee.position.y = -THIGH;
      knee.add(
        part(0.14, SHIN, 0.16, pants, 0, -SHIN / 2, 0),
        part(0.15, SHOE, 0.24, shoes, 0, -SHIN - SHOE / 2, 0.04),
      );
      hip.add(part(0.15, THIGH, 0.17, pants, 0, -THIGH / 2, 0), knee);
      this.body.add(hip);
      return { hip, knee };
    });

    this.body.add(part(0.44, 0.6, 0.24, shirt, 0, HIP + 0.3, 0));
    if (tie !== null) this.body.add(part(0.07, 0.4, 0.02, tie, 0, HIP + 0.36, 0.13)); // front of torso is z 0.12

    this.arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.285, HIP + 0.56, 0);
      const elbow = new THREE.Group();
      elbow.position.y = -0.32;
      elbow.add(part(0.1, 0.3, 0.12, skin, 0, -0.15, 0));
      shoulder.add(part(0.12, 0.32, 0.14, shirt, 0, -0.16, 0), elbow);
      this.body.add(shoulder);
      return { shoulder, elbow, side };
    });

    this.head = new THREE.Group();
    this.head.position.y = HIP + 0.62;
    // Head is 0.26 cube (y 0–0.28). Hair caps the top and covers the back;
    // eyes sit just in front of the face.
    this.head.add(
      part(0.26, 0.28, 0.26, skin, 0, 0.14, 0),
      part(0.28, 0.06, 0.29, hair, 0, 0.31, -0.015),
      part(0.28, 0.22, 0.04, hair, 0, 0.17, -0.15),
      part(0.05, 0.04, 0.02, 0x111111, -0.06, 0.16, 0.14),
      part(0.05, 0.04, 0.02, 0x111111, 0.06, 0.16, 0.14),
    );
    this.body.add(this.head);

    // Parts that change when infected.
    this.skinMeshes = [this.head.children[0], ...this.arms.map((a) => a.elbow.children[0])];
    this.skinMaterial = mat(skin);
    this.eyes = this.head.children.slice(3, 5);
    this.drips = new THREE.Group();
    this.drips.add(
      part(0.12, 0.04, 0.1, GOOB_COLOR, 0.04, HIP + 0.94, 0.02),
      part(0.04, 0.12, 0.03, GOOB_COLOR, 0.09, HIP + 0.86, 0.12),
      part(0.1, 0.03, 0.1, GOOB_COLOR, -0.26, HIP + 0.58, 0.01),
      part(0.14, 0.1, 0.02, GOOB_COLOR, -0.08, HIP + 0.42, 0.13),
    );
    this.drips.visible = false;
    this.body.add(this.drips);
    this.infected = false;

    this.meshes = [];
    this.root.traverse((o) => { if (o.isMesh) this.meshes.push(o); });

    this.pose = 'stand';
    this.talking = false;
    this.headYaw = null; // overrides the idle head turn when set
    this.action = null;  // 'lunge' | 'stunned' | null (infected only)
    this.actionT = 0;
    this.t = Math.random() * 10;
    this.walkPhase = 0;
  }

  setInfected(on) {
    this.infected = on;
    for (const m of this.skinMeshes) m.material = on ? mat(INFECTED_SKIN) : this.skinMaterial;
    for (const m of this.eyes) m.material = on ? glowingEyes : mat(0x111111);
    this.drips.visible = on;
  }

  update(dt, walkSpeed = 1.3) {
    this.t += dt;
    const t = this.t;
    const [left, right] = this.legs;
    const [armL, armR] = this.arms;

    // Neutral pose, then apply the current one.
    this.body.position.y = 0;
    this.body.rotation.x = 0;
    this.body.rotation.z = 0;
    for (const leg of this.legs) { leg.hip.rotation.x = 0; leg.knee.rotation.x = 0; }
    for (const arm of this.arms) { arm.shoulder.rotation.set(0, 0, arm.side * 0.06); arm.elbow.rotation.x = 0; }
    this.head.rotation.set(0, 0, 0);

    switch (this.pose) {
      case 'walk': {
        this.walkPhase += dt * walkSpeed * 5.5;
        const s = Math.sin(this.walkPhase);
        left.hip.rotation.x = s * 0.5;
        right.hip.rotation.x = -s * 0.5;
        left.knee.rotation.x = Math.max(0, -s) * 0.7;
        right.knee.rotation.x = Math.max(0, s) * 0.7;
        armL.shoulder.rotation.x = -s * 0.4;
        armR.shoulder.rotation.x = s * 0.4;
        armL.elbow.rotation.x = armR.elbow.rotation.x = -0.25;
        this.body.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.03;
        break;
      }
      case 'sit':
      case 'type': {
        this.body.position.y = SEAT_HIP - HIP;
        for (const leg of this.legs) { leg.hip.rotation.x = -Math.PI / 2; leg.knee.rotation.x = Math.PI / 2; }
        for (const arm of this.arms) { arm.shoulder.rotation.x = -0.5; arm.elbow.rotation.x = -0.9; }
        if (this.pose === 'type') {
          armL.shoulder.rotation.x += Math.sin(t * 17) * 0.05;
          armR.shoulder.rotation.x += Math.sin(t * 17 + 1.7) * 0.05;
          this.head.rotation.x = 0.12;
        } else {
          this.head.rotation.y = Math.sin(t * 0.35) * 0.35;
        }
        break;
      }
      default: // stand
        this.body.rotation.z = Math.sin(t * 1.3) * 0.015;
        this.head.rotation.y = Math.sin(t * 0.4) * 0.35;
    }

    // Infected: arms reaching forward, lolling head, a lurching sway.
    if (this.infected && (this.pose === 'stand' || this.pose === 'walk')) {
      armL.shoulder.rotation.x = -1.25 + Math.sin(t * 1.7) * 0.12;
      armR.shoulder.rotation.x = -1.25 + Math.sin(t * 1.7 + 2) * 0.12;
      armL.elbow.rotation.x = armR.elbow.rotation.x = -0.2;
      this.head.rotation.z = 0.3 + Math.sin(t * 0.9) * 0.15;
      this.head.rotation.x = 0.25;
      this.body.rotation.z = Math.sin(t * 1.1) * 0.06;
    }

    // One-off actions for infected: a lunging grab, or reeling after a blast.
    // actionT runs 0..1 through the action.
    if (this.action === 'lunge') {
      const k = this.actionT;
      armL.shoulder.rotation.x = armR.shoulder.rotation.x = -1.3 - 0.6 * k;
      armL.elbow.rotation.x = armR.elbow.rotation.x = -0.1;
      this.body.rotation.x = 0.35 * k;
      this.head.rotation.x = -0.2 * k;
    } else if (this.action === 'stunned') {
      this.body.position.y = -0.22;
      for (const leg of this.legs) { leg.hip.rotation.x = -0.8; leg.knee.rotation.x = 1.5; }
      this.body.rotation.z = Math.sin(t * 7) * 0.18;
      this.body.rotation.x = -0.15;
      armL.shoulder.rotation.set(Math.sin(t * 9) * 0.8, 0, -0.9);
      armR.shoulder.rotation.set(Math.sin(t * 9 + 2) * 0.8, 0, 0.9);
      this.head.rotation.set(Math.sin(t * 5) * 0.3, 0, Math.sin(t * 6) * 0.4);
    }

    if (this.headYaw !== null) this.head.rotation.y = this.headYaw;
    if (this.talking) {
      this.head.rotation.x = Math.sin(t * 4.5) * 0.04;
      if (this.pose === 'stand') {
        // A small open-hand gesture held out to the side. It stays out of the
        // listener's face: they're usually standing about a meter away.
        armR.shoulder.rotation.x = -0.25 + Math.sin(t * 2.2) * 0.08;
        armR.shoulder.rotation.z = 0.28;
        armR.elbow.rotation.x = -0.9 + Math.sin(t * 2.2 + 0.8) * 0.12;
      }
    }
  }
}
