import { BOSS_BRIEFING, BOSS_ROUTE } from '../npc/cast.js';
import { BUILDING } from '../world/building.js';
import { createBins, createVacuumRack } from '../goob/bins.js';
import { VACUUM } from '../player/vacuum.js';

// Chapter 1 story flow.
// INTRO → BRIEFING → TO_LOCKERS → TO_FREEZER → SPILL → GET_VACUUM → CLEANUP → CONTAINED
// (securing the goob in the freezer and the real ending come in milestone 5).

const OBJECTIVES = {
  INTRO: 'Wait at your desk. Your manager wants a word.',
  INTRO_AWAY: 'Your manager is waiting at your desk.',
  TO_LOCKERS: 'Suit up in the 1F locker room.',
  TO_FREEZER: 'Get the goob from the secure freezer in the loading dock.',
  GET_VACUUM: 'Grab the containment vacuum beside the freezer door.',
  CLEANUP: 'Vacuum up all the goob. Empty the tank into yellow biohazard bins.',
  LAST_TANK: 'Empty your tank into a biohazard bin.',
  CONTAINED: 'All the goob is contained!',
};
const FREEZER_LOCKED = 'Hazard suit required beyond this point.';
const BRIEFING_RANGE = 2.8;
const VENT_SEEDS = 6;

const HANK_WATCHING = [
  'Careful carrying that thing. Nice and slow.',
  "I've got the shuttle crate open. Just bring it here.",
];

export class Chapter1 {
  constructor({ ctx, world, player, cast, hud, dialogue, interactions, fx, goob, graph, vacuum, spill, onEnd }) {
    Object.assign(this, { world, player, cast, hud, dialogue, fx, goob, graph, vacuum, spill, onEnd });
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
    this.bins = createBins(ctx, BUILDING.bins, {
      label: () => (vacuum.tank > 0.5 ? `Empty tank into biohazard bin (${Math.floor(vacuum.tank)} L)` : 'Biohazard bin (your tank is empty)'),
      enabled: () => vacuum.equipped && !this.busy,
      onUse: () => this.emptyTank(),
    });
    for (const npc of cast.all) npc.onTalk = (n) => this.talkTo(n);
  }

  // True while the player shouldn't be able to move or interact.
  get inputLocked() {
    return this.busy || this.dialogue.active;
  }

  // Game speed (slow motion during the spill).
  get timeScale() {
    return this.spill.running ? this.spill.timeScale : 1;
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
    this.spill.reset();
    this.rack.vacuum.visible = true;
    this.hud.setGoob(null);
    this.player.spawn(this.world.spawn);
    this.player.suited = false;
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
    const order = ['TO_LOCKERS', 'TO_FREEZER', 'GET_VACUUM', 'CLEANUP'];
    const step = order.indexOf(state);
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
    this.setState(state, OBJECTIVES[state], false);
  }

  update(dt) {
    this.runTimers(dt);
    this.spill.update(dt);

    if (this.state === 'INTRO' && this.bossArrived && !this.dialogue.active) {
      const boss = this.cast.boss.pos;
      const p = this.player.pos;
      const near = Math.hypot(p.x - boss.x, p.z - boss.z) < BRIEFING_RANGE && Math.abs(p.y - boss.y) < 1.5;
      if (near) this.startBriefing();
      else this.hud.setObjective(OBJECTIVES.INTRO_AWAY);
    }

    if (this.vacuum.equipped) {
      this.hud.setGoob({ tank: this.vacuum.tank, capacity: VACUUM.capacity, cleaned: this.goob.cleanedPercent });
    }

    if (this.state === 'CLEANUP' && this.goob.blobs.size === 0) {
      if (this.vacuum.tank > 0.01) this.hud.setObjective(OBJECTIVES.LAST_TANK);
      else this.contained();
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
  }

  // ---------- Cleanup ----------

  equipVacuum() {
    this.rack.vacuum.visible = false;
    this.vacuum.equip(true);
  }

  takeVacuum() {
    this.equipVacuum();
    this.setState('CLEANUP', OBJECTIVES.CLEANUP);
    this.hud.toast('Hold the left mouse button to vacuum goob.', 4);
  }

  emptyTank() {
    if (this.vacuum.tank <= 0.5) {
      this.hud.toast('Your tank is empty.', 2);
      return;
    }
    const amount = this.vacuum.empty();
    this.hud.toast(`Emptied ${Math.round(amount)} L of goob into the bin.`, 2.5);
  }

  contained() {
    this.setState('CONTAINED', OBJECTIVES.CONTAINED, false);
    this.goob.spreading = false;
    this.hud.toast('All the goob is contained!', 3);
    const token = this.token;
    this.later(3, async () => {
      this.busy = true;
      await this.fx.fade(1, 1.2);
      if (token !== this.token) return;
      this.onEnd?.({
        title: 'Goob contained',
        text: `You cleaned up every drop of goob. Your coworkers, however, are still very infected.`,
        hint: 'Securing it back in the freezer and the chapter ending arrive in a later milestone.',
      });
    });
  }
}
