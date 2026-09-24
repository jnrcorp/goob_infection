import * as THREE from 'three';

const SWING_SPEED = 3.2; // radians per second
const OPEN_ANGLE = Math.PI / 2 * 0.95;

// A hinged door that swings away from whoever opens it.
// axis 'x': the wall runs along x. axis 'z': the wall runs along z.
export class Door {
  constructor(ctx, { x, y, z, axis, w, h = 2.18, mat = 'door', label = 'door', locked = null }) {
    const { scene, collision, materials, interactions, hud } = ctx;
    this.hud = hud;
    this.x = x;
    this.z = z;
    this.axis = axis;
    this.locked = locked;
    this.angle = 0;
    this.target = 0;

    const pw = w - 0.04;
    const t = 0.06;
    this.pivot = new THREE.Group();
    const panel = new THREE.Mesh(
      axis === 'x' ? new THREE.BoxGeometry(pw, h, t) : new THREE.BoxGeometry(t, h, pw),
      materials.get(mat)
    );
    const handle = new THREE.Mesh(
      axis === 'x' ? new THREE.BoxGeometry(0.12, 0.04, 0.16) : new THREE.BoxGeometry(0.16, 0.04, 0.12),
      materials.get('metal')
    );
    if (axis === 'x') {
      this.pivot.position.set(x - w / 2 + 0.02, y, z);
      panel.position.set(pw / 2, h / 2, 0);
      handle.position.set(pw - 0.12, 1.0, 0);
    } else {
      this.pivot.position.set(x, y, z - w / 2 + 0.02);
      panel.position.set(0, h / 2, pw / 2);
      handle.position.set(0, 1.0, pw - 0.12);
    }
    this.pivot.add(panel, handle);
    scene.add(this.pivot);

    this.collider = axis === 'x'
      ? collision.addBox(x - w / 2, y, z - 0.05, x + w / 2, y + h, z + 0.05)
      : collision.addBox(x - 0.05, y, z - w / 2, x + 0.05, y + h, z + w / 2);

    const name = label.charAt(0).toUpperCase() + label.slice(1);
    interactions.add({
      mesh: [panel, handle],
      ignore: [this.collider],
      label: () => (this.locked ? `${name} (locked)` : `${this.isOpen ? 'Close' : 'Open'} ${label}`),
      use: (player) => this.toggle(player),
    });
  }

  get isOpen() {
    return this.target !== 0;
  }

  toggle(player) {
    if (this.locked) {
      this.hud.toast(this.locked);
      return;
    }
    if (this.isOpen) {
      this.target = 0;
      return;
    }
    // Positive rotation swings an x-axis door toward -z and a z-axis door toward +x.
    const sign = this.axis === 'x'
      ? (player.pos.z < this.z ? -1 : 1)
      : (player.pos.x < this.x ? 1 : -1);
    this.target = sign * OPEN_ANGLE;
    this.collider.enabled = false;
  }

  update(dt) {
    const diff = this.target - this.angle;
    const step = SWING_SPEED * dt;
    this.angle = Math.abs(diff) <= step ? this.target : this.angle + Math.sign(diff) * step;
    this.pivot.rotation.y = this.angle;
    if (this.target === 0 && this.angle === 0) this.collider.enabled = true;
  }
}
