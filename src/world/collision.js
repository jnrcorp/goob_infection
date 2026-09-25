// Axis-aligned boxes and ramps the player collides with.
// Boxes can be toggled (doors) or moved (elevator) via their fields.
export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.ramps = [];
  }

  addBox(minX, minY, minZ, maxX, maxY, maxZ) {
    const box = { minX, minY, minZ, maxX, maxY, maxZ, enabled: true };
    this.boxes.push(box);
    return box;
  }

  // A ramp rising along +z from y0 at minZ to y1 at maxZ (used for stairs).
  addRamp({ minX, maxX, minZ, maxZ, y0, y1, offset = 0 }) {
    const ramp = {
      minX, maxX, minZ, maxZ,
      heightAt(z) {
        const t = (z - minZ) / (maxZ - minZ);
        return Math.min(y1, y0 + offset + t * (y1 - y0));
      },
    };
    this.ramps.push(ramp);
    return ramp;
  }

  // Distance along the ray to the nearest enabled box, or maxT if none is closer.
  // Boxes in `ignore` (an array or Set), or containing `ignorePoint`, are skipped.
  raycast(origin, dir, maxT, ignore = [], ignorePoint = null) {
    const skip = ignore instanceof Set ? (b) => ignore.has(b) : (b) => ignore.includes(b);
    let best = maxT;
    for (const b of this.boxes) {
      if (!b.enabled || skip(b)) continue;
      if (ignorePoint && contains(b, ignorePoint, 0.01)) continue;
      const t = rayBox(origin, dir, b);
      if (t !== null && t < best) best = t;
    }
    return best;
  }

  // Highest walkable surface under a footprint (half-size r) that's at most
  // `step` above height y: box tops and ramps. -Infinity if none.
  groundAt(x, z, y, r, step, ignore = new Set()) {
    let best = -Infinity;
    for (const b of this.boxes) {
      if (!b.enabled || ignore.has(b) || b.maxY > y + step || b.maxY <= best) continue;
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) best = b.maxY;
    }
    for (const ramp of this.ramps) {
      if (x < ramp.minX || x > ramp.maxX || z < ramp.minZ || z > ramp.maxZ) continue;
      const h = ramp.heightAt(z);
      if (h <= y + step && h > best) best = h;
    }
    return best;
  }

  // Does the segment from `a` to `b` pass through this one box (enabled or not)?
  segmentHits(box, a, b) {
    const dir = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = Math.hypot(dir.x, dir.y, dir.z);
    if (len < 1e-6) return false;
    dir.x /= len; dir.y /= len; dir.z /= len;
    const t = rayBox(a, dir, box);
    return t !== null && t <= len;
  }

  // Is the point inside any enabled box (other than those in `ignore`)?
  pointInside(p, ignore = new Set()) {
    return this.boxes.some((b) => b.enabled && !ignore.has(b) && contains(b, p, 0));
  }
}

function contains(b, p, margin) {
  return p.x >= b.minX - margin && p.x <= b.maxX + margin
    && p.y >= b.minY - margin && p.y <= b.maxY + margin
    && p.z >= b.minZ - margin && p.z <= b.maxZ + margin;
}

// Slab test. Returns the entry distance (0 if the origin is inside), or null.
function rayBox(o, d, b) {
  let tmin = -Infinity;
  let tmax = Infinity;
  const axes = [o.x, d.x, b.minX, b.maxX, o.y, d.y, b.minY, b.maxY, o.z, d.z, b.minZ, b.maxZ];
  for (let i = 0; i < 12; i += 4) {
    const oa = axes[i], da = axes[i + 1], lo = axes[i + 2], hi = axes[i + 3];
    if (Math.abs(da) < 1e-9) {
      if (oa < lo || oa > hi) return null;
      continue;
    }
    const t1 = (lo - oa) / da;
    const t2 = (hi - oa) / da;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
    if (tmax < tmin) return null;
  }
  if (tmax < 0) return null;
  return Math.max(tmin, 0);
}
