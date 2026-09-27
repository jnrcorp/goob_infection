import * as THREE from 'three';
import { sfx } from '../core/sound.js';

const SWING_SPEED = 3.2; // radians per second
const OPEN_ANGLE = Math.PI / 2 * 0.95;

// A hinged door that swings away from whoever opens it.
// axis 'x': the wall runs along x. axis 'z': the wall runs along z.
export class Door {
  constructor(ctx, { x, y, z, axis, w, h = 2.18, mat = 'door', label = 'door', locked = null }) {
    const { scene, collision, materials, interactions, hud } = ctx;
    this.hud = hud;
    this.label = label;
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

    // Closed: blocks the doorway. Open: a thin box along the swung-open panel,
    // so you can't walk through the door itself.
    this.collider = axis === 'x'
      ? collision.addBox(x - w / 2, y, z - 0.05, x + w / 2, y + h, z + 0.05)
      : collision.addBox(x - 0.05, y, z - w / 2, x + 0.05, y + h, z + w / 2);
    this.collider.wall = true; // a shut door blocks the vacuum like a wall
    this.openCollider = collision.addBox(0, y, 0, 0, y + h, 0);
    this.openCollider.enabled = false;
    this.panelLength = pw;

    // A story step can take over the door with its own action (e.g. locking
    // the freezer): { enabled(), label, use(player) }.
    this.override = null;
    const name = label.charAt(0).toUpperCase() + label.slice(1);
    const overriding = () => this.override?.enabled();
    interactions.add({
      mesh: [panel, handle],
      ignore: [this.collider, this.openCollider],
      label: () => {
        if (overriding()) return this.override.label;
        return this.locked ? `${name} (locked)` : `${this.isOpen ? 'Close' : 'Open'} ${label}`;
      },
      use: (player) => (overriding() ? this.override.use(player) : this.toggle(player)),
    });
  }

  get isOpen() {
    return this.target !== 0;
  }

  // Snap shut (used when restarting the chapter).
  reset() {
    this.angle = this.target = 0;
    this.pivot.rotation.y = 0;
    this.syncColliders();
  }

  // Snap open. sign follows the same convention as toggle().
  setOpen(sign) {
    this.angle = this.target = sign * OPEN_ANGLE;
    this.pivot.rotation.y = this.angle;
    this.syncColliders();
  }

  // Closed collider when shut, panel collider when fully open, neither mid-swing.
  syncColliders() {
    const shut = this.target === 0 && this.angle === 0;
    const open = this.target !== 0 && this.angle === this.target;
    this.collider.enabled = shut;
    this.openCollider.enabled = open;
    if (!open) return;
    // Panel runs from the hinge in the direction the door now points.
    const hinge = this.pivot.position;
    const dx = this.axis === 'x' ? Math.cos(this.angle) : Math.sin(this.angle);
    const dz = this.axis === 'x' ? -Math.sin(this.angle) : Math.cos(this.angle);
    const ex = hinge.x + dx * this.panelLength;
    const ez = hinge.z + dz * this.panelLength;
    const c = this.openCollider;
    c.minX = Math.min(hinge.x, ex) - 0.04; c.maxX = Math.max(hinge.x, ex) + 0.04;
    c.minZ = Math.min(hinge.z, ez) - 0.04; c.maxZ = Math.max(hinge.z, ez) + 0.04;
  }

  toggle(player) {
    if (this.locked) {
      this.hud.toast(this.locked);
      return;
    }
    if (this.isOpen) {
      // Don't shut the door on the player.
      if (this.playerInDoorway(player)) return;
      this.target = 0;
      this.syncColliders();
      sfx.door(this.soundPos);
      return;
    }
    this.openFrom(player.pos);
  }

  // Swing open away from whoever is at `pos` (the player, or an infected
  // coworker shoving through).
  openFrom(pos) {
    if (this.locked || this.isOpen) return;
    // Positive rotation swings an x-axis door toward -z and a z-axis door toward +x.
    const sign = this.axis === 'x'
      ? (pos.z < this.z ? -1 : 1)
      : (pos.x < this.x ? 1 : -1);
    this.target = sign * OPEN_ANGLE;
    this.syncColliders();
    sfx.door(this.soundPos);
  }

  get soundPos() {
    return { x: this.x, y: this.pivot.position.y + 1, z: this.z };
  }

  // Player's body overlaps the closed door's space (plus their radius).
  playerInDoorway(player) {
    const c = this.collider;
    const r = 0.35;
    return player.pos.x + r > c.minX && player.pos.x - r < c.maxX
      && player.pos.z + r > c.minZ && player.pos.z - r < c.maxZ
      && player.pos.y < c.maxY && player.pos.y + 1.75 > c.minY;
  }

  update(dt, player) {
    // If the player steps into the doorway while it's swinging shut, open it back up.
    if (this.target === 0 && this.angle !== 0 && player && this.playerInDoorway(player)) {
      this.target = Math.sign(this.angle) * OPEN_ANGLE;
    }
    const diff = this.target - this.angle;
    const step = SWING_SPEED * dt;
    this.angle = Math.abs(diff) <= step ? this.target : this.angle + Math.sign(diff) * step;
    this.pivot.rotation.y = this.angle;
    this.syncColliders();
  }
}
