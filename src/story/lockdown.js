import * as THREE from 'three';
import { difficulty } from '../core/settings.js';
import { sfx } from '../core/sound.js';
import { sign } from '../world/furniture.js';

// Chapter 2, between the police and Victoria's office: the lockdown. You
// step out of the hidden elevator on B1 and she locks HQ down: the power's
// cut, steel shutters seal every stairwell door, and Officer Kim, who went
// up ahead of you, is stuck in the dead elevator.
//
//   C2_LOCKDOWN  reset the breakers in the B1 server room (the right pattern
//                is in Hank's maintenance note in the goob lab), past her
//                night guards
//   C2_KIM       the elevator comes down with Kim in it: ride up to 1F
//   C2_DEFEND    Kim lifts the lockdown from the reception desk while the
//                infected come for her: keep them off her until she's done
// Then back to C2_FIND: her office on 3F (afterCredits.js, part2.js).

export const LOCKDOWN_STATES = ['C2_LOCKDOWN', 'C2_KIM', 'C2_DEFEND'];
const BREAKERS = 5;
const RIGHT = [true, false, true, true, false]; // 1, 3 and 4 on; 2 and 5 off
const START = [true, true, false, false, true];
const SEALED = 'Sealed. LOCKDOWN: a steel shutter has dropped behind the door.';
const NO_POWER = 'LOCKDOWN. The elevator has no power.';
const KIM_SPOT = { x: 18.9, z: 7.3 };        // behind the reception counter
const DEFEND_SECONDS = { easy: 45, normal: 60, hard: 75 };
const KIM_REACH = 1.8;                      // infected this close stop her working
// Infected who come for her: cast members the escort will meet again later.
// (The rooms they come out of have their doors flung open when it starts.)
const WAVES = [
  { at: 0, name: 'Tom', x: 1.5, z: 11.6 }, { at: 0, name: 'Marcy', x: 6, z: 15.2 },
  { at: 8, name: 'Janet', x: 21, z: 15.5 }, { at: 16, name: 'Walt', x: 4, z: 6 },
  { at: 26, name: 'Gus', x: 11, z: 6 }, { at: 36, name: 'Pat', x: 23, z: 11.5 },
];
const BURST_DOORS = ['break room door', 'infirmary door', 'locker room door', 'restroom door'];
const BEGIN = [
  { speaker: 'Victoria (PA)', text: 'Attention, Goob Co. HQ. This building is now in lockdown. Stairwells sealed. Power cut. Nobody climbs.' },
  { speaker: 'Victoria (PA)', text: 'Oh, and Officer Kim got into my elevator. She’s still in it. Somewhere between floors, in the dark. Bye now.' },
];
const NOTE = [
  { speaker: 'Maintenance note', text: 'IF THE LOCKDOWN KILLS THE POWER AGAIN: server room breakers 1, 3 and 4 ON. 2 and 5 OFF. Then pull MAIN.' },
  { speaker: 'Maintenance note', text: 'Do NOT turn 5 on. 5 feeds the vats. I mean it. (Hank)' },
];
const KIM_FOUND = [
  { speaker: 'Officer Kim', text: 'Champ! Oh, thank God. Forty minutes in the dark with a recording of Victoria humming.' },
  { speaker: 'Officer Kim', text: 'My badge can lift a building lockdown, but only from the front desk. The stairs are sealed. Take me up to the lobby.' },
];
const DEFEND_START = [
  { speaker: 'Officer Kim', text: 'Okay. Override menu... badge... it wants a full system check. That’ll take a minute.' },
  { speaker: 'Officer Kim', text: 'Champ? Something’s moaning in the corridor. Keep them off me!' },
];
const DEFEND_DONE = [
  { speaker: 'Officer Kim', text: 'LOCKDOWN LIFTED. Stairs are open, elevator’s yours. Diaz is on his way up.' },
  { speaker: 'Officer Kim', text: 'Her office is on 3F. Go. I’ll hold the lobby.' },
];
const OBJECTIVES = {
  C2_LOCKDOWN: (noteRead) => (noteRead
    ? 'Reset the breakers in the B1 server room: 1, 3 and 4 ON, 2 and 5 OFF, then pull MAIN. Watch for her night guard.'
    : 'Lockdown: no power, the stairs are sealed and Kim’s stuck in the elevator. Reset the breakers in the B1 server room. (Somebody must have written the pattern down: try the goob lab.)'),
  C2_KIM: 'Ride the elevator up to the 1F lobby with Officer Kim.',
  C2_DEFEND: (pct) => `Keep the infected away from Kim while she lifts the lockdown at the reception desk (${pct}%). Blast them back (right mouse) or cure them (F).`,
};

export class Lockdown {
  constructor(ch2, { scene, interactions, materials }) {
    this.ch2 = ch2;
    this.active = false;
    this.done = false;
    const props = ch2.world.props;

    // The breaker panel, on the server room's north wall.
    const px = 7.5;
    const py = -4 + 1.35;
    const pz = 20.86;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.1), materials.get('metal'));
    panel.position.set(px, py, pz);
    scene.add(panel);
    this.switches = [];
    for (let i = 0; i < BREAKERS; i++) {
      const x = px - 0.48 + i * 0.2;
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.06), new THREE.MeshLambertMaterial({ color: 0x1c1c1c }));
      lever.position.set(x, py + 0.08, pz - 0.08);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.01), new THREE.MeshBasicMaterial({ color: 0x401010 }));
      lamp.position.set(x, py + 0.28, pz - 0.055);
      scene.add(lever, lamp);
      sign(scene, String(i + 1), x, py + 0.35, pz - 0.056, 's', { w: 0.1, h: 0.08 });
      const sw = { i, lever, lamp, on: START[i] };
      interactions.add({
        mesh: lever,
        label: () => `Breaker ${i + 1}: ${sw.on ? 'ON' : 'OFF'} (flip)`,
        enabled: () => this.active && this.state === 'C2_LOCKDOWN' && !this.ch1.busy,
        use: () => this.flip(sw),
      });
      this.switches.push(sw);
    }
    const main = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3030).multiplyScalar(1.3) }));
    main.position.set(px + 0.5, py, pz - 0.09);
    scene.add(main);
    sign(scene, 'MAIN', px + 0.5, py + 0.35, pz - 0.056, 's', { w: 0.18, h: 0.07 });
    this.mainLever = main;
    interactions.add({ mesh: main, label: 'Pull MAIN', enabled: () => this.active && this.state === 'C2_LOCKDOWN' && !this.ch1.busy, use: () => this.pullMain() });

    // Hank's note on the goob lab desk.
    const lab = props.labDesk;
    const note = new THREE.Group();
    note.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.003, 0.2), new THREE.MeshLambertMaterial({ color: 0xf4f1e6, emissive: 0x2a2a20 })));
    const pick = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.y = 0.05;
    note.add(pick);
    note.position.set(lab.deskX + 0.4, lab.y + 0.765, lab.deskZ + 0.1);
    note.rotation.y = 0.4;
    scene.add(note);
    this.note = note;
    note.visible = false;
    interactions.add({ mesh: note.children, label: 'Read the maintenance note', enabled: () => this.active && note.visible && !this.ch1.busy, use: () => this.readNote() });
  }

  get ch1() {
    return this.ch2.ch1;
  }

  get state() {
    return this.ch1.state;
  }

  get kim() {
    return this.ch2.after.officers[1];
  }

  get world() {
    return this.ch2.world;
  }

  cast(name) {
    return this.ch2.cast.all.find((n) => n.name === name);
  }

  // Her night guards, for the vacuum blast (part2's guards; part 2 hasn't started yet).
  get targets() {
    if (!this.active || this.state === 'C2_DEFEND') return [];
    return this.ch2.part2.guards.filter((g) => g.active);
  }

  objectiveFor(state) {
    if (state === 'C2_LOCKDOWN') return OBJECTIVES.C2_LOCKDOWN(this.noteRead);
    if (state === 'C2_DEFEND') return OBJECTIVES.C2_DEFEND(Math.floor(100 * this.progress / this.needed));
    return OBJECTIVES[state] ?? null;
  }

  snapshot() {
    return { done: this.done, noteRead: !!this.noteRead };
  }

  // ---------- Setting the building up ----------

  seal(on) {
    for (const d of this.world.doors) {
      if (d.label !== 'stairwell door' || d.pivot.position.y < -5) continue;
      d.reset();
      d.locked = on ? SEALED : null;
    }
    const only = 'LOCKDOWN: the elevator only goes to B1 and 1F.';
    this.world.elevator.floorLocks = on ? { 2: only, 3: only, 4: only } : null;
  }

  // Back to normal (a new game, the aftermath reset).
  reset() {
    this.active = false;
    this.done = false;
    this.noteRead = false;
    this.note.visible = false;
    this.kim.root.visible = false;
    this.threats = [];
    this.seal(false);
    this.world.elevator.lockedMessage = null;
  }

  // Leave everything as it is after the lockdown (restoring past it).
  finished() {
    this.active = false;
    this.done = true;
    this.note.visible = false;
    this.seal(false);
    this.world.elevator.lockedMessage = null;
    this.switches.forEach((sw, i) => this.setSwitch(sw, RIGHT[i]));
    this.mainLever.rotation.x = 0.9;
  }

  // Into a lockdown state: stage the building for it.
  setup(state, noteRead) {
    this.active = true;
    this.done = false;
    this.noteRead = !!noteRead;
    this.note.visible = true;
    const powered = state !== 'C2_LOCKDOWN';
    this.switches.forEach((sw, i) => this.setSwitch(sw, powered ? RIGHT[i] : START[i]));
    this.mainLever.rotation.x = powered ? 0.9 : 0;
    this.seal(true);
    const e = this.world.elevator;
    e.lockedMessage = powered ? null : NO_POWER;
    // Kim's in the car, stuck at 1F (doors shut) until the power's back.
    const kim = this.kim;
    kim.root.visible = state !== 'C2_DEFEND';
    kim.pose = 'stand';
    if (!powered) {
      e.current = e.target = 1;
      e.carY = e.floors[1];
      e.phase = 'closed';
      e.open.fill(0);
      e.syncCar();
      e.syncDoors();
    }
    this.kimInCar = state !== 'C2_DEFEND';
    this.threats = [];
    this.progress = 0;
    this.needed = this.defendSeconds();
    for (const g of this.ch2.part2.guards) {
      g.reset();
      if (g.y > 0.5) g.setVisible(false); // (only B1 and 1F are in play)
    }
  }

  defendSeconds() {
    const d = difficulty();
    if (!d.infectedAttack) return DEFEND_SECONDS.easy;
    return d.infectedOpenDoors ? DEFEND_SECONDS.hard : DEFEND_SECONDS.normal;
  }

  restore(saved, state) {
    if (saved?.done && !LOCKDOWN_STATES.includes(state)) {
      this.finished();
      return;
    }
    if (!LOCKDOWN_STATES.includes(state)) return;
    this.setup(state, saved?.noteRead);
    this.ch1.equipVacuum();
    this.ch1.equipAntidote();
    if (state === 'C2_DEFEND') this.startDefend(false);
    else this.ch1.setState(state, this.objectiveFor(state), false);
  }

  // ---------- The story ----------

  // Off the hidden elevator onto B1, chasing her: the lockdown drops.
  async begin() {
    const ch1 = this.ch1;
    const token = ch1.token;
    this.setup('C2_LOCKDOWN', false);
    ch1.equipVacuum();
    ch1.equipAntidote();
    ch1.busy = true;
    ch1.setState('C2_LOCKDOWN', null, false);
    sfx.klaxon();
    ch1.alarmEl.hidden = false;
    ch1.fx.flash('#ff3a2a', 0.5);
    await ch1.dialogue.play(BEGIN);
    if (token !== ch1.token) return;
    ch1.alarmEl.hidden = true;
    ch1.busy = false;
    this.enter('C2_LOCKDOWN');
    this.ch2.hud.toast('Your vacuum and antidote are clipped to your suit. Her night guards are out, too: C to crouch.', 4);
  }

  enter(state) {
    this.ch1.setState(state, this.objectiveFor(state), true);
    this.ch2.saveCheckpoint();
  }

  async readNote() {
    const ch1 = this.ch1;
    const token = ch1.token;
    sfx.rustle();
    ch1.busy = true;
    await ch1.dialogue.play(NOTE);
    if (token !== ch1.token) return;
    ch1.busy = false;
    if (!this.noteRead && this.state === 'C2_LOCKDOWN') {
      this.noteRead = true;
      this.ch1.hud.setObjective(this.objectiveFor('C2_LOCKDOWN'));
      this.ch2.saveCheckpoint();
    }
  }

  setSwitch(sw, on) {
    sw.on = on;
    sw.lever.position.y = -4 + 1.35 + (on ? 0.08 : -0.08);
    sw.lever.material.color.set(on ? 0xe0e0e0 : 0x1c1c1c);
  }

  flip(sw) {
    this.setSwitch(sw, !sw.on);
    sfx.ui();
  }

  pullMain() {
    const right = this.switches.every((sw, i) => sw.on === RIGHT[i]);
    if (!right) {
      sfx.breach();
      this.ch1.fx.flash('#ffffff', 0.3);
      this.ch2.part2.damage(5);
      this.ch2.hud.toast(this.switches[4].on
        ? 'The vat line roars and the panel spits sparks! Breaker 5 feeds the vats. Nothing else happens.'
        : 'The panel sparks and the lights stay dead. Wrong pattern.', 4);
      return;
    }
    sfx.lock();
    sfx.elevator();
    this.mainLever.rotation.x = 0.9;
    for (const sw of this.switches) sw.lamp.material.color.set(sw.on ? 0x40ff60 : 0x401010);
    const e = this.world.elevator;
    e.lockedMessage = null;
    e.request(0);
    this.ch2.hud.toast('MAIN. The building shudders back to life. Far off, the elevator starts down.', 4);
    this.ch1.hud.setObjective('The power’s back. The elevator’s coming down to B1: meet it.');
    this.kimTalked = false;
  }

  async kimFound() {
    const ch1 = this.ch1;
    const token = ch1.token;
    this.kimTalked = true;
    ch1.busy = true;
    const player = this.ch2.player;
    player.lookTarget = { x: this.kim.root.position.x, y: this.kim.root.position.y + 1.6, z: this.kim.root.position.z };
    await ch1.dialogue.play(KIM_FOUND);
    if (token !== ch1.token) return;
    player.lookTarget = null;
    ch1.busy = false;
    this.enter('C2_KIM');
  }

  // At the lobby: Kim takes the desk, the infected come.
  async startDefend(intro = true) {
    const ch1 = this.ch1;
    const token = ch1.token;
    const kim = this.kim;
    this.kimInCar = false;
    kim.root.visible = true;
    kim.root.position.set(KIM_SPOT.x, 0, KIM_SPOT.z);
    kim.root.rotation.y = Math.PI; // facing the counter
    kim.pose = 'stand';
    this.progress = 0;
    this.needed = this.defendSeconds();
    this.clock = 0;
    this.spawned = new Set();
    this.threats = [];
    this.nudgeIn = 0;
    this.blockedFor = 0;
    for (const g of this.ch2.part2.guards) g.setVisible(false);
    for (const d of this.world.doors) {
      if (BURST_DOORS.includes(d.label) && Math.abs(d.pivot.position.y) < 0.5) {
        d.locked = null;
        d.setOpen(1);
      }
    }
    if (!intro) {
      ch1.setState('C2_DEFEND', this.objectiveFor('C2_DEFEND'), false);
      return;
    }
    ch1.busy = true;
    await ch1.fx.fade(1, 0.5);
    if (token !== ch1.token) return;
    await ch1.fx.fade(0, 0.5);
    if (token !== ch1.token) return;
    ch1.setState('C2_DEFEND', null, false);
    await ch1.dialogue.play(DEFEND_START);
    if (token !== ch1.token) return;
    ch1.busy = false;
    this.enter('C2_DEFEND');
  }

  spawn(w) {
    const npc = this.cast(w.name);
    if (!npc) return;
    npc.person.root.visible = true;
    npc.collider.enabled = true;
    npc.frozen = false;
    npc.path = null;
    npc.onArrive = null;
    npc.cured = false;
    npc.brain = null;
    npc.mode = 'stand';
    npc.person.setInfected(false);
    npc.pos.set(w.x, 0, w.z);
    npc.home.copy(npc.pos);
    npc.infect();
    npc.brain.reset(0.5);
    sfx.moan(npc.pos, 0.9);
    this.threats.push(npc);
  }

  // Cured during the defense: they go and sit out the rest in the break room.
  cured(npc) {
    if (!this.active || !this.threats?.includes(npc) || !npc.infected) return false;
    npc.cure(['Did I bite someone? I feel like I bit someone.']);
    sfx.cure(npc.pos);
    this.ch1.fx.flash('#8fd8ff', 0.3);
    this.ch2.hud.toast(`${npc.name} is cured.`, 2);
    return true;
  }

  async finish() {
    const ch1 = this.ch1;
    const token = ch1.token;
    ch1.busy = true;
    sfx.ding();
    await ch1.dialogue.play(DEFEND_DONE);
    if (token !== ch1.token) return;
    await ch1.fx.fade(1, 0.6);
    if (token !== ch1.token) return;
    // Kim herds whoever's left into the break room.
    for (const npc of this.threats) {
      npc.person.root.visible = false;
      npc.collider.enabled = false;
      npc.frozen = true;
      npc.brain = null;
      npc.path = null;
    }
    this.threats = [];
    this.kim.root.visible = false;
    this.finished();
    ch1.busy = false;
    ch1.setState('C2_FIND', 'The lockdown’s lifted. Victoria’s office is on 3F.', true);
    this.ch2.saveCheckpoint();
    await ch1.fx.fade(0, 0.6);
  }

  // ---------- Every frame ----------

  update(dt) {
    const ch1 = this.ch1;
    const player = this.ch2.player;
    const state = this.state;
    // Off the hidden elevator onto B1 in C2_FIND: lockdown.
    if (!this.active && !this.done && state === 'C2_FIND' && !ch1.busy && player.pos.y > -5.5 && player.pos.y < -2 && player.pos.z < 23.5) {
      this.begin();
      return 0;
    }
    if (!this.active) return 0;
    const e = this.world.elevator;
    if (this.kimInCar) {
      this.kim.root.position.set(16.9, e.carY, 15.3);
      this.kim.root.rotation.y = Math.PI;
      this.kim.update?.(dt, 0);
    }
    if (!ch1.busy) {
      if (state === 'C2_LOCKDOWN' && !e.lockedMessage && !this.kimTalked && e.current === 0 && e.phase !== 'moving' && player.pos.y < -2
        && Math.hypot(player.pos.x - 16.5, player.pos.z - 14.5) < 4) this.kimFound();
      if (state === 'C2_KIM' && e.current === 1 && e.phase !== 'moving' && Math.abs(player.pos.y) < 0.5 && player.pos.z < 12.9) this.startDefend(true);
      if (state === 'C2_DEFEND') this.updateDefend(dt);
    }
    // Her night guards, on B1 and 1F (not during the defense).
    const watching = ['C2_LOCKDOWN', 'C2_KIM'].includes(state) && !ch1.busy && !this.ch2.caughtBusy && !player.rig;
    let suspicion = 0;
    if (state !== 'C2_DEFEND') {
      for (const g of this.ch2.part2.guards) {
        const s = g.update(dt, player, this.ch2.collision, this.ch2.sightIgnore);
        if (watching) suspicion = Math.max(suspicion, s);
      }
    }
    return suspicion;
  }

  updateDefend(dt) {
    this.clock += dt;
    for (const w of WAVES) {
      if (this.clock >= w.at && !this.spawned.has(w.name)) {
        this.spawned.add(w.name);
        this.spawn(w);
      }
    }
    // They lose interest easily: keep them coming toward you (and Kim).
    this.nudgeIn -= dt;
    if (this.nudgeIn <= 0) {
      this.nudgeIn = 2.5;
      for (const npc of this.threats) if (npc.infected && npc.brain?.state === 'wander') npc.brain.startChase();
    }
    const kim = this.kim.root.position;
    const blocked = this.threats.some((n) => n.infected && n.brain?.state !== 'stunned' && Math.hypot(n.pos.x - kim.x, n.pos.z - kim.z) < KIM_REACH);
    if (blocked) {
      this.blockedFor += dt; // (she stops working; she doesn't lose her place)
      if (this.blockedFor > 0.4 && !this.warned) {
        this.warned = true;
        this.ch2.hud.toast('They’re on Kim! She can’t work like this. Get them off her!', 2.5);
      }
    } else {
      this.blockedFor = 0;
      this.warned = false;
      this.progress = Math.min(this.needed, this.progress + dt);
    }
    if (Math.floor(this.clock * 4) !== Math.floor((this.clock - dt) * 4)) this.ch1.hud.setObjective(this.objectiveFor('C2_DEFEND'));
    if (this.progress >= this.needed) this.finish();
  }
}
