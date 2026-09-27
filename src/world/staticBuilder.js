import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { shadowMaterials, boxShadowGeometry } from '../render/shadows.js';

const SHADOW = '__shadow';
const FLOOR_LEVELS = [-4, 0, 4, 8];

// Collects static boxes and planes, adds their colliders, and merges all
// geometry that shares a material into one mesh (a few draw calls total).
export class StaticBuilder {
  constructor(materials, collision) {
    this.materials = materials;
    this.collision = collision;
    this.buckets = new Map();
    // Every visible box and plane, for debug checks (see debugOverlaps.js).
    this.records = [];
  }

  // Box from min to max corner. mat = null adds only a collider.
  // opts.collide (default true), opts.boxUV: stretch the texture over each face
  // instead of tiling it in world space. opts.noTop: leave out the top face
  // (for walls, whose tops are hidden under the next floor and would otherwise
  // flicker against it). opts.shadow: cast a soft contact shadow.
  // Collider-only boxes standing on a floor are furniture footprints, so they
  // cast one automatically.
  box(x0, y0, z0, x1, y1, z1, mat, opts = {}) {
    if (x1 - x0 <= 1e-4 || y1 - y0 <= 1e-4 || z1 - z0 <= 1e-4) return null;
    const collider = opts.collide === false ? null : this.collision.addBox(x0, y0, z0, x1, y1, z1);
    const onFloor = FLOOR_LEVELS.some((f) => Math.abs(y0 - f) < 0.02);
    if (onFloor && y1 - y0 >= 0.3 && (opts.shadow || (!mat && collider))) this.shadow(x0, z0, x1, z1, y0);
    if (mat) {
      this.records.push({ kind: 'box', x0, y0, z0, x1, y1, z1, mat, noTop: !!opts.noTop });
      let g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      if (opts.noTop) g = withoutTopFace(g);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      if (!opts.boxUV) worldUV(g, this.materials.tile(mat));
      this.add(mat, g);
    }
    return collider;
  }

  // Like box(), but with its edges rounded off (furniture), so they catch
  // the light.
  roundBox(x0, y0, z0, x1, y1, z1, mat, radius = 0.02, opts = {}) {
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;
    if (w <= 1e-4 || h <= 1e-4 || d <= 1e-4) return null;
    const r = Math.min(radius, w / 2, h / 2, d / 2) * 0.98;
    if (r < 0.002) return this.box(x0, y0, z0, x1, y1, z1, mat, opts);
    const collider = opts.collide === false ? null : this.collision.addBox(x0, y0, z0, x1, y1, z1);
    const onFloor = FLOOR_LEVELS.some((f) => Math.abs(y0 - f) < 0.02);
    if (onFloor && h >= 0.3 && opts.shadow) this.shadow(x0, z0, x1, z1, y0);
    const g = new RoundedBoxGeometry(w, h, d, 2, r);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    if (!opts.boxUV) worldUV(g, this.materials.tile(mat));
    this.add(mat, g);
    return collider;
  }

  // Any geometry (sized in meters, built around its own origin), turned by
  // rotY about the vertical axis and moved to (x, y, z). No collider.
  shape(geometry, mat, x, y, z, rotY = 0) {
    geometry.rotateY(rotY);
    geometry.translate(x, y, z);
    worldUV(geometry, this.materials.tile(mat));
    this.add(mat, geometry);
  }

  // Horizontal plane facing up (floors) or down (ceilings). No collider.
  plane(x0, z0, x1, z1, y, mat, facingDown = false) {
    this.records.push({ kind: 'plane', x0, z0, x1, z1, y, mat, facingDown });
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(facingDown ? Math.PI / 2 : -Math.PI / 2);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    worldUV(g, this.materials.tile(mat));
    this.add(mat, g);
  }

  // Soft contact shadow on the floor under a footprint.
  shadow(x0, z0, x1, z1, y) {
    this.add(SHADOW, boxShadowGeometry(x0, z0, x1, z1, y + 0.004));
  }

  add(mat, geometry) {
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(geometry);
  }

  finish(scene) {
    for (const [mat, list] of this.buckets) {
      // Rounded boxes come without an index; everything merged together
      // has to match.
      const geometries = list.some((g) => !g.index) ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list;
      const merged = mergeGeometries(geometries, false);
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, mat === SHADOW ? shadowMaterials.box : this.materials.get(mat));
      mesh.matrixAutoUpdate = false;
      if (mat === SHADOW) mesh.renderOrder = -1; // before other see-through things (glass)
      // Walls, floors and furniture cast and catch real shadows (when on).
      const solid = mat !== SHADOW && mat !== 'glass';
      mesh.castShadow = solid;
      mesh.receiveShadow = solid;
      scene.add(mesh);
    }
    this.buckets.clear();
  }
}

// BoxGeometry's faces are index groups in the order +x, -x, +y, -y, +z, -z.
// Drop the +y group's triangles.
function withoutTopFace(g) {
  const top = g.groups[2];
  const index = [...g.index.array];
  index.splice(top.start, top.count);
  g.setIndex(index);
  g.clearGroups();
  return g;
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
