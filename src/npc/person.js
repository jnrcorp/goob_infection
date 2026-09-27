import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { blobShadow } from '../render/shadows.js';

// A stylized office worker: rounded body, simple face, hair, jointed limbs.
// The model faces +z, with its origin at the feet. Poses: 'stand', 'walk',
// 'sit', 'type'. Parts on the same joint and material are merged into one
// mesh, so a person is about twenty draw calls.

const HIP = 0.88;
const THIGH = 0.44;
const SHIN = 0.38;
const SHOE = 0.06; // THIGH + SHIN + SHOE = HIP
const SEAT_HIP = 0.5;
const SHOULDER_Y = HIP + 0.52;
const NECK_Y = HIP + 0.64;

const GOOB_COLOR = 0x4cd62e;
const INFECTED_SKIN = 0x86b262;
const EYE_WHITE = 0xf2f0ea;
const PUPIL = 0x2a1c14;
const LIPS = 0x8a4a48;
const GLASSES = 0x1a1a1a;

const HAIR_STYLES = ['short', 'bob', 'ponytail', 'long', 'curly', 'buzz'];

const materials = new Map();
function mat(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color }));
  return materials.get(color);
}
const glowingEyes = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb6ff6a).multiplyScalar(1.8) });
const goobMaterial = new THREE.MeshLambertMaterial({ color: GOOB_COLOR, emissive: 0x1d5a0c });

// Stable pseudo-random numbers from a name, for picking hair styles and such.
function seeded(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (salt) => {
    let x = Math.imul(h ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b);
    x ^= x >>> 13;
    return ((x >>> 0) % 10000) / 10000;
  };
}

// Collects geometry per material for one joint, then merges it into meshes.
class Parts {
  constructor() { this.byMaterial = new Map(); }

  add(geometry, material, x = 0, y = 0, z = 0) {
    geometry.translate(x, y, z);
    if (!this.byMaterial.has(material)) this.byMaterial.set(material, []);
    this.byMaterial.get(material).push(geometry);
    return geometry;
  }

  // Adds the merged meshes to parent; returns them by material.
  build(parent) {
    const meshes = new Map();
    for (const [material, list] of this.byMaterial) {
      const geometries = list.some((g) => !g.index) ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list;
      const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
      list.forEach((g) => g.dispose());
      parent.add(mesh);
      meshes.set(material, mesh);
    }
    return meshes;
  }
}

// A capsule hanging down from its joint: top at y = 0, bottom at y = -length.
function limb(radius, length, radiusBottom = radius) {
  const g = new THREE.CapsuleGeometry((radius + radiusBottom) / 2, Math.max(0.01, length - radius - radiusBottom), 4, 12);
  g.translate(0, -length / 2, 0);
  return g;
}

function sphere(r, sx = 1, sy = 1, sz = 1, detail = [16, 12]) {
  const g = new THREE.SphereGeometry(r, detail[0], detail[1]);
  g.scale(sx, sy, sz);
  return g;
}

// Part of a sphere (hair caps): phi runs around the vertical axis (π–2π is the
// back of the head), theta down from the top.
function cap(r, phiStart, phiLength, thetaStart, thetaLength) {
  return new THREE.SphereGeometry(r, 20, 12, phiStart, phiLength, thetaStart, thetaLength);
}

// Torso: a lathe profile (radius, height), flattened front to back.
function torsoGeometry() {
  const profile = [
    [0.0, 0], [0.15, 0], [0.16, 0.06], [0.15, 0.2], [0.162, 0.34], [0.192, 0.46], [0.2, 0.52],
    [0.17, 0.58], [0.1, 0.62], [0.05, 0.635], [0, 0.635],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(profile, 20);
  g.scale(1, 1, 0.62);
  return g;
}

function tieGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.018, 0);
  shape.lineTo(0.018, 0);
  shape.lineTo(0.012, -0.04);
  shape.lineTo(0.03, -0.33);
  shape.lineTo(0, -0.37);
  shape.lineTo(-0.03, -0.33);
  shape.lineTo(-0.012, -0.04);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false });
}

export class Person {
  // look: { shirt, pants, skin, hair, tie?, shoes?, seed? (a name, for the
  // hair style, glasses and beard), hairStyle? }
  constructor({ shirt, pants, skin, hair, tie = null, shoes = 0x222222, seed = '', hairStyle = null }) {
    const rand = seeded(seed || `${shirt}/${pants}/${skin}/${hair}`);
    const style = hairStyle ?? HAIR_STYLES[Math.floor(rand(1) * HAIR_STYLES.length)];
    const glasses = rand(2) < 0.3;
    const beard = rand(3) < 0.2 && style !== 'bob' && style !== 'ponytail';

    const cloth = mat(shirt);
    const trousers = mat(pants);
    this.skinMaterial = mat(skin);
    this.infectedSkin = mat(INFECTED_SKIN);
    const hairMat = mat(hair);

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.skinMeshes = [];

    // Legs: thigh and shin capsules, rounded shoes.
    this.legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.095, HIP, 0);
      const knee = new THREE.Group();
      knee.position.y = -THIGH;
      const shin = new Parts();
      shin.add(limb(0.064, SHIN + 0.02, 0.055), trousers);
      const shoe = new RoundedBoxGeometry(0.11, 0.08, 0.26, 2, 0.03);
      shin.add(shoe, mat(shoes), 0, -SHIN - SHOE / 2 + 0.01, 0.045);
      shin.build(knee);
      const thigh = new Parts();
      thigh.add(limb(0.08, THIGH + 0.03, 0.068), trousers);
      thigh.build(hip);
      hip.add(knee);
      this.body.add(hip);
      return { hip, knee };
    });

    // Torso, hips, collar and tie.
    const torso = new Parts();
    torso.add(torsoGeometry(), cloth, 0, HIP - 0.03, 0);
    torso.add(sphere(0.17, 1, 0.5, 0.72), trousers, 0, HIP + 0.02, 0);
    const collar = new THREE.TorusGeometry(0.058, 0.016, 6, 16);
    collar.rotateX(Math.PI / 2);
    torso.add(collar, cloth, 0, HIP + 0.6, 0.005);
    const neck = new THREE.CylinderGeometry(0.048, 0.052, 0.09, 12);
    this.skinMeshes.push(...torso.build(this.body).values());
    const neckParts = new Parts();
    neckParts.add(neck, this.skinMaterial, 0, NECK_Y - 0.02, 0);
    this.skinMeshes.push(neckParts.build(this.body).get(this.skinMaterial));
    this.skinMeshes = this.skinMeshes.filter((m) => m.material === this.skinMaterial);
    if (tie !== null) {
      const t = new Parts();
      const g = tieGeometry();
      g.rotateX(-0.12);
      t.add(g, mat(tie), 0, HIP + 0.585, 0.118);
      t.build(this.body);
    }

    // Arms: shoulder cap, sleeves, mitten hands with a thumb.
    this.arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.19, SHOULDER_Y, 0);
      const upper = new Parts();
      upper.add(sphere(0.056), cloth);
      upper.add(limb(0.06, 0.31, 0.052), cloth);
      upper.build(shoulder);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      const fore = new Parts();
      fore.add(limb(0.052, 0.26, 0.044), cloth);
      fore.add(sphere(0.047, 0.78, 1.3, 0.6), this.skinMaterial, 0, -0.3, 0.005);
      const thumb = limb(0.016, 0.055);
      thumb.rotateX(-0.6);
      thumb.rotateZ(side * 0.3);
      fore.add(thumb, this.skinMaterial, side * -0.022, -0.27, 0.02);
      const foreMeshes = fore.build(elbow);
      this.skinMeshes.push(foreMeshes.get(this.skinMaterial));
      shoulder.add(elbow);
      this.body.add(shoulder);
      return { shoulder, elbow, side };
    });

    // Head: skull, nose, ears, eyes (blink), brows, mouth (talks), hair.
    this.head = new THREE.Group();
    this.head.position.y = NECK_Y + 0.02;
    const face = new Parts();
    face.add(sphere(0.125, 0.92, 1.08, 1, [20, 16]), this.skinMaterial, 0, 0.13, 0);
    face.add(sphere(0.026, 0.8, 1, 1.25), this.skinMaterial, 0, 0.115, 0.12);
    for (const s of [-1, 1]) face.add(sphere(0.03, 0.45, 1, 0.8), this.skinMaterial, s * 0.114, 0.13, 0);
    for (const s of [-1, 1]) {
      const brow = new RoundedBoxGeometry(0.048, 0.012, 0.014, 1, 0.005);
      brow.rotateZ(s * -0.12);
      face.add(brow, hairMat, s * 0.042, 0.188, 0.105);
    }
    this.addHair(face, hairMat, style, rand);
    if (beard) face.add(cap(0.127, 0, Math.PI, 0.6 * Math.PI, 0.32 * Math.PI), hairMat, 0, 0.13, 0.004);
    if (glasses) {
      for (const s of [-1, 1]) face.add(new THREE.TorusGeometry(0.024, 0.004, 6, 16), mat(GLASSES), s * 0.042, 0.15, 0.124);
      face.add(new THREE.BoxGeometry(0.03, 0.005, 0.005), mat(GLASSES), 0, 0.152, 0.126);
    }
    this.skinMeshes.push(face.build(this.head).get(this.skinMaterial));

    this.eyes = new THREE.Group();
    this.eyes.position.set(0, 0.15, 0);
    const eyeParts = new Parts();
    for (const s of [-1, 1]) {
      eyeParts.add(sphere(0.02, 1, 0.8, 0.5), mat(EYE_WHITE), s * 0.042, 0, 0.106);
      eyeParts.add(sphere(0.011, 1, 1, 0.5), mat(PUPIL), s * 0.042, 0, 0.114);
    }
    this.pupils = eyeParts.build(this.eyes).get(mat(PUPIL));
    this.head.add(this.eyes);

    this.mouth = new THREE.Group();
    this.mouth.position.set(0, 0.068, 0.112);
    const mouthParts = new Parts();
    mouthParts.add(new RoundedBoxGeometry(0.046, 0.012, 0.012, 1, 0.005), mat(LIPS));
    mouthParts.build(this.mouth);
    this.head.add(this.mouth);
    this.body.add(this.head);

    // Wet goob patches, shown when infected.
    this.drips = new THREE.Group();
    const goob = new Parts();
    for (const [x, y, z, r] of [[0.05, HIP + 0.5, 0.11, 0.05], [-0.08, HIP + 0.3, 0.1, 0.045], [0.12, HIP + 0.18, 0.09, 0.035], [-0.16, HIP + 0.52, 0.04, 0.04], [0.02, NECK_Y + 0.26, 0.07, 0.035]]) {
      goob.add(sphere(r, 1.2, 0.8, 0.45), goobMaterial, x, y, z);
    }
    goob.add(sphere(0.02, 1, 2.2, 1), goobMaterial, 0.06, HIP + 0.4, 0.12);
    goob.build(this.drips);
    this.drips.visible = false;
    this.body.add(this.drips);
    this.infected = false;

    this.meshes = [];
    this.root.traverse((o) => { if (o.isMesh) this.meshes.push(o); });
    this.root.add(blobShadow(1.1)); // after collecting meshes: not part of "Talk to"

    this.pose = 'stand';
    this.talking = false;
    this.headYaw = null; // overrides the idle head turn when set
    this.action = null;  // 'lunge' | 'stunned' | null (infected only)
    this.actionT = 0;
    this.t = rand(4) * 10;
    this.walkPhase = 0;
    this.blinkIn = 1 + rand(5) * 3;
  }

  addHair(parts, hairMat, style, rand) {
    const y = 0.13;
    const top = () => {
      const g = cap(0.134, 0, Math.PI * 2, 0, 0.36 * Math.PI);
      g.scale(0.94, 1.1, 1.02);
      parts.add(g, hairMat, 0, y, -0.006);
    };
    const back = (from, length) => {
      const g = cap(0.132, Math.PI, Math.PI, from * Math.PI, length * Math.PI);
      g.scale(0.95, 1.08, 1.04);
      parts.add(g, hairMat, 0, y, -0.004);
    };
    switch (style) {
      case 'bob':
        top();
        back(0, 0.68);
        for (const s of [-1, 1]) parts.add(sphere(0.05, 0.6, 1.5, 1.1), hairMat, s * 0.115, y - 0.02, -0.02);
        break;
      case 'ponytail': {
        top();
        back(0, 0.55);
        const tail = sphere(0.045, 0.85, 1.9, 0.85);
        tail.rotateX(0.35);
        parts.add(tail, hairMat, 0, y - 0.04, -0.15);
        break;
      }
      case 'long': {
        top();
        back(0, 0.75);
        const fall = sphere(0.11, 1.05, 1.6, 0.45);
        parts.add(fall, hairMat, 0, y - 0.1, -0.075);
        break;
      }
      case 'balding': // only when asked for (hairStyle)
        back(0.32, 0.32);
        break;
      case 'curly':
        top();
        back(0, 0.55);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + rand(20 + i) * 0.4;
          const up = 0.08 + rand(40 + i) * 0.06;
          parts.add(sphere(0.042, 1, 1, 1, [10, 8]), hairMat, Math.cos(a) * 0.1, y + up, Math.sin(a) * 0.1 - 0.015);
        }
        break;
      case 'buzz': {
        const g = cap(0.128, 0, Math.PI * 2, 0, 0.4 * Math.PI);
        g.scale(0.93, 1.09, 1.01);
        parts.add(g, hairMat, 0, y, -0.004);
        back(0, 0.55);
        break;
      }
      default: // short
        top();
        back(0, 0.6);
    }
  }

  setInfected(on) {
    this.infected = on;
    for (const m of this.skinMeshes) if (m) m.material = on ? this.infectedSkin : this.skinMaterial;
    this.pupils.material = on ? glowingEyes : mat(PUPIL);
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
    for (const arm of this.arms) { arm.shoulder.rotation.set(0.04, 0, arm.side * 0.08); arm.elbow.rotation.x = -0.12; }
    this.head.rotation.set(0, 0, 0);

    switch (this.pose) {
      case 'walk': {
        this.walkPhase += dt * walkSpeed * 5.5;
        const s = Math.sin(this.walkPhase);
        left.hip.rotation.x = s * 0.5;
        right.hip.rotation.x = -s * 0.5;
        left.knee.rotation.x = Math.max(0, -s) * 0.75 + 0.05;
        right.knee.rotation.x = Math.max(0, s) * 0.75 + 0.05;
        armL.shoulder.rotation.x = -s * 0.4;
        armR.shoulder.rotation.x = s * 0.4;
        armL.elbow.rotation.x = -0.25 - Math.max(0, s) * 0.2;
        armR.elbow.rotation.x = -0.25 - Math.max(0, -s) * 0.2;
        this.body.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.03;
        this.body.rotation.z = Math.sin(this.walkPhase) * 0.02;
        this.head.rotation.z = -Math.sin(this.walkPhase) * 0.015;
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
      default: // stand: breathing, weight shifts, looking around
        this.body.rotation.z = Math.sin(t * 1.3) * 0.015;
        this.body.position.y = Math.sin(t * 1.6) * 0.004;
        this.head.rotation.y = Math.sin(t * 0.4) * 0.35;
        this.head.rotation.x = Math.sin(t * 0.23) * 0.05;
    }

    // Infected: arms reaching forward, lolling head, a lurching sway.
    if (this.infected && (this.pose === 'stand' || this.pose === 'walk')) {
      armL.shoulder.rotation.x = -1.25 + Math.sin(t * 1.7) * 0.12;
      armR.shoulder.rotation.x = -1.25 + Math.sin(t * 1.7 + 2) * 0.12;
      armL.elbow.rotation.x = armR.elbow.rotation.x = -0.2;
      this.head.rotation.z = 0.3 + Math.sin(t * 0.9) * 0.15;
      this.head.rotation.x = 0.25;
      this.body.rotation.z = Math.sin(t * 1.1) * 0.06;
      this.body.rotation.x = 0.06;
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

    // Face: blinking (infected don't blink: wide, glowing eyes), and a mouth
    // that moves while talking (or hangs open when infected).
    this.blinkIn -= dt;
    let eyeOpen = 1;
    if (!this.infected) {
      if (this.blinkIn < 0) {
        eyeOpen = 0.1;
        if (this.blinkIn < -0.12) this.blinkIn = 2 + Math.random() * 4;
      }
    } else {
      eyeOpen = 1.25;
    }
    this.eyes.scale.y = eyeOpen;
    let mouthOpen = 1;
    if (this.talking) mouthOpen = 1 + Math.abs(Math.sin(t * 11)) * 2.8;
    else if (this.infected) mouthOpen = 2.6 + Math.sin(t * 1.3) * 0.6;
    this.mouth.scale.y = mouthOpen;
  }
}
