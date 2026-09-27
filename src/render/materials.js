import * as THREE from 'three';
import { generateSurfaces } from './surfaces.js';

// Meters covered by one repeat of each texture on world-mapped geometry.
const TILE = {
  wall: 2, carpet: 1.5, carpetRed: 1.5, ceiling: 1.2, linoleum: 1.2, tile: 0.8,
  concrete: 2, steel: 1, locker: 0.5, wood: 1, desk: 1, plastic: 0.5, screen: 0.5,
  cubicle: 1, chair: 0.5, metal: 1, stall: 1, freezer: 1, freezerFloor: 0.6,
  hazard: 0.8, shutter: 1, cardboard: 0.6, asphalt: 4, suit: 0.5, counter: 1,
  fridge: 1, vending: 1, red: 0.5, plant: 0.5, pot: 0.5, rubber: 0.5,
  trim: 1, facade: 3, grass: 3,
};

// Every surface is matte (diffuse light only, no shine or reflections):
// glossy highlights made rooms look washed out, and flickered as the nearest
// lights changed over.

// Light panels are brighter than white so bloom picks them up.
const PANEL_GLOW = 3;

// preset: the quality preset (texture size, normal maps).
export function createMaterials(renderer, preset) {
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  let generated = null;
  const mats = {};

  function generate(p) {
    generated?.dispose();
    generated = generateSurfaces(renderer, { size: p.textureSize, normalMaps: p.normalMaps, anisotropy });
    for (const [name, { map, normalMap }] of Object.entries(generated.surfaces)) {
      if (name === 'screen') {
        mats.screen ??= new THREE.MeshBasicMaterial();
        mats.screen.map = map;
        mats.screen.needsUpdate = true;
        continue;
      }
      mats[name] ??= new THREE.MeshLambertMaterial();
      const m = mats[name];
      const hadNormal = !!m.normalMap;
      m.map = map;
      m.normalMap = normalMap;
      if (hadNormal !== !!normalMap) m.needsUpdate = true;
    }
    textureKey = `${p.textureSize}/${p.normalMaps}`;
  }
  let textureKey = '';
  generate(preset);

  // Unlit materials: light panels, screens and the goob in the tank.
  mats.light = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff6e0).multiplyScalar(PANEL_GLOW) });
  mats.lightBlue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xcfe8ff).multiplyScalar(1.4) });
  mats.visor = new THREE.MeshLambertMaterial({ color: 0x14201e });
  mats.trophy = new THREE.MeshLambertMaterial({ color: 0xd9b03a, emissive: 0x3a2a00 });
  mats.goob = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6cff4a).multiplyScalar(1.3) });
  // Car paint and tinted car glass.
  for (const [name, color] of [['paintRed', 0x9a1b1b], ['paintSilver', 0xa8adb2], ['paintYellow', 0xd9a820], ['paintBlue', 0x1f3f7a], ['paintBlack', 0x16181b]]) {
    mats[name] = new THREE.MeshLambertMaterial({ color });
  }
  mats.tint = new THREE.MeshLambertMaterial({ color: 0x1b2328 });
  mats.glass = new THREE.MeshLambertMaterial({
    color: 0xb8d4dc, transparent: true, opacity: 0.18,
    depthWrite: false, side: THREE.DoubleSide,
  });

  return {
    get(name) {
      const m = mats[name];
      if (!m) throw new Error(`Unknown material "${name}"`);
      return m;
    },
    tile(name) {
      return TILE[name] ?? 1;
    },
    // New textures when the quality preset's texture size or normal maps change.
    regenerate(p) {
      if (`${p.textureSize}/${p.normalMaps}` !== textureKey) generate(p);
    },
  };
}
