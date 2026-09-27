import * as THREE from 'three';

// Texture from a canvas (signs, flyers, nameplates, displays).
export function toTexture(canvas, anisotropy = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
