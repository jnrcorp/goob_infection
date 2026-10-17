import * as THREE from 'three';
import { NPC } from '../npc/npc.js';
import { look } from '../npc/cast.js';
import { WING } from '../world/building.js';
import { sfx } from '../core/sound.js';

// Chapter 2, part 1: the isolation wing. Once Kevin and Luis are cured, Dr.
// Pell tells you there are more: the ones who fought back are kept in
// isolation, north of the staff corridor. The wing has no power.
//
//   C2_FUSES      find three fuses (security office, staff lockers, guard
//                 break room) and put them in the fuse box by the wing door
//   C2_WING       the power's back, and so are the wing's cameras: sneak past
//                 them to the wing control room and release the cells
//   C2_ISOLATION  two of the four come out infected: cure them
// Then everyone (ten now) goes to the elevator lobby (C2_LEAVE, chapter2.js).

export const WING_STATES = ['C2_FUSES', 'C2_WING', 'C2_ISOLATION'];
const B3_Y = -12;
// The four in isolation: new faces (not in the office cast, so chapter 1
// never sees them). infected: comes out green.
const WING_PRISONERS = [
  { name: 'Gloria', look: look(0x6a4a8a, 'charcoal', 4, 'grey'), lines: ['Accounts receivable. I asked where the money for “input” was going. Once.'] },
  { name: 'Raj', infected: true, look: look(0x3f6f8f, 'navy', 2, 'black'), lines: ['Facilities. I said I wouldn’t weld the vat lids shut. I welded them. They locked me up anyway.'] },
  { name: 'Otis', look: look(0x26324e, 'black', 5, 'grey'), lines: ['I was a guard here. Twenty years. I opened a cell for a kid who was crying. That’s all.'] },
  { name: 'Bev', infected: true, look: look(0xd8d0b0, 'khaki', 0, 'red'), lines: ['Cafeteria. I put the goob in the soup. I didn’t know! I thought it was pesto!'] },
];
const FUSE_TOTAL = 3;
const CAMERA = {
  sight: 9,          // meters (half that if you crouch)
  cone: 26,          // degrees either side of where it points
  sweep: 0.9,        // radians either side of its center
  period: 7,         // seconds per sweep, there and back
  fade: 0.4,
};
const PELL_WING = [
  { speaker: 'Dr. Pell', text: 'Champ, wait. We’re not all here.' },
  { speaker: 'Dr. Pell', text: 'The ones who fought back, they took to isolation. North end of the staff corridor. Four of them, last I counted.' },
  { speaker: 'Ivo', text: 'The wing’s been dark since they cut its power. They pulled the fuses and hid them around the level.' },
  { speaker: 'Dr. Pell', text: 'We’ll wait for you in the elevator lobby. Go.' },
];
const RELEASED = [
  { speaker: 'Otis', text: 'Is that... a Goob Co. suit? Kid, if you’re here to feed us, the soup’s been green all week.' },
  { speaker: 'Gloria', text: 'He’s not feeding us, Otis. He’s letting us out. Raj? Bev? Oh no. Oh no, look at them.' },
];
const OBJECTIVES = {
  C2_FUSES: (found, left) => (found < FUSE_TOTAL
    ? `The isolation wing (north end of the staff corridor) has no power. Find the fuses they pulled (${found}/${FUSE_TOTAL}): ${left.join(', ')}.`
    : 'You have all three fuses. Put them in the fuse box beside the isolation wing door.'),
  C2_WING: 'The power’s back, and so are the wing’s cameras. Sneak past them to wing control at the far end (crouch behind the crates) and release the cells.',
  C2_ISOLATION: (left) => `Raj and Bev came out infected. Cure them with the antidote (F). ${left} left.`,
};

export class IsolationWing {
  constructor(ch2, ctx) {
    this.ch2 = ch2;
    const { scene, interactions, materials } = ctx;
    this.scene = scene;
    const props = ch2.world.props.wing;
    this.active = false;

    // The four, standing in their cells.
    this.prisoners = WING_PRISONERS.map((p, i) => {
      const x = WING.cellDoors[i];
      const npc = new NPC(ctx, { name: p.name, x, y: B3_Y, z: 44, yaw: Math.PI, mode: 'stand', look: p.look, lines: p.lines });
      npc.onTalk = (n) => ch2.ch1.talkTo(n);
      npc.person.root.visible = false;
      npc.collider.enabled = false;
      npc.frozen = true;
      ch2.sightIgnore.add(npc.collider);
      npc.collider.person = true; // (the player isn't shoved out of people)
      return { ...p, npc, cell: i, wing: true, freed: false, spot: null };
    });
    this.cellDoors = WING.cellDoors.map((_, i) => ch2.world.doorByLabel(`isolation cell ${i + 1}`));
    this.wingDoor = ch2.world.doorByLabel('isolation wing door');

    // Fuses: a ceramic cartridge with brass caps.
    this.fuses = props.fuses.map((f, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12), new THREE.MeshLambertMaterial({ color: 0xf0ece0 }));
      body.rotation.z = Math.PI / 2;
      body.position.y = 0.035;
      const caps = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 12, 1, true), materials.get('trophy') ?? materials.get('metal'));
      caps.rotation.z = Math.PI / 2;
      caps.position.y = 0.035;
      caps.scale.set(1, 1, 1);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.35, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.003;
      const pick = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.y = 0.06;
      g.add(glow, body, caps, pick);
      g.position.set(f.x, f.y, f.z);
      g.rotation.y = i * 0.9;
      scene.add(g);
      const fuse = { ...f, group: g, taken: false };
      interactions.add({
        mesh: [body, caps, pick],
        label: 'Take the fuse',
        enabled: () => this.active && !fuse.taken && this.state === 'C2_FUSES' && !this.ch1.busy,
        use: () => this.takeFuse(fuse),
      });
      return fuse;
    });

    // The fuse box: a grey panel with three empty sockets, and a lamp.
    const fb = props.fuseBox;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.12), materials.get('metal'));
    box.position.set(fb.x, fb.y, fb.z - 0.06);
    this.fuseLamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: 0x401010 }));
    this.fuseLamp.position.set(fb.x + 0.16, fb.y + 0.22, fb.z - 0.125);
    scene.add(box, this.fuseLamp);
    interactions.add({
      mesh: [box, this.fuseLamp],
      label: () => (this.progress?.power ? 'Fuse box (powered)' : this.carried >= FUSE_TOTAL ? 'Put the fuses in' : `Fuse box (${this.carried ?? 0}/${FUSE_TOTAL} fuses)`),
      enabled: () => this.active && !this.ch1.busy,
      use: () => this.useFuseBox(),
    });

    // Cameras: a housing on a wall bracket, a red light, a faint cone.
    this.cameras = props.cameras.map((c) => {
      const g = new THREE.Group();
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.36), materials.get('plastic'));
      housing.position.z = 0.15;
      housing.rotation.x = 0.35;
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      led.position.set(0.06, 0.06, 0.32);
      const length = CAMERA.sight;
      const radius = Math.tan(THREE.MathUtils.degToRad(CAMERA.cone)) * length * 0.5;
      const coneGeo = new THREE.ConeGeometry(radius, length, 20, 1, true);
      coneGeo.translate(0, -length / 2, 0);
      coneGeo.rotateX(-Math.PI / 2 + 0.28); // opening forward (+z) and a little down
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff6050, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const beam = new THREE.Mesh(coneGeo, beamMat);
      beam.position.z = 0.3;
      const pivot = new THREE.Group();
      pivot.add(housing, led, beam);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.2), materials.get('metal'));
      bracket.position.z = 0.05;
      g.add(bracket, pivot);
      g.position.set(c.x, c.y, c.z);
      scene.add(g);
      return { ...c, group: g, pivot, led, beam, beamMat, suspicion: 0, phase: Math.random() * Math.PI * 2, yawNow: c.yaw };
    });

    // Wing control: the console that kills the cameras and opens the cells.
    const wc = props.console;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.5), materials.get('plastic'));
    panel.position.set(wc.x, wc.y, wc.z);
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.05, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3030).multiplyScalar(1.6) }));
    button.position.set(wc.x, wc.y + 0.05, wc.z);
    scene.add(panel, button);
    interactions.add({
      mesh: [panel, button],
      label: 'Press CAMERAS OFF / RELEASE ISOLATION',
      enabled: () => this.active && this.state === 'C2_WING' && !this.ch1.busy,
      use: () => this.release(),
    });
  }

  get ch1() {
    return this.ch2.ch1;
  }

  get state() {
    return this.ch1.state;
  }

  get carried() {
    return this.fuses?.filter((f) => f.taken).length ?? 0;
  }

  get infectedLeft() {
    return this.prisoners.filter((p) => p.npc.infected).length;
  }

  // Infected wing prisoners, for the antidote.
  get targets() {
    return this.active ? this.prisoners.map((p) => p.npc).filter((n) => n.person.root.visible) : [];
  }

  objectiveFor(state) {
    if (state === 'C2_FUSES') return OBJECTIVES.C2_FUSES(this.carried, this.fuses.filter((f) => !f.taken).map((f) => f.where));
    if (state === 'C2_ISOLATION') return OBJECTIVES.C2_ISOLATION(this.infectedLeft);
    return OBJECTIVES[state] ?? null;
  }

  // The wing as progress describes it: { fuses: [taken...], power, released }.
  setup(progress) {
    const p = progress ?? {};
    this.active = true;
    this.progress = { power: !!p.power, released: !!p.released };
    this.fuses.forEach((f, i) => {
      f.taken = !!p.fuses?.[i] || this.progress.power;
      f.group.visible = !f.taken;
    });
    this.wingDoor.reset();
    this.wingDoor.locked = this.progress.power ? null : this.lockedText();
    this.fuseLamp.material.color.set(this.progress.power ? 0x40ff60 : 0x401010);
    for (const d of this.cellDoors) {
      d.reset();
      d.locked = this.progress.released ? null : 'Locked. Isolation cells open from the wing control room.';
      if (this.progress.released) d.setOpen(-1);
    }
    for (const c of this.cameras) {
      c.suspicion = 0;
      this.setCamera(c, this.progress.power && !this.progress.released);
    }
    const env = this.ch2.cast.all[0].env;
    for (const q of this.prisoners) {
      const npc = q.npc;
      if (env && npc.env !== env) {
        npc.setEnv(env);
        env.moveIgnore.add(npc.collider);
      }
      npc.reset();
      npc.onTalk = (n) => this.ch1.talkTo(n);
      npc.person.root.visible = true;
      npc.collider.enabled = true;
      npc.frozen = false;
      npc.talkable = true;
      npc.lines = ['Please. The cells open from wing control, at the end of the corridor.'];
      q.freed = false;
      q.spot = null;
      if (q.infected) npc.infect();
    }
  }

  // Back to how chapter 1 left it: nobody here, no power, cells shut.
  stop() {
    this.active = false;
    for (const q of this.prisoners) {
      q.npc.person.root.visible = false;
      q.npc.collider.enabled = false;
      q.npc.frozen = true;
      q.npc.path = null;
    }
    for (const c of this.cameras) this.setCamera(c, false);
    this.wingDoor.reset();
    this.wingDoor.locked = 'Locked. The wing has no power: the panel beside the door is dark.';
    for (const d of this.cellDoors) { d.reset(); d.locked = 'Locked. Isolation cells open from the wing control room.'; }
  }

  // (Hidden after the raid, like the cells' other prisoners.)
  hide() {
    this.stop();
  }

  snapshot() {
    if (!this.active) return null;
    return { fuses: this.fuses.map((f) => f.taken), power: this.progress.power, released: this.progress.released };
  }

  lockedText() {
    return `Locked. The wing has no power: the fuse box beside the door has ${this.carried >= FUSE_TOTAL ? 'three empty sockets (you have the fuses)' : 'three empty sockets'}.`;
  }

  setCamera(c, on) {
    c.on = on;
    c.beam.visible = on;
    c.led.material.color.set(on ? 0xff2020 : 0x220808);
  }

  // ---------- The story ----------

  // Everyone in the cells is cured: Dr. Pell remembers the wing.
  async begin() {
    const ch1 = this.ch1;
    const token = ch1.token;
    ch1.busy = true;
    await ch1.dialogue.play(PELL_WING);
    if (token !== ch1.token) return;
    ch1.busy = false;
    this.ch2.enter('C2_FUSES');
  }

  takeFuse(fuse) {
    fuse.taken = true;
    fuse.group.visible = false;
    sfx.pickup();
    const n = this.carried;
    this.ch2.hud.toast(n < FUSE_TOTAL ? `Got a fuse from the ${fuse.where} (${n}/${FUSE_TOTAL}).` : 'That’s all three fuses. Now the fuse box by the wing door.', 3);
    this.wingDoor.locked = this.lockedText();
    this.ch1.hud.setObjective(this.objectiveFor('C2_FUSES'));
    this.ch2.saveCheckpoint();
  }

  useFuseBox() {
    if (this.progress.power) return;
    if (this.carried < FUSE_TOTAL || this.state !== 'C2_FUSES') {
      sfx.ui();
      this.ch2.hud.toast(`Three empty sockets. You have ${this.carried} of the fuses.`, 3);
      return;
    }
    this.progress.power = true;
    sfx.lock();
    sfx.klaxon();
    this.ch1.fx.flash('#ffffff', 0.2);
    this.fuseLamp.material.color.set(0x40ff60);
    this.wingDoor.locked = null;
    for (const c of this.cameras) this.setCamera(c, true);
    this.ch2.hud.toast('Clunk, clunk, clunk. The wing hums awake: the door unlocks, and beyond it, cameras whir to life.', 4);
    this.ch2.enter('C2_WING');
  }

  async release() {
    const ch1 = this.ch1;
    const token = ch1.token;
    this.progress.released = true;
    sfx.lock();
    for (const c of this.cameras) this.setCamera(c, false);
    for (const d of this.cellDoors) { d.locked = null; d.setOpen(-1); }
    this.ch2.hud.toast('CAMERAS OFF. ISOLATION RELEASE. Down the corridor, four glass doors swing open.', 3.5);
    let delay = 0;
    for (const q of this.prisoners) {
      if (q.npc.infected) {
        q.npc.brain.reset(1.5);
        continue;
      }
      this.ch2.free(q, delay);
      delay += 1.4;
    }
    ch1.busy = true;
    await ch1.dialogue.play(RELEASED);
    if (token !== ch1.token) return;
    ch1.busy = false;
    this.ch2.enter(this.infectedLeft > 0 ? 'C2_ISOLATION' : 'C2_LEAVE');
  }

  // Restoring a checkpoint: someone saved out of their cell.
  restoreFreed(saved) {
    for (const q of this.prisoners) {
      const s = saved?.find((x) => x.name === q.name);
      if (!this.progress.released || s?.infected || (!s && q.infected)) continue;
      if (q.npc.infected) q.npc.cure([]);
      if (s) q.npc.pos.set(s.x, B3_Y, s.z);
      this.ch2.free(q);
    }
    for (const q of this.prisoners) if (q.npc.infected && this.progress.released) q.npc.brain.reset(1);
  }

  // The antidote reached a wing prisoner (Chapter2.cured): true if it was ours.
  cured(npc) {
    const q = this.prisoners.find((p) => p.npc === npc);
    if (!q || !npc.infected) return !!q;
    npc.brain = null;
    npc.mode = 'stand';
    npc.person.setInfected(false);
    sfx.cure(npc.pos);
    this.ch1.fx.flash('#8fd8ff', 0.3);
    this.ch2.free(q);
    this.ch2.hud.toast(`${q.name} is cured!`, 2.5);
    if (this.state === 'C2_ISOLATION') {
      if (this.infectedLeft > 0) this.ch1.hud.setObjective(this.objectiveFor('C2_ISOLATION'));
      else this.ch2.enter('C2_LEAVE');
    }
    return true;
  }

  // ---------- Every frame ----------

  // People in the wing move; the cameras sweep. Returns camera suspicion.
  update(dt, player, collision, ignore, watching) {
    if (!this.active) return 0;
    for (const q of this.prisoners) if (q.npc.person.root.visible) q.npc.update(dt, player);
    let worst = 0;
    const t = performance.now() / 1000;
    for (const c of this.cameras) {
      if (!c.on) {
        c.suspicion = 0;
        continue;
      }
      c.yawNow = c.yaw + Math.sin((t * Math.PI * 2) / CAMERA.period + c.phase) * CAMERA.sweep;
      c.pivot.rotation.y = c.yawNow - c.yaw;
      c.group.rotation.y = c.yaw;
      const rate = watching ? this.sees(c, player, collision, ignore) : 0;
      if (rate > 0) c.suspicion = Math.min(1, c.suspicion + rate * dt);
      else c.suspicion = Math.max(0, c.suspicion - CAMERA.fade * dt);
      c.beamMat.opacity = 0.05 + c.suspicion * 0.1;
      worst = Math.max(worst, c.suspicion);
    }
    return worst;
  }

  sees(c, player, collision, ignore) {
    if (Math.abs(player.pos.y - B3_Y) > 2) return 0;
    const origin = new THREE.Vector3(c.x, c.y, c.z);
    const to = new THREE.Vector3(player.pos.x, player.eyeY - 0.3, player.pos.z).sub(origin);
    const dist = to.length();
    const range = player.crouching ? CAMERA.sight * 0.5 : CAMERA.sight;
    if (dist > range) return 0;
    const flat = Math.hypot(to.x, to.z);
    const facing = (Math.sin(c.yawNow) * to.x + Math.cos(c.yawNow) * to.z) / Math.max(flat, 1e-4);
    if (facing < Math.cos(THREE.MathUtils.degToRad(CAMERA.cone))) return 0;
    to.divideScalar(dist);
    if (collision.raycast(origin, to, dist - 0.3, ignore) < dist - 0.3) return 0;
    const moving = Math.hypot(player.vel.x, player.vel.z) > 0.5 ? 1.4 : 1;
    return moving * (1.5 / (0.6 + dist * 0.35));
  }
}
