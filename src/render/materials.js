import * as THREE from 'three';
import { createTextures } from './textures.js';
import { ps1ify } from './ps1.js';

// Meters covered by one repeat of each texture on world-mapped geometry.
const TILE = {
  wall: 2, carpet: 1.5, carpetRed: 1.5, ceiling: 1.2, linoleum: 1.2, tile: 0.8,
  concrete: 2, steel: 1, locker: 0.5, wood: 1, desk: 1, plastic: 0.5, screen: 0.5,
  cubicle: 1, chair: 0.5, metal: 1, stall: 1, freezer: 1, freezerFloor: 0.6,
  hazard: 0.8, shutter: 1, cardboard: 0.6, asphalt: 4, suit: 0.5, counter: 1,
  fridge: 1, vending: 1, red: 0.5, plant: 0.5, pot: 0.5, rubber: 0.5,
};

// Big architectural surfaces don't get vertex wobble (see ps1ify).
const NO_SNAP = new Set([
  'wall', 'carpet', 'carpetRed', 'ceiling', 'linoleum', 'tile', 'concrete',
  'freezer', 'freezerFloor', 'hazard', 'shutter', 'asphalt',
]);

export function createMaterials(maxAnisotropy = 1) {
  const textures = createTextures(maxAnisotropy);
  const mats = {};

  for (const [name, map] of Object.entries(textures)) {
    mats[name] = ps1ify(new THREE.MeshLambertMaterial({ map }), { snap: !NO_SNAP.has(name) });
  }
  // Unlit materials: light panels, screens, glass and the goob itself.
  mats.screen = ps1ify(new THREE.MeshBasicMaterial({ map: textures.screen }));
  mats.light = ps1ify(new THREE.MeshBasicMaterial({ color: 0xfff6e0 }), { snap: false });
  mats.lightBlue = ps1ify(new THREE.MeshBasicMaterial({ color: 0xcfe8ff }), { snap: false });
  mats.visor = ps1ify(new THREE.MeshBasicMaterial({ color: 0x14201e }));
  mats.goob = ps1ify(new THREE.MeshBasicMaterial({ color: 0x6cff4a }));
  mats.glass = ps1ify(new THREE.MeshBasicMaterial({
    color: 0x9fc4d0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide,
  }), { snap: false });

  return {
    get(name) {
      const m = mats[name];
      if (!m) throw new Error(`Unknown material "${name}"`);
      return m;
    },
    tile(name) {
      return TILE[name] ?? 1;
    },
  };
}
