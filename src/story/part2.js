import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Guard } from './guards.js';
import { GoobExec } from './boss.js';
import { FinalRun } from './finalRun.js';
import { Launch, LAUNCH_STATES } from './launch.js';
import { CURED_LINES } from '../npc/cast.js';
import { difficulty } from '../core/settings.js';
import { sfx } from '../core/sound.js';

// Chapter 2, part 2: the hunt for Victoria through Goob Co. HQ at night.
// After the police confrontation (afterCredits.js) you check her office:
// she's not there, but she's left you a message. Then:
//
//   C2_TRANSMITTERS  smash the four override transmitters that let her
//                    control your suit (one on each floor B1-3F), past her
//                    loyal night security and the infected night shift.
//                    Each one you smash, she yanks your suit around.
//   C2_CLEANUP       the restarted vats flooded HQ: vacuum it all up (empty
//                    the tank into the yellow bins), floor by floor.
//   C2_EVIDENCE      she shredded her records on the way out: find the eight
//                    scraps scattered around HQ, for the case against her.
//   C2_NIGHTSHIFT    cure the six infected night-shift workers; Hank the
//                    janitor has the roof key.
//   C2_ROOF          ride the elevator up to the roof.
//   C2_BOSS          Victoria, in a goob-powered executive suit, by the last
//                    shuttle to Mars. Blast her, then spray her (three times).
//   C2_CHASE, C2_ESCORT  she runs; then lead the night shift out (finalRun.js)
//   C2_DRIVE ... C2_FINAL  the launch site (launch.js)

const CEO_OFFICE = { x0: 0, z0: 0, x1: 10, z1: 8, y: 8 };
const TRANSMITTERS = [
  { where: 'B1 server room', x: 11.4, y: -4, z: 14.2, rot: Math.PI },
  { where: '1F mail room', x: 23.45, y: 0, z: 9.2, rot: -Math.PI / 2 },
  { where: '2F IT closet', x: 20.55, y: 4, z: 15.4, rot: Math.PI / 2 },
  { where: '3F records room', x: 11.4, y: 8, z: 23.4, rot: Math.PI },
];
// Victoria's loyal night security: one patrol on each floor.
const HQ_GUARDS = [
  { name: 'Guard Vance', y: -4, look: { skin: 0xe0ac69, hair: 0x2b1d0e }, route: [{ x: 1.2, z: 11.5, wait: 2 }, { x: 22.8, z: 11.5, wait: 2 }] },
  { name: 'Guard Pike', y: 0, look: { skin: 0xf1c27d, hair: 0x5a3a1a, hairStyle: 'short' }, route: [{ x: 1.2, z: 11.6, wait: 2.5 }, { x: 22.8, z: 11.6, wait: 2.5 }] },
  {
    name: 'Guard Moss', y: 4, look: { skin: 0x8d5524, hair: 0x111111 },
    route: [{ x: 11.5, z: 1.5, wait: 2 }, { x: 11.5, z: 12.2 }, { x: 16.6, z: 12.2, wait: 2 }, { x: 16.6, z: 6.25 }, { x: 6.3, z: 6.25, wait: 2 }, { x: 11.5, z: 6.25 }],
  },
  { name: 'Guard Hale', y: 8, look: { skin: 0xc68642, hair: 0x2b1d0e, hairStyle: 'short' }, route: [{ x: 1.5, z: 11, wait: 2 }, { x: 11.5, z: 11 }, { x: 11.5, z: 10.5 }, { x: 22.8, z: 10.5, wait: 2 }, { x: 11.5, z: 10.5 }, { x: 11.5, z: 11 }] },
];
// The night shift: infected again, wandering HQ (cast members who were off
// in chapter 2 until now).
const NIGHT_SHIFT = [
  { name: 'Hank', x: 18, y: 0, z: 5, key: true },
  { name: 'Rhonda', x: 6, y: 0, z: 18.5 },
  { name: 'Brad', x: 5.5, y: 4, z: 13.2 },
  { name: 'Olu', x: 20.5, y: 4, z: 3 },
  { name: 'Deb', x: 19.5, y: 8, z: 18.5 },
  { name: 'Stan', x: 2, y: -4, z: 22.4 },
];
// The shredded evidence: scraps dropped on the floor across HQ as she fled.
const EVIDENCE = [
  { x: 8, y: -4, z: 11.6, what: 'a strip of the vat assignment sheet' },
  { x: 6, y: 0, z: 15, what: 'a corner of an Employee of the Month certificate' },
  { x: 17, y: 0, z: 8.2, what: 'half a shipping manifest: MARS 7, CARGO: \u201cINPUT\u201d' },
  { x: 1.2, y: 4, z: 5.2, what: 'a torn memo: \u201cDale must never see this\u201d' },
  { x: 19.5, y: 4, z: 17.2, what: 'a scrap of the override codes for every hazard suit' },
  { x: 9.2, y: 4, z: 20, what: 'a payment slip from the Board, marked \u201cdiscretion\u201d' },
  { x: 17, y: 8, z: 7, what: 'a page of the board minutes: \u201capproved: Mars program\u201d' },
  { x: 20, y: 8, z: 16, what: 'a photo of the next rotation, with your face circled' },
];
// Goob left when the cleanup counts as done (liters; a few stray drops are fine).
const CLEAN_ENOUGH = 10;
const ROOF_LOCKED = 'The ROOF button won’t light. It needs a key. (Hank the janitor has one.)';
const ROOF_ARRIVAL = { x: 16.5, y: 12, z: 11.6, yaw: Math.PI };
const BOSS_START = { x: 7, z: 16 };

const OBJECTIVES = {
  C2_TRANSMITTERS: (left) => `Smash Victoria’s suit-override transmitters (${4 - left.length}/4): ${left.join(', ')}. Avoid her night security (C to crouch).`,
  C2_CLEANUP: (liters) => `The restarted vats flooded HQ. Vacuum up the goob and empty your tank into the yellow bins (${Math.max(0, Math.ceil(liters - CLEAN_ENOUGH))} L to go). The HUD shows each floor.`,
  C2_EVIDENCE: (found) => `She shredded her records on the way out. Find the scraps scattered around HQ (${found}/${EVIDENCE.length}) for the case against her.`,
  C2_NIGHTSHIFT: (cured) => `Cure the infected night shift (${cured}/${NIGHT_SHIFT.length}) with the antidote (F). Hank the janitor has the roof key.`,
  C2_ROOF: 'You have the roof key. Take the elevator up to the roof.',
  C2_BOSS: (armor) => `Stop Victoria. Blast her with the vacuum (right mouse), then spray her with the antidote (F) while she’s stunned. Armor: ${armor}/5.`,
};
const MESSAGE = [
  { speaker: 'Victoria (recording)', text: 'Champ. If you’re hearing this, you came to my office. Predictable. I like that in an employee.' },
  { speaker: 'Victoria (recording)', text: 'I’m on the roof. The last shuttle to Mars leaves at dawn, and I’ll be on it, with the original batch.' },
  { speaker: 'Victoria (recording)', text: 'I’ve restarted the vats, by the way. The night shift got a little… enthusiastic.' },
  { speaker: 'Victoria (recording)', text: 'And my security never went home. Four little transmitters keep your suit on my leash: one on every floor. Good luck finding them.' },
];
const OVERRIDE_TAUNTS = [
  'Victoria (suit radio): Ah ah ah. Over here, Champ.',
  'Victoria (suit radio): You smash my things, I walk you places. That’s fair.',
  'Victoria (suit radio): Last one? Then let’s go say hello to a friend.',
];
const HANK_KEY = [
  { speaker: 'Hank', text: 'Champ? I was dreaming I was a puddle. A happy puddle.' },
  { speaker: 'Hank', text: 'Roof key? Yeah, right here. Victoria made me open it for her an hour ago. Go get her.' },
];
const BOSS_INTRO = [
  { speaker: 'Victoria', text: 'You made it. And here I was hoping my security would save me the trouble.' },
  { speaker: 'Victoria', text: 'Do you like the suit? Executive edition. Pure batch seven. Gary, Denise, Phil, Rosa, Ken… all of them, holding me together.' },
  { speaker: 'Victoria', text: 'The shuttle leaves at dawn. I’ll be on it. You won’t.' },
];
const BOSS_DEFEAT = [
  { speaker: 'Victoria', text: 'No… no, the suit… it’s coming apart…' },
  { speaker: 'Officer Diaz', text: 'Victoria! Stay down! It’s over!' },
  { speaker: 'Victoria', text: 'Over? I always have a way out, officer. Goob is forever, Champ.' },
  { speaker: 'Officer Kim', text: 'She’s in the elevator! She’s going down! Champ, take the stairs, we’ll cut her off!' },
];

export class Part2 {
  constructor({ ch2, ctx }) {
    this.ch2 = ch2;
    const { scene, interactions, materials, collision } = ctx;
    this.collision = collision;
    this.active = false;

    // Transmitters: a dark box on a stand, a whip antenna and a blinking light.
    this.transmitters = TRANSMITTERS.map((t) => {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.6, 0.35, 2, 0.04), materials.get('plastic'));
      box.position.y = 0.95;
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.65, 0.1), materials.get('metal'));
      stand.position.y = 0.33;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.3), materials.get('metal'));
      foot.position.y = 0.02;
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.9, 6), materials.get('steel'));
      antenna.position.set(0.15, 1.7, 0);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2020).multiplyScalar(2) }));
      led.position.set(-0.12, 1.12, 0.18);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ color: 0x6cff4a }));
      label.position.set(0, 0.85, 0.176);
      g.add(box, stand, foot, antenna, led, label);
      g.position.set(t.x, t.y, t.z);
      g.rotation.y = t.rot;
      g.visible = false;
      scene.add(g);
      const item = { ...t, group: g, led, destroyed: false };
      interactions.add({
        mesh: [box, stand],
        label: 'Smash the override transmitter',
        enabled: () => this.active && g.visible && !item.destroyed && this.state === 'C2_TRANSMITTERS' && !this.ch1.busy,
        use: () => this.smash(item),
      });
      return item;
    });

    this.guards = HQ_GUARDS.map((g) => new Guard(scene, { ...g, collision }));
    for (const g of this.guards) {
      g.setVisible(false);
      ch2.sightIgnore.add(g.collider);
    }

    // Evidence scraps: a crumpled bit of paper with a faint glow.
    const paperMat = new THREE.MeshLambertMaterial({ color: 0xf2eee2, emissive: 0x3a382e });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.4, depthWrite: false });
    this.evidence = EVIDENCE.map((e, i) => {
      const g = new THREE.Group();
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.14), paperMat);
      paper.position.y = 0.01;
      paper.rotation.set(0.15, i * 1.3, -0.1);
      const torn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.18), paperMat);
      torn.position.set(0.12, 0.012, 0.05);
      torn.rotation.y = 0.8 + i;
      const halo = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), glowMat);
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.006;
      const pick = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.y = 0.1;
      g.add(halo, paper, torn, pick);
      g.position.set(e.x, e.y, e.z);
      g.visible = false;
      scene.add(g);
      const item = { ...e, group: g, found: false };
      interactions.add({
        mesh: [paper, torn, pick],
        label: 'Pick up the shredded scrap',
        enabled: () => this.active && g.visible && !item.found && !this.ch1.busy,
        use: () => this.pickEvidence(item),
      });
      return item;
    });

    this.boss = new GoobExec(scene, ch2.ch1.victoria.def.look);
    this.finalRun = new FinalRun(this);
    this.launch = new Launch(this, ctx);
    this.time = 0;
  }

  get ch1() {
    return this.ch2.ch1;
  }

  get state() {
    return this.ch1.state;
  }

  get nightShift() {
    return NIGHT_SHIFT.map((n) => ({ ...n, npc: this.ch2.cast.all.find((c) => c.name === n.name) }));
  }

  // Things the vacuum blast and the antidote can hit (guards and the boss).
  get targets() {
    if (!this.active) return [];
    return [...this.guards.filter((g) => g.active), ...(this.boss.active ? [this.boss] : []), ...this.finalRun.targets, ...this.launch.targets];
  }

  stop() {
    this.active = false;
    for (const t of this.transmitters) t.group.visible = false;
    for (const e of this.evidence) e.group.visible = false;
    for (const g of this.guards) g.setVisible(false);
    this.boss.stop();
    this.launch.stop();
    this.ch2.world.elevator.floorLocks = null;
  }

  // ---------- The office: her message ----------

  async begin() {
    const ch1 = this.ch1;
    const token = ch1.token;
    ch1.busy = true;
    ch1.setState('C2_MESSAGE', null, false);
    sfx.intercom();
    this.ch2.hud.toast('A laptop on her desk lights up as you walk in.', 3);
    await ch1.dialogue.play(MESSAGE);
    if (token !== ch1.token) return;
    ch1.busy = false;
    this.setup({ transmitters: [false, false, false, false], cured: [], key: false, evidence: [], cleaned: false });
    ch1.equipVacuum();
    ch1.equipAntidote();
    this.ch2.hud.toast('Your vacuum and antidote are clipped to your suit. You’re going to need them.', 4);
    this.enter('C2_TRANSMITTERS', true);
  }

  // Put HQ into the part 2 state: progress = { transmitters, cured, key }.
  setup(progress) {
    const ch2 = this.ch2;
    this.active = true;
    this.progress = {
      transmitters: [...progress.transmitters], cured: [...progress.cured], key: !!progress.key,
      evidence: [...(progress.evidence ?? [])], cleaned: !!progress.cleaned,
    };
    this.evidence.forEach((e, i) => {
      e.found = this.progress.evidence.includes(i);
      e.group.visible = !e.found;
    });
    this.transmitters.forEach((t, i) => {
      t.destroyed = this.progress.transmitters[i];
      t.group.visible = !t.destroyed;
    });
    for (const g of this.guards) g.reset();
    // The night shift: infected, roaming, unless already cured (then they've gone home).
    for (const n of this.nightShift) {
      const npc = n.npc;
      if (!npc) continue;
      npc.path = null;
      npc.onArrive = null;
      npc.frozen = false;
      npc.talking = false;
      if (this.progress.cured.includes(n.name)) {
        npc.person.root.visible = false;
        npc.collider.enabled = false;
        npc.frozen = true;
        continue;
      }
      npc.person.root.visible = true;
      npc.collider.enabled = true;
      npc.cured = false;
      npc.brain = null;
      npc.person.setInfected(false);
      npc.mode = 'stand';
      npc.pos.set(n.x, n.y, n.z);
      npc.home.copy(npc.pos);
      npc.infect();
      npc.brain.reset(3);
    }
    // Goob's back in HQ (from the restarted vats): out of every vent and in
    // puddles across each floor. Once it's been cleaned up it stays gone.
    const goob = ch2.goob;
    goob.reset();
    if (!this.progress.cleaned) {
      for (const node of ch2.graph.nodes) {
        if (node.pos.y < -5 || node.pos.y > 10) continue;
        if (node.kind === 'vent') goob.spawn(node, 1.4);
        else if (node.kind === 'floor' && node.pos.x < 40 && !this.ch1.world.areaAt(node.pos).startsWith('Out') && Math.random() < 0.03) goob.spawn(node, 1.2);
      }
    }
    // It doesn't spread (the vats are off again): what you see is all there is.
    goob.spreading = false;
    ch2.world.elevator.floorLocks = this.progress.key ? null : { 4: ROOF_LOCKED };
    this.boss.stop();
    // Fresh duct tape everywhere (two rolls are on the roof, for the fight).
    for (const t of this.ch1.tapes) t.taken = false;
  }

  // Into a state, with its objective (and a checkpoint when announce is set).
  enter(state, announce = false) {
    const objective = this.objectiveFor(state);
    this.ch1.setState(state, objective, announce);
    if (announce) this.ch2.saveCheckpoint();
  }

  objectiveFor(state) {
    if (state === 'C2_TRANSMITTERS') return OBJECTIVES.C2_TRANSMITTERS(this.transmitters.filter((t) => !t.destroyed).map((t) => t.where));
    if (state === 'C2_NIGHTSHIFT') return OBJECTIVES.C2_NIGHTSHIFT(this.progress.cured.length);
    if (state === 'C2_CLEANUP') return OBJECTIVES.C2_CLEANUP(this.ch2.goob.remaining);
    if (state === 'C2_EVIDENCE') return OBJECTIVES.C2_EVIDENCE(this.evidence.filter((e) => e.found).length);
    if (state === 'C2_BOSS') return OBJECTIVES.C2_BOSS(this.boss.armor ?? 5);
    return OBJECTIVES[state] ?? null;
  }

  snapshot() {
    if (!this.active) return null;
    return {
      ...this.progress,
      transmitters: this.transmitters.map((t) => t.destroyed),
      evidence: this.evidence.flatMap((e, i) => (e.found ? [i] : [])),
      launch: this.launch.snapshot(),
    };
  }

  // Restoring a checkpoint taken in part 2 (Chapter2.restore has set up the
  // facility and the aftermath; the player is already in place).
  restore(c) {
    this.setup(c.part2 ?? { transmitters: [false, false, false, false], cured: [], key: false, evidence: [], cleaned: false });
    const ch1 = this.ch1;
    ch1.equipVacuum();
    ch1.equipAntidote();
    if (LAUNCH_STATES.includes(c.state)) this.launch.restore(c.part2?.launch ?? null, c.state);
    else if (c.state === 'C2_BOSS') this.startBoss(false);
    else if (c.state === 'C2_CHASE') this.finalRun.startChase(false);
    else if (c.state === 'C2_ESCORT') this.finalRun.startEscort(false);
    else ch1.setState(c.state, this.objectiveFor(c.state), false);
  }

  // ---------- Transmitters ----------

  async smash(item) {
    item.destroyed = true;
    item.group.visible = false;
    this.progress.transmitters = this.transmitters.map((t) => t.destroyed);
    sfx.smash();
    this.ch1.fx.flash('#ffffff', 0.25);
    const left = this.transmitters.filter((t) => !t.destroyed);
    this.ch2.hud.toast(`Transmitter smashed (${4 - left.length}/4). Sparks, smoke, a smell like burnt goob.`, 3);
    if (left.length > 0) {
      this.ch1.hud.setObjective(this.objectiveFor('C2_TRANSMITTERS'));
      this.ch2.saveCheckpoint();
      await this.overrideEvent(4 - left.length - 1);
      return;
    }
    await this.overrideEvent(2);
    this.ch2.hud.toast('Victoria (suit radio): Fine. No more leash. Come up to the roof, Champ. If you can get there.', 4.5);
    this.enter('C2_CLEANUP', true);
  }

  // Victoria grabs your suit for a few seconds and walks you toward the
  // nearest infected (or just off somewhere), with a taunt.
  overrideEvent(n) {
    const ch1 = this.ch1;
    const player = this.ch2.player;
    const target = this.nearestInfected(player.pos, 14);
    ch1.alarmEl.hidden = false;
    ch1.fx.flash('#ff3a2a', 0.35);
    sfx.klaxon();
    this.ch2.hud.toast(OVERRIDE_TAUNTS[n] ?? OVERRIDE_TAUNTS[0], 3.5);
    let t = 3.2;
    const dir = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    return new Promise((resolve) => {
      player.rig = {
        update: (dt, input, active, p) => {
          t -= dt;
          if (t <= 0) {
            p.rig = null;
            ch1.alarmEl.hidden = true;
            resolve();
            return;
          }
          if (target) dir.set(target.pos.x - p.pos.x, 0, target.pos.z - p.pos.z);
          if (dir.lengthSq() < 0.6) return; // close enough
          dir.normalize();
          const step = 2.6 * dt;
          p.moveAxis('x', dir.x * step);
          p.moveAxis('z', dir.z * step);
          const yaw = Math.atan2(-dir.x, -dir.z);
          p.yaw += Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)) * Math.min(1, dt * 5);
        },
      };
    });
  }

  nearestInfected(pos, range) {
    let best = null;
    for (const n of this.nightShift) {
      const npc = n.npc;
      if (!npc?.infected || !npc.person.root.visible || Math.abs(npc.pos.y - pos.y) > 1.5) continue;
      const d = Math.hypot(npc.pos.x - pos.x, npc.pos.z - pos.z);
      if (d < range && (!best || d < best.d)) best = { d, pos: npc.pos };
    }
    return best;
  }

  // ---------- The cleanup and the evidence ----------

  // Called each frame during the cleanup: done once (nearly) all the goob is
  // vacuumed up and the tank's been emptied.
  checkCleanup() {
    const goob = this.ch2.goob;
    this.ch1.hud.setObjective(this.objectiveFor('C2_CLEANUP'));
    if (goob.remaining > CLEAN_ENOUGH || this.ch1.vacuum.tank > 0.5) return;
    goob.reset();
    goob.spreading = false;
    this.progress.cleaned = true;
    this.ch2.hud.toast('HQ is clean. The vats upstairs gurgle, and go quiet.', 3);
    this.enter('C2_EVIDENCE', true);
  }

  pickEvidence(item) {
    item.found = true;
    item.group.visible = false;
    sfx.pickup();
    const found = this.evidence.filter((e) => e.found).length;
    this.ch2.hud.toast(`Found ${item.what} (${found}/${EVIDENCE.length}).`, 3.5);
    if (this.state !== 'C2_EVIDENCE') return;
    if (found >= EVIDENCE.length) {
      this.ch2.hud.toast('That\u2019s all of it. Enough to put her away for good. Now: the night shift.', 3.5);
      this.enter(this.progress.cured.length >= NIGHT_SHIFT.length ? (this.progress.key ? 'C2_ROOF' : 'C2_NIGHTSHIFT') : 'C2_NIGHTSHIFT', true);
    } else {
      this.ch1.hud.setObjective(this.objectiveFor('C2_EVIDENCE'));
      this.ch2.saveCheckpoint();
    }
  }

  // ---------- The night shift ----------

  // The antidote reached someone (Chapter2.cured): true if it was ours.
  cured(npc) {
    if (!this.active) return false;
    if (npc === this.boss) {
      this.bossHit();
      return true;
    }
    if (this.finalRun.cureFollower(npc)) return true;
    if (this.launch.cured(npc)) return true;
    const n = this.nightShift.find((q) => q.npc === npc);
    if (!n) return false;
    npc.cure(CURED_LINES[npc.name] ?? CURED_LINES.default);
    sfx.cure(npc.pos);
    this.ch1.fx.flash('#8fd8ff', 0.3);
    if (!this.progress.cured.includes(n.name)) this.progress.cured.push(n.name);
    const count = this.progress.cured.length;
    this.ch2.hud.toast(`${n.name} is cured! (${count}/${NIGHT_SHIFT.length} of the night shift)`, 2.5);
    if (n.key) this.hankKey(npc);
    if (this.state === 'C2_NIGHTSHIFT') {
      if (count >= NIGHT_SHIFT.length) this.enter('C2_ROOF', true);
      else {
        this.ch1.hud.setObjective(this.objectiveFor('C2_NIGHTSHIFT'));
        this.ch2.saveCheckpoint();
      }
    }
    return true;
  }

  async hankKey(npc) {
    const token = this.ch1.token;
    npc.talking = true;
    await this.ch1.dialogue.play(HANK_KEY);
    if (token !== this.ch1.token) return;
    npc.talking = false;
    this.progress.key = true;
    this.ch2.world.elevator.floorLocks = null;
    sfx.keys();
    this.ch2.hud.toast('Got the roof key. The elevator can go to the ROOF now.', 3);
  }

  // ---------- The roof ----------

  async startBoss(intro = true) {
    const ch1 = this.ch1;
    const token = ch1.token;
    const player = this.ch2.player;
    for (const g of this.guards) g.setVisible(false);
    this.boss.start(BOSS_START.x, BOSS_START.z);
    if (!intro) {
      ch1.setState('C2_BOSS', this.objectiveFor('C2_BOSS'), false);
      return;
    }
    ch1.busy = true;
    ch1.setState('C2_BOSS', null, false);
    this.ch2.saveCheckpoint();
    player.lookTarget = { x: this.boss.pos.x, y: this.boss.pos.y + 2.2, z: this.boss.pos.z };
    this.boss.active = false; // (stands still while she talks)
    await ch1.dialogue.play(BOSS_INTRO);
    if (token !== ch1.token) return;
    player.lookTarget = null;
    this.boss.active = true;
    ch1.busy = false;
    ch1.setState('C2_BOSS', this.objectiveFor('C2_BOSS'), true);
  }

  async bossHit() {
    const done = this.boss.hit();
    this.ch1.fx.flash('#8fd8ff', 0.4);
    if (!done) {
      const toasts = { 4: 'A layer of her armor sloughs off!', 3: 'Another layer gone!', 2: 'She’s angry now. Watch the spread!', 1: 'One more!' };
      this.ch2.hud.toast(toasts[this.boss.armor] ?? 'Hit!', 2.5);
      this.ch1.hud.setObjective(this.objectiveFor('C2_BOSS'));
      return;
    }
    // Beaten.
    const ch1 = this.ch1;
    const token = ch1.token;
    ch1.busy = true;
    this.boss.active = false;
    this.boss.clearGlobs();
    this.boss.person.action = 'stunned';
    ch1.setState('C2_FOUND', null, false);
    const player = this.ch2.player;
    player.lookTarget = { x: this.boss.pos.x, y: this.boss.pos.y + 1.8, z: this.boss.pos.z };
    // The officers arrive behind you.
    const officers = this.ch2.after.officers;
    officers.forEach((o, i) => {
      o.root.position.set(player.pos.x + (i ? 1 : -1), player.pos.y, player.pos.z + 1.4);
      o.root.rotation.y = Math.atan2(this.boss.pos.x - o.root.position.x, this.boss.pos.z - o.root.position.z);
      o.root.visible = true;
    });
    await ch1.dialogue.play(BOSS_DEFEAT);
    if (token !== ch1.token) return;
    // She gets away from the roof: the chase is on (finalRun.js).
    await ch1.fx.fade(1, 0.8);
    if (token !== ch1.token) return;
    for (const o of officers) o.root.visible = false;
    this.finalRun.startChase();
    await ch1.fx.fade(0, 0.6);
  }

  damage(amount) {
    const ch1 = this.ch1;
    const player = this.ch2.player;
    if (ch1.busy || amount <= 0) return;
    player.suit = Math.max(0, player.suit - amount);
    player.shakeFor(0.3);
    ch1.fx.flash('#6cff4a', 0.4);
    sfx.hurt();
    if (player.suit <= 0) ch1.breach();
  }

  // ---------- Every frame ----------

  // Returns the highest guard suspicion (for the meter), or 0.
  update(dt) {
    if (!this.active) return 0;
    this.time += dt;
    for (const t of this.transmitters) t.led.visible = Math.sin(this.time * 6) > 0;
    const state = this.state;
    const ch1 = this.ch1;
    const player = this.ch2.player;

    if (state === 'C2_ROOF' && player.pos.y > 11.5 && !ch1.busy) this.startBoss(true);
    if (state === 'C2_CLEANUP' && !ch1.busy) this.checkCleanup();
    this.finalRun.update(dt);
    if (state === 'C2_BOSS' && this.boss.active) {
      this.boss.update(dt, player, () => this.damage(this.globDamage()));
    }

    const watching = ['C2_TRANSMITTERS', 'C2_CLEANUP', 'C2_EVIDENCE', 'C2_NIGHTSHIFT', 'C2_ROOF'].includes(state) && !ch1.busy && !this.ch2.caughtBusy && !player.rig;
    let suspicion = 0;
    for (const g of this.guards) {
      const s = g.update(dt, player, this.collision, this.ch2.sightIgnore);
      if (watching) suspicion = Math.max(suspicion, s);
    }
    return Math.max(suspicion, this.launch.update(dt));
  }

  globDamage() {
    const d = difficulty();
    if (!d.infectedAttack) return 4;
    return d.infectedOpenDoors ? 11 : 7;
  }
}
