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
  raycast(origin, dir, maxT, ignore = []) {
    let best = maxT;
    for (const b of this.boxes) {
      if (!b.enabled || ignore.includes(b)) continue;
      const t = rayBox(origin, dir, b);
      if (t !== null && t < best) best = t;
    }
    return best;
  }
}

function rayBox(o, d, b) {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (const [oa, da, lo, hi] of [[o.x, d.x, b.minX, b.maxX], [o.y, d.y, b.minY, b.maxY], [o.z, d.z, b.minZ, b.maxZ]]) {
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
