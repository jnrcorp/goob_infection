import * as THREE from 'three';
import { createGoobMaterial, goobTime } from './goobMaterial.js';

// Tuning. Volumes are liters.
export const GOOB = {
  maxBlobs: 150,        // the building never holds more blobs than this
  maxVolume: 4,         // a blob stops growing here
  growRate: 0.1,        // liters per second while spreading
  budAt: 3,             // a blob this big can spread to a neighboring spot
  budInterval: [25, 45],// seconds between spreads, per blob
  budVolume: 1,         // size of a new blob
};

const PARTS = 3;         // each blob is drawn as a main lump plus two smaller ones
const MAX_PARTICLES = 120;
const UP = new THREE.Vector3(0, 1, 0);

// All the goob in the building: blobs sitting on graph spots, drawn with one
// instanced mesh. Blobs grow and bud into neighboring free spots while
// spreading is on. The vacuum removes them.
export class GoobSystem {
  constructor(scene, graph, collision) {
    this.graph = graph;
    this.collision = collision;
    this.blobs = new Map(); // node id -> blob
    this.spreading = false;
    this.collected = 0;

    const geometry = new THREE.IcosahedronGeometry(0.5, 1);
    this.mesh = new THREE.InstancedMesh(geometry, createGoobMaterial(), GOOB.maxBlobs * PARTS + 16);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);

    // Little bits of goob flying into the vacuum nozzle.
    this.particles = [];
    this.particleMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x7dff4f }),
      MAX_PARTICLES
    );
    this.particleMesh.frustumCulled = false;
    this.particleMesh.count = 0;
    scene.add(this.particleMesh);

    this.tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), t: new THREE.Vector3() };
  }

  reset() {
    this.blobs.clear();
    this.particles.length = 0;
    this.spreading = false;
    this.collected = 0;
  }

  get remaining() {
    let total = 0;
    for (const b of this.blobs.values()) total += b.volume;
    return total;
  }

  // Percentage of all goob so far that's been vacuumed up.
  get cleanedPercent() {
    const remaining = this.remaining;
    const total = this.collected + remaining;
    return total <= 0 ? 0 : (this.collected / total) * 100;
  }

  spawn(node, volume) {
    const existing = this.blobs.get(node.id);
    if (existing) {
      existing.volume = Math.min(GOOB.maxVolume, existing.volume + volume);
      return existing;
    }
    if (this.blobs.size >= GOOB.maxBlobs) return null;
    const blob = { node, volume, budTimer: randomBetween(...GOOB.budInterval), seed: hash(node.id) };
    this.blobs.set(node.id, blob);
    return blob;
  }

  // Put goob on the free spots nearest a point (the spill, a splat).
  splat(point, radius, volume, maxCount = 99) {
    const nodes = this.graph.nodesNear(point, radius)
      .sort((a, b) => a.pos.distanceTo(point) - b.pos.distanceTo(point))
      .slice(0, maxCount);
    for (const n of nodes) this.spawn(n, volume * (0.6 + Math.random() * 0.6));
    return nodes.length;
  }

  update(dt, time) {
    goobTime.value = time;
    if (this.spreading) this.spread(dt);
    this.updateParticles(dt);
    this.draw();
  }

  spread(dt) {
    const newBlobs = [];
    for (const blob of this.blobs.values()) {
      blob.volume = Math.min(GOOB.maxVolume, blob.volume + GOOB.growRate * dt);
      if (blob.volume < GOOB.budAt) continue;
      blob.budTimer -= dt;
      if (blob.budTimer > 0) continue;
      blob.budTimer = randomBetween(...GOOB.budInterval);
      const free = blob.node.links.filter((n) => !this.blobs.has(n.id));
      if (free.length) newBlobs.push(free[Math.floor(Math.random() * free.length)]);
    }
    for (const node of newBlobs) this.spawn(node, GOOB.budVolume);
  }

  // Vacuum: pull goob from every blob inside the cone in front of the nozzle
  // that the nozzle can see. Returns liters removed (at most `limit`).
  suck(origin, forward, range, cosAngle, rate, dt, limit, particleTarget) {
    let removed = 0;
    const toBlob = this.tmp.t;
    for (const [id, blob] of this.blobs) {
      if (removed >= limit) break;
      const center = this.tmp.p.copy(blob.node.pos).addScaledVector(blob.node.normal, 0.1);
      toBlob.copy(center).sub(origin);
      const dist = toBlob.length();
      if (dist > range + this.radius(blob) || dist < 1e-3) continue;
      toBlob.divideScalar(dist);
      if (toBlob.dot(forward) < cosAngle) continue;
      // Line of sight; colliders around the blob itself (a desk) don't block.
      if (this.collision.raycast(origin, toBlob, dist - 0.05, this.graph.passable, center) < dist - 0.05) continue;

      const falloff = 1 - 0.5 * Math.min(1, dist / range);
      const take = Math.min(blob.volume, rate * falloff * dt, limit - removed);
      blob.volume -= take;
      removed += take;
      blob.sucked = 0.2;
      if (Math.random() < dt * 25) this.emitParticle(center, particleTarget);
      if (blob.volume <= 0.02) {
        this.blobs.delete(id);
        for (let i = 0; i < 6; i++) this.emitParticle(center, particleTarget);
      }
    }
    this.collected += removed;
    return removed;
  }

  radius(blob) {
    return 0.14 + 0.2 * Math.sqrt(blob.volume);
  }

  emitParticle(from, target) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const p = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.2, (Math.random() - 0.5) * 0.4));
    this.particles.push({ pos: p, target, spin: Math.random() * 6 });
  }

  updateParticles(dt) {
    const { m, q, s } = this.tmp;
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const to = p.target.clone().sub(p.pos);
      const d = to.length();
      const step = Math.min(d, (4 + 10 * (1 - Math.min(1, d / 3))) * dt);
      if (d < 0.08) {
        this.particles.splice(i, 1);
        continue;
      }
      p.pos.addScaledVector(to.divideScalar(d), step);
      p.spin += dt * 8;
    }
    for (const p of this.particles) {
      q.setFromAxisAngle(UP, p.spin);
      m.compose(p.pos, q, s.set(1, 1, 1));
      this.particleMesh.setMatrixAt(n++, m);
    }
    this.particleMesh.count = n;
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  // One main lump plus two smaller satellites per blob, flattened against the
  // surface it sits on. Blobs being vacuumed jitter.
  draw() {
    const { m, q, s, p, t } = this.tmp;
    let i = 0;
    for (const blob of this.blobs.values()) {
      const r = this.radius(blob);
      const normal = blob.node.normal;
      q.setFromUnitVectors(UP, normal);
      const jitter = blob.sucked > 0 ? 0.04 : 0;
      blob.sucked = Math.max(0, (blob.sucked ?? 0) - 0.016);
      for (let k = 0; k < PARTS; k++) {
        const size = k === 0 ? r : r * (0.45 + 0.15 * frac(blob.seed * (k + 3)));
        const angle = blob.seed * 6.283 * (k + 1);
        const offset = k === 0 ? 0 : r * 0.95;
        t.set(Math.cos(angle) * offset, 0, Math.sin(angle) * offset).applyQuaternion(q);
        p.copy(blob.node.pos).add(t);
        if (jitter) p.add(t.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(jitter));
        s.set(size * 2, size * 0.8, size * 2);
        m.compose(p, q, s);
        this.mesh.setMatrixAt(i++, m);
      }
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function hash(n) {
  return frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
}

function frac(x) {
  return x - Math.floor(x);
}
