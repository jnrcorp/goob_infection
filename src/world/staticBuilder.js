import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Collects static boxes and planes, adds their colliders, and merges all
// geometry that shares a material into one mesh (a few draw calls total).
export class StaticBuilder {
  constructor(materials, collision) {
    this.materials = materials;
    this.collision = collision;
    this.buckets = new Map();
  }

  // Box from min to max corner. mat = null adds only a collider.
  // opts.collide (default true), opts.boxUV: stretch the texture over each face
  // instead of tiling it in world space.
  box(x0, y0, z0, x1, y1, z1, mat, opts = {}) {
    if (x1 - x0 <= 1e-4 || y1 - y0 <= 1e-4 || z1 - z0 <= 1e-4) return null;
    const collider = opts.collide === false ? null : this.collision.addBox(x0, y0, z0, x1, y1, z1);
    if (mat) {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      if (!opts.boxUV) worldUV(g, this.materials.tile(mat));
      this.add(mat, g);
    }
    return collider;
  }

  // Horizontal plane facing up (floors) or down (ceilings). No collider.
  plane(x0, z0, x1, z1, y, mat, facingDown = false) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(facingDown ? Math.PI / 2 : -Math.PI / 2);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    worldUV(g, this.materials.tile(mat));
    this.add(mat, g);
  }

  add(mat, geometry) {
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(geometry);
  }

  finish(scene) {
    for (const [mat, geometries] of this.buckets) {
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, this.materials.get(mat));
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
    }
    this.buckets.clear();
  }
}

// Set UVs from world position so textures tile evenly across any box size
// and line up between neighboring pieces.
function worldUV(g, tile) {
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    let u, v;
    if (ny > 0.5) { u = pos.getX(i); v = pos.getZ(i); }
    else if (nx > 0.5) { u = pos.getZ(i); v = pos.getY(i); }
    else { u = pos.getX(i); v = pos.getY(i); }
    uv.setXY(i, u / tile, v / tile);
  }
}
