import * as THREE from 'three';

const REACH = 2.2;

function isVisible(object) {
  for (let o = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

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
      // Raycasting doesn't skip hidden meshes, so take the first visible hit.
      const hit = this.raycaster.intersectObjects(this.meshes, false).find((h) => isVisible(h.object));
      if (hit) {
        const item = hit.object.userData.interact;
        const { origin, direction } = this.raycaster.ray;
        const limit = hit.distance - 0.02;
        // Colliders that contain the hit point (a rack around the suit, a desk
        // under a monitor) belong to the object itself and don't block it.
        const blocked = this.collision.raycast(origin, direction, limit, item.ignore, hit.point) < limit;
        if (!blocked && (!item.enabled || item.enabled())) current = item;
      }
    }
    const label = current && (typeof current.label === 'function' ? current.label() : current.label);
    this.hud.setPrompt(label ? `[E] ${label}` : null);
    if (current && input.wasPressed('KeyE')) current.use(player);
  }
}
