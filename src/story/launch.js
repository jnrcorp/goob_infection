import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Guard } from './guards.js';
import { GoobExec } from './boss.js';
import { LAUNCH } from '../world/building.js';
import { toTexture } from '../render/textures.js';
import { difficulty } from '../core/settings.js';
import { sfx } from '../core/sound.js';

// Chapter 2's last act: the launch site. After the escort (finalRun.js),
// Victoria slips out of the police cruiser and heads for Goob Co.'s launch
// site east of the yard, where Mars 7 is fueled and loaded with "input": the
// next rotation, sealed in cargo pods.
//
//   C2_RADIO    the radio call (a cutscene)
//   C2_DRIVE    drive out through the yard's east gate, down the service road
//   C2_GATE     the site gate is locked: sneak past the lot guard into the
//               guard post and open it (the keycard and a clue are there too)
//   C2_CARGO    open the eight cargo pods in the hangar (three come out
//               infected: cure them); everyone walks out to the staging lot
//   C2_CODE     find the four digits of the control bunker's door code
//               (guard post, hangar, fuel depot, a board member)
//   C2_ABORT    press ABORT at the launch console: rejected, the fuel lines
//               need venting first
//   C2_VALVES   close the depot's three valves in the right order
//   C2_GANTRY   she's flying it herself: take the gantry lift to the top
//   C2_FINAL    Victoria and the original batch, before the clock runs out

export const LAUNCH_STATES = ['C2_DRIVE', 'C2_GATE', 'C2_CARGO', 'C2_CODE', 'C2_ABORT', 'C2_VALVES', 'C2_GANTRY', 'C2_FINAL'];
const WATCHED = ['C2_GATE', 'C2_CARGO', 'C2_CODE', 'C2_ABORT', 'C2_VALVES', 'C2_GANTRY'];
const CODE = ['6', '1', '8', '3'];
const VENT_ORDER = ['blue', 'yellow', 'red'];
const VALVE_COLORS = { red: 0xc8302a, blue: 0x2f6fd0, yellow: 0xe2ba24 };
// Where you leave the car (on the road, short of the lot), and where you get out.
const CAR_PARK = { x: 60, z: 9, heading: -Math.PI / 2 };
const PLAYER_PARK = { x: 61, y: 0, z: 7.4, yaw: -Math.PI / 2 };
const ARRIVE_X = 56;
// The cargo: cast members the rest of the chapter hasn't used. infected: comes out green.
const PODS = [
  { name: 'Priya', line: 'I was in a jar. I was in a JAR, Champ.' },
  { name: 'Mo', line: 'They told us it was a team-building retreat.' },
  { name: 'Earl', infected: true, line: 'I was going to Mars. I could feel it. I did not want to go to Mars.' },
  { name: 'Carla', line: 'Is it Friday? Are we the Employees of the Month?' },
  { name: 'Chip', infected: true, line: 'My whole body tastes like lime.' },
  { name: 'Terry', infected: true, line: 'The servers! Who is watching the servers?' },
  { name: 'Sal', line: 'I only came in to fix the vending machine.' },
  { name: 'Dwayne', line: 'I am a delivery driver. I delivered myself.' },
];
// Where they wait for the police, in the staging lot (clear of the guard's beat).
const SAFE_SPOTS = [[67.6, 0.2], [68.9, 0.2], [70.2, 0.2], [71.5, 0.2], [67.6, 1.6], [68.9, 1.6], [70.2, 1.6], [71.5, 1.6]];
// The board, infected, wandering the site. Rex knows the last digit.
const BOARD = [
  {
    name: 'Rex', x: 93, z: -6, digit: 3,
    lines: [
      { speaker: 'Rex', text: 'Champ? From accounts payable? Why am I in a parking lot?' },
      { speaker: 'Rex', text: 'The bunker code. I set it. Victoria made me. The last digit is 3. Please tell my wife I’m sorry about the boat.' },
    ],
  },
  {
    name: 'Lorraine', x: 108.5, z: 29,
    lines: [
      { speaker: 'Lorraine', text: 'The board voted for this. I voted for this. She said the input was volunteers.' },
      { speaker: 'Lorraine', text: 'If you abort the launch, she’ll fly it herself. There’s a manual override in the cockpit. Top of the gantry.' },
    ],
  },
];
// Launch security: one on the lot (past the guard post door), four on the site.
const SITE_GUARDS = [
  { name: 'Guard Ruiz', look: { skin: 0xc68642, hair: 0x1a1410 }, route: [{ x: 67.5, z: 12.6, wait: 2.5 }, { x: 78.5, z: 12.6, wait: 2.5 }] },
  { name: 'Guard Tan', look: { skin: 0xf1c27d, hair: 0x2b1d0e, hairStyle: 'short' }, route: [{ x: 84, z: 21, wait: 2 }, { x: 104, z: 21, wait: 2 }] },
  { name: 'Guard Ward', look: { skin: 0x8d5524, hair: 0x111111 }, route: [{ x: 107, z: 20, wait: 1.5 }, { x: 107, z: 38.6, wait: 2 }] },
  { name: 'Guard Sato', look: { skin: 0xe0ac69, hair: 0x111111, hairStyle: 'short' }, route: [{ x: 83, z: -9, wait: 2 }, { x: 102, z: -9, wait: 2 }] },
  {
    name: 'Guard Nash', look: { skin: 0xf1c27d, hair: 0x5a3a1a },
    route: [{ x: 105, z: -14, wait: 2 }, { x: 129, z: -14 }, { x: 129, z: 16, wait: 2 }, { x: 105, z: 16 }],
  },
];
// The final fight, on the gantry platform (around the lift's headhouse).
const ARENA = { x0: LAUNCH.top.x0 + 0.6, z0: LAUNCH.top.z0 + 0.6, x1: LAUNCH.top.x1 - 0.6, z1: LAUNCH.top.z1 - 0.6, y: LAUNCH.top.y };
const ARENA_BLOCKED = [{ x0: LAUNCH.shaft.x0 - 0.6, z0: LAUNCH.shaft.z0 - 0.8, x1: LAUNCH.shaft.x1 + 0.6, z1: LAUNCH.shaft.z1 + 0.6 }];
const FINAL_START = { x: 117.6, z: 4.2 };
const FINAL_TUNING = {
  scale: 1.9, armor: 6, speed: 1.9, keepAway: 5, slam: true, stunned: 3.2, spreadFrom: 3,
  throwEvery: [2.5, 2.2, 1.9, 1.7, 1.5, 1.3],
};
const LIFTOFF = { easy: 420, normal: 300, hard: 240 };

const RADIO = [
  { speaker: 'Officer Kim (radio)', text: 'Diaz! It’s the cruiser! The back door’s open and the cuffs are... they’re full of goob.' },
  { speaker: 'Officer Diaz', text: 'She slipped the cuffs? How do you slip— never mind. Where’s she going?' },
  { speaker: 'Hank', text: 'The launch site. Out the east gate of the yard, down the service road. Goob Co. built it for the Mars program. I used to mop the hangar.' },
  { speaker: 'Champ', text: 'The manifest. MARS 7, cargo: “input.” It’s the next rotation. She’s putting people on that rocket.' },
  { speaker: 'Officer Diaz', text: 'Then it doesn’t launch. Our cruiser’s full of goob. You’ve got a car, Champ. Go. We’ll follow when backup gets here.' },
];
const CLIPBOARD = [{ speaker: 'Clipboard', text: 'NIGHT LOG. 02:10: bunker door code changed AGAIN. First digit is 6. Do NOT write down the rest, Ruiz. (Sgt. Nash)' }];
const WHITEBOARD = [
  { speaker: 'Whiteboard', text: 'MARS 7 CARGO MANIFEST. 8 UNITS (LIVE). LOAD BY 05:00. NO TALKING TO THE CARGO.' },
  { speaker: 'Whiteboard', text: 'Under it, in different pen: “New bunker code, 2nd digit is 1. Rex has the last one.”' },
];
const DEPOT_NOTE = [{ speaker: 'Sticky note', text: 'If I get locked out of that bunker one more time I will scream. THIRD DIGIT: 8. It is 8. (L.)' }];
const ABORT = [
  { speaker: 'Launch Control', text: 'ABORT REJECTED. FUEL LINES PRESSURIZED. VENT AT THE FUEL DEPOT IN SEQUENCE: BLUE, YELLOW, RED.' },
  { speaker: 'Victoria (PA)', text: 'Champ. You found my little rocket. Go on, play with the valves. I’ll be right here.' },
];
const VENTED = [
  { speaker: 'Launch Control', text: 'FUEL LINES VENTED. GROUND LAUNCH ABORTED.' },
  { speaker: 'Victoria (PA)', text: 'Clever. But Mars 7 doesn’t need a ground crew. I’ll fly it myself.' },
  { speaker: 'Victoria (PA)', text: 'Manual override engaged. Liftoff in a few minutes. The gantry lift is open, Champ. Come and say goodbye.' },
];
const FINAL_INTRO = [
  { speaker: 'Victoria', text: 'The original batch. Seven years of it. Every Employee of the Month, in one suit.' },
  { speaker: 'Victoria', text: 'It wants to go to Mars, Champ. I’m only taking it where it wants to go.' },
  { speaker: 'Victoria', text: 'The hatch seals at liftoff. Stop me, if you can.' },
];
const FINAL_DEFEAT = [
  { speaker: 'Victoria', text: 'No... it’s letting go. It’s letting go of me.' },
  { speaker: 'Victoria', text: 'Seven years. And it never even liked me.' },
  { speaker: 'Officer Diaz', text: 'Victoria. Hands on the railing. This time we brought zip ties.' },
  { speaker: 'Officer Kim', text: 'Launch control’s dark, the fuel’s vented, and eight very confused people are sitting in the staging lot. Champ... is it over?' },
  { speaker: 'Champ', text: 'It’s over.' },
];
const OBJECTIVES = {
  C2_DRIVE: 'Victoria’s headed for the launch site. Get in your car and drive out through the loading yard’s east gate.',
  C2_GATE: 'The launch site gate is locked. Sneak into the guard post on the lot and open it. Stay out of the guard’s flashlight (C to crouch, right mouse to knock him out).',
  C2_CARGO: (freed, card) => `Rescue the cargo: the next rotation is sealed in pods in the hangar (${freed}/${PODS.length} out).${card ? '' : ' The hangar needs the keycard from the guard post.'} Cure anyone who comes out green.`,
  C2_CODE: (digits, all) => (all
    ? `Bunker code: ${digits}. Enter it at the control bunker door (south side of the site).`
    : `Get into the control bunker (south side). Door code: ${digits}. Clues: the guard post, the hangar, the fuel depot, and a board member who set it.`),
  C2_ABORT: 'You’re in. Abort the launch at the console.',
  C2_VALVES: (n) => `Vent the fuel lines at the fuel depot: close the valves BLUE, then YELLOW, then RED (${n}/3).`,
  C2_GANTRY: 'Victoria’s at the top of the gantry, by the rocket’s hatch. Take the gantry lift up.',
  C2_FINAL: (armor, secs) => `Stop Victoria before liftoff (T-minus ${clock(secs)}). Blast her (right mouse), then spray her (F) while she’s stunned. When she rears up, blast her or back away! Batch: ${armor}/${FINAL_TUNING.armor}.`,
};

function clock(secs) {
  const s = Math.max(0, Math.ceil(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class Launch {
  constructor(part2, { scene, interactions, materials, collision }) {
    this.part2 = part2;
    this.scene = scene;
    this.collision = collision;
    this.active = false;
    const props = part2.ch2.world.props.launch;
    this.props = props;
    const enabledIn = (...states) => () => this.active && states.includes(this.state) && !this.ch1.busy;

    this.guards = SITE_GUARDS.map((g) => new Guard(scene, { ...g, y: 0, collision }));
    for (const g of this.guards) {
      g.setVisible(false);
      part2.ch2.sightIgnore.add(g.collider);
    }

    // Guard post: the clipboard, the keycard, the gate control.
    const desk = props.guardDesk;
    const clip = new THREE.Group();
    clip.add(mesh(new RoundedBoxGeometry(0.24, 0.012, 0.32, 2, 0.004), materials.get('wood')));
    clip.add(at(mesh(new THREE.BoxGeometry(0.2, 0.004, 0.27), new THREE.MeshLambertMaterial({ color: 0xf4f1e6 })), 0, 0.008, 0.01));
    clip.add(pickBox(0.4, 0.14, 0.45));
    clip.position.set(desk.deskX - 0.45, 0.765, desk.deskZ - 0.1);
    clip.rotation.y = 0.3;
    scene.add(clip);
    interactions.add({ mesh: clip.children, label: 'Read the clipboard', enabled: () => this.active && !this.ch1.busy, use: () => this.readClue(0, CLIPBOARD) });

    this.keycard = new THREE.Group();
    this.keycard.add(mesh(new RoundedBoxGeometry(0.09, 0.006, 0.055, 2, 0.003), new THREE.MeshLambertMaterial({ color: 0x3bdf6a, emissive: 0x08300f })));
    this.keycard.add(pickBox(0.4, 0.14, 0.35));
    this.keycard.position.set(desk.deskX + 0.45, 0.765, desk.deskZ - 0.15);
    this.keycard.rotation.y = -0.5;
    scene.add(this.keycard);
    interactions.add({ mesh: this.keycard.children, label: 'Take the launch site keycard', enabled: () => this.active && this.keycard.visible && !this.ch1.busy, use: () => this.takeKeycard() });

    const gp = props.gatePanel;
    const panel = at(mesh(new THREE.BoxGeometry(0.06, 0.6, 0.45), materials.get('metal')), gp.x, gp.y, gp.z);
    this.lever = at(mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3030).multiplyScalar(1.4) })), gp.x + 0.06, gp.y, gp.z);
    scene.add(panel, this.lever);
    interactions.add({ mesh: [panel, this.lever], label: 'Pull GATE OPEN', enabled: enabledIn('C2_GATE'), use: () => this.openGate() });

    // Hangar: the manifest whiteboard, and the pods.
    const wb = props.whiteboard;
    const board = at(mesh(new THREE.PlaneGeometry(1.9, 1.3), textMaterial(['MARS 7 · CARGO', '8 UNITS (LIVE)', 'LOAD BY 05:00', '', 'bunker code', '2nd digit = 1', 'Rex has the last'], '#f4f4ee', '#1d2a6a')), wb.x + 0.06, wb.y, wb.z);
    board.rotation.y = Math.PI / 2;
    scene.add(board);
    interactions.add({ mesh: board, label: 'Read the whiteboard', enabled: () => this.active && !this.ch1.busy, use: () => this.readClue(1, WHITEBOARD) });

    const glassMat = new THREE.MeshLambertMaterial({ color: 0xa8ffb0, emissive: 0x0c3a12, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    this.pods = PODS.map((p, i) => {
      const spot = props.pods[i];
      const g = new THREE.Group();
      g.add(at(mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.16, 28), materials.get('steel')), 0, 0.08, 0));
      const lid = new THREE.Group();
      lid.add(at(mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 28, 1, true), glassMat), 0, 1.26, 0));
      lid.add(at(mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.26, 28), materials.get('steel')), 0, 2.49, 0));
      lid.add(at(mesh(new THREE.BoxGeometry(0.5, 0.08, 0.04), new THREE.MeshBasicMaterial({ color: 0x6cff4a })), 0, 2.49, spot.yaw === 0 ? 0.665 : -0.665));
      g.add(lid);
      g.position.set(spot.x, 0, spot.z);
      scene.add(g);
      const collider = collision.addBox(spot.x - 0.66, 0, spot.z - 0.66, spot.x + 0.66, 2.62, spot.z + 0.66);
      const pod = { ...p, ...spot, group: g, lid, collider, state: 'sealed', open: 0, safe: { x: SAFE_SPOTS[i][0], z: SAFE_SPOTS[i][1] } };
      interactions.add({
        mesh: lid.children,
        label: `Open the cargo pod (${p.name})`,
        enabled: () => this.active && this.state === 'C2_CARGO' && pod.state === 'sealed' && !this.ch1.busy,
        use: () => this.openPod(pod),
      });
      return pod;
    });

    // Fuel depot: the sticky note on the desk, and the three valves.
    const dd = props.depotDesk;
    const note = new THREE.Group();
    note.add(mesh(new THREE.BoxGeometry(0.08, 0.003, 0.08), new THREE.MeshLambertMaterial({ color: 0xfff27a, emissive: 0x3a3410 })));
    note.add(pickBox(0.35, 0.12, 0.35));
    note.position.set(dd.deskX + 0.1, 0.762, dd.deskZ - 0.2);
    scene.add(note);
    interactions.add({ mesh: note.children, label: 'Read the sticky note', enabled: () => this.active && !this.ch1.busy, use: () => this.readClue(2, DEPOT_NOTE) });

    this.valves = props.valves.map((v) => {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 24), new THREE.MeshLambertMaterial({ color: VALVE_COLORS[v.color] }));
      const hub = at(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), materials.get('steel')), 0, 0, 0);
      hub.rotation.x = Math.PI / 2;
      const spokes = mesh(new THREE.BoxGeometry(0.44, 0.03, 0.03), new THREE.MeshLambertMaterial({ color: VALVE_COLORS[v.color] }));
      const spokes2 = spokes.clone();
      spokes2.rotation.z = Math.PI / 2;
      const g = new THREE.Group();
      g.add(wheel, hub, spokes, spokes2, pickBox(0.55, 0.55, 0.25));
      g.position.set(v.x, v.y, v.z - 0.18);
      scene.add(g);
      const valve = { ...v, group: g, closed: false };
      interactions.add({ mesh: g.children, label: `Close the ${v.color.toUpperCase()} valve`, enabled: () => enabledIn('C2_VALVES')() && !valve.closed, use: () => this.turnValve(valve) });
      return valve;
    });

    // Control bunker: the keypad by the door, the abort console, the big screen.
    this.bunkerDoor = part2.ch2.world.doorByLabel('bunker door');
    const kp = props.bunkerKeypad;
    const keypad = at(mesh(new THREE.BoxGeometry(0.16, 0.22, 0.04), materials.get('plastic')), kp.x, kp.y, kp.z);
    const keyLed = at(mesh(new THREE.BoxGeometry(0.1, 0.04, 0.01), new THREE.MeshBasicMaterial({ color: 0xff3030 })), kp.x, kp.y + 0.07, kp.z + 0.025);
    scene.add(keypad, keyLed);
    this.keyLed = keyLed;
    interactions.add({
      mesh: [keypad, keyLed],
      label: () => (this.allDigits ? `Enter the code ${CODE.join('-')}` : 'Keypad (you don’t have the whole code)'),
      enabled: () => this.active && !this.progress?.bunker && !this.ch1.busy,
      use: () => this.enterCode(),
    });
    const ac = props.abortConsole;
    const stand = at(mesh(new THREE.BoxGeometry(0.7, 1.0, 0.5), materials.get('metal')), ac.x, ac.y - 0.5, ac.z);
    const cover = at(mesh(new THREE.BoxGeometry(0.3, 0.04, 0.3), new THREE.MeshLambertMaterial({ color: 0xe2ba24 })), ac.x, ac.y + 0.02, ac.z);
    const abortButton = at(mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.06, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3030).multiplyScalar(1.6) })), ac.x, ac.y + 0.07, ac.z);
    scene.add(stand, cover, abortButton);
    interactions.add({ mesh: [stand, cover, abortButton], label: 'Press ABORT LAUNCH', enabled: enabledIn('C2_ABORT'), use: () => this.abort() });
    const cs = props.countdownScreen;
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 1024;
    this.screenCanvas.height = 160;
    this.screenTexture = toTexture(this.screenCanvas);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1), new THREE.MeshBasicMaterial({ map: this.screenTexture }));
    screen.position.set(cs.x, cs.y, cs.z);
    scene.add(screen);
    this.screenText = null;

    // Victoria, with the original batch.
    this.final = new GoobExec(scene, part2.ch1.victoria.def.look, { arena: ARENA, blocked: ARENA_BLOCKED, tuning: FINAL_TUNING });
    this.time = 0;
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

  get world() {
    return this.ch2.world;
  }

  get car() {
    return this.ch2.morning.car;
  }

  get allDigits() {
    return !!this.progress && this.progress.digits.every(Boolean);
  }

  get digitsText() {
    return CODE.map((d, i) => (this.progress?.digits[i] ? d : '_')).join(' ');
  }

  cast(name) {
    return this.ch2.cast.all.find((n) => n.name === name);
  }

  // Things the vacuum blast and the antidote can hit.
  get targets() {
    if (!this.active) return [];
    return [...this.guards.filter((g) => g.active), ...(this.final.active ? [this.final] : [])];
  }

  // ---------- Starting, stopping, checkpoints ----------

  // After the escort's outro: the radio call, then the drive.
  async begin() {
    const ch1 = this.ch1;
    const token = ch1.token;
    ch1.busy = true;
    ch1.setState('C2_RADIO', null, false);
    sfx.intercom();
    await ch1.dialogue.play(RADIO);
    if (token !== ch1.token) return;
    ch1.busy = false;
    this.ch2.player.lookTarget = null;
    for (const o of this.ch2.after.officers) o.root.visible = false;
    this.setup(null);
    this.enter('C2_DRIVE', true);
  }

  // Put the site in the state that progress describes (null: untouched).
  setup(progress) {
    this.active = true;
    const p = progress ?? {};
    this.progress = {
      keycard: !!p.keycard, gate: !!p.gate, bunker: !!p.bunker, vented: !!p.vented,
      digits: CODE.map((_, i) => !!p.digits?.[i]),
      pods: Object.fromEntries(PODS.map((q) => [q.name, p.pods?.[q.name] ?? 'sealed'])),
      board: Object.fromEntries(BOARD.map((b) => [b.name, !!p.board?.[b.name]])),
    };
    this.vent = [];
    for (const v of this.valves) {
      v.closed = !!this.progress.vented;
      v.group.rotation.z = v.closed ? Math.PI : 0;
    }
    this.keycard.visible = !this.progress.keycard;
    for (const g of this.guards) g.reset();
    this.final.stop();
    // Doors and gates.
    const yardGate = this.world.doorByLabel('east gate');
    yardGate.locked = null;
    yardGate.setOpen(1);
    const siteGate = this.world.doorByLabel('launch site gate');
    siteGate.locked = this.progress.gate ? null : 'Locked. GATE CONTROL: GUARD POST.';
    if (this.progress.gate) siteGate.setOpen(1);
    else siteGate.reset();
    const hangar = this.world.doorByLabel('hangar door');
    hangar.reset();
    hangar.locked = this.progress.keycard ? null : 'Locked. A card reader blinks red: LAUNCH SITE KEYCARD REQUIRED.';
    this.bunkerDoor.reset();
    this.updateBunkerLock();
    const lift = this.world.gantryElevator;
    lift.lockedMessage = this.progress.vented ? null : this.world.gantryLocked;
    // The pods and the people in them.
    for (const pod of this.pods) this.setPod(pod, this.progress.pods[pod.name]);
    // The board, infected, unless cured (then they've joined the others in the lot).
    BOARD.forEach((b, i) => {
      const npc = this.cast(b.name);
      if (!npc) return;
      this.wake(npc);
      if (this.progress.board[b.name]) {
        this.standAt(npc, SAFE_SPOTS[i % 2 ? 7 : 3][0] + 1.4, SAFE_SPOTS[i % 2 ? 7 : 3][1]);
        return;
      }
      npc.pos.set(b.x, 0, b.z);
      npc.home.copy(npc.pos);
      npc.infect();
      npc.brain.reset(2);
    });
    // Your car: where you left it on the road (or in the HQ lot, for the drive).
    this.ch2.morning.carStory = { label: 'Get in and drive', use: () => this.useCar() };
    this.screenText = null;
    this.updateScreen();
  }

  stop() {
    this.active = false;
    for (const g of this.guards) g.setVisible(false);
    this.final.stop();
    if (this.ch2.morning.carStory) this.ch2.morning.carStory = null;
    const world = this.world;
    for (const [label, locked] of [
      ['east gate', 'Chained shut. A sign: GOOB CO. LAUNCH SITE. AUTHORIZED VEHICLES ONLY.'],
      ['launch site gate', 'Locked. GATE CONTROL: GUARD POST.'],
      ['hangar door', 'Locked. A card reader blinks red: LAUNCH SITE KEYCARD REQUIRED.'],
      ['bunker door', 'Locked. The keypad wants a four-digit code.'],
    ]) {
      const d = world.doorByLabel(label);
      d.reset();
      d.locked = locked;
    }
    world.gantryElevator.lockedMessage = world.gantryLocked;
    for (const pod of this.pods) this.closePod(pod);
    this.keycard.visible = true;
  }

  snapshot() {
    if (!this.active) return null;
    return JSON.parse(JSON.stringify(this.progress));
  }

  // A checkpoint taken here (Part2.restore has set up HQ; the player's in place).
  restore(progress, state) {
    this.setup(progress);
    if (state !== 'C2_DRIVE') this.car.place(CAR_PARK.x, CAR_PARK.z, CAR_PARK.heading);
    if (state === 'C2_FINAL') this.startFinal(false);
    else this.ch1.setState(state, this.objectiveFor(state), false);
  }

  enter(state, announce = false) {
    this.ch1.setState(state, this.objectiveFor(state), announce);
    if (announce) this.ch2.saveCheckpoint();
    this.updateScreen();
  }

  objectiveFor(state) {
    const freed = this.pods.filter((p) => p.state === 'free').length;
    if (state === 'C2_CARGO') return OBJECTIVES.C2_CARGO(freed, this.progress.keycard);
    if (state === 'C2_CODE') return OBJECTIVES.C2_CODE(this.digitsText, this.allDigits);
    if (state === 'C2_VALVES') return OBJECTIVES.C2_VALVES(this.vent.length);
    if (state === 'C2_FINAL') return OBJECTIVES.C2_FINAL(this.final.armor ?? FINAL_TUNING.armor, this.liftoff ?? 0);
    return OBJECTIVES[state] ?? null;
  }

  refreshObjective() {
    this.ch1.hud.setObjective(this.objectiveFor(this.state));
  }

  // ---------- The drive ----------

  useCar() {
    if (this.ch1.busy) return;
    this.car.enter(this.ch2.player);
    if (this.state === 'C2_DRIVE') this.ch2.hud.toast('W/S: gas and brake · A/D: steer · Space: handbrake · E: get out', 4);
  }

  // Short of the lot: you pull over, kill the lights and get out.
  async arrive() {
    const ch1 = this.ch1;
    const token = ch1.token;
    ch1.busy = true;
    sfx.carDoor();
    await ch1.fx.fade(1, 0.6);
    if (token !== ch1.token) return;
    if (this.car.driver) this.car.exit();
    this.car.place(CAR_PARK.x, CAR_PARK.z, CAR_PARK.heading);
    this.ch2.player.spawn(PLAYER_PARK);
    ch1.busy = false;
    this.enter('C2_GATE', true);
    await ch1.fx.fade(0, 0.6);
    this.ch2.hud.toast('Lights off. A guard walks the lot ahead, right past the guard post door. Go the rest of the way on foot.', 4.5);
  }

  // ---------- The guard post ----------

  async readClue(i, lines) {
    const ch1 = this.ch1;
    const token = ch1.token;
    sfx.rustle();
    ch1.busy = true;
    await ch1.dialogue.play(lines);
    if (token !== ch1.token) return;
    ch1.busy = false;
    if (this.progress.digits[i]) return;
    this.foundDigit(i);
  }

  foundDigit(i) {
    this.progress.digits[i] = true;
    sfx.ui();
    this.ch2.hud.toast(`Bunker code: ${this.digitsText}`, 3);
    this.updateBunkerLock();
    if (['C2_CODE', 'C2_CARGO'].includes(this.state)) this.refreshObjective();
    if (WATCHED.includes(this.state)) this.ch2.saveCheckpoint();
  }

  takeKeycard() {
    this.keycard.visible = false;
    this.progress.keycard = true;
    this.world.doorByLabel('hangar door').locked = null;
    sfx.pickup();
    this.ch2.hud.toast('Got the launch site keycard. It opens the cargo hangar.', 3);
    if (this.state === 'C2_CARGO') this.refreshObjective();
    this.ch2.saveCheckpoint();
  }

  openGate() {
    this.progress.gate = true;
    const gate = this.world.doorByLabel('launch site gate');
    gate.locked = null;
    gate.setOpen(1);
    this.lever.rotation.z = 0.8;
    sfx.gate();
    this.ch2.hud.toast('GATE OPEN. Out on the lot, the launch site gate grinds aside.', 3.5);
    this.enter('C2_CARGO', true);
    if (!this.progress.keycard) this.ch2.hud.toast('Grab the keycard on the desk: the hangar’s locked.', 3.5);
  }

  // ---------- The cargo ----------

  // A person and their pod in one of: sealed (inside), infected (out, green), free.
  setPod(pod, state) {
    const npc = this.cast(pod.name);
    pod.state = state;
    if (!npc) return;
    this.wake(npc);
    if (state === 'sealed') {
      this.closePod(pod);
      npc.pos.set(pod.x, 0.16, pod.z);
      npc.home.copy(npc.pos);
      npc.yaw = pod.yaw;
      npc.frozen = true;
      npc.collider.enabled = false;
      npc.talkable = false;
      npc.person.setInfected(!!pod.infected);
      return;
    }
    this.openLid(pod, true);
    if (state === 'infected') {
      npc.pos.set(pod.x, 0, pod.z + (pod.yaw === 0 ? 1 : -1));
      npc.home.copy(npc.pos);
      npc.infect();
      npc.brain.reset(1.5);
    } else {
      this.standAt(npc, pod.safe.x, pod.safe.z, pod.line);
    }
  }

  // Back in the world: visible, solid, out of whatever it was doing.
  wake(npc) {
    npc.person.root.visible = true;
    npc.collider.enabled = true;
    npc.frozen = false;
    npc.path = null;
    npc.onArrive = null;
    npc.talking = false;
    npc.cured = false;
    npc.brain = null;
    npc.mode = 'stand';
    npc.person.action = null;
    npc.person.setInfected(false);
  }

  // Standing in the staging lot, waiting for the police.
  standAt(npc, x, z, line) {
    npc.pos.set(x, 0, z);
    npc.home.copy(npc.pos);
    npc.yaw = Math.PI / 2;
    npc.cured = true;
    npc.talkable = true;
    npc.lines = [line ?? 'Thank you, Champ.'];
    npc.lineIndex = 0;
  }

  closePod(pod) {
    pod.open = 0;
    pod.opening = false;
    pod.lid.position.y = 0;
    pod.lid.visible = true;
    pod.collider.enabled = true;
  }

  openLid(pod, instant = false) {
    pod.collider.enabled = false;
    pod.opening = true;
    if (instant) {
      pod.open = 1;
      pod.lid.position.y = 2.3;
    }
  }

  openPod(pod) {
    const npc = this.cast(pod.name);
    this.openLid(pod);
    sfx.pour();
    sfx.lock();
    if (pod.infected) {
      pod.state = 'infected';
      this.progress.pods[pod.name] = 'infected';
      npc.frozen = false;
      npc.collider.enabled = true;
      npc.pos.set(pod.x, 0, pod.z + (pod.yaw === 0 ? 0.7 : -0.7));
      npc.infect();
      npc.brain.reset(1.2);
      sfx.moan(npc.pos, 1);
      this.ch2.hud.toast(`The pod hisses open. ${pod.name} comes out green! Cure them (F).`, 3);
    } else {
      this.ch2.hud.toast(`The pod hisses open. ${pod.name} stumbles out, blinking.`, 3);
      this.free(pod);
    }
    this.cargoProgress();
  }

  // Out of the pod and off to the staging lot.
  free(pod) {
    const npc = this.cast(pod.name);
    pod.state = 'free';
    this.progress.pods[pod.name] = 'free';
    npc.brain = null;
    npc.frozen = false;
    npc.collider.enabled = true;
    npc.cured = true; // (walks with collision and opens doors)
    npc.mode = 'stand';
    npc.talkable = true;
    npc.lines = [pod.line];
    npc.lineIndex = 0;
    npc.speed = 1.9;
    npc.person.setInfected(false);
    if (npc.pos.y > 0.05) npc.pos.set(pod.x, 0, pod.z + (pod.yaw === 0 ? 0.8 : -0.8));
    const spot = new THREE.Vector3(pod.safe.x, 0, pod.safe.z);
    const nav = npc.env.nav;
    const route = nav.path(nav.nearest(npc.pos), nav.nearest(spot), true) ?? [];
    npc.walkPath([...route, spot], () => {
      npc.mode = 'stand';
      npc.yaw = Math.PI / 2;
    });
    npc.pause = 0.6;
  }

  cargoProgress() {
    const freed = this.pods.filter((p) => p.state === 'free').length;
    if (this.state !== 'C2_CARGO') return;
    if (freed >= this.pods.length) {
      this.ch2.hud.toast('That’s all eight. They’re heading out to the staging lot to wait for the police.', 4);
      this.enter(this.progress.bunker ? 'C2_ABORT' : 'C2_CODE', true);
    } else {
      this.refreshObjective();
      this.ch2.saveCheckpoint();
    }
  }

  // The antidote reached someone (Part2.cured): true if it was ours.
  cured(npc) {
    if (!this.active) return false;
    if (npc === this.final) {
      this.finalHit();
      return true;
    }
    const pod = this.pods.find((p) => p.name === npc.name && p.state === 'infected');
    if (pod) {
      sfx.cure(npc.pos);
      this.ch1.fx.flash('#8fd8ff', 0.3);
      this.ch2.hud.toast(`${pod.name} is cured!`, 2.5);
      this.free(pod);
      this.cargoProgress();
      return true;
    }
    const b = BOARD.find((q) => q.name === npc.name);
    if (b && npc.infected) {
      sfx.cure(npc.pos);
      this.ch1.fx.flash('#8fd8ff', 0.3);
      npc.brain = null;
      npc.mode = 'stand';
      npc.cured = true;
      npc.person.setInfected(false);
      npc.talkable = false;
      this.progress.board[b.name] = true;
      this.boardTalk(npc, b);
      return true;
    }
    return false;
  }

  async boardTalk(npc, b) {
    const ch1 = this.ch1;
    const token = ch1.token;
    npc.talking = true;
    ch1.busy = true;
    this.ch2.player.lookTarget = npc.headPoint;
    await ch1.dialogue.play(b.lines);
    if (token !== ch1.token) return;
    ch1.busy = false;
    this.ch2.player.lookTarget = null;
    npc.talking = false;
    npc.talkable = true;
    npc.lines = [b.lines.at(-1).text];
    npc.lineIndex = 0;
    if (b.digit !== undefined && !this.progress.digits[b.digit]) this.foundDigit(b.digit);
    else if (WATCHED.includes(this.state)) this.ch2.saveCheckpoint();
    // Off to wait with the others.
    const i = BOARD.indexOf(b);
    const spot = new THREE.Vector3(SAFE_SPOTS[i ? 7 : 3][0] + 1.4, 0, SAFE_SPOTS[i ? 7 : 3][1]);
    const nav = npc.env.nav;
    npc.speed = 1.9;
    npc.walkPath([...(nav.path(nav.nearest(npc.pos), nav.nearest(spot), true) ?? []), spot], () => { npc.yaw = Math.PI / 2; });
  }

  // ---------- The bunker and the valves ----------

  updateBunkerLock() {
    if (!this.progress) return;
    this.bunkerDoor.locked = this.progress.bunker ? null : `Locked. The keypad wants a four-digit code. You have: ${this.digitsText}.`;
    this.keyLed.material.color.set(this.progress.bunker ? 0x40ff60 : 0xff3030);
  }

  enterCode() {
    if (!this.allDigits) {
      sfx.ui();
      this.ch2.hud.toast(`The keypad wants four digits. You have: ${this.digitsText}.`, 3);
      return;
    }
    if (!['C2_CODE'].includes(this.state)) {
      this.ch2.hud.toast('Not yet. The cargo’s still in the hangar.', 3);
      return;
    }
    this.progress.bunker = true;
    this.updateBunkerLock();
    sfx.lock();
    this.bunkerDoor.setOpen(1);
    this.ch2.hud.toast('The keypad beeps twice. The bunker door unlocks.', 3);
    this.enter('C2_ABORT', true);
  }

  async abort() {
    const ch1 = this.ch1;
    const token = ch1.token;
    ch1.busy = true;
    sfx.klaxon();
    this.screenText = ['ABORT REJECTED', 'FUEL LINES PRESSURIZED · VENT: BLUE  YELLOW  RED'];
    this.updateScreen(true);
    await ch1.dialogue.play(ABORT);
    if (token !== ch1.token) return;
    ch1.busy = false;
    this.enter('C2_VALVES', true);
  }

  turnValve(valve) {
    if (valve.color !== VENT_ORDER[this.vent.length]) {
      // Wrong: everything spins back open.
      sfx.breach();
      this.ch1.fx.flash('#ffffff', 0.2);
      for (const v of this.valves) {
        v.closed = false;
        v.group.rotation.z = 0;
      }
      this.vent = [];
      this.ch2.hud.toast('Wrong order! The pressure slams back up and the valves spin open. BLUE, then YELLOW, then RED.', 4);
      this.refreshObjective();
      return;
    }
    valve.closed = true;
    valve.group.rotation.z = Math.PI;
    this.vent.push(valve.color);
    sfx.lock();
    this.ch2.hud.toast(`${valve.color.toUpperCase()} valve closed (${this.vent.length}/3). Somewhere a pipe sighs.`, 2.5);
    this.refreshObjective();
    if (this.vent.length >= VENT_ORDER.length) this.vented();
  }

  async vented() {
    const ch1 = this.ch1;
    const token = ch1.token;
    ch1.busy = true;
    this.progress.vented = true;
    sfx.intercom();
    this.screenText = ['GROUND LAUNCH ABORTED', 'MANUAL OVERRIDE: COCKPIT'];
    this.updateScreen(true);
    await ch1.dialogue.play(VENTED);
    if (token !== ch1.token) return;
    ch1.busy = false;
    this.world.gantryElevator.lockedMessage = null;
    this.enter('C2_GANTRY', true);
  }

  // ---------- The gantry ----------

  async startFinal(intro = true) {
    const ch1 = this.ch1;
    const token = ch1.token;
    const player = this.ch2.player;
    for (const g of this.guards) g.setVisible(false);
    this.final.start(FINAL_START.x, FINAL_START.z);
    this.liftoff = this.liftoffSeconds();
    this.failing = false;
    if (!intro) {
      ch1.setState('C2_FINAL', this.objectiveFor('C2_FINAL'), false);
      return;
    }
    ch1.busy = true;
    ch1.setState('C2_FINAL', null, false);
    this.final.active = false; // (stands still while she talks)
    player.lookTarget = { x: this.final.pos.x, y: this.final.pos.y + 2.6, z: this.final.pos.z };
    await ch1.dialogue.play(FINAL_INTRO);
    if (token !== ch1.token) return;
    player.lookTarget = null;
    this.final.active = true;
    ch1.busy = false;
    ch1.setState('C2_FINAL', this.objectiveFor('C2_FINAL'), true);
    this.ch2.saveCheckpoint();
  }

  liftoffSeconds() {
    const d = difficulty();
    if (!d.infectedAttack) return LIFTOFF.easy;
    return d.infectedOpenDoors ? LIFTOFF.hard : LIFTOFF.normal;
  }

  finalHit() {
    const done = this.final.hit();
    this.ch1.fx.flash('#8fd8ff', 0.4);
    if (!done) {
      const left = this.final.armor;
      const toasts = { 5: 'The batch screams! A layer sloughs off!', 4: 'Another layer gone!', 3: 'She’s throwing three at once now. Keep moving!', 2: 'It’s letting go of her!', 1: 'One more!' };
      this.ch2.hud.toast(toasts[left] ?? 'Hit!', 2.5);
      this.refreshObjective();
      return;
    }
    this.win();
  }

  async win() {
    const ch1 = this.ch1;
    const token = ch1.token;
    const player = this.ch2.player;
    ch1.busy = true;
    ch1.setState('C2_FOUND', null, false);
    this.final.active = false;
    this.final.clearGlobs();
    this.final.person.action = 'stunned';
    sfx.squelch(this.final.pos);
    // The goob lets go: she's herself again (normal size, normal skin).
    this.final.root.scale.setScalar(1);
    this.final.person.setInfected(false);
    for (const p of this.final.plates) p.visible = false;
    player.lookTarget = { x: this.final.pos.x, y: this.final.pos.y + 1.6, z: this.final.pos.z };
    // The officers come up the lift behind you.
    this.ch2.after.officers.forEach((o, i) => {
      o.root.position.set(111.5 + (i ? 1.2 : -1.2), LAUNCH.top.y, -1.6);
      o.root.rotation.y = Math.atan2(this.final.pos.x - o.root.position.x, this.final.pos.z - o.root.position.z);
      o.root.visible = true;
    });
    await ch1.wait(1.2);
    if (token !== ch1.token) return;
    this.final.person.action = null;
    await ch1.dialogue.play(FINAL_DEFEAT);
    if (token !== ch1.token) return;
    await ch1.fx.fade(1, 1.8);
    if (token !== ch1.token) return;
    ch1.onEnd?.({
      title: 'The End',
      text: 'The sun came up over the launch site with Mars 7 still on its pad. Victoria was led away in zip ties, goob-free for the first time in seven years. The eight people in the cargo pods went home, and Rex finally told his wife about the boat. The original batch was scraped into a hundred evidence jars. The rotation is over. Goob Co. is over. You kept the suit.',
      hint: 'Thanks for playing The Goob Infection.',
    });
  }

  async liftoffFail() {
    const ch1 = this.ch1;
    if (this.failing) return;
    this.failing = true;
    const token = ch1.token;
    ch1.busy = true;
    this.final.active = false;
    this.final.clearGlobs();
    sfx.crash();
    this.ch2.player.shakeFor(1.5);
    this.ch2.hud.toast('MARS 7 LIFTS OFF. The gantry shakes, and she’s gone.', 3);
    await ch1.fx.fade(1, 1.6);
    if (token !== ch1.token) return;
    await this.ch2.restore(ch1.checkpoint);
    this.ch2.hud.toast('Try again: blast her when she rears up, and spray her while she’s dazed.', 4.5);
  }

  // ---------- Every frame ----------

  // The big screen in the bunker.
  updateScreen(force = false) {
    const state = this.state;
    let lines = this.screenText;
    if (!lines || !['C2_ABORT', 'C2_VALVES', 'C2_GANTRY', 'C2_FINAL'].includes(state)) {
      lines = state === 'C2_FINAL' || state === 'C2_GANTRY'
        ? ['MANUAL OVERRIDE', state === 'C2_FINAL' ? `LIFTOFF T-MINUS ${clock(this.liftoff ?? 0)}` : 'COCKPIT CONTROL']
        : ['MARS 7 · FUELING', 'LAUNCH AT DAWN · CARGO: INPUT (8)'];
    }
    const key = lines.join('|');
    if (!force && key === this.screenKey) return;
    this.screenKey = key;
    const g = this.screenCanvas.getContext('2d');
    g.fillStyle = '#04110a';
    g.fillRect(0, 0, 1024, 160);
    g.fillStyle = lines[0].startsWith('ABORT') || lines[0].startsWith('MANUAL') ? '#ff5a4a' : '#6cff4a';
    g.font = 'bold 64px "Courier New", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(lines[0], 512, 52, 1000);
    g.fillStyle = '#bfe8c8';
    g.font = 'bold 34px "Courier New", monospace';
    g.fillText(lines[1] ?? '', 512, 122, 1000);
    this.screenTexture.needsUpdate = true;
  }

  // Returns the highest guard suspicion (for the meter), or 0.
  update(dt) {
    if (!this.active) return 0;
    this.time += dt;
    const state = this.state;
    const ch1 = this.ch1;
    const player = this.ch2.player;

    // Pod lids slide up as they open.
    for (const pod of this.pods) {
      if (!pod.opening || pod.open >= 1) continue;
      pod.open = Math.min(1, pod.open + dt * 0.9);
      pod.lid.position.y = 2.3 * pod.open * pod.open;
    }

    if (!ch1.busy) {
      if (state === 'C2_DRIVE' && (this.car.driver ? this.car.pos.x : player.pos.x) > ARRIVE_X) this.arrive();
      if (state === 'C2_GANTRY' && player.pos.y > LAUNCH.top.y - 0.5 && player.pos.x > LAUNCH.top.x0 - 1) this.startFinal(true);
      if (state === 'C2_FINAL' && this.final.active) {
        this.final.update(dt, player, (amount) => this.part2.damage(amount ?? this.part2.globDamage()));
        this.liftoff -= dt;
        if (Math.floor(this.liftoff * 4) !== Math.floor((this.liftoff + dt) * 4)) this.refreshObjective();
        if (this.liftoff <= 0) this.liftoffFail();
      }
    }
    if (Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) this.updateScreen();

    const watching = WATCHED.includes(state) && !ch1.busy && !this.ch2.caughtBusy && !player.rig;
    let suspicion = 0;
    for (const g of this.guards) {
      const s = g.update(dt, player, this.collision, this.ch2.sightIgnore);
      if (watching) suspicion = Math.max(suspicion, s);
    }
    return suspicion;
  }
}

function mesh(geometry, material) {
  return new THREE.Mesh(geometry, material);
}

function at(m, x, y, z) {
  m.position.set(x, y, z);
  return m;
}

// An invisible box that's easier to aim at than a thin prop.
function pickBox(w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.y = h / 2 - 0.02;
  return m;
}

// Handwriting on a board: a few lines of text.
function textMaterial(lines, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 352;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 352);
  g.fillStyle = fg;
  g.font = 'bold 40px "Comic Sans MS", "Segoe Print", cursive';
  g.textAlign = 'left';
  g.textBaseline = 'top';
  lines.forEach((line, i) => g.fillText(line, 28, 18 + i * 46, 460));
  const map = toTexture(canvas);
  map.magFilter = THREE.LinearFilter;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  return new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.2 });
}
