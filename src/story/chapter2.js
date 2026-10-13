import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Guard } from './guards.js';
import { AfterCredits } from './afterCredits.js';
import { Part2 } from './part2.js';
import { sfx } from '../core/sound.js';

// Chapter 2: The True Facility.
// A week after the office was shut down, Dr. Pell slips a letter under your
// door: the rotation never stopped. Under Goob Co. HQ, below a floor that
// isn't on any plan, the next "Employees of the Month" are being held.
//
// Stages (Chapter1.state):
//   C2_HOME       at home at night, then the drive (story/morning.js, mode 2)
//   C2_INFILTRATE get into the closed HQ, down to B1, through the hidden elevator
//   C2_KEYCARD    sneak past security to the keycard in the security office
//   C2_CONTROL    get into the control room and open the cells
//   C2_CURE       two of the prisoners are infected: cure them
//   C2_LEAVE      get everyone to the lobby and take the elevator up
//   C2_END        the ending (police raid, news, credits)

const CODE = '4-2-7-9';
// Part 2 (after the credits): see part2.js.
const PART2_STATES = ['C2_TRANSMITTERS', 'C2_CLEANUP', 'C2_EVIDENCE', 'C2_NIGHTSHIFT', 'C2_ROOF', 'C2_BOSS'];
const HOLDING_DOOR_X = 7; // the holding area's door to the corridor
const FILE_OUT_GAP = 1.4; // seconds between freed prisoners leaving their cells
const B3_Y = -12;
const LOBBY = { x0: 6.3, z0: 18.3, x1: 13.7, z1: 23.7 };
// Prisoners (cast members, borrowed from the office) and their cells.
// infected: needs the antidote first.
const PRISONERS = [
  { name: 'Dr. Pell', cell: 1 },
  { name: 'Martin', cell: 2 },
  { name: 'Nell', cell: 3 },
  { name: 'Kevin', cell: 4, infected: true },
  { name: 'Ivo', cell: 5 },
  { name: 'Luis', cell: 6, infected: true },
];
// Where freed prisoners wait in the elevator lobby, handed out in the order
// they're freed: deepest first, alternating west and east walls, so nobody
// has to walk past someone already standing there, and the way from the
// entrance (x 8.5-11.5) to the elevator (x 9, z 24) stays clear.
const LOBBY_SPOTS = [
  { x: 7.4, z: 22.4 }, { x: 12.9, z: 22.4 }, { x: 7.4, z: 21.2 },
  { x: 12.9, z: 21.2 }, { x: 7.4, z: 20 }, { x: 12.9, z: 20 },
];
const LOBBY_ENTRANCE = { x: 10, z: 18.8 }; // just inside the gap from the corridor
const CELL_X = [1, 3.15, 5.45, 7.75, 10.05, 12.6];
const CELL_LOCKED = 'Locked. The cell doors are opened from the control room.';
const CONTROL_LOCKED = 'Locked. A card reader blinks red: SECURITY KEYCARD REQUIRED.';
// Guards: patrol loops on B3 (x, z, and seconds to pause there).
const GUARDS = [
  { name: 'Guard Reyes', look: { skin: 0xc68642, hair: 0x1a1410 }, route: [{ x: 1.5, z: 16, wait: 2.5 }, { x: 13, z: 16, wait: 1 }, { x: 13, z: 16.2, wait: 1.5 }, { x: 1.5, z: 16.2 }] },
  { name: 'Guard Blake', look: { skin: 0xf1c27d, hair: 0x5a3a1a, hairStyle: 'short' }, route: [{ x: 15.8, z: 20, wait: 2 }, { x: 28.2, z: 20 }, { x: 28.2, z: 32.2, wait: 2 }, { x: 15.8, z: 32.2 }] },
  { name: 'Guard Okoro', look: { skin: 0x8d5524, hair: 0x111111 }, route: [{ x: 16, z: 16.2, wait: 2 }, { x: 34.5, z: 16.2, wait: 3 }, { x: 34.5, z: 16, wait: 1 }, { x: 16, z: 16 }] },
];
const OBJECTIVES = {
  C2_INFILTRATE: `Get into HQ and down to the B1 basement. Find the hidden elevator in the north wall (code ${CODE}).`,
  C2_RIDE: 'Take the hidden elevator down.',
  C2_KEYCARD: 'Find a security keycard (try the security office). Stay out of the flashlights: C to crouch, right mouse to knock a guard out.',
  C2_CONTROL: 'Get into the control room (east end of the corridor) and open the holding cells.',
  C2_CURE: (left) => `Kevin and Luis are infected. Cure them with the antidote (F). ${left} left.`,
  C2_LEAVE: (inLobby, total) => `Get everyone to the elevator lobby (${inLobby}/${total}), then take the elevator up.`,
};
// What freed prisoners say.
const FREED_LINES = {
  'Dr. Pell': ['Champ! You actually read the letter.', 'The batch hums. It hums our names. Get us out of here.'],
  Martin: ['I scheduled the plaques. I never asked what they were for. I am so sorry.'],
  Nell: ['I knew Gary wouldn’t leave without saying goodbye.'],
  Ivo: ['I ran the numbers on the vats for two years. I thought the input was... soy.'],
  Kevin: ['My head… I was dreaming I was in a jar. Am I still in a jar?'],
  Luis: ['Is it Friday? They said Friday was the launch.'],
};

export class Chapter2 {
  constructor({ ch1, ctx, world, player, cast, hud, dialogue, fx, goob, graph, sightIgnore, morning }) {
    Object.assign(this, { ch1, world, player, cast, hud, dialogue, fx, goob, graph, sightIgnore, morning });
    const { scene, interactions, materials } = ctx;
    this.scene = scene;
    this.collision = ctx.collision;
    this.active = false;
    this.guards = GUARDS.map((g) => new Guard(scene, { ...g, y: B3_Y, collision: ctx.collision }));
    // Guards' bodies don't block anyone's line of sight (like people's).
    for (const g of this.guards) sightIgnore.add(g.collider);
    // People step out of the guards' way.
    cast.extras = () => (this.active ? this.guards.filter((g) => g.active) : []);
    for (const g of this.guards) g.setVisible(false);
    this.after = new AfterCredits({ ch2: this, scene });
    this.part2 = new Part2({ ch2: this, ctx });
    this.prisoners = PRISONERS.map((p) => ({ ...p, npc: cast.all.find((n) => n.name === p.name) }));
    this.cellDoors = CELL_X.map((_, i) => world.doorByLabel(`cell door ${i + 1}`));
    this.controlDoor = world.doorByLabel('control room door');
    this.detectEl = document.getElementById('detect');
    this.detectFill = document.getElementById('detect-fill');

    // The keycard, on the security office desk.
    const desk = world.props.securityDesk;
    const card = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.006, 0.055, 2, 0.003), new THREE.MeshLambertMaterial({ color: 0xdf3b3b, emissive: 0x3a0808 }));
    card.position.set(desk.deskX - 0.45, B3_Y + 0.765, desk.deskZ + 0.2); // (front corner, clear of the clutter)
    card.rotation.y = 0.4;
    const halo = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.002, 0.14), new THREE.MeshBasicMaterial({ color: 0xffc0c0, transparent: true, opacity: 0.45, depthWrite: false }));
    halo.position.copy(card.position);
    halo.position.y -= 0.002;
    const pick = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.copy(card.position);
    this.keycard = new THREE.Group();
    this.keycard.add(card, halo, pick);
    scene.add(this.keycard);
    interactions.add({
      mesh: [card, pick],
      label: 'Take the security keycard',
      enabled: () => this.active && this.ch1.state === 'C2_KEYCARD' && this.keycard.visible,
      use: () => this.takeKeycard(),
    });

    // The cell release console in the control room: a big red button.
    const c = world.props.controlConsole;
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.05, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3030).multiplyScalar(1.6) }));
    button.position.set(c.x, c.y + 0.03, c.z);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.04, 0.5, 2, 0.01), materials.get('metal'));
    plate.position.set(c.x, c.y, c.z);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), materials.get('plastic'));
    stand.position.set(c.x, c.y - 0.5, c.z);
    scene.add(button, plate, stand);
    this.releaseButton = button;
    interactions.add({
      mesh: [button, plate, stand],
      label: 'Press CELL RELEASE',
      enabled: () => this.active && this.ch1.state === 'C2_CONTROL',
      use: () => this.releaseCells(),
    });

    // Police tape across the front doors (the building's shut down).
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.12), new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.DoubleSide }));
    const tape2 = tape.clone();
    tape.position.set(19, 1.2, -0.25);
    tape.rotation.z = 0.12;
    tape2.position.set(19, 1.6, -0.27);
    tape2.rotation.z = -0.1;
    this.tape = new THREE.Group();
    this.tape.add(tape, tape2);
    this.tape.visible = false;
    scene.add(this.tape);

    // The hidden elevator: its keypad takes the code from the letter.
    const secret = world.secretElevator;
    secret.tryUnlock = () => {
      if (!this.active || !this.morning.done.has('letter')) return false;
      secret.lockedMessage = null;
      sfx.ui();
      this.hud.toast(`You punch in ${CODE}. Something heavy unlocks behind the wall.`, 3);
      if (this.ch1.state === 'C2_INFILTRATE') this.ch1.setState('C2_RIDE', OBJECTIVES.C2_RIDE);
      return true;
    };
  }

  // Everything ignored by the guards' line of sight: people and open doors.
  get targets() {
    return this.active ? [...this.guards, ...this.part2.targets] : [];
  }

  // A new game of chapter 2 (Chapter1.start(2) has reset the world).
  start() {
    this.active = true;
    this.ending = false;
    this.caughtBusy = false;
    this.world.setNight(true, this.scene);
    this.tape.visible = true;
    this.world.secretElevator.lockedMessage = 'RESTRICTED. A keypad glows beside the doors: ENTER CODE.';
    this.setupFacility();
    this.ch1.setState('C2_HOME', null, false);
    this.morning.onDone = () => this.arrived();
    this.morning.start(2);
  }

  // Chapter 1: none of this is here.
  stop() {
    this.active = false;
    this.after.reset();
    this.part2.stop();
    this.world.setNight(false, this.scene);
    this.tape.visible = false;
    for (const g of this.guards) g.setVisible(false);
    this.detectEl.hidden = true;
    this.world.secretElevator.lockedMessage = 'RESTRICTED. A keypad glows beside the doors: ENTER CODE.';
    for (const d of this.cellDoors) { d.reset(); d.locked = CELL_LOCKED; }
    this.controlDoor.locked = CONTROL_LOCKED;
  }

  // Guards on patrol, prisoners locked in their cells (two of them
  // infected), the keycard on the desk, goob seeping from the vats, and
  // nobody left in the office upstairs.
  cellX(n) {
    return CELL_X[n - 1];
  }

  // After the raid (the post-credits part): the guards are gone, everyone
  // you rescued has gone home, the cells are shut, the keycard's long gone,
  // and the hidden elevator's back at B3.
  setupAftermath() {
    this.ch1.ending.reset();
    this.ending = false;
    this.ch1.busy = false;
    this.goob.reset();
    this.goob.spreading = false;
    this.keycard.visible = false;
    for (const g of this.guards) g.setVisible(false);
    for (const p of this.prisoners) {
      const npc = p.npc;
      npc.path = null;
      npc.person.root.visible = false;
      npc.collider.enabled = false;
      npc.frozen = true;
    }
    for (const d of this.cellDoors) { d.reset(); d.locked = CELL_LOCKED; }
    this.controlDoor.reset();
    this.controlDoor.locked = null;
    const secret = this.world.secretElevator;
    secret.lockedMessage = null;
    secret.current = secret.target = 0;
    secret.carY = secret.floors[0];
    secret.phase = 'closed';
    secret.open.fill(0);
    secret.syncCar();
    secret.syncDoors();
    this.detectEl.hidden = true;
  }

  // The override opens the doors between you and the control room.
  openForOverride() {
    this.world.doorByLabel('holding area door').setOpen(1);
    this.controlDoor.locked = null;
    this.controlDoor.setOpen(1);
  }

  openCell(n) {
    const d = this.cellDoors[n - 1];
    d.locked = null;
    d.setOpen(-1);
  }

  setupFacility() {
    for (const g of this.guards) g.reset();
    this.keycard.visible = true;
    this.controlDoor.reset();
    this.controlDoor.locked = CONTROL_LOCKED;
    for (const d of this.cellDoors) { d.reset(); d.locked = CELL_LOCKED; }
    const borrowed = new Set(this.prisoners.map((p) => p.npc));
    for (const npc of this.cast.all) {
      if (borrowed.has(npc)) continue;
      npc.person.root.visible = false;
      npc.collider.enabled = false;
      npc.frozen = true;
    }
    for (const p of this.prisoners) this.lockUp(p);
    this.goob.reset();
    for (const node of this.graph.nodes) {
      if (node.pos.y > -13 && node.pos.y < -11 && node.pos.x > 14 && node.pos.x < 30 && node.pos.z > 18 && Math.random() < 0.18) {
        this.goob.spawn(node, 1 + Math.random());
      }
    }
    this.goob.spreading = true;
  }

  lockUp(p) {
    const npc = p.npc;
    const x = CELL_X[p.cell - 1];
    npc.person.root.visible = true;
    npc.collider.enabled = true;
    npc.frozen = false;
    npc.path = null;
    npc.onArrive = null;
    npc.talking = false;
    npc.cured = false;
    npc.brain = null;
    npc.person.setInfected(false);
    npc.mode = 'stand';
    npc.pos.set(x, B3_Y, 8.6);
    npc.home.copy(npc.pos);
    npc.yaw = 0; // facing the cell door
    if (p.infected) npc.infect();
    else {
      npc.talkable = true;
      npc.lines = ['Please. Get us out of here. The release is in the control room.'];
      npc.lineIndex = 0;
    }
    p.freed = false;
    p.spot = null;
  }

  // Parked at HQ and down in B1: suit up and find the elevator.
  arrived() {
    this.ch1.putOnSuit();
    this.ch1.equipVacuum();
    this.ch1.equipAntidote();
    this.ch1.outbreak = true;
    this.ch1.setState('C2_INFILTRATE', OBJECTIVES.C2_INFILTRATE);
    if (!this.world.secretElevator.locked) this.ch1.setState('C2_RIDE', OBJECTIVES.C2_RIDE);
    this.saveCheckpoint();
  }

  takeKeycard() {
    this.keycard.visible = false;
    this.controlDoor.locked = null;
    sfx.pickup();
    this.hud.toast('Got the keycard. The control room’s at the east end of the corridor.', 3);
    this.ch1.setState('C2_CONTROL', OBJECTIVES.C2_CONTROL);
    this.saveCheckpoint();
  }

  async releaseCells() {
    sfx.lock();
    this.hud.toast('CELL RELEASE. Every cell door on the level unlocks with a clunk.', 3);
    this.openCells();
    this.ch1.setState('C2_CURE', OBJECTIVES.C2_CURE(this.infectedLeft));
    this.saveCheckpoint();
  }

  // Everyone who isn't infected walks out, one at a time (nearest the
  // holding area door first, so each one follows the last) rather than all
  // crowding the walkway at once.
  openCells() {
    for (const d of this.cellDoors) { d.locked = null; d.setOpen(-1); }
    let delay = 0;
    const byDoor = [...this.prisoners].sort((a, b) => Math.abs(CELL_X[a.cell - 1] - HOLDING_DOOR_X) - Math.abs(CELL_X[b.cell - 1] - HOLDING_DOOR_X));
    for (const p of byDoor) {
      if (p.npc.infected) continue;
      this.free(p, delay);
      delay += FILE_OUT_GAP;
    }
  }

  get infectedLeft() {
    return this.prisoners.filter((p) => p.npc.infected).length;
  }

  // Out of the cell and off to the lobby to wait for you.
  free(p, delay = 0) {
    const npc = p.npc;
    p.freed = true;
    p.spot ??= LOBBY_SPOTS[this.prisoners.filter((q) => q.spot).length];
    npc.brain = null;
    npc.cured = true; // (walks with collision and opens doors)
    npc.talkable = true;
    npc.lines = [...(FREED_LINES[p.name] ?? ['Thank you.'])];
    npc.lineIndex = 0;
    npc.speed = 1.6;
    // To the lobby entrance, then straight to their spot (a route that ends
    // at the walkway point nearest the spot can overshoot, and double back
    // past people already standing there).
    const target = new THREE.Vector3(p.spot.x, B3_Y, p.spot.z);
    const entrance = new THREE.Vector3(LOBBY_ENTRANCE.x, B3_Y, LOBBY_ENTRANCE.z);
    const nav = npc.env.nav;
    const inLobby = npc.pos.z > LOBBY.z0 && npc.pos.x > LOBBY.x0 && npc.pos.x < LOBBY.x1;
    const route = inLobby ? [] : [...(nav.path(nav.nearest(npc.pos), nav.nearest(entrance), true) ?? []), entrance];
    npc.walkPath([...route, target], () => {
      npc.mode = 'stand';
      npc.yaw = Math.PI; // facing the corridor, waiting
    });
    npc.pause = delay;
  }

  // The antidote worked on one of the infected prisoners (see Chapter1.cureNpc).
  cured(npc) {
    if (this.part2.cured(npc)) return;
    const p = this.prisoners.find((q) => q.npc === npc);
    npc.person.setInfected(false);
    sfx.cure(npc.pos);
    this.fx.flash('#8fd8ff', 0.3);
    if (!p) return;
    npc.mode = 'stand';
    this.free(p);
    this.hud.toast(`${p.name} is cured!`, 2.5);
    if (this.ch1.state !== 'C2_CURE') return;
    if (this.infectedLeft > 0) this.ch1.hud.setObjective(OBJECTIVES.C2_CURE(this.infectedLeft));
    else {
      this.ch1.setState('C2_LEAVE', OBJECTIVES.C2_LEAVE(this.inLobby, this.prisoners.length));
      this.saveCheckpoint();
    }
  }

  get inLobby() {
    return this.prisoners.filter((p) => {
      const q = p.npc.pos;
      return p.freed && q.y < -11 && q.x > LOBBY.x0 && q.x < LOBBY.x1 && q.z > LOBBY.z0 && q.z < LOBBY.z1;
    }).length;
  }

  update(dt) {
    if (!this.active) return;
    this.after.update(dt);
    const state = this.ch1.state;
    // On B3 once the car has stopped there (not mid-ride: the checkpoint
    // taken here would put you back in a moving car's shaft).
    const secret = this.world.secretElevator;
    if (state === 'C2_RIDE' && this.player.pos.y < -11 && secret.current === 0 && secret.phase !== 'moving') {
      this.ch1.setState('C2_KEYCARD', OBJECTIVES.C2_KEYCARD);
      this.hud.toast('B3. There is no B2. The air smells like goob and floor polish.', 3.5);
      this.saveCheckpoint();
    }
    if (state === 'C2_LEAVE') {
      this.hud.setObjective(OBJECTIVES.C2_LEAVE(this.inLobby, this.prisoners.length));
      // Everyone's in the lobby and you've taken the elevator up to B1.
      const up = this.world.secretElevator;
      if (this.inLobby === this.prisoners.length && up.current === 1 && this.player.pos.y > -6 && this.player.pos.z > 24) this.finish();
    }

    // Security.
    const watching = state.startsWith('C2_') && this.player.pos.y < -8 && !this.ch1.busy && !this.caughtBusy;
    let suspicion = 0;
    for (const g of this.guards) {
      const s = g.update(dt, this.player, this.collision, this.sightIgnore);
      if (watching) suspicion = Math.max(suspicion, s);
    }
    suspicion = Math.max(suspicion, this.part2.update(dt));
    this.detectEl.hidden = suspicion <= 0.01;
    this.detectFill.style.width = `${Math.round(suspicion * 100)}%`;
    this.detectEl.classList.toggle('alert', suspicion >= 0.6);
    if (suspicion >= 1 && !this.caughtBusy && !this.ch1.busy) this.caught();
  }

  async caught() {
    this.caughtBusy = true;
    const token = this.ch1.token;
    sfx.klaxon();
    this.hud.toast('"Hey! Stop right there!" Security caught you.', 3);
    this.fx.flash('#ff3a2a', 0.6);
    await this.fx.fade(1, 1.2);
    if (token !== this.ch1.token) return;
    this.restore(this.ch1.checkpoint);
    this.hud.toast('Back where you were. Stay out of the flashlights.', 3);
  }

  // ---------- Checkpoints (stored in Chapter1.checkpoint, with chapter: 2) ----------

  saveCheckpoint() {
    const p = this.player;
    this.ch1.checkpoint = {
      chapter: 2,
      state: this.ch1.state,
      player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw },
      suit: p.suit,
      secretUnlocked: !this.world.secretElevator.locked,
      secretFloor: this.world.secretElevator.current,
      prisoners: this.prisoners.map((q) => ({ name: q.name, infected: q.npc.infected, freed: q.freed, x: q.npc.pos.x, z: q.npc.pos.z })),
      part2: this.part2.snapshot(),
    };
    this.ch1.onCheckpoint?.(this.ch1.checkpoint);
  }

  // Back to a checkpoint (being caught, a suit breach, or Continue).
  async restore(c) {
    this.active = true;
    this.caughtBusy = false;
    this.ch1.token++;
    this.ch1.busy = false;
    this.ch1.dialogue.close();
    this.world.setNight(true, this.scene);
    this.tape.visible = true;
    this.morning.finish();
    this.morning.done.add('letter');
    this.morning.onDone = () => this.arrived();
    this.ch1.putOnSuit();
    this.ch1.equipVacuum();
    this.ch1.equipAntidote();
    this.ch1.outbreak = true;
    this.player.lookTarget = null;
    this.player.spawn(c.player);
    this.player.suit = c.suit ?? 100;
    this.setupFacility();
    const secret = this.world.secretElevator;
    secret.lockedMessage = c.secretUnlocked ? null : 'RESTRICTED. A keypad glows beside the doors: ENTER CODE.';
    secret.current = secret.target = c.secretFloor ?? secret.def.startFloor;
    secret.carY = secret.floors[secret.current];
    secret.phase = 'closed';
    secret.open.fill(0);
    secret.syncCar();
    secret.syncDoors();
    // (Saved mid-ride: back in the car, at a floor.)
    if (this.world.settleInElevator(this.player.pos)) this.player.updateCamera();
    const at = ['C2_CONTROL', 'C2_CURE', 'C2_LEAVE'];
    if (at.includes(c.state)) {
      this.keycard.visible = false;
      this.controlDoor.locked = null;
    }
    if (c.state === 'C2_CURE' || c.state === 'C2_LEAVE') {
      for (const d of this.cellDoors) { d.locked = null; d.setOpen(-1); }
      for (const p of this.prisoners) {
        const saved = c.prisoners?.find((q) => q.name === p.name);
        if (saved && !saved.infected) {
          if (p.npc.infected) p.npc.cure([]);
          p.npc.pos.set(saved.x, B3_Y, saved.z);
          this.free(p);
        }
      }
    }
    const objective = c.state === 'C2_CURE' ? OBJECTIVES.C2_CURE(this.infectedLeft)
      : c.state === 'C2_LEAVE' ? OBJECTIVES.C2_LEAVE(this.inLobby, this.prisoners.length)
        : OBJECTIVES[c.state] ?? null;
    this.ch1.setState(c.state, objective, false);
    if (c.state === 'C2_FIND') {
      this.setupAftermath();
      this.ch1.putOnSuit();
      this.after.beginFind(false);
    }
    if (PART2_STATES.includes(c.state)) {
      this.setupAftermath();
      this.ch1.putOnSuit();
      this.part2.restore(c);
    }
    this.ch1.checkpoint = c;
    this.fx.fade(1, 0);
    await this.fx.fade(0, 0.8);
  }

  // Debug: jump to a stage (?stage=C2_...).
  skipTo(state) {
    this.ch1.start(2);
    this.morning.finish();
    if (state === 'C2_AFTER') {
      // Straight to the post-credits part ("You're not done.").
      this.morning.done.add('letter');
      this.after.start();
      return;
    }
    const spots = {
      C2_INFILTRATE: { x: 13, y: 0, z: -2, yaw: 0 },
      C2_RIDE: { x: 9, y: -4, z: 22.5, yaw: Math.PI },
      C2_KEYCARD: { x: 9, y: B3_Y, z: 22, yaw: 0 },
      C2_CONTROL: { x: 3, y: B3_Y, z: 21, yaw: 0 },
      C2_CURE: { x: 32, y: B3_Y, z: 22, yaw: Math.PI / 2 },
      C2_LEAVE: { x: 10, y: B3_Y, z: 21, yaw: 0 },
      C2_FIND: { x: 31.6, y: B3_Y, z: 21.4, yaw: Math.PI / 2 },
      C2_TRANSMITTERS: { x: 5, y: 8, z: 5, yaw: Math.PI },
      C2_CLEANUP: { x: 12, y: 0, z: 11.5, yaw: Math.PI / 2 },
      C2_EVIDENCE: { x: 12, y: 0, z: 11.5, yaw: Math.PI / 2 },
      C2_NIGHTSHIFT: { x: 12, y: 0, z: 11.5, yaw: Math.PI / 2 },
      C2_ROOF: { x: 16.5, y: 8, z: 12.2, yaw: Math.PI },
      C2_BOSS: { x: 13, y: 12, z: 11.6, yaw: Math.PI / 2 },
    };
    this.morning.done.add('letter');
    this.restore({
      chapter: 2,
      state: state === 'C2_HOME' ? 'C2_INFILTRATE' : state,
      player: spots[state] ?? spots.C2_INFILTRATE,
      secretUnlocked: state !== 'C2_INFILTRATE' && state !== 'C2_HOME',
      secretFloor: ['C2_KEYCARD', 'C2_CONTROL', 'C2_CURE', 'C2_LEAVE'].includes(state) ? 0 : 1,
      part2: {
        transmitters: [0, 1, 2, 3].map(() => state !== 'C2_TRANSMITTERS'),
        cured: ['C2_ROOF', 'C2_BOSS'].includes(state) ? ['Hank', 'Rhonda', 'Brad', 'Olu', 'Deb', 'Stan'] : [],
        key: ['C2_ROOF', 'C2_BOSS'].includes(state),
        cleaned: !['C2_TRANSMITTERS', 'C2_CLEANUP'].includes(state),
        evidence: ['C2_NIGHTSHIFT', 'C2_ROOF', 'C2_BOSS'].includes(state) ? [0, 1, 2, 3, 4, 5, 6, 7] : [],
      },
      prisoners: state === 'C2_LEAVE' ? this.prisoners.map((q, i) => ({ name: q.name, infected: false, freed: true, x: LOBBY_SPOTS[i].x, z: LOBBY_SPOTS[i].z })) : null,
    });
  }

  // ---------- The ending ----------

  async finish() {
    if (this.ending) return;
    this.ending = true;
    this.ch1.setState('C2_END', null, false);
    this.ch1.busy = true;
    this.detectEl.hidden = true;
    this.hud.setGoob(null);
    this.ch1.vacuum.equip(false);
    this.ch1.antidote.reset();
    this.goob.spreading = false;
    await this.ch1.ending.runChapter2(this.prisoners.map((p) => p.npc));
    // Not over yet (see afterCredits.js).
    this.after.start();
  }
}
