import { BOSS_BRIEFING, BOSS_ROUTE, CURED_LINES, DALE_CALL, DALE_THANKS } from '../npc/cast.js';
import { BUILDING } from '../world/building.js';
import { createAntidoteProp, createBins, createVacuumRack } from '../goob/bins.js';
import { VACUUM } from '../player/vacuum.js';
import { INFECTED } from '../npc/infectedBrain.js';
import { createDuctTape } from '../world/pickups.js';
import { BinHauler } from './hauling.js';
import { sfx } from '../core/sound.js';

// Chapter 1 story flow:
// INTRO → BRIEFING → TO_LOCKERS → TO_FREEZER → SPILL → GET_VACUUM → CLEANUP
// → SECURE (wheel the bins into the freezer) → LOCK_FREEZER → DALE_CALL
// → GET_ANTIDOTE → CURE → FINALE

const BIN_COUNT = BUILDING.bins.length;
const OBJECTIVES = {
  INTRO: 'Wait at your desk (the gold CHAMP nameplate). Your manager wants a word.',
  INTRO_AWAY: 'Your manager is waiting at your desk (the gold CHAMP nameplate).',
  TO_LOCKERS: 'Suit up in the 1F locker room.',
  TO_FREEZER: 'Get the goob from the secure freezer in the loading dock.',
  GET_VACUUM: 'Grab the containment vacuum beside the freezer door.',
  CLEANUP: 'Vacuum up all the goob. Empty the tank into yellow biohazard bins.',
  LAST_TANK: 'Empty your tank into a biohazard bin.',
  SECURE: (loaded) => `Wheel the biohazard bins into the secure freezer (${loaded}/${BIN_COUNT}). The elevator works again.`,
  LOCK_FREEZER: 'Lock the secure freezer.',
  GET_ANTIDOTE: 'Get the antidote from the infirmary, next to the elevator on 1F.',
  CURE: (cured, total) => `Cure everyone: hold F to spray the antidote (${cured}/${total} cured).`,
};
const FREEZER_LOCKED = 'Hazard suit required beyond this point.';
const FREEZER_SEALED = 'Locked tight. The goob stays in there.';
const FREEZER_AREA = { x0: 31, z0: 17, x1: 36, z1: 24 };
const BRIEFING_RANGE = 2.8;
const VENT_SEEDS = 6;
const TAPE_REPAIR = 35;          // suit percent per roll of duct tape
const HOSTILE_STATES = new Set(['GET_VACUUM', 'CLEANUP', 'SECURE', 'LOCK_FREEZER', 'GET_ANTIDOTE', 'CURE']);
const STAGES = ['TO_LOCKERS', 'TO_FREEZER', 'GET_VACUUM', 'CLEANUP', 'SECURE', 'LOCK_FREEZER', 'GET_ANTIDOTE', 'CURE'];

const HANK_WATCHING = [
  'Careful carrying that thing. Nice and slow.',
  "I've got the shuttle crate open. Just bring it here.",
];

export class Chapter1 {
  constructor({
    ctx, world, player, cast, hud, dialogue, interactions, fx, goob, graph, vacuum, antidote, spill,
    sightIgnore, onEnd, onBreach,
  }) {
    Object.assign(this, { world, player, cast, hud, dialogue, fx, goob, graph, vacuum, antidote, spill, onEnd, onBreach });
    this.outbreak = false;
    this.checkpoint = null;
    this.token = 0;
    this.time = 0;
    this.timers = [];
    this.state = 'INTRO';
    this.busy = false;
    this.freezerDoor = world.doorByLabel('freezer door');
    this.managerDoor = world.doorByLabel("manager's door");
    this.hank = cast.all.find((n) => n.name === 'Hank');

    interactions.add({
      mesh: world.props.suit.meshes,
      label: 'Put on hazard suit',
      enabled: () => this.state === 'TO_LOCKERS' && !this.busy,
      use: () => this.suitUp(),
    });
    interactions.add({
      mesh: world.props.canister.meshes,
      label: 'Pick up the goob',
      enabled: () => this.state === 'TO_FREEZER' && !this.busy,
      use: () => this.pickUpGoob(),
    });
    this.rack = createVacuumRack(ctx, BUILDING.vacuumRack, {
      enabled: () => this.state === 'GET_VACUUM' && !this.busy,
      onUse: () => this.takeVacuum(),
    });
    const bins = createBins(ctx, BUILDING.bins, {
      label: (bin) => this.binLabel(bin),
      enabled: (bin) => this.binEnabled(bin),
      onUse: (bin) => {
        if (this.state !== 'SECURE') return this.emptyTank();
        sfx.bin(bin.group.position);
        this.hauler.grab(bin);
      },
    });
    this.hauler = new BinHauler({
      bins, player, collision: ctx.collision, sightIgnore, hud,
      onLoaded: (bin, count) => this.binLoaded(count),
    });
    this.tapes = createDuctTape(ctx, BUILDING.ductTape, {
      enabled: () => this.outbreak && !this.busy,
      onTake: (tape) => this.takeTape(tape),
    });
    this.antidoteProp = createAntidoteProp(ctx, BUILDING.antidote, {
      enabled: () => this.state === 'GET_ANTIDOTE' && !this.busy,
      onUse: () => this.takeAntidote(),
    });
    this.freezerDoor.override = {
      enabled: () => this.state === 'LOCK_FREEZER' && !this.busy,
      label: 'Lock the secure freezer',
      use: () => this.lockFreezer(),
    };
    antidote.onCure = (npc) => this.cureNpc(npc);
    for (const npc of cast.all) npc.onTalk = (n) => this.talkTo(n);
  }

  // Infected only attack during the outbreak (not in cutscenes or menus).
  get hostile() {
    return this.outbreak && !this.busy && HOSTILE_STATES.has(this.state);
  }

  // True while the player shouldn't be able to move or interact.
  get inputLocked() {
    return this.busy || this.dialogue.active;
  }

  // Game speed (slow motion during the spill).
  get timeScale() {
    return this.spill.running ? this.spill.timeScale : 1;
  }

  get curedCount() {
    return this.cast.all.filter((n) => n.cured).length;
  }

  objectiveFor(state) {
    const o = OBJECTIVES[state];
    if (state === 'SECURE') return o(this.hauler.loadedCount);
    if (state === 'CURE') return o(this.curedCount, this.cast.all.length);
    return o ?? null;
  }

  start() {
    this.token++;
    this.busy = false;
    this.bossArrived = false;
    this.dialogue.close();
    this.world.reset();
    this.cast.reset();
    this.goob.reset();
    this.vacuum.reset();
    this.antidote.reset();
    this.spill.reset();
    this.hauler.reset();
    this.rack.vacuum.visible = true;
    this.antidoteProp.setVisible(true);
    for (const tape of this.tapes) tape.taken = false;
    this.outbreak = false;
    this.checkpoint = null;
    this.hud.setGoob(null);
    this.player.spawn(this.world.spawn);
    this.player.suited = false;
    this.player.suit = 100;
    this.player.lookTarget = null;
    this.fx.setVisor(false);
    this.freezerDoor.locked = FREEZER_LOCKED;
    this.managerDoor.setOpen(-1);
    this.setState('INTRO', OBJECTIVES.INTRO, false);

    this.fx.fade(1, 0);
    this.fx.fade(0, 1.2);
    this.later(1.5, () => this.cast.boss.walkPath(BOSS_ROUTE, () => { this.bossArrived = true; }));
  }

  // Debug: jump straight to a later objective (?stage= in the URL).
  skipTo(state) {
    const step = STAGES.indexOf(state);
    if (step < 0) return;
    this.token++; // cancels the manager's walk
    this.cast.boss.path = null;
    this.fx.fade(0, 0);
    if (step >= 1) this.putOnSuit();
    if (step >= 2) {
      this.world.setCanisterVisible(false);
      this.goob.splat({ x: 32, y: 0, z: 20.5 }, 2.6, 3.2, 9);
      this.hank.infect();
      this.startOutbreak();
    }
    if (step >= 3) this.equipVacuum();
    if (step >= 4) {
      this.goob.collected += this.goob.remaining;
      this.goob.blobs.clear();
      this.goob.spreading = false;
      this.world.elevator.repair();
    }
    if (step >= 5) for (const bin of this.hauler.bins) this.hauler.load(bin);
    if (step >= 6) this.sealFreezer();
    if (step >= 7) this.equipAntidote();
    this.setState(state, this.objectiveFor(state), false);
    // Checkpoint for retrying, but not an autosave: skipping ahead shouldn't
    // overwrite a real saved game.
    if (step >= 2) this.saveCheckpoint(false);
  }

  update(dt, input, active) {
    this.runTimers(dt);
    this.spill.update(dt);
    this.hauler.update(dt, input, active && !this.inputLocked);

    if (this.state === 'INTRO' && this.bossArrived && !this.dialogue.active) {
      const boss = this.cast.boss.pos;
      const p = this.player.pos;
      const near = Math.hypot(p.x - boss.x, p.z - boss.z) < BRIEFING_RANGE && Math.abs(p.y - boss.y) < 1.5;
      if (near) this.startBriefing();
      else this.hud.setObjective(OBJECTIVES.INTRO_AWAY);
    }

    if (this.outbreak) {
      this.hud.setGoob({
        suit: this.player.suit,
        tank: this.vacuum.equipped ? this.vacuum.tank : null,
        capacity: VACUUM.capacity,
        cleaned: this.goob.cleanedPercent,
      });
    }

    if (this.state === 'CLEANUP' && this.goob.blobs.size === 0) {
      if (this.vacuum.tank > 0.01) this.hud.setObjective(OBJECTIVES.LAST_TANK);
      else this.startSecuring();
    }
  }

  setState(state, objective, announce = true) {
    this.state = state;
    this.hud.setObjective(objective ?? null);
    if (announce && objective) this.hud.toast('New objective', 2);
  }

  // Run fn after a delay in game time, unless the chapter restarts first.
  later(seconds, fn) {
    this.timers.push({ at: this.time + seconds, token: this.token, fn });
  }

  runTimers(dt) {
    this.time += dt;
    const due = this.timers.filter((t) => t.at <= this.time);
    this.timers = this.timers.filter((t) => t.at > this.time);
    for (const t of due) if (t.token === this.token) t.fn();
  }

  wait(seconds) {
    return new Promise((resolve) => this.later(seconds, resolve));
  }

  // ---------- Before the spill ----------

  async startBriefing() {
    if (this.state !== 'INTRO') return;
    const token = this.token;
    const boss = this.cast.boss;
    const walkBack = this.bossArrived;
    this.setState('BRIEFING', null, false);
    boss.path = null;
    boss.talking = true;
    this.player.lookTarget = boss.headPoint;

    await this.dialogue.play(BOSS_BRIEFING.map((text) => ({ speaker: boss.name, text })));
    if (token !== this.token) return;

    boss.talking = false;
    this.player.lookTarget = null;
    if (walkBack) boss.walkPath([...BOSS_ROUTE].reverse(), (n) => { n.yaw = Math.PI / 2; });
    this.setState('TO_LOCKERS', OBJECTIVES.TO_LOCKERS);
  }

  async talkTo(npc) {
    if (npc === this.cast.boss && this.state === 'INTRO') {
      this.startBriefing();
      return;
    }
    if (this.dialogue.active || this.busy) return;
    const token = this.token;
    npc.talking = true;
    this.player.lookTarget = npc.headPoint;
    await this.dialogue.play([{ speaker: npc.name, text: npc.nextLine() }]);
    if (token !== this.token) return;
    npc.talking = false;
    this.player.lookTarget = null;
  }

  putOnSuit() {
    this.world.props.suit.group.visible = false;
    this.player.suited = true;
    this.fx.setVisor(true);
    this.freezerDoor.locked = null;
  }

  async suitUp() {
    const token = this.token;
    this.busy = true;
    sfx.pickup();
    await this.fx.fade(1, 0.5);
    if (token !== this.token) return;
    this.putOnSuit();
    await this.wait(0.6);
    this.fx.fade(0, 0.7);
    this.busy = false;
    this.setState('TO_FREEZER', OBJECTIVES.TO_FREEZER);

    // Hank heads over to wait outside the freezer.
    this.hank.lines = [...HANK_WATCHING];
    this.hank.lineIndex = 0;
    this.hank.walkPath(BUILDING.hankWatch, (n) => { n.yaw = Math.PI / 2; });
  }

  // ---------- The spill ----------

  pickUpGoob() {
    this.busy = true;
    this.setState('SPILL', null, false);
    this.spill.start(() => this.afterSpill());
  }

  afterSpill() {
    this.startOutbreak();
    this.busy = false;
    this.setState('GET_VACUUM', OBJECTIVES.GET_VACUUM, false);
    this.hud.toast("The goob is loose, and it's in the vents! Everyone's infected.", 4.5);
    this.saveCheckpoint();
  }

  // Everyone turns, goob gets into the vents, the elevator jams, and it all
  // starts spreading.
  startOutbreak() {
    for (const npc of this.cast.all) if (!npc.infected) npc.infect();
    const vents = this.graph.nodes.filter((n) => n.kind === 'vent').sort(() => Math.random() - 0.5);
    for (const node of vents.slice(0, VENT_SEEDS)) this.goob.spawn(node, 2);
    this.world.elevator.jam();
    const car = this.world.elevator.carFloorPoint;
    if (!this.elevatorSpot) this.elevatorSpot = this.graph.addHidingSpot(car.x, car.y, car.z, 'elevator');
    this.goob.spawn(this.elevatorSpot, 1.5);
    this.goob.spreading = true;
    this.outbreak = true;
  }

  // ---------- Cleanup ----------

  equipVacuum() {
    this.rack.vacuum.visible = false;
    this.vacuum.equip(true);
  }

  takeVacuum() {
    sfx.pickup();
    this.equipVacuum();
    this.setState('CLEANUP', OBJECTIVES.CLEANUP);
    this.hud.toast('Left mouse: vacuum goob. Right mouse: blast infected away.', 5);
    this.saveCheckpoint();
  }

  binLabel(bin) {
    if (this.state === 'SECURE') return 'Grab the biohazard bin';
    return this.vacuum.tank > 0.5 ? `Empty tank into biohazard bin (${Math.floor(this.vacuum.tank)} L)` : 'Biohazard bin (your tank is empty)';
  }

  binEnabled(bin) {
    if (this.busy || bin.loaded) return false;
    if (this.state === 'SECURE') return !this.hauler.carrying;
    return this.vacuum.equipped && (this.state === 'GET_VACUUM' || this.state === 'CLEANUP');
  }

  emptyTank() {
    if (this.vacuum.tank <= 0.5) {
      this.hud.toast('Your tank is empty.', 2);
      return;
    }
    const amount = this.vacuum.empty();
    sfx.pour();
    this.hud.toast(`Emptied ${Math.round(amount)} L of goob into the bin. Checkpoint saved.`, 2.5);
    this.saveCheckpoint();
  }

  takeTape(tape) {
    if (this.player.suit >= 100) {
      this.hud.toast("Your suit doesn't need patching yet.", 2);
      return;
    }
    tape.taken = true;
    sfx.pickup();
    this.player.suit = Math.min(100, this.player.suit + TAPE_REPAIR);
    this.hud.toast(`Patched your suit with duct tape: ${Math.ceil(this.player.suit)}%.`, 2.5);
  }

  // ---------- Securing the goob ----------

  startSecuring() {
    this.goob.spreading = false;
    this.world.elevator.repair();
    this.setState('SECURE', this.objectiveFor('SECURE'));
    this.hud.toast('Every drop is in the bins! Now wheel them into the freezer.', 4);
    this.saveCheckpoint();
  }

  binLoaded(count) {
    sfx.bin(this.player.pos);
    this.hud.toast(`Bin loaded into the freezer (${count}/${BIN_COUNT}). Checkpoint saved.`, 2.5);
    if (count >= BIN_COUNT) this.setState('LOCK_FREEZER', OBJECTIVES.LOCK_FREEZER);
    else this.hud.setObjective(this.objectiveFor('SECURE'));
    this.saveCheckpoint();
  }

  sealFreezer() {
    this.freezerDoor.reset();
    this.freezerDoor.locked = FREEZER_SEALED;
  }

  lockFreezer() {
    const p = this.player.pos;
    const a = FREEZER_AREA;
    if (p.x > a.x0 && p.x < a.x1 && p.z > a.z0 && p.z < a.z1) {
      this.hud.toast('Step out of the freezer first.', 2);
      return;
    }
    this.sealFreezer();
    sfx.lock();
    this.hud.toast('Freezer locked.', 2);
    const token = this.token;
    this.setState('DALE_CALL', null, false);
    this.later(1.5, () => { if (token === this.token) this.daleCall(); });
  }

  // ---------- Curing everyone ----------

  async daleCall() {
    const token = this.token;
    sfx.intercom();
    await this.dialogue.play(DALE_CALL.map((text) => ({ speaker: 'Dale (intercom)', text })));
    if (token !== this.token) return;
    this.setState('GET_ANTIDOTE', OBJECTIVES.GET_ANTIDOTE);
    this.saveCheckpoint();
  }

  equipAntidote() {
    this.antidoteProp.setVisible(false);
    this.antidote.equip(true);
  }

  takeAntidote() {
    sfx.pickup();
    this.equipAntidote();
    this.setState('CURE', this.objectiveFor('CURE'));
    this.hud.toast('Hold F to spray the antidote. Blast them back with right mouse if they get too close.', 5);
    this.saveCheckpoint();
  }

  cureNpc(npc) {
    npc.cure(CURED_LINES[npc.name] ?? CURED_LINES.default);
    sfx.cure(npc.pos);
    this.fx.flash('#8fd8ff', 0.3);
    const cured = this.curedCount;
    const total = this.cast.all.length;
    this.hud.toast(`${npc.name} is cured! (${cured}/${total})`, 2.5);
    this.hud.setObjective(this.objectiveFor('CURE'));
    this.saveCheckpoint();
    if (cured >= total) this.finale();
  }

  async finale() {
    const token = this.token;
    this.setState('FINALE', null, false);
    await this.wait(1.5);
    if (token !== this.token) return;
    sfx.intercom();
    await this.dialogue.play(DALE_THANKS.map((text) => ({ speaker: 'Dale (intercom)', text })));
    if (token !== this.token) return;
    this.busy = true;
    await this.fx.fade(1, 1.5);
    if (token !== this.token) return;
    this.onEnd?.({
      title: 'Chapter 1 complete',
      text: 'The goob is locked away and everyone is cured. The Mars delivery, however, is very late.',
      hint: 'Thanks for playing! Chapter 2 is on its way.',
    });
  }

  // ---------- Getting hurt ----------

  // An infected coworker's lunge landed.
  hurtPlayer(npc) {
    if (!this.hostile) return;
    const before = this.player.suit;
    this.player.suit = Math.max(0, before - INFECTED.damage);
    this.player.knockFrom(npc.pos, 6);
    this.player.shakeFor(0.35);
    this.fx.flash('#ff3a2a', 0.45);
    sfx.hurt();
    const after = this.player.suit;
    if (after <= 0) {
      this.breach();
    } else if (before > 50 && after <= 50) {
      this.hud.toast('Suit integrity at 50%. Find duct tape to patch it.', 3);
    } else if (before > 25 && after <= 25) {
      this.hud.toast('WARNING: suit integrity critical!', 3);
    }
  }

  async breach() {
    const token = this.token;
    this.busy = true;
    this.hauler.drop();
    this.setState('BREACHED', null, false);
    this.fx.flash('#6cff4a', 1.2);
    sfx.breach();
    await this.fx.fade(1, 1.5);
    if (token !== this.token) return;
    this.onBreach?.();
  }

  // ---------- Checkpoints ----------
  // Taken at each story step after the spill, each tank emptied, each bin
  // loaded and each cure.

  saveCheckpoint(autosave = true) {
    const p = this.player;
    this.checkpoint = {
      state: this.state,
      player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw },
      suit: p.suit,
      vacuum: { equipped: this.vacuum.equipped, tank: this.vacuum.tank },
      antidote: this.antidote.equipped,
      goob: this.goob.snapshot(),
      bins: this.hauler.snapshot(),
      freezerSealed: this.freezerDoor.locked === FREEZER_SEALED,
      elevatorJammed: this.world.elevator.jammed,
      npcs: this.cast.all.map((n) => ({ x: n.pos.x, y: n.pos.y, z: n.pos.z, yaw: n.yaw, cured: n.cured })),
      tapes: this.tapes.map((t) => t.taken),
    };
    if (autosave) this.onCheckpoint?.(this.checkpoint);
  }

  get hasCheckpoint() {
    return !!this.checkpoint;
  }

  // Put the world back the way a checkpoint describes it (also used to
  // continue a saved game).
  restoreCheckpoint(checkpoint = this.checkpoint) {
    const c = checkpoint;
    if (!c) return false;
    this.checkpoint = c;
    this.token++;
    this.busy = false;
    this.dialogue.close();
    this.spill.reset();
    this.hud.toast('', 0);
    this.world.setCanisterVisible(false);
    this.putOnSuit();
    this.player.spawn(c.player);
    this.player.suit = c.suit;
    this.player.lookTarget = null;
    this.vacuum.reset();
    this.vacuum.equip(c.vacuum.equipped);
    this.vacuum.tank = c.vacuum.tank;
    this.rack.vacuum.visible = !c.vacuum.equipped;
    this.antidote.reset();
    if (c.antidote) this.equipAntidote();
    else this.antidoteProp.setVisible(true);
    this.goob.restore(c.goob);
    this.hauler.restore(c.bins);
    if (c.freezerSealed) this.sealFreezer();
    this.world.elevator.jam();
    if (!c.elevatorJammed) this.world.elevator.repair();
    const car = this.world.elevator.carFloorPoint;
    if (!this.elevatorSpot) this.elevatorSpot = this.graph.addHidingSpot(car.x, car.y, car.z, 'elevator');
    c.npcs.forEach((s, i) => {
      const npc = this.cast.all[i];
      npc.pos.set(s.x, s.y, s.z);
      npc.yaw = s.yaw;
      if (s.cured) {
        npc.cure(CURED_LINES[npc.name] ?? CURED_LINES.default);
      } else {
        if (!npc.infected) npc.infect();
        npc.home.copy(npc.pos);
        npc.brain.reset(2.5);
      }
    });
    this.tapes.forEach((t, i) => { t.taken = c.tapes[i]; });
    this.outbreak = true;
    this.setState(c.state, this.objectiveFor(c.state), false);
    this.fx.fade(1, 0);
    this.fx.fade(0, 0.8);
    return true;
  }
}
