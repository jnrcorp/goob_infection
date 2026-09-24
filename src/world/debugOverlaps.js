// Finds static surfaces that nearly coincide: two faces pointing the same way,
// less than TOLERANCE apart, overlapping in area, with different materials.
// Those flicker ("z-fighting"). Run with ?checkfaces; results go to the console.

const TOLERANCE = 0.03;

function facesOf(r) {
  if (r.kind === 'plane') {
    return [{ axis: 1, sign: r.facingDown ? -1 : 1, at: r.y, a0: r.x0, a1: r.x1, b0: r.z0, b1: r.z1, r }];
  }
  return [
    { axis: 0, sign: -1, at: r.x0, a0: r.y0, a1: r.y1, b0: r.z0, b1: r.z1, r },
    { axis: 0, sign: 1, at: r.x1, a0: r.y0, a1: r.y1, b0: r.z0, b1: r.z1, r },
    { axis: 1, sign: -1, at: r.y0, a0: r.x0, a1: r.x1, b0: r.z0, b1: r.z1, r },
    { axis: 1, sign: 1, at: r.y1, a0: r.x0, a1: r.x1, b0: r.z0, b1: r.z1, r },
    { axis: 2, sign: -1, at: r.z0, a0: r.x0, a1: r.x1, b0: r.y0, b1: r.y1, r },
    { axis: 2, sign: 1, at: r.z1, a0: r.x0, a1: r.x1, b0: r.y0, b1: r.y1, r },
  ].filter((f) => !(r.noTop && f.axis === 1 && f.sign === 1));
}

export function findOverlappingFaces(records) {
  const buckets = new Map();
  const keyOf = (f, cell) => `${f.axis}${f.sign}:${cell}`;
  const faces = records.flatMap(facesOf);
  for (const f of faces) {
    const key = keyOf(f, Math.round(f.at / TOLERANCE));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(f);
  }

  const found = [];
  for (const f of faces) {
    const cell = Math.round(f.at / TOLERANCE);
    for (const c of [cell - 1, cell, cell + 1]) {
      for (const g of buckets.get(keyOf(f, c)) ?? []) {
        if (g === f || g.r === f.r || f.r.mat === g.r.mat || f.r.mat > g.r.mat) continue;
        if (Math.abs(f.at - g.at) >= TOLERANCE) continue;
        const w = Math.min(f.a1, g.a1) - Math.max(f.a0, g.a0);
        const h = Math.min(f.b1, g.b1) - Math.max(f.b0, g.b0);
        if (w > 0.005 && h > 0.005) found.push({ f, g, area: w * h });
      }
    }
  }
  return found;
}

// filter: only list pairs whose materials include this name (?checkfaces=desk).
export function reportOverlappingFaces(records, filter = '') {
  const found = findOverlappingFaces(records).filter(({ f, g }) => !filter || f.r.mat === filter || g.r.mat === filter);
  const axisName = ['x', 'y', 'z'];
  console.log(`[checkfaces] ${found.length} overlapping face pairs`);
  const byPair = new Map();
  for (const { f, g } of found) {
    const key = `${f.r.mat} vs ${g.r.mat}`;
    byPair.set(key, (byPair.get(key) ?? 0) + 1);
  }
  for (const [pair, n] of [...byPair].sort((a, b) => b[1] - a[1])) console.log(`[checkfaces] ${n} x ${pair}`);
  for (const { f, g, area } of found.sort((a, b) => b.area - a.area).slice(0, 40)) {
    const fmt = (face) => `${face.r.mat} ${face.r.kind} ${JSON.stringify(Object.fromEntries(
      Object.entries(face.r).filter(([k]) => /^[xyz][01]?$/.test(k)).map(([k, v]) => [k, +v.toFixed(2)])
    ))}`;
    console.log(`[checkfaces] ${axisName[f.axis]}${f.sign > 0 ? '+' : '-'} at ${f.at.toFixed(3)} / ${g.at.toFixed(3)}, area ${area.toFixed(2)}: ${fmt(f)} vs ${fmt(g)}`);
  }
}
