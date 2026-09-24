// Split rect r into axis-aligned rects that cover it minus the holes.
// Rects are { x0, z0, x1, z1 }.
export function rectMinus(r, holes) {
  const hs = holes
    .map((h) => ({ x0: Math.max(h.x0, r.x0), z0: Math.max(h.z0, r.z0), x1: Math.min(h.x1, r.x1), z1: Math.min(h.z1, r.z1) }))
    .filter((h) => h.x1 > h.x0 && h.z1 > h.z0);
  if (!hs.length) return [{ ...r }];

  const cuts = (a, b) => [...new Set([r[a], r[b], ...hs.flatMap((h) => [h[a], h[b]])])].sort((m, n) => m - n);
  const xs = cuts('x0', 'x1');
  const zs = cuts('z0', 'z1');

  // Merge solid cells into horizontal runs per row.
  const rows = [];
  for (let j = 0; j < zs.length - 1; j++) {
    let run = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cz = (zs[j] + zs[j + 1]) / 2;
      const solid = !hs.some((h) => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1);
      if (solid) {
        if (run) run.x1 = xs[i + 1];
        else run = { x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] };
      } else if (run) {
        rows.push(run);
        run = null;
      }
    }
    if (run) rows.push(run);
  }

  // Merge vertically adjacent runs with the same x span.
  const out = [];
  for (const row of rows) {
    const above = out.find((o) => o.x0 === row.x0 && o.x1 === row.x1 && o.z1 === row.z0);
    if (above) above.z1 = row.z1;
    else out.push(row);
  }
  return out;
}

export function inRect(r, x, z) {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}
