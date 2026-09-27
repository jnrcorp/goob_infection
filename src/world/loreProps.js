import * as THREE from 'three';
import { toTexture } from '../render/textures.js';
import { MISSING } from '../story/lore.js';

const LOOK = {
  folder: { color: 0xd8b56a, w: 0.3, d: 0.23, h: 0.02 },
  paper: { color: 0xf4f2ea, w: 0.22, d: 0.29, h: 0.006 },
  note: { color: 0xf4e25a, w: 0.1, d: 0.1, h: 0.004 },
};

// The collectible files: folders, printouts and sticky notes lying on
// surfaces. A faint pulse makes them findable. { canRead(file), onRead(file) }.
export function createFiles(ctx, files, { canRead, onRead }) {
  const { scene, interactions } = ctx;
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.35, depthWrite: false });
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  return files.map((file, i) => {
    const look = LOOK[file.kind];
    const group = new THREE.Group();
    group.position.set(file.at.x, file.at.y + 0.004, file.at.z);
    group.rotation.y = (i * 1.7) % Math.PI;
    const mat = new THREE.MeshLambertMaterial({ color: look.color, emissive: look.color, emissiveIntensity: 0.25 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(look.w, look.h, look.d), mat);
    mesh.position.y = look.h / 2;
    // A soft halo just above it, so it catches the eye.
    const halo = new THREE.Mesh(new THREE.BoxGeometry(look.w + 0.08, 0.002, look.d + 0.08), glowMat);
    halo.position.y = 0.002;
    // A bigger invisible box to aim at: a sticky note is hard to hit with the crosshair.
    const pick = new THREE.Mesh(new THREE.BoxGeometry(look.w + 0.25, 0.12, look.d + 0.25), pickMat);
    pick.position.y = 0.06;
    group.add(halo, mesh, pick);
    scene.add(group);
    const item = {
      file,
      group,
      get found() { return !group.visible; },
      set found(v) { group.visible = !v; },
    };
    interactions.add({
      mesh: [mesh, pick],
      label: `Read: ${file.title}`,
      enabled: () => !item.found && canRead(file),
      use: () => onRead(item),
    });
    return item;
  });
}

// Missing-person flyers taped to walls.
// spots: [{ x, y, z, facing, person }], facing n/s/e/w like signs.
const FACING = { n: 0, s: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
export function createFlyers(scene, spots) {
  for (const s of spots) {
    const person = MISSING[s.person];
    const map = toTexture(drawFlyer(person, s.person));
    map.magFilter = THREE.LinearFilter;
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.56),
      new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.15 })
    );
    mesh.position.set(s.x, s.y, s.z);
    mesh.rotation.y = FACING[s.facing];
    mesh.rotation.z = ((s.person % 3) - 1) * 0.04; // taped up slightly crooked
    scene.add(mesh);
  }
}

// Photocopied flyer: MISSING, a blocky portrait, name and details.
function drawFlyer(person, seed) {
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#ece8dc';
  g.fillRect(0, 0, 300, 400);
  g.fillStyle = '#9e1c1c';
  g.font = 'bold 58px "Courier New", monospace';
  g.textAlign = 'center';
  g.fillText('MISSING', 150, 66);

  // Grainy photocopied portrait.
  const skins = ['#c68642', '#8d5524', '#e0ac69', '#f1c27d', '#6b4226'];
  const hairs = ['#2b1d0e', '#111111', '#5a3a1a', '#8a3b12', '#a8a8a8'];
  g.fillStyle = '#b8b4aa';
  g.fillRect(75, 90, 150, 150);
  g.fillStyle = skins[seed % skins.length];
  g.fillRect(110, 120, 80, 90);
  g.fillStyle = hairs[seed % hairs.length];
  g.fillRect(104, 108, 92, 26);
  g.fillStyle = '#111';
  g.fillRect(126, 152, 12, 10);
  g.fillRect(162, 152, 12, 10);
  g.fillRect(138, 188, 24, 5);
  g.fillStyle = '#6a6a6a';
  g.fillRect(90, 210, 120, 30);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${0.08 + ((i * 37) % 10) / 100})`;
    g.fillRect(75 + ((i * 53) % 150), 90 + ((i * 97) % 150), 2, 2);
  }

  g.fillStyle = '#1a1a1a';
  g.font = 'bold 30px "Courier New", monospace';
  g.fillText(person.name.toUpperCase(), 150, 282, 280);
  g.font = '20px "Courier New", monospace';
  g.fillText(person.dept, 150, 312, 280);
  g.fillText(`Last seen: ${person.seen}`, 150, 340, 290);
  g.fillText(`Missing since ${person.since}`, 150, 366, 280);
  g.font = 'italic 15px "Courier New", monospace';
  g.fillStyle = '#555';
  g.fillText('HR says: "transferred"', 150, 390);
  return c;
}
