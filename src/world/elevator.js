import * as THREE from 'three';

const CAR_SPEED = 1.6;   // m/s
const DOOR_SPEED = 1.1;  // fraction per second
const HOLD_OPEN = 4;     // seconds before doors close on their own
const CAR_HEIGHT = 3;

// Elevator car that travels between floors, with sliding shaft doors and
// call buttons on each floor. Phases: closed → opening → open → closing → moving.
export class Elevator {
  constructor(ctx, def) {
    const { scene, collision, materials, interactions } = ctx;
    this.def = def;
    this.floors = def.floors;
    this.current = def.startFloor;
    this.target = this.current;
    this.carY = this.floors[this.current];
    this.phase = 'closed';
    this.timer = 0;
    this.open = this.floors.map(() => 0);

    const { x0, x1, z0, z1 } = def;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const w = x1 - x0;
    const d = z1 - z0;
    const steel = materials.get('steel');

    // Car
    this.car = new THREE.Group();
    scene.add(this.car);
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      this.car.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(w, 0.15, d), materials.get('freezerFloor'), cx, -0.075, cz);
    add(new THREE.BoxGeometry(w, 0.1, d), steel, cx, CAR_HEIGHT - 0.05, cz);
    add(new THREE.BoxGeometry(1.2, 0.02, 0.5), materials.get('light'), cx, CAR_HEIGHT - 0.11, cz);
    add(new THREE.BoxGeometry(0.03, CAR_HEIGHT - 0.1, d), steel, x0 + 0.02, (CAR_HEIGHT - 0.1) / 2, cz);
    add(new THREE.BoxGeometry(0.03, CAR_HEIGHT - 0.1, d), steel, x1 - 0.02, (CAR_HEIGHT - 0.1) / 2, cz);
    add(new THREE.BoxGeometry(w, CAR_HEIGHT - 0.1, 0.03), steel, cx, (CAR_HEIGHT - 0.1) / 2, z1 - 0.02);
    add(new THREE.BoxGeometry(w - 0.2, 0.05, 0.05), materials.get('metal'), cx, 0.95, z1 - 0.08);
    const panel = add(new THREE.BoxGeometry(0.03, 0.4, 0.25), materials.get('plastic'), x1 - 0.05, 1.2, z0 + 0.45);
    const b1 = add(new THREE.BoxGeometry(0.02, 0.06, 0.06), materials.get('light'), x1 - 0.07, 1.3, z0 + 0.45);
    const b2 = add(new THREE.BoxGeometry(0.02, 0.06, 0.06), materials.get('light'), x1 - 0.07, 1.1, z0 + 0.45);

    this.floorCollider = collision.addBox(x0, 0, z0, x1, 0, z1);
    this.ceilingCollider = collision.addBox(x0, 0, z0, x1, 0, z1);
    this.syncCar();

    const floorName = (i) => `${i + 1}F`;
    const other = () => (this.current + 1) % this.floors.length;
    interactions.add({
      mesh: [panel, b1, b2],
      label: () => (this.phase === 'moving' ? 'Elevator moving…' : `Go to ${floorName(other())}`),
      use: () => this.request(other()),
    });

    // Shaft doors and call buttons on each floor
    const hw = def.doorW / 2;
    const z = def.doorZ;
    this.doors = this.floors.map((fy, i) => {
      const left = new THREE.Mesh(new THREE.BoxGeometry(hw, 2.2, 0.05), steel);
      const right = new THREE.Mesh(new THREE.BoxGeometry(hw, 2.2, 0.05), steel);
      left.position.set(def.doorAt - hw / 2, fy + 1.1, z);
      right.position.set(def.doorAt + hw / 2, fy + 1.1, z);
      scene.add(left, right);
      const collider = collision.addBox(def.doorAt - hw, fy, z - 0.1, def.doorAt + hw, fy + 2.2, z + 0.1);

      const bx = def.doorAt + hw + 0.35;
      const button = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.04), materials.get('plastic'));
      button.position.set(bx, fy + 1.2, z - 0.12);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), materials.get('light'));
      lamp.position.set(bx, fy + 1.2, z - 0.145);
      scene.add(button, lamp);
      interactions.add({ mesh: [button, lamp], label: 'Call elevator', use: () => this.request(i) });

      return { left, right, collider, fy };
    });
    this.syncDoors();
  }

  request(floor) {
    if (this.phase === 'moving') return;
    if (floor === this.current) {
      if (this.phase === 'closed' || this.phase === 'closing') this.phase = 'opening';
      else if (this.phase === 'open') this.timer = HOLD_OPEN;
      return;
    }
    this.target = floor;
    if (this.phase !== 'closing') this.phase = 'closing';
  }

  playerInDoorway(player) {
    const { doorAt, doorW, doorZ } = this.def;
    const fy = this.floors[this.current];
    return Math.abs(player.pos.y - fy) < 1
      && Math.abs(player.pos.z - doorZ) < 0.45
      && Math.abs(player.pos.x - doorAt) < doorW / 2 + 0.3;
  }

  update(dt, player) {
    const i = this.current;
    switch (this.phase) {
      case 'opening':
        this.open[i] = Math.min(1, this.open[i] + dt * DOOR_SPEED);
        if (this.open[i] === 1) {
          this.phase = 'open';
          this.timer = HOLD_OPEN;
        }
        break;
      case 'open':
        this.timer -= dt;
        if (this.timer <= 0 && !this.playerInDoorway(player)) this.phase = 'closing';
        break;
      case 'closing':
        if (this.playerInDoorway(player)) {
          this.phase = 'opening';
          break;
        }
        this.open[i] = Math.max(0, this.open[i] - dt * DOOR_SPEED);
        if (this.open[i] === 0) this.phase = this.target !== i ? 'moving' : 'closed';
        break;
      case 'moving': {
        const dy = this.floors[this.target] - this.carY;
        const step = CAR_SPEED * dt;
        if (Math.abs(dy) <= step) {
          this.carY = this.floors[this.target];
          this.current = this.target;
          this.phase = 'opening';
        } else {
          this.carY += Math.sign(dy) * step;
        }
        break;
      }
    }
    this.syncCar();
    this.syncDoors();
  }

  syncCar() {
    this.car.position.y = this.carY;
    this.floorCollider.minY = this.carY - 0.15;
    this.floorCollider.maxY = this.carY;
    this.ceilingCollider.minY = this.carY + CAR_HEIGHT - 0.1;
    this.ceilingCollider.maxY = this.carY + CAR_HEIGHT;
  }

  syncDoors() {
    const hw = this.def.doorW / 2;
    const travel = hw - 0.1;
    this.doors.forEach((d, i) => {
      const f = this.open[i];
      d.left.position.x = this.def.doorAt - hw / 2 - f * travel;
      d.right.position.x = this.def.doorAt + hw / 2 + f * travel;
      d.collider.enabled = f < 0.85;
    });
  }
}
