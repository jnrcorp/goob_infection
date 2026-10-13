import * as THREE from 'three';
import { sfx } from '../core/sound.js';

// The last two missions of chapter 2, after the roof:
//
//   C2_CHASE   Victoria's goob suit falls apart, and she bolts: down the
//              stairs, through the loading dock and out to the getaway truck
//              in the yard. Catch her before she gets there. She stops now
//              and then to fling goob back at you; a vacuum blast staggers
//              her. (If she reaches the truck, you retry the chase.)
//   C2_ESCORT  The night shift is hiding in the 1F break room, and the
//              building's still crawling with infected. Lead all six out the
//              front doors to the police in the parking lot. Infected who
//              catch one of them re-infect them: cure them and keep going.

const CHASE_START = { x: 12.6, y: 4, z: 14.6 };         // 2F stair landing
const PLAYER_CHASE = { x: 16.5, y: 8, z: 11.6, yaw: Math.PI }; // 3F, out of the elevator
const TRUCK = { x: 44, y: 0, z: 5.6 };                  // the getaway truck in the yard
// Her way out (the nav graph finds the stairs and doors between these).
const CHASE_WAYPOINTS = [{ x: 12.6, y: 0, z: 14.6 }, { x: 22, y: 0, z: 11.5 }, { x: 34, y: 0, z: 15.5 }, { x: 38, y: 0, z: 15.5 }, TRUCK];
const CHASE = {
  speed: 4.3,
  catchRange: 2.2,
  throwEvery: 4.2,   // seconds between stops to throw goob back
  throwPause: 1.1,
  stagger: 2.6,      // seconds a vacuum blast holds her up
};

// The escort.
const BREAK_ROOM_SPOTS = [[2.5, 19], [3.5, 22.5], [6, 22.8], [9.5, 20.5], [10.5, 15.6], [6.5, 15.2]];
const ESCORT_START = { x: 6.5, y: 0, z: 18.6, yaw: 0 };
// Infected waiting along the way out: cast members the hunt hasn't used.
const ESCORT_THREATS = [
  { name: 'Tom', x: 9, y: 0, z: 11.6 }, { name: 'Marcy', x: 17.5, y: 0, z: 11.5 }, { name: 'Janet', x: 16, y: 0, z: 6 },
  { name: 'Walt', x: 21.5, y: 0, z: 3 }, { name: 'Gus', x: 12, y: 0, z: -4 }, { name: 'Pat', x: 22, y: 0, z: -5 },
];
const SAFE = { x0: 10, z0: -14, x1: 26, z1: -3 }; // the police line in the lot
const FOLLOW_GAP = 1.6;      // how close followers keep to you
const REINFECT_RANGE = 0.85;
const REINFECT_TIME = 1.3;

const CAUGHT = [
  { speaker: 'Victoria', text: 'Let go of me! Do you know who I am?' },
  { speaker: 'Champ', text: 'The CEO of a company that doesn’t exist anymore.' },
  { speaker: 'Officer Diaz', text: 'Got her! Nice tackle, Champ. Okay, Victoria. Hands where I can see them. Both of them.' },
  { speaker: 'Officer Kim', text: 'Champ, the night shift is still hiding in the break room on 1F, and the building’s still crawling with those things. Can you bring them out?' },
];
const ESCAPED = 'Victoria’s truck roars out of the yard. You were too slow.';
const OUTRO = [
  { speaker: 'Hank', text: 'Fresh air! Real air! I’m never mopping goob again. I’m going to be a florist.' },
  { speaker: 'Officer Diaz', text: 'That’s everyone. Six for six. Champ, that’s two nights in a row you’ve walked people out of that building.' },
  { speaker: 'Officer Kim', text: 'Go home. Sleep. And maybe take the suit off. The visor’s still blinking.' },
];
const OBJECTIVES = {
  C2_CHASE: 'She’s running! Catch Victoria before she reaches the getaway truck in the loading yard. (Shift to run; a vacuum blast staggers her.)',
  C2_ESCORT: (out, total) => `Lead the night shift out of the 1F break room, through the front doors, to the police in the parking lot (${out}/${total} safe). Cure anyone the infected catch.`,
};

export class FinalRun {
  constructor(part2) {
    this.part2 = part2;
    this.contact = new Map();
  }

  get ch1() {
    return this.part2.ch1;
  }

  get ch2() {
    return this.part2.ch2;
  }

  get state() {
    return this.ch1.state;
  }

  cast(name) {
    return this.ch2.cast.all.find((n) => n.name === name);
  }

  // ---------- The chase ----------

  startChase(save = true) {
    const ch1 = this.ch1;
    const v = ch1.victoria;
    const player = this.ch2.player;
    this.part2.boss.stop();
    for (const g of this.part2.guards) g.setVisible(false);
    player.rig = null;
    player.lookTarget = null;
    player.spawn(PLAYER_CHASE);
    v.person.root.visible = true;
    v.person.setInfected(true); // what's left of the goob suit
    v.collider.enabled = true;
    v.frozen = false;
    v.brain = null;
    v.talking = false;
    v.talkable = false;
    v.cured = true; // (walks with collision and opens doors)
    v.mode = 'stand';
    v.pos.set(CHASE_START.x, CHASE_START.y, CHASE_START.z);
    v.speed = CHASE.speed;
    // A vacuum blast staggers her (Vacuum.blow stuns anything with a brain).
    this.stagger = 0;
    this.throwIn = CHASE.throwEvery;
    this.pause = 0;
    v.chaseBrain = { stun: () => { this.stagger = CHASE.stagger; sfx.hurt(); }, state: 'fleeing' };
    this.planChase(v);
    // She left the stairwell doors swinging behind her (you're right behind).
    for (const d of this.ch2.world.doors) {
      if (d.label === 'stairwell door' && d.pivot.position.y > -1) d.setOpen(1);
    }
    ch1.busy = false;
    ch1.setState('C2_CHASE', OBJECTIVES.C2_CHASE, true);
    if (save) this.ch2.saveCheckpoint();
  }

  // Through each waypoint by the nav graph's way (stairs, doors).
  planChase(v) {
    const nav = v.env.nav;
    let from = v.pos.clone();
    const route = [];
    for (const w of CHASE_WAYPOINTS) {
      const to = new THREE.Vector3(w.x, w.y, w.z);
      route.push(...(nav.path(nav.nearest(from), nav.nearest(to), true) ?? []), to);
      from = to;
    }
    v.walkPath(route, () => this.escaped());
  }

  // For the vacuum: Victoria can be blasted during the chase.
  get targets() {
    if (this.state !== 'C2_CHASE') return [];
    const v = this.ch1.victoria;
    return [{ pos: v.pos, brain: v.chaseBrain, name: 'Victoria' }];
  }

  updateChase(dt) {
    const ch1 = this.ch1;
    const v = ch1.victoria;
    const player = this.ch2.player;
    // Staggered, or stopping to throw: she stands still for a moment.
    if (this.stagger > 0) this.stagger -= dt;
    else if (this.pause > 0) this.pause -= dt;
    else {
      this.throwIn -= dt;
      if (this.throwIn <= 0) {
        this.throwIn = CHASE.throwEvery;
        this.pause = CHASE.throwPause;
        if (Math.abs(player.pos.y - v.pos.y) < 2 && v.pos.distanceTo(player.pos) < 14) {
          this.part2.boss.pos.copy(v.pos);
          this.part2.boss.throwGlob(player, 0);
        }
      }
    }
    v.frozen = this.stagger > 0 || this.pause > 0;
    v.person.action = this.stagger > 0 ? 'stunned' : null;
    if (v.frozen) v.yaw = Math.atan2(player.pos.x - v.pos.x, player.pos.z - v.pos.z);
    // Globs she's thrown still fly.
    this.part2.boss.updateGlobs(dt, player, () => this.part2.damage(this.part2.globDamage()));
    if (Math.abs(player.pos.y - v.pos.y) < 1.5 && Math.hypot(player.pos.x - v.pos.x, player.pos.z - v.pos.z) < CHASE.catchRange) this.caught();
  }

  async caught() {
    const ch1 = this.ch1;
    const token = ch1.token;
    const v = ch1.victoria;
    ch1.busy = true;
    v.path = null;
    v.frozen = true;
    v.talking = true;
    v.person.action = null;
    this.part2.boss.clearGlobs();
    sfx.blast();
    ch1.fx.flash('#ffffff', 0.3);
    const player = this.ch2.player;
    player.lookTarget = v.headPoint;
    const officers = this.ch2.after.officers;
    officers.forEach((o, i) => {
      o.root.position.set(v.pos.x + (i ? 1.1 : -1.1), v.pos.y, v.pos.z + 0.8);
      o.root.rotation.y = Math.atan2(v.pos.x - o.root.position.x, v.pos.z - o.root.position.z);
      o.root.visible = true;
    });
    await ch1.dialogue.play(CAUGHT);
    if (token !== ch1.token) return;
    await ch1.fx.fade(1, 0.8);
    if (token !== ch1.token) return;
    v.talking = false;
    v.person.root.visible = false;
    v.collider.enabled = false;
    for (const o of officers) o.root.visible = false;
    this.startEscort();
    await ch1.fx.fade(0, 0.8);
  }

  async escaped() {
    const ch1 = this.ch1;
    if (this.state !== 'C2_CHASE' || ch1.busy) return;
    const token = ch1.token;
    ch1.busy = true;
    this.ch2.hud.toast(ESCAPED, 3);
    sfx.crash();
    await ch1.fx.fade(1, 1.2);
    if (token !== ch1.token) return;
    this.ch2.restore(ch1.checkpoint);
    this.ch2.hud.toast('Try again: cut through the loading dock, and blast her to slow her down.', 4);
  }

  // ---------- The escort ----------

  startEscort(save = true) {
    const ch1 = this.ch1;
    const player = this.ch2.player;
    player.rig = null;
    player.lookTarget = null;
    player.spawn(ESCORT_START);
    this.contact.clear();
    this.followers = this.part2.nightShift.map((n) => n.npc).filter(Boolean);
    this.followers.forEach((npc, i) => {
      const [x, z] = BREAK_ROOM_SPOTS[i % BREAK_ROOM_SPOTS.length];
      npc.person.root.visible = true;
      npc.collider.enabled = true;
      npc.frozen = false;
      npc.path = null;
      npc.onArrive = null;
      npc.brain = null;
      npc.person.setInfected(false);
      npc.cured = true;
      npc.talkable = false;
      npc.talking = false;
      npc.mode = 'stand';
      npc.speed = 3.2;
      npc.pos.set(x, 0, z);
      npc.home.copy(npc.pos);
      npc.safe = false;
    });
    this.threats = ESCORT_THREATS.map((t) => {
      const npc = this.cast(t.name);
      if (!npc) return null;
      npc.person.root.visible = true;
      npc.collider.enabled = true;
      npc.frozen = false;
      npc.path = null;
      npc.cured = false;
      npc.brain = null;
      npc.person.setInfected(false);
      npc.mode = 'stand';
      npc.pos.set(t.x, t.y, t.z);
      npc.home.copy(npc.pos);
      npc.infect();
      npc.brain.reset(2);
      return npc;
    }).filter(Boolean);
    for (const g of this.part2.guards) g.setVisible(false);
    this.part2.boss.stop();
    this.ch2.goob.reset();
    this.ch2.goob.spreading = false;
    this.followIn = 0;
    ch1.busy = false;
    ch1.setState('C2_ESCORT', OBJECTIVES.C2_ESCORT(0, this.followers.length), true);
    if (save) this.ch2.saveCheckpoint();
  }

  // A follower the infected caught: cured by the antidote (Part2.cured).
  cureFollower(npc) {
    if (this.state !== 'C2_ESCORT' || !this.followers?.includes(npc)) return false;
    npc.brain = null;
    npc.mode = 'stand';
    npc.cured = true;
    npc.person.setInfected(false);
    sfx.cure(npc.pos);
    this.ch1.fx.flash('#8fd8ff', 0.3);
    this.ch2.hud.toast(`${npc.name} is cured. Stay close!`, 2.2);
    return true;
  }

  updateEscort(dt) {
    const player = this.ch2.player;
    // Followers walk to just behind you (unless safe, or infected).
    this.followIn -= dt;
    if (this.followIn <= 0) {
      this.followIn = 0.5;
      const nav = this.followers[0]?.env.nav;
      this.followers.forEach((npc, i) => {
        if (npc.safe || npc.infected) return;
        const d = Math.hypot(npc.pos.x - player.pos.x, npc.pos.z - player.pos.z);
        if (d < FOLLOW_GAP + 0.3 * (i % 3) && Math.abs(npc.pos.y - player.pos.y) < 1) {
          npc.path = null;
          return;
        }
        const behind = new THREE.Vector3(player.pos.x + Math.sin(player.yaw) * 1.2, player.pos.y, player.pos.z + Math.cos(player.yaw) * 1.2);
        const route = nav ? nav.path(nav.nearest(npc.pos), nav.nearest(behind), true) ?? [] : [];
        npc.walkPath([...route.slice(1), behind]);
      });
    }
    // The infected catching a follower re-infect them.
    for (const npc of this.followers) {
      if (npc.infected || npc.safe) { this.contact.delete(npc); continue; }
      const threat = this.threats.find((t) => t.infected && t.brain?.state !== 'stunned' && Math.abs(t.pos.y - npc.pos.y) < 1 && Math.hypot(t.pos.x - npc.pos.x, t.pos.z - npc.pos.z) < REINFECT_RANGE);
      if (!threat) { this.contact.delete(npc); continue; }
      const t = (this.contact.get(npc) ?? 0) + dt;
      this.contact.set(npc, t);
      if (t >= REINFECT_TIME) {
        this.contact.delete(npc);
        npc.path = null;
        npc.infect();
        sfx.moan(npc.pos, 0.9);
        this.ch2.hud.toast(`${threat.name} got ${npc.name}! Cure them (F).`, 3);
      }
    }
    // Safe behind the police line.
    for (const npc of this.followers) {
      if (npc.safe || npc.infected) continue;
      if (npc.pos.y < 1 && npc.pos.x > SAFE.x0 && npc.pos.x < SAFE.x1 && npc.pos.z > SAFE.z0 && npc.pos.z < SAFE.z1) {
        npc.safe = true;
        npc.path = null;
        npc.walkPath([{ x: npc.pos.x, z: npc.pos.z - 2 }]);
        sfx.cure(npc.pos);
      }
    }
    const out = this.followers.filter((n) => n.safe).length;
    this.ch1.hud.setObjective(OBJECTIVES.C2_ESCORT(out, this.followers.length));
    if (out >= this.followers.length) this.finish();
  }

  async finish() {
    const ch1 = this.ch1;
    if (ch1.busy) return;
    const token = ch1.token;
    ch1.busy = true;
    ch1.setState('C2_FOUND', null, false);
    for (const t of this.threats) { t.person.root.visible = false; t.collider.enabled = false; t.frozen = true; }
    const officers = this.ch2.after.officers;
    const player = this.ch2.player;
    officers.forEach((o, i) => {
      o.root.position.set(player.pos.x + (i ? 1.2 : -1.2), 0, player.pos.z - 2);
      o.root.rotation.y = Math.atan2(player.pos.x - o.root.position.x, player.pos.z - o.root.position.z);
      o.root.visible = true;
    });
    player.lookTarget = { x: officers[0].root.position.x, y: 1.6, z: officers[0].root.position.z };
    await ch1.dialogue.play(OUTRO);
    if (token !== ch1.token) return;
    await ch1.fx.fade(1, 1.8);
    if (token !== ch1.token) return;
    ch1.onEnd?.({
      title: 'The End',
      text: 'Victoria was dragged out of the loading yard a few hours before dawn. The last shuttle to Mars never launched. The vats were drained, the transmitters bagged as evidence, and all six of the night shift walked out the front door. The rotation is over. Goob Co. is over. You kept the suit. It doesn’t blink anymore.',
      hint: 'Thanks for playing The Goob Infection.',
    });
  }

  update(dt) {
    if (this.ch1.busy) return;
    if (this.state === 'C2_CHASE') this.updateChase(dt);
    if (this.state === 'C2_ESCORT') this.updateEscort(dt);
  }
}
