import * as THREE from 'three';
import { Person } from '../npc/person.js';
import { sfx } from '../core/sound.js';

// Chapter 2, after the credits: "You're not done."
// The police are holding Victoria in one of B3's cells. She still has an
// executive override on Goob Co.'s hazard suits, and you're wearing one: she
// takes over your suit, walks you to the control room and makes you open
// her cell. She slips away up the hidden elevator; the officers find you at
// the console. Find her before they decide you're her accomplice. She's
// gone back to her office on 3F, as if nothing happened.
//
// Stages (Chapter1.state):
//   C2_OVERRIDE  your suit walks you to the control room (no control)
//   C2_COPS      the officers confront you
//   C2_FIND      find Victoria (her office, 3F)
//   C2_FOUND     the arrest, then the end

const B3_Y = -12;
const START = { x: 7.2, y: B3_Y, z: 12.4, yaw: Math.PI * 0.85 };
const VICTORIA_CELL = 6;
// The walk Victoria's override makes you take: out of the holding area,
// along the corridor, into the control room, up to the console.
const PUPPET_PATH = [
  { x: 7, z: 13.2 }, { x: 7, z: 16 }, { x: 33, z: 16 }, { x: 33, z: 19.6 }, { x: 31.6, z: 21.4 },
];
const PUPPET_SPEED = 2.2;
// Where Victoria goes once she's out (then she's gone, up the elevator).
const VICTORIA_ESCAPE = { x: 9, z: 22.6 }; // in front of the hidden elevator
// Just inside the control room door (x 33, z 18).
const OFFICERS_AT = [{ x: 32.5, z: 19.3 }, { x: 33.7, z: 19.7 }];
const FOUND_RANGE = 3;

const OVERRIDE_LINES = [
  { speaker: 'Victoria (suit radio)', text: 'Hello, Champ. Comfortable? You should be. Goob Co. makes a very good suit.' },
  { speaker: 'Victoria (suit radio)', text: 'Every suit we ever made has an executive override. I’m the executive. Left foot. Right foot.' },
  { speaker: 'Victoria (suit radio)', text: 'You let six people out of those cells tonight. What’s one more?' },
];
const COPS_LINES = [
  { speaker: 'Officer Diaz', text: 'Step away from the console! Hands where we can see them!' },
  { speaker: 'Officer Kim', text: 'Cell six is open. Cell six was the CEO.' },
  { speaker: 'Officer Diaz', text: 'You walk in here a hero and five minutes later you’re letting her out?' },
  { speaker: 'Officer Kim', text: '... Diaz, look at the suit. The visor’s blinking. GOOB CO. EXECUTIVE OVERRIDE.' },
  { speaker: 'Officer Diaz', text: 'Fine. You know this building better than anyone. Find her, Champ. Before she finds a way out. We’ll be right behind you.' },
];
const FOUND_LINES = [
  { speaker: 'Victoria', text: 'Champ. You found me. I did leave the lights on.' },
  { speaker: 'Victoria', text: 'Where else would I go? This is my office. My company. My plaques.' },
  { speaker: 'Officer Diaz', text: 'Victoria, you’re under arrest. Again.' },
  { speaker: 'Victoria', text: 'Fine. But keep the suit, Champ. You never know when someone might want to take it for a walk.' },
];
const OBJECTIVES = {
  C2_FIND: 'Find Victoria before the police decide you’re her accomplice. She went up the hidden elevator.',
};

export class AfterCredits {
  constructor({ ch2, scene }) {
    this.ch2 = ch2;
    this.officers = [0, 1].map((i) => {
      const person = new Person({
        shirt: 0x1f2c4a, pants: 0x161b28, skin: [0x8d5524, 0xf1c27d][i], hair: 0x1a1410, tie: 0x0d1220,
        seed: `officer-after-${i}`, hairStyle: 'buzz',
      });
      person.root.visible = false;
      scene.add(person.root);
      return person;
    });
    this.overlay = document.getElementById('notdone');
  }

  get ch1() {
    return this.ch2.ch1;
  }

  reset() {
    for (const o of this.officers) o.root.visible = false;
    this.overlay.hidden = true;
    this.watching = null;
  }

  // Straight after chapter 2's credits.
  async start() {
    const { ch2 } = this;
    const ch1 = this.ch1;
    const token = ch1.token;
    await this.notDone();
    if (token !== ch1.token) return;

    // B3, after the raid: everyone you rescued has gone home, the guards are
    // in custody, and Victoria's in cell 6, waiting to be transferred.
    ch2.setupAftermath();
    ch1.putOnSuit();
    ch1.outbreak = true;
    const v = ch1.victoria;
    this.lockVictoriaUp(v);
    const player = ch2.player;
    player.rig = null;
    player.spawn(START);
    player.lookTarget = v.headPoint;
    ch1.setState('C2_OVERRIDE', null, false);
    ch2.hud.toast('B3, an hour later. The police wanted a statement. Victoria is in cell six.', 4);
    ch1.fx.fade(1, 0);
    await ch1.fx.fade(0, 1.4);
    if (token !== ch1.token) return;
    await this.wait(2);
    if (token !== ch1.token) return;
    await this.override(v);
  }

  // "You're not done." over black.
  notDone() {
    const el = this.overlay;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    sfx.intercom();
    return this.wait(4.2).then(() => { el.hidden = true; });
  }

  // Game time (pauses with the game).
  wait(seconds) {
    return this.ch1.wait(seconds);
  }

  lockVictoriaUp(v) {
    v.person.root.visible = true;
    v.collider.enabled = true;
    v.frozen = false;
    v.brain = null;
    v.path = null;
    v.onArrive = null;
    v.cured = false;
    v.talkable = false;
    v.talking = false;
    v.mode = 'stand';
    v.person.setInfected(false);
    v.pos.set(this.ch2.cellX(VICTORIA_CELL), B3_Y, 8.6);
    v.home.copy(v.pos);
    v.yaw = 0; // facing the cell door
  }

  // The suit walks you to the control room and presses CELL RELEASE.
  async override(v) {
    const { ch2 } = this;
    const ch1 = this.ch1;
    const token = ch1.token;
    sfx.klaxon();
    ch1.fx.flash('#ff3a2a', 0.5);
    ch2.hud.announceObjective('SUIT OVERRIDE: GOOB CO. EXECUTIVE ACCESS. You can’t move.');
    ch1.alarmEl.hidden = false;
    v.talking = true;
    // Doors on the way open by themselves (she has the codes for those too).
    ch2.openForOverride();
    const walk = this.puppetWalk();
    await ch1.dialogue.play(OVERRIDE_LINES);
    await walk;
    if (token !== ch1.token) return;
    v.talking = false;

    // CELL RELEASE: her cell opens, she strolls out and away up the elevator.
    sfx.lock();
    ch2.hud.toast('Your hand presses CELL RELEASE. Somewhere down the corridor, a cell door clunks open.', 3.5);
    ch2.openCell(VICTORIA_CELL);
    v.cured = true; // (walks with collision and opens doors)
    v.speed = 1.8;
    const nav = v.env.nav;
    const lift = new THREE.Vector3(VICTORIA_ESCAPE.x, B3_Y, VICTORIA_ESCAPE.z);
    const route = nav.path(nav.nearest(v.pos), nav.nearest(lift), true) ?? [];
    v.walkPath([...route, lift], () => {
      v.person.root.visible = false;
      v.collider.enabled = false;
      v.frozen = true;
      ch2.world.secretElevator.request(1);
    });
    await this.wait(2.5);
    if (token !== ch1.token) return;

    // Control's back, and you've got company.
    ch2.player.rig = null;
    ch1.alarmEl.hidden = true;
    ch2.hud.toast('The suit lets go. Your legs are your own again.', 2.5);
    ch1.setState('C2_COPS', null, false);
    this.officers.forEach((o, i) => {
      const at = OFFICERS_AT[i];
      o.root.position.set(at.x, B3_Y, at.z);
      o.root.rotation.y = Math.atan2(31.6 - at.x, 21.4 - at.z);
      o.pose = 'stand';
      o.root.visible = true;
    });
    this.watching = this.officers[0];
    ch2.player.lookTarget = { x: OFFICERS_AT[0].x, y: B3_Y + 1.6, z: OFFICERS_AT[0].z };
    await ch1.dialogue.play(COPS_LINES);
    if (token !== ch1.token) return;
    ch2.player.lookTarget = null;
    this.watching = null;
    this.beginFind();
  }

  // Victoria's back in her office upstairs; the officers follow you.
  // save: false when restoring a checkpoint taken here.
  beginFind(save = true) {
    const { ch2 } = this;
    const ch1 = this.ch1;
    const v = ch1.victoria;
    v.reset(); // at her desk on 3F, typing as if nothing happened
    v.person.root.visible = true;
    v.collider.enabled = true;
    v.frozen = false;
    v.talkable = false;
    for (const o of this.officers) o.root.visible = false;
    ch2.world.secretElevator.lockedMessage = null;
    ch1.setState('C2_FIND', OBJECTIVES.C2_FIND, save);
    if (save) ch2.saveCheckpoint();
  }

  // Walk the player along PUPPET_PATH (a rig: no control, but you can look).
  puppetWalk() {
    const player = this.ch2.player;
    return new Promise((resolve) => {
      let i = 0;
      player.lookTarget = null;
      player.rig = {
        update: (dt, input, active, p) => {
          const t = PUPPET_PATH[i];
          if (!t) return;
          const dx = t.x - p.pos.x;
          const dz = t.z - p.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.05) {
            i += 1;
            if (i >= PUPPET_PATH.length) {
              p.yaw = -Math.PI / 2 + Math.PI; // facing the console (west)
              p.pitch = -0.6;
              resolve();
            }
            return;
          }
          const step = Math.min(d, PUPPET_SPEED * dt);
          p.pos.x += (dx / d) * step;
          p.pos.z += (dz / d) * step;
          const yaw = Math.atan2(-dx, -dz);
          p.yaw += Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)) * Math.min(1, dt * 6);
          p.pitch += (-0.1 - p.pitch) * Math.min(1, dt * 3);
        },
      };
    });
  }

  update() {
    const ch1 = this.ch1;
    if (this.watching) for (const o of this.officers) o.update(1 / 60, 0);
    if (ch1.state !== 'C2_FIND' || ch1.busy) return;
    const v = ch1.victoria;
    const p = this.ch2.player.pos;
    if (Math.abs(p.y - v.pos.y) < 1.5 && Math.hypot(p.x - v.pos.x, p.z - v.pos.z) < FOUND_RANGE) this.found(v);
  }

  async found(v) {
    const ch1 = this.ch1;
    const token = ch1.token;
    ch1.busy = true;
    ch1.setState('C2_FOUND', null, false);
    v.talking = true;
    this.ch2.player.lookTarget = v.headPoint;
    // The officers were right behind you.
    const p = this.ch2.player.pos;
    this.officers.forEach((o, i) => {
      o.root.position.set(p.x + (i ? 0.9 : -0.9), p.y, p.z + 1.2);
      o.root.rotation.y = Math.atan2(v.pos.x - o.root.position.x, v.pos.z - o.root.position.z);
      o.root.visible = true;
    });
    await ch1.dialogue.play(FOUND_LINES);
    if (token !== ch1.token) return;
    v.talking = false;
    await ch1.fx.fade(1, 1.6);
    if (token !== ch1.token) return;
    ch1.onEnd?.({
      title: 'The End',
      text: 'Victoria went back into a cell, this time with her suits’ override codes in an evidence bag. The rotation is over. Goob Co. is over. You still have the suit. It still blinks, sometimes.',
      hint: 'Thanks for playing The Goob Infection.',
    });
  }
}
