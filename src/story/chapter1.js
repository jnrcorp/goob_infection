import { BOSS_BRIEFING, BOSS_ROUTE } from '../npc/cast.js';

// Chapter 1 story flow, from your desk up to picking up the goob.
// States: INTRO → BRIEFING → TO_LOCKERS → TO_FREEZER → SPILL
// (the spill itself and the cleanup come in milestone 3).

const OBJECTIVES = {
  INTRO: 'Wait at your desk. Your manager wants a word.',
  INTRO_AWAY: 'Your manager is waiting at your desk.',
  TO_LOCKERS: 'Suit up in the 1F locker room.',
  TO_FREEZER: 'Get the goob from the secure freezer in the loading dock.',
};
const FREEZER_LOCKED = 'Hazard suit required beyond this point.';
const BRIEFING_RANGE = 2.8;

export class Chapter1 {
  constructor({ world, player, cast, hud, dialogue, interactions, fx, onEnd }) {
    Object.assign(this, { world, player, cast, hud, dialogue, fx, onEnd });
    this.token = 0;
    this.time = 0;
    this.timers = [];
    this.state = 'INTRO';
    this.busy = false;
    this.freezerDoor = world.doorByLabel('freezer door');
    this.managerDoor = world.doorByLabel("manager's door");

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
    for (const npc of cast.all) npc.onTalk = (n) => this.talkTo(n);
  }

  // True while the player shouldn't be able to move or interact.
  get inputLocked() {
    return this.busy || this.dialogue.active;
  }

  start() {
    this.token++;
    this.busy = false;
    this.bossArrived = false;
    this.dialogue.close();
    this.world.reset();
    this.cast.reset();
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
    if (state !== 'TO_LOCKERS' && state !== 'TO_FREEZER') return;
    this.token++; // cancels the manager's walk
    this.cast.boss.path = null;
    this.fx.fade(0, 0);
    this.setState(state, OBJECTIVES[state], false);
    if (state === 'TO_FREEZER') {
      this.world.props.suit.group.visible = false;
      this.player.suited = true;
      this.fx.setVisor(true);
      this.freezerDoor.locked = null;
    }
  }

  update(dt) {
    this.runTimers(dt);
    if (this.state !== 'INTRO' || !this.bossArrived || this.dialogue.active) return;
    const boss = this.cast.boss.pos;
    const p = this.player.pos;
    const near = Math.hypot(p.x - boss.x, p.z - boss.z) < BRIEFING_RANGE && Math.abs(p.y - boss.y) < 1.5;
    if (near) this.startBriefing();
    else this.hud.setObjective(OBJECTIVES.INTRO_AWAY);
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

  async suitUp() {
    const token = this.token;
    this.busy = true;
    await this.fx.fade(1, 0.5);
    if (token !== this.token) return;
    this.world.props.suit.group.visible = false;
    this.player.suited = true;
    this.fx.setVisor(true);
    this.freezerDoor.locked = null;
    await this.wait(0.6);
    this.fx.fade(0, 0.7);
    this.busy = false;
    this.setState('TO_FREEZER', OBJECTIVES.TO_FREEZER);
  }

  async pickUpGoob() {
    const token = this.token;
    this.busy = true;
    this.setState('SPILL', null, false);
    this.world.setCanisterVisible(false);
    await this.fx.fade(1, 1.2);
    if (token !== this.token) return;
    this.onEnd?.();
  }
}
