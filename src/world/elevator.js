import * as THREE from 'three';
import { sfx } from '../core/sound.js';
import { ps1ify } from '../render/ps1.js';
import { toTexture } from '../render/textures.js';

const CAR_SPEED = 1.6;   // m/s
const DOOR_SPEED = 1.1;  // fraction per second
const HOLD_OPEN = 4;     // seconds before doors close on their own
const CAR_HEIGHT = 3;
const DISPLAY_W = 0.56; // floor display over each landing's doors
const DISPLAY_H = 0.18;

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
    // Control panel on the side wall: one button per floor, top floor highest.
    const n = this.floors.length;
    const spacing = 0.13;
    add(new THREE.BoxGeometry(0.03, spacing * n + 0.12, 0.25), materials.get('plastic'), x1 - 0.05, 1.2, z0 + 0.45);
    const name = (i) => def.floorNames?.[i] ?? `${i + 1}F`;
    this.floors.forEach((_, i) => {
      const y = 1.2 + (i - (n - 1) / 2) * spacing;
      const button = add(new THREE.BoxGeometry(0.03, 0.08, 0.1), materials.get('light'), x1 - 0.075, y, z0 + 0.45);
      interactions.add({
        mesh: button,
        label: () => {
          if (this.jammed) return 'Out of service';
          if (this.phase === 'moving') return 'Elevator moving…';
          return i === this.current ? `${name(i)} (you're here)` : `Go to ${name(i)}`;
        },
        use: () => this.request(i),
      });
    });

    this.floorCollider = collision.addBox(x0, 0, z0, x1, 0, z1);
    this.ceilingCollider = collision.addBox(x0, 0, z0, x1, 0, z1);
    this.syncCar();

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
      interactions.add({
        mesh: [button, lamp],
        label: () => (this.jammed ? 'Elevator: out of service' : 'Call elevator'),
        use: () => this.request(i),
      });

      // Threshold plate filling the doorway (the wall's thickness) between
      // the landing floor and the car, so you can't see down the shaft.
      // A hair above the floor so it doesn't flicker against it.
      const sill = new THREE.Mesh(new THREE.BoxGeometry(def.doorW + 0.1, 0.2, z0 - (z - 0.12)), materials.get('metal'));
      sill.position.set(def.doorAt, fy - 0.096, (z - 0.12 + z0) / 2);
      scene.add(sill);
      collision.addBox(def.doorAt - hw - 0.05, fy - 0.2, z - 0.12, def.doorAt + hw + 0.05, fy + 0.004, z0);

      // Floor display above the doors (every landing shows the same thing).
      const display = new THREE.Mesh(new THREE.PlaneGeometry(DISPLAY_W, DISPLAY_H), this.displayMaterial);
      display.position.set(def.doorAt, fy + 2.31, z - 0.13);
      display.rotation.y = Math.PI; // face the hallway (-z)
      scene.add(display);

      return { left, right, collider, fy };
    });

    // Inside the car: a front wall with a doorway lined up with the landing
    // doors, car doors that slide with them, and a floor display above.
    const fz = z0 + 0.03;
    const wallH = CAR_HEIGHT - 0.1;
    const leftW = def.doorAt - hw - x0;
    const rightW = x1 - (def.doorAt + hw);
    add(new THREE.BoxGeometry(leftW, wallH, 0.03), steel, x0 + leftW / 2, wallH / 2, fz);
    add(new THREE.BoxGeometry(rightW, wallH, 0.03), steel, x1 - rightW / 2, wallH / 2, fz);
    add(new THREE.BoxGeometry(def.doorW, wallH - 2.2, 0.03), steel, def.doorAt, 2.2 + (wallH - 2.2) / 2, fz);
    this.carDoors = {
      left: add(new THREE.BoxGeometry(hw, 2.2, 0.04), steel, def.doorAt - hw / 2, 1.1, z0 + 0.07),
      right: add(new THREE.BoxGeometry(hw, 2.2, 0.04), steel, def.doorAt + hw / 2, 1.1, z0 + 0.07),
    };
    // Closed car doors block the doorway while the car is between floors.
    this.carDoorCollider = collision.addBox(def.doorAt - hw, 0, z0 + 0.03, def.doorAt + hw, 2.2, z0 + 0.11);
    this.carDoorCollider.wall = true;
    const inside = add(new THREE.PlaneGeometry(DISPLAY_W, DISPLAY_H), this.displayMaterial, def.doorAt, 2.45, fz + 0.02);
    inside.rotation.y = 0; // faces into the car (+z)

    this.syncCar();
    this.syncDoors();
    this.updateDisplay();
  }

  // One canvas shared by every landing's display: which floor the car is at
  // (or passing), with an arrow while it's moving.
  get displayMaterial() {
    if (this.display) return this.display.material;
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 62;
    const map = toTexture(canvas);
    map.magFilter = THREE.LinearFilter;
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    const material = ps1ify(new THREE.MeshBasicMaterial({ map }));
    this.display = { canvas, map, material, text: null };
    return material;
  }

  updateDisplay() {
    const name = (i) => this.def.floorNames?.[i] ?? `${i + 1}F`;
    // The floor the car is nearest, so it counts past floors on the way.
    let near = 0;
    this.floors.forEach((fy, i) => { if (Math.abs(fy - this.carY) < Math.abs(this.floors[near] - this.carY)) near = i; });
    let arrow = '';
    if (this.phase === 'moving') arrow = this.floors[this.target] > this.carY ? '▲' : '▼';
    const text = this.jammed ? 'OUT' : `${arrow} ${name(near)}`.trim();
    const d = this.display;
    if (d.text === text) return;
    d.text = text;
    const g = d.canvas.getContext('2d');
    const { width: w, height: h } = d.canvas;
    g.fillStyle = '#1a1a1a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#050505';
    g.fillRect(4, 4, w - 8, h - 8);
    g.fillStyle = this.jammed ? '#ff4030' : '#ffb030';
    g.font = `bold ${Math.round(h * 0.62)}px "Courier New", monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    d.map.needsUpdate = true;
  }

  reset() {
    this.current = this.target = this.def.startFloor;
    this.carY = this.floors[this.current];
    this.phase = 'closed';
    this.open.fill(0);
    this.syncCar();
    this.syncDoors();
  }

  // Breaks down: returns to the ground floor (y 0) and stays there with its
  // doors jammed open. Buttons stop working.
  jam() {
    const ground = Math.max(0, this.floors.indexOf(0));
    this.current = this.target = ground;
    this.carY = this.floors[ground];
    this.phase = 'jammed';
    this.open.fill(0);
    this.open[ground] = 0.8;
    this.syncCar();
    this.syncDoors();
  }

  // Working again (after the cleanup): stays where it is with its doors shut.
  repair() {
    if (!this.jammed) return;
    this.phase = 'closed';
    this.target = this.current;
    this.open.fill(0);
    this.syncDoors();
  }

  get jammed() {
    return this.phase === 'jammed';
  }

  // Center of the car floor, for putting goob in it.
  get carFloorPoint() {
    return { x: (this.def.x0 + this.def.x1) / 2, y: this.carY, z: (this.def.z0 + this.def.z1) / 2 };
  }

  request(floor) {
    if (this.phase === 'moving' || this.jammed) return;
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
          sfx.elevator({ x: this.def.doorAt, y: this.carY + 1.5, z: this.def.doorZ });
        } else {
          this.carY += Math.sign(dy) * step;
        }
        break;
      }
    }
    this.syncCar();
    this.syncDoors();
    this.updateDisplay();
  }

  syncCar() {
    this.car.position.y = this.carY;
    this.floorCollider.minY = this.carY - 0.15;
    this.floorCollider.maxY = this.carY;
    this.ceilingCollider.minY = this.carY + CAR_HEIGHT - 0.1;
    this.ceilingCollider.maxY = this.carY + CAR_HEIGHT;
    if (this.carDoorCollider) {
      this.carDoorCollider.minY = this.carY;
      this.carDoorCollider.maxY = this.carY + 2.2;
    }
  }

  syncDoors() {
    const hw = this.def.doorW / 2;
    const travel = hw - 0.1;
    this.doors.forEach((d, i) => {
      const f = this.open[i];
      d.left.position.x = this.def.doorAt - hw / 2 - f * travel;
      d.right.position.x = this.def.doorAt + hw / 2 + f * travel;
      // Half-open jammed doors still leave a gap wide enough to squeeze through.
      d.collider.enabled = f < (this.jammed ? 0.5 : 0.85);
    });
    // The car doors open and close with the landing doors of the floor the
    // car is at (they're shut while it moves).
    const f = this.phase === 'moving' ? 0 : this.open[this.current];
    this.carDoors.left.position.x = this.def.doorAt - hw / 2 - f * travel;
    this.carDoors.right.position.x = this.def.doorAt + hw / 2 + f * travel;
    this.carDoorCollider.enabled = f < (this.jammed ? 0.5 : 0.85);
  }
}
