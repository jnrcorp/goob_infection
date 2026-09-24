import * as THREE from 'three';

const REACH = 2.2;

// Look-at-and-press-E interactions. An item is
// { mesh: Mesh | Mesh[], label: string | () => string, use(player), enabled?(), ignore?: collider[] }.
export class Interactions {
  constructor(camera, collision, hud) {
    this.camera = camera;
    this.collision = collision;
    this.hud = hud;
    this.meshes = [];
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = REACH;
    this.center = new THREE.Vector2(0, 0);
  }

  add(item) {
    for (const mesh of [].concat(item.mesh)) {
      mesh.userData.interact = item;
      this.meshes.push(mesh);
    }
    return item;
  }

  update(input, player, active) {
    let current = null;
    if (active) {
      this.camera.updateMatrixWorld();
      this.raycaster.setFromCamera(this.center, this.camera);
      const hit = this.raycaster.intersectObjects(this.meshes, false)[0];
      if (hit) {
        const item = hit.object.userData.interact;
        const { origin, direction } = this.raycaster.ray;
        const limit = hit.distance - 0.02;
        const blocked = this.collision.raycast(origin, direction, limit, item.ignore) < limit;
        if (!blocked && (!item.enabled || item.enabled())) current = item;
      }
    }
    const label = current && (typeof current.label === 'function' ? current.label() : current.label);
    this.hud.setPrompt(label ? `[E] ${label}` : null);
    if (current && input.wasPressed('KeyE')) current.use(player);
  }
}
