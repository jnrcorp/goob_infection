// Walking routes for infected coworkers. Reuses the goob spot network's floor
// spots (a grid over every room plus the stairs), whose links are already
// checked for clear lines between spots. On Normal, infected can't open
// doors, so a link through a shut door can't be used.
export class Navigation {
  constructor(goobGraph) {
    this.graph = goobGraph;
    this.nodes = goobGraph.nodes.filter((n) => n.kind === 'floor');
    const walkable = new Set(this.nodes);
    this.links = new Map(this.nodes.map((n) => [n, n.links.filter((m) => walkable.has(m))]));
  }

  // Closest spot on roughly the same level as the point.
  nearest(p) {
    let best = null;
    let bestD = Infinity;
    for (const n of this.nodes) {
      const dy = Math.abs(n.pos.y - p.y);
      if (dy > 1.2) continue;
      const d = (n.pos.x - p.x) ** 2 + (n.pos.z - p.z) ** 2 + dy * dy * 4;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  // A* from one spot to another. Returns spot positions to walk through, or
  // null if there's no way there (e.g. every route is behind a shut door).
  // throughDoors: the walker can open doors (Hard difficulty).
  path(from, to, throughDoors = false) {
    if (!from || !to) return null;
    if (from === to) return [to.pos];
    const open = new Set([from]);
    const came = new Map();
    const g = new Map([[from, 0]]);
    const f = new Map([[from, from.pos.distanceTo(to.pos)]]);
    while (open.size) {
      let current = null;
      for (const n of open) if (!current || f.get(n) < f.get(current)) current = n;
      if (current === to) {
        const route = [current.pos];
        while (came.has(current)) {
          current = came.get(current);
          route.unshift(current.pos);
        }
        return route;
      }
      open.delete(current);
      for (const next of this.links.get(current)) {
        if (!throughDoors && !this.graph.canSpread(current, next)) continue; // shut door
        const cost = g.get(current) + current.pos.distanceTo(next.pos);
        if (cost >= (g.get(next) ?? Infinity)) continue;
        came.set(next, current);
        g.set(next, cost);
        f.set(next, cost + next.pos.distanceTo(to.pos));
        open.add(next);
      }
    }
    return null;
  }
}
