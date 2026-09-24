import * as THREE from 'three';
import { ps1ify } from '../render/ps1.js';
import { toTexture } from '../render/textures.js';

// Biohazard drums where the vacuum tank gets emptied.
// onUse(bin) is called when the player empties into one; label() gives the prompt.
export function createBins(ctx, spots, { label, enabled, onUse }) {
  const { scene, collision, materials, interactions } = ctx;
  const drum = materials.get('suit');
  const rim = materials.get('rubber');
  const symbol = biohazardMaterial();

  return spots.map((spot) => {
    const group = new THREE.Group();
    group.position.set(spot.x, spot.y, spot.z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.88, 12), drum);
    body.position.y = 0.44;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 12), rim);
    lid.position.y = 0.91;
    group.add(body, lid);
    // Labels on four sides so one always faces you.
    for (let i = 0; i < 4; i++) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), symbol);
      const a = (i * Math.PI) / 2;
      sign.position.set(Math.sin(a) * 0.345, 0.5, Math.cos(a) * 0.345);
      sign.rotation.y = a;
      group.add(sign);
    }
    scene.add(group);
    const collider = collision.addBox(spot.x - 0.36, spot.y, spot.z - 0.36, spot.x + 0.36, spot.y + 0.94, spot.z + 0.36);
    const bin = { group, collider, spot };
    interactions.add({
      mesh: group.children,
      ignore: [collider],
      label: () => label(bin),
      enabled: () => enabled(bin),
      use: () => onUse(bin),
    });
    return bin;
  });
}

// Black trefoil on yellow, drawn once and shared.
let cached = null;
function biohazardMaterial() {
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#e2ba24';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#111';
  g.strokeStyle = '#111';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(32, 34, 20, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    g.beginPath();
    g.arc(32 + Math.cos(a) * 11, 34 + Math.sin(a) * 11, 9, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#e2ba24';
  g.beginPath();
  g.arc(32, 34, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111';
  g.beginPath();
  g.arc(32, 34, 3, 0, Math.PI * 2);
  g.fill();
  cached = ps1ify(new THREE.MeshLambertMaterial({ map: toTexture(c) }));
  return cached;
}

// The containment vacuum hanging on its wall rack (world prop, not the one in
// your hands). Faces -x, out into the loading dock.
export function createVacuumRack(ctx, spot, { enabled, onUse }) {
  const { scene, collision, materials, interactions } = ctx;
  const group = new THREE.Group();
  group.position.set(spot.x, spot.y, spot.z);
  const add = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.get(mat));
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  // Wall bracket
  add(0.04, 0.9, 0.7, 'metal', -0.02, 1.1, 0);
  // The vacuum: yellow body, tank window, hose and nozzle
  const vacuum = new THREE.Group();
  const v = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.get(mat));
    m.position.set(x, y, z);
    vacuum.add(m);
    return m;
  };
  v(0.28, 0.5, 0.34, 'suit', -0.18, 1.05, 0);
  v(0.02, 0.26, 0.2, 'glass', -0.33, 1.1, 0);
  v(0.08, 0.08, 0.08, 'rubber', -0.18, 1.34, 0);
  v(0.06, 0.06, 0.5, 'rubber', -0.34, 0.85, 0.12);
  v(0.1, 0.1, 0.16, 'rubber', -0.34, 0.85, 0.42);
  group.add(vacuum);
  scene.add(group);
  collision.addBox(spot.x - 0.5, spot.y, spot.z - 0.38, spot.x, spot.y + 1.6, spot.z + 0.38);
  interactions.add({
    mesh: vacuum.children,
    label: 'Take the containment vacuum',
    enabled,
    use: onUse,
  });
  return { group, vacuum };
}
