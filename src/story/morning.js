import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DrivableCar } from '../world/drivableCar.js';
import { sfx } from '../core/sound.js';

// The start of the day, before the office: you wake up in bed to your alarm,
// get ready (brush your teeth, shower, coffee, toast, get dressed, grab your
// keys), drive to Goob Co. and park in any space, then head up to your desk.
// Stages: WAKE → CHORES → DRIVE → ARRIVE → done.

const PILLOW_EYE = { x: -58.8, y: 0.82, z: -25.35 }; // lying in bed
const OUT_OF_BED = { x: -57.2, y: 0, z: -23.2, yaw: Math.PI * 0.8 };
// In the driveway, nose east, pointing down the road to work.
const DRIVEWAY = { x: -53, z: -14.8, heading: -Math.PI / 2 };
// The Goob Co. lot's two rows of stalls (see furnishOutdoors): stopping in
// any of them, facing along the stall, counts as parked.
const STALL_ROWS = [{ x0: -6, x1: 34, z0: -8, z1: -3 }, { x0: -6, x1: 34, z0: -21, z1: -16 }];
// Where your car ends up when the morning's skipped, and at the end (a free
// stall in the north row, clear of the crowd in the finale).
const PARKED = { x: 27.8, z: -5.5, heading: Math.PI };
// The lot entrance (the gap in its west fence): a gate slides across it once
// you've arrived, so the outbreak stays at the office.
const GATE = { x: -8, z0: -14.3, z1: -9.7 };

const OBJECTIVES = {
  WAKE: 'Turn off your alarm (look at the clock on the nightstand).',
  DRIVE: 'Drive to work and park in any space in the Goob Co. lot. (W/S gas and brake, A/D steer.)',
  ARRIVE: "Head inside and up to your desk on 2F. Look for the CHAMP nameplate: your manager doesn't know your name, so he calls you Champ.",
};
// Chores in order, by step: first brush your teeth and shower (either
// first), then get dressed, then coffee and toast (either first), and last
// your keys.
const CHORES = [
  { id: 'teeth', name: 'brush your teeth', step: 0 },
  { id: 'shower', name: 'shower', step: 0 },
  { id: 'dressed', name: 'get dressed', step: 1 },
  { id: 'coffee', name: 'make coffee', step: 2 },
  { id: 'toast', name: 'make toast', step: 2 },
  { id: 'keys', name: 'grab your keys and badge', step: 3 },
];
// What to say when you try a chore too early (by step).
const TOO_EARLY = [
  '',
  "Get dressed? You haven't even showered and brushed your teeth yet.",
  "Breakfast in your pajamas? Wash up and get dressed first.",
  "Not yet. Breakfast first: coffee and toast.",
];

// Chapter 2: a week later, the middle of the night. Something's been slipped
// under the door.
const CHORES_2 = [
  { id: 'letter', name: 'read the letter by the front door', step: 0 },
  { id: 'gear', name: 'grab your hazard gear from the living room', step: 1 },
  { id: 'keys', name: 'grab your keys', step: 2 },
];
const TOO_EARLY_2 = ['', 'Something was slipped under the front door. Read it first.', 'You might need that gear. Grab it first.'];
const OBJECTIVES_2 = {
  WAKE: 'Something woke you. Turn off the alarm.',
  READY: 'Drive to Goob Co. HQ in the dark and park anywhere in the lot.',
  DRIVE: 'Drive to Goob Co. HQ and park anywhere in the lot. (W/S gas and brake, A/D steer.)',
  ARRIVE: 'Goob Co. is closed and taped off. Get inside and down to the B1 basement.',
};
export const LETTER = {
  title: 'Letter under the door',
  kind: 'note',
  body: `Champ,

It's Dr. Pell. Yes, I'm alive. No, I can't say where I've been.

You shut down the office. You didn't shut down the rotation. There's a floor under Goob Co. that isn't on any plan. B3. The next five "Employees of the Month" are down there right now, waiting to be transferred.

In the B1 basement, the north wall, past the server room: an elevator nobody uses. Code 4-2-7-9.

Bring the vacuum. Bring the spray. Stay out of the flashlights.

Burn this letter. (Don't actually. You'll need the code.)

- P.`,
};

export class Morning {
  constructor({ ctx, world, player, hud, fx, collision, reader }) {
    Object.assign(this, { world, player, hud, fx, collision, reader });
    this.mode = 1; // which chapter's morning (2: the night of chapter 2)
    this.onChoreDone = null; // (id) after each chore
    this.stage = 'done';
    this.busy = false;
    this.done = new Set();
    this.onDone = null; // called once you're at the office (see Chapter1)
    this.alarmIn = 0;
    const { scene, interactions, materials } = ctx;
    const m = (name) => materials.get(name);

    // Things you use. Each: a mesh (or group) and an interaction.
    const prop = (group, label, enabled, use) => {
      scene.add(group);
      const meshes = [];
      group.traverse((o) => { if (o.isMesh) { meshes.push(o); o.castShadow = o.receiveShadow = true; } });
      interactions.add({ mesh: meshes, label, enabled: () => !this.busy && enabled(), use });
      return group;
    };
    const box = (w, h, d, mat, r = 0) => new THREE.Mesh(r ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), m(mat));
    const at = (mesh, x, y, z) => { mesh.position.set(x, y, z); return mesh; };
    const group = (...children) => { const g = new THREE.Group(); g.add(...children); return g; };

    // Alarm clock on the nightstand, with a glowing face.
    const clockFace = at(box(0.12, 0.06, 0.005, 'screen'), 0, 0.045, 0.03);
    this.clock = prop(
      at(group(box(0.16, 0.09, 0.07, 'red', 0.02), clockFace), -57.65, 0.6, -25.62),
      () => (this.stage === 'WAKE' ? 'Turn off the alarm' : 'Alarm clock'),
      () => this.stage === 'WAKE',
      () => this.wakeUp(),
    );
    this.clock.rotation.y = -0.4;
    const chore = (id, label, verb, sound, toast, x, y, z, mesh) => prop(
      at(mesh, x, y, z),
      () => (this.done.has(id) ? label : `${verb}`),
      () => this.stage === 'CHORES' && !this.done.has(id) && this.chores.some((c) => c.id === id),
      () => {
        const step = this.chores.find((c) => c.id === id).step;
        if (step > this.currentStep) this.hud.toast((this.mode === 2 ? TOO_EARLY_2 : TOO_EARLY)[step], 3);
        else this.doChore(id, sound, toast);
      },
    );
    // Bathroom sink: a tall faucet behind the basin (its spout reaches over
    // the bowl, well above the rim) and a toothbrush cup.
    const pipe = (r, h) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m('steel'));
    const spout = pipe(0.014, 0.17);
    spout.rotation.x = Math.PI / 2;
    chore('teeth', 'Sink', 'Brush your teeth', sfx.water, 'Minty fresh.', -52.6, 0.9, -25.9,
      group(at(pipe(0.03, 0.02), 0, 0.01, 0), at(pipe(0.016, 0.3), 0, 0.16, 0), at(spout, 0, 0.3, 0.08),
        at(pipe(0.012, 0.04), 0, 0.28, 0.16), at(box(0.03, 0.02, 0.07, 'steel', 0.008), 0.05, 0.22, 0.01),
        at(box(0.06, 0.1, 0.06, 'lightBlue', 0.02), 0.33, 0.05, 0.3)));
    // Shower head and controls.
    chore('shower', 'Shower', 'Take a shower', sfx.water, 'Awake now. Mostly.', -48.8, 1.9, -25.9,
      group(at(box(0.16, 0.04, 0.16, 'steel', 0.02), 0, 0, 0.12), at(box(0.12, 0.12, 0.04, 'steel', 0.02), 0, -0.8, 0)));
    // Coffee maker and toaster on the kitchen counter.
    chore('coffee', 'Coffee maker', 'Make coffee', sfx.coffee, 'Coffee. The most important meal of the day.', -53.0, 0.9, -21.7,
      group(at(box(0.25, 0.35, 0.25, 'plastic', 0.03), 0, 0.175, 0), at(box(0.12, 0.12, 0.12, 'glass'), 0, 0.07, 0.07)));
    chore('toast', 'Toaster', 'Make toast', sfx.ding, 'Toast. Slightly burnt, like your hopes.', -52.2, 0.9, -21.7,
      group(at(box(0.28, 0.18, 0.16, 'steel', 0.04), 0, 0.09, 0)));
    // Wardrobe doors (the wardrobe itself is part of the room).
    chore('dressed', 'Wardrobe', 'Get dressed for work', sfx.rustle, 'Business casual. Mostly casual.', -59.05, 1.02, -20.72,
      group(at(box(0.8, 1.9, 0.03, 'door'), -0.41, 0, 0), at(box(0.8, 1.9, 0.03, 'door'), 0.41, 0, 0)));
    // Key hook by the front door, with your keys and badge.
    chore('keys', 'Key hook', 'Grab your keys and badge', sfx.keys, 'Keys, badge, sense of dread. Got everything.', -55.9, 1.45, -16.12,
      group(box(0.3, 0.12, 0.02, 'wood'), at(box(0.05, 0.08, 0.02, 'steel'), -0.06, -0.08, -0.01),
        at(box(0.06, 0.09, 0.01, 'fridge'), 0.07, -0.1, -0.01)));
    // Chapter 2: a letter on the floor inside the front door, and your old
    // hazard gear (suit, vacuum, antidote spray) in the living room corner.
    const envelope = box(0.24, 0.006, 0.16, 'fridge');
    envelope.rotation.y = 0.5;
    this.letterProp = chore('letter', 'Letter', 'Read the letter', sfx.rustle, 'Dr. Pell. He\u2019s alive.', -56.6, 0.004, -16.7,
      // (A bigger invisible box to aim at: the envelope is paper-thin.)
      group(envelope, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.45), new THREE.MeshBasicMaterial({ visible: false }))));
    this.gearProp = chore('gear', 'Hazard gear', 'Grab your hazard gear', sfx.pickup, 'Suit, vacuum, antidote. Just like old times.', -59.4, 0, -16.6,
      group(at(box(0.5, 0.9, 0.3, 'suit', 0.06), 0, 0.45, 0), at(box(0.22, 0.26, 0.42, 'suit', 0.04), 0.1, 0.13, 0.32),
        at(box(0.12, 0.3, 0.12, 'lightBlue', 0.04), -0.15, 0.15, 0.3)));
    this.chores = CHORES;

    // Your car, in the driveway.
    this.car = new DrivableCar(ctx, { x: DRIVEWAY.x, z: DRIVEWAY.z, heading: DRIVEWAY.heading, paint: 'paintBlue' });
    this.car.label = () => this.carStory?.label ?? (this.stage === 'DRIVE' ? 'Get in and drive to work' : this.stage === 'CHORES' ? 'Your car (get ready first)' : 'Your car');
    this.car.onUse = () => (this.carStory ? this.carStory.use() : this.useCar());
    // A later story beat can borrow the car: { label, use() } (see launch.js).
    this.carStory = null;

    // Lot gate (shut once you've arrived).
    const gateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, GATE.z1 - GATE.z0), m('metal'));
    gateMesh.position.set(GATE.x, 1.1, (GATE.z0 + GATE.z1) / 2);
    scene.add(gateMesh);
    this.gate = { mesh: gateMesh, collider: collision.addBox(GATE.x - 0.1, 0, GATE.z0, GATE.x + 0.1, 2.2, GATE.z1) };
    this.gate.collider.wall = true;
  }

  get objectives() {
    return this.mode === 2 ? { ...OBJECTIVES, ...OBJECTIVES_2 } : OBJECTIVES;
  }

  get active() {
    return this.stage !== 'done';
  }

  setGate(shut) {
    this.gate.mesh.visible = shut;
    this.gate.collider.enabled = shut;
  }

  // New day: in bed, alarm going off. mode 2: chapter 2's night.
  start(mode = 1) {
    this.mode = mode;
    this.chores = mode === 2 ? CHORES_2 : CHORES;
    this.letterProp.visible = this.gearProp.visible = mode === 2;
    this.stage = 'WAKE';
    this.busy = false;
    this.done.clear();
    if (this.car.driver) this.car.exit();
    this.car.place(DRIVEWAY.x, DRIVEWAY.z, DRIVEWAY.heading);
    this.setGate(false);
    this.player.spawn({ x: PILLOW_EYE.x, y: 0, z: PILLOW_EYE.z, yaw: Math.PI });
    this.player.eyeHeight = PILLOW_EYE.y;
    this.player.pitch = 0.9; // looking up at the ceiling
    this.player.rig = { update: () => {} }; // lying down: look around, can't walk
    this.alarmIn = 0;
    this.hud.setObjective(this.objectives.WAKE);
  }

  // Testing: ready to drive, standing by the car (?morning=drive).
  readyToDrive() {
    this.player.rig = null;
    for (const c of this.chores) this.done.add(c.id);
    this.stage = 'DRIVE';
    this.player.spawn({ x: DRIVEWAY.x, y: 0, z: DRIVEWAY.z + 1.8, yaw: 0 });
    this.hud.setObjective('Head out to your car in the driveway and drive to work.');
  }

  // Skip straight to being at the office (debug skips, loading a save).
  finish() {
    if (this.car.driver) this.car.exit();
    this.player.rig = null;
    this.stage = 'done';
    this.busy = false;
    this.car.place(PARKED.x, PARKED.z, PARKED.heading);
    this.setGate(true);
  }

  async wakeUp() {
    this.busy = true;
    await this.fx.fade(1, 0.6);
    this.player.rig = null;
    this.player.spawn(OUT_OF_BED);
    this.stage = 'CHORES';
    this.hud.announceObjective(this.choresObjective());
    await this.fx.fade(0, 0.6);
    this.busy = false;
    this.hud.toast(this.mode === 2 ? '3 a.m. Something slid under the front door.' : 'Ugh. Delivery day.', 2.5);
  }

  // The first step with a chore still to do.
  get currentStep() {
    return Math.min(...this.chores.filter((c) => !this.done.has(c.id)).map((c) => c.step), Infinity);
  }

  // Only what you can do right now (the current step's chores).
  choresObjective() {
    const done = this.chores.filter((c) => this.done.has(c.id)).length;
    const now = this.chores.filter((c) => c.step === this.currentStep && !this.done.has(c.id)).map((c) => c.name);
    const next = now.length > 1 ? `${now.slice(0, -1).join(', ')} and ${now.at(-1)}` : now[0];
    const cap = next.charAt(0).toUpperCase() + next.slice(1);
    const what = this.mode === 2 ? 'Get ready' : 'Get ready for work';
    return `${what} (${done}/${this.chores.length}): ${cap}.`;
  }

  async doChore(id, sound, toast) {
    this.busy = true;
    sound();
    if (id === 'letter') {
      await this.reader.open(LETTER);
    }
    await this.fx.fade(1, 0.35);
    this.done.add(id);
    await this.fx.fade(1, 0.25); // a moment in the dark
    await this.fx.fade(0, 0.35);
    this.busy = false;
    this.hud.toast(toast, 2.5);
    this.onChoreDone?.(id);
    if (this.done.size >= this.chores.length) {
      this.stage = 'DRIVE';
      this.hud.announceObjective(this.mode === 2 ? this.objectives.READY : 'Ready. Head out to your car in the driveway and drive to work.');
    } else {
      this.hud.setObjective(this.choresObjective());
    }
  }

  useCar() {
    if (this.stage === 'CHORES') {
      this.hud.toast(`Not yet. Still to do: ${this.chores.filter((c) => !this.done.has(c.id)).map((c) => c.name).join(', ')}.`, 3);
      return;
    }
    if (this.stage !== 'DRIVE') return;
    this.car.enter(this.player);
    this.hud.setObjective(this.objectives.DRIVE);
    this.hud.toast('W/S: gas and brake · A/D: steer · Space: handbrake · E: get out', 4);
  }

  update(dt, input, active) {
    if (this.stage === 'WAKE') {
      this.alarmIn -= dt;
      if (this.alarmIn <= 0) {
        this.alarmIn = 0.9;
        sfx.alarm(this.clock.position);
      }
    }
    // E gets you out of the car when it's (nearly) stopped.
    if (this.car.driver && active && input.wasPressed('KeyE') && Math.abs(this.car.speed) < 1) {
      this.car.exit();
      if (this.stage === 'DRIVE') this.hud.setObjective('Get back in your car and drive to work.');
      return;
    }
    if (this.stage === 'DRIVE' && this.car.driver && this.inSpot()) this.arrive();
    // At your desk floor: the workday starts. (Chapter 2: down in B1.)
    const there = this.mode === 2 ? this.player.pos.y < -2 && this.player.pos.x > 0 : this.player.pos.y > 3.5 && this.player.pos.x > 0;
    if (this.stage === 'ARRIVE' && there) {
      this.stage = 'done';
      this.onDone?.();
    }
  }

  // Stopped in a stall: the car's center inside one of the rows (at least
  // 0.8 m in from the row's ends), pointing along the stall, either way.
  inSpot() {
    const p = this.car.pos;
    const along = Math.abs(Math.cos(this.car.heading)) > 0.8; // within ~35° of the stall's direction
    const inRow = STALL_ROWS.some((r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 + 0.8 && p.z < r.z1 - 0.8);
    return inRow && along && Math.abs(this.car.speed) < 0.6;
  }

  async arrive() {
    this.stage = 'ARRIVE';
    this.busy = true;
    this.hud.toast('Parked. Nice.', 2);
    await this.fx.fade(1, 0.5);
    this.car.exit();
    this.setGate(true);
    sfx.gate();
    this.hud.announceObjective(this.objectives.ARRIVE);
    await this.fx.fade(0, 0.5);
    this.busy = false;
  }
}
