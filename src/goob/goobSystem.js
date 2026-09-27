import * as THREE from 'three';
import { createGoobMaterial, goobTime } from './goobMaterial.js';
import { sfx } from '../core/sound.js';

// Tuning. Volumes are liters.
export const GOOB = {
  maxBlobs: 240,        // the building never holds more blobs than this
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
    // Multiplies how fast goob grows and spreads (set per difficulty).
    this.spreadSpeed = () => 1;
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

  // For checkpoints: every blob as [spot id, liters, seconds until it spreads].
  snapshot() {
    return {
      collected: this.collected,
      spreading: this.spreading,
      blobs: [...this.blobs.values()].map((b) => [b.node.id, b.volume, b.budTimer]),
    };
  }

  restore(snap) {
    this.blobs.clear();
    this.particles.length = 0;
    this.collected = snap.collected;
    this.spreading = snap.spreading;
    for (const [id, volume, budTimer] of snap.blobs) {
      const node = this.graph.nodes[id];
      if (!node) continue;
      const blob = this.spawn(node, volume);
      if (blob) blob.budTimer = budTimer;
    }
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

  // Put goob on the free spots nearest a point (the spill, a splat), but only
  // ones with a clear line to it: a splat doesn't go through walls.
  splat(point, radius, volume, maxCount = 99) {
    const nodes = this.graph.visibleFrom(point, radius)
      .sort((a, b) => a.pos.distanceTo(point) - b.pos.distanceTo(point))
      .slice(0, maxCount);
    for (const n of nodes) this.spawn(n, volume * (0.6 + Math.random() * 0.6));
    return nodes.length;
  }

  update(dt, time) {
    goobTime.value = time;
    if (this.spreading) this.spread(dt * this.spreadSpeed());
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
      // Not into occupied spots, and not under a shut door.
      const free = blob.node.links.filter((n) => !this.blobs.has(n.id) && this.graph.canSpread(blob.node, n));
      if (free.length) newBlobs.push(free[Math.floor(Math.random() * free.length)]);
    }
    for (const node of newBlobs) this.spawn(node, GOOB.budVolume);
  }

  // Vacuum: pull goob from every blob inside the cone in front of the nozzle,
  // even ones hidden behind furniture (but not behind walls). Returns liters removed (at most `limit`).
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
      // The vacuum is strong enough to pull goob out from under desks, from
      // behind shelves and out of vents, so furniture doesn't block it and
      // every blob can be reached wherever it spreads. Walls, shut doors and
      // the ceiling (the floor above) still do.
      if (center.y > origin.y + 1.5) continue;
      if (this.collision.raycastWalls(origin, toBlob, dist - 0.05) < dist - 0.05) continue;

      const falloff = 1 - 0.5 * Math.min(1, dist / range);
      const take = Math.min(blob.volume, rate * falloff * dt, limit - removed);
      blob.volume -= take;
      removed += take;
      blob.sucked = 0.2;
      if (Math.random() < dt * 25) this.emitParticle(center, particleTarget);
      if (blob.volume <= 0.02) {
        this.blobs.delete(id);
        sfx.squelch(center);
        for (let i = 0; i < 6; i++) this.emitParticle(center, particleTarget);
      }
    }
    this.collected += removed;
    return removed;
  }

  // Radius of the main lump, capped by the closest wall or furniture so it
  // never pokes through to the other side.
  radius(blob) {
    const size = 0.14 + 0.2 * Math.sqrt(blob.volume);
    return Math.max(0.06, Math.min(size, blob.node.clearance - 0.04));
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

  // One main lump plus two smaller ones per blob, flattened against the
  // surface it sits on. The smaller lumps spread toward the spot's roomiest
  // directions and stop short of anything solid. Blobs being vacuumed jitter.
  draw() {
    const { m, q, s, p, t } = this.tmp;
    let i = 0;
    for (const blob of this.blobs.values()) {
      const r = this.radius(blob);
      const node = blob.node;
      q.setFromUnitVectors(UP, node.normal);
      const jitter = blob.sucked > 0 ? 0.04 : 0;
      blob.sucked = Math.max(0, (blob.sucked ?? 0) - 0.016);
      const grown = 0.14 + 0.2 * Math.sqrt(blob.volume);
      for (let k = 0; k < PARTS; k++) {
        let size = r;
        t.set(0, 0, 0);
        if (k > 0) {
          const open = node.openDirs[k - 1];
          // Capped by the tightest side too, so it can't poke through sideways.
          size = Math.min(grown * (0.45 + 0.15 * frac(blob.seed * (k + 3))), node.clearance - 0.04);
          const offset = Math.min(grown * 0.95, open.dist - size - 0.04);
          if (offset < 0.02) size = 0; // no room for this lump
          else t.copy(open.dir).multiplyScalar(offset);
        }
        if (size <= 0) continue;
        p.copy(node.pos).add(t);
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
