import * as THREE from 'three';
import { NPC } from './npc.js';
import { sign } from '../world/furniture.js';

// The player. Dale calls you "champ", so that's your name.
export const PLAYER_NAME = 'Champ';
// Your desk: the seat you start behind (see BUILDING.spawn).
export const PLAYER_SEAT = 8;

// Empty desks that belong to coworkers who spend the day somewhere else
// (the meeting room, the kitchenette, the break room, laps of the office).
const AWAY_DESKS = { Brad: 3, Olu: 5, Deb: 15, Stan: 18, Gus: 22, Nell: 24, Pat: 19 };

// Everyone at Goob Co. on delivery day.

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x6b4226];
const HAIR = { dark: 0x2b1d0e, brown: 0x5a3a1a, black: 0x111111, blond: 0xc9a25a, grey: 0xa8a8a8, red: 0x8a3b12 };
const PANTS = { navy: 0x2d3142, charcoal: 0x3b3b3b, khaki: 0x8a7a5a, black: 0x1c1c1e };

const look = (shirt, pants, skin, hair, extra = {}) => ({ shirt, pants: PANTS[pants], skin: SKIN[skin], hair: HAIR[hair], ...extra });

// Facing the monitor from a desk seat, by desk rotation (see furniture.desk).
const SEAT_YAW = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
const seated = (seat, y) => ({ x: seat.x, y, z: seat.z, yaw: SEAT_YAW[seat.rot & 3] });

// The manager starts in his office and walks to your desk (2F).
export const BOSS_ROUTE = [
  { x: 1.5, z: 4.8 }, { x: 5.2, z: 4.5 }, { x: 6.8, z: 4.5 }, { x: 6.8, z: 11.5 }, { x: 7.3, z: 11.5 },
];

export const BOSS_BRIEFING = [
  'Morning, champ! Big day. Huge day.',
  "Your name came up on the rotation. You're delivering the goob!",
  "It's going to Mars. The shuttle crate's waiting at the loading dock. That's downstairs, first floor.",
  "Standard procedure: suit up in the locker room first. Hazard suit. Non-negotiable. Legal made me say that.",
  "Then grab the goob from the secure freezer in the dock. Gently. It's very... goobly.",
  "And don't drop it. Ha! Nobody's ever dropped it. Okay, go get 'em!",
];

// Dale over the intercom once the goob is locked away: still infected, still a manager.
export const DALE_CALL = [
  '*crackle* Champ! *gurgle* Fantastic work. The goob is back in the freezer where it belongs.',
  'Small hiccup. Everyone is still... *blorp* ...goob. Including me. I feel great, but HR says that is a problem.',
  "There's antidote in the new infirmary. The old storage room, next to the elevator.",
  'It clips right onto your vacuum. Hold F to spray. Spray everyone. Spray me. Especially me. *gurgle*',
];

// Dale, cured, when everyone is back to normal.
export const DALE_THANKS = [
  "Everyone's back to normal! I remember nothing, and I would like to keep it that way.",
  'Outstanding teamwork. I will be mentioning it in my quarterly self-review.',
  'Now. About that Mars delivery. We are going to need more goob.',
];

// What people say once cured (a general pool, plus a few personal ones).
export const CURED_LINES = {
  default: [
    'Why do I taste pennies? And why is my mouth green?',
    'I had the strangest dream I was a puddle. A happy puddle.',
    'Thanks for the spray. I think. My ears are still ringing.',
  ],
  Earl: ["You got it all? Every drop? ...I'm not mopping anything today. Or ever."],
  Hank: ['Last thing I remember is you holding that canister. Remind me never to say "careful" again.'],
  Priya: ['It hummed at me again. Then everything went green. I am taking the rest of the week off.'],
  Kevin: ['Wait, did I finish my solitaire game? Did I WIN?'],
  Deb: ['I made coffee while I was goob. It was the best coffee I have ever made. I cannot remember how.'],
  Walt: ['In my day, the goob stayed in the freezer. Uphill. Both ways.'],
  Dale: ['Is it Friday? It feels like a Friday. A goob Friday.'],
};

const BOSS_AFTER = [
  "Suit first, then the freezer. You've got this!",
  'The shuttle leaves when the goob gets there. No pressure. Some pressure.',
  "I'd come with you, but I have a very important meeting with my inbox.",
];

// Desk seats are indexes into the seat list from furnish() (4 per cubicle pod).
// Seat 8 is yours.
const DESK_WORKERS = [
  { seat: 1, name: 'Priya', look: look(0x7a3b69, 'charcoal', 2, 'black'), lines: [
    "Heard it's your turn to deliver the goob. Better you than me.",
    'Last time I held the goob it hummed at me. I have not been the same.',
  ] },
  { seat: 6, name: 'Tom', look: look(0x9bb0c9, 'khaki', 4, 'blond'), lines: [
    "Don't look directly at the goob. That's not a rule. I just don't like it.",
    'Do the Mars people pay in space money? Asking for my 401k.',
  ] },
  { seat: 10, name: 'Marcy', look: look(0xc2b280, 'navy', 0, 'red'), lines: [
    "We sit back to back, so technically I'm your emotional support coworker.",
    'Bring me back a Mars rock. Or a Mars anything.',
  ] },
  { seat: 13, name: 'Kevin', look: look(0x4f6d4a, 'charcoal', 1, 'brown'), lines: [
    'The printer is jammed again. I think there is goob in the rollers.',
    'Do not tell Dale I am playing solitaire.',
  ] },
  { seat: 20, name: 'Luis', look: look(0xe8e4d8, 'navy', 3, 'black'), lines: [
    'Goob Co. Employee Handbook, page one: "Respect the goob." Page two is also that.',
    'Wear the suit. The suit is your friend.',
  ] },
  { seat: 26, name: 'Janet', look: look(0x5b7fa6, 'black', 5, 'dark'), lines: [
    'Twelve years here and I still do not know what goob is for.',
    'Mars. Wow. The furthest I have delivered anything is the break room.',
  ] },
  { seat: 27, name: 'Walt', look: look(0x8c5a3c, 'khaki', 4, 'grey'), lines: [
    'In my day we delivered the goob in a paper bag. Uphill.',
    'Freezer runs at minus forty. The goob likes it. I do not.',
  ] },
];

export function createCast(ctx, props) {
  const y2 = 4;
  const defs = [
    {
      id: 'boss', name: 'Dale', x: 1.5, y: y2, z: 4.8, yaw: Math.PI / 2, mode: 'stand',
      look: look(0xf2f2ee, 'navy', 4, 'brown', { tie: 0xb0282a }),
      lines: BOSS_AFTER,
    },
    ...DESK_WORKERS.map((w) => ({ ...w, ...seated(props.desks[w.seat], y2), mode: 'type' })),
    // 2F meeting room, kitchenette, and someone doing laps of the office
    { name: 'Brad', x: 20, y: y2, z: 2.45, yaw: 0, mode: 'sit', look: look(0x2f3e6b, 'charcoal', 4, 'blond'), lines: [
      "This meeting is about scheduling the next meeting. It's going great.",
    ] },
    { name: 'Olu', x: 22, y: y2, z: 4.55, yaw: Math.PI, mode: 'sit', look: look(0xd9a441, 'black', 3, 'black'), lines: [
      "Please rescue me. It's slide forty-one.",
    ] },
    { name: 'Deb', x: 19.2, y: y2, z: 22.7, yaw: 0, mode: 'stand', look: look(0xb35d5d, 'navy', 1, 'dark'), lines: [
      "Coffee's fresh. Well. Fresh-ish.",
      'Somebody keeps labeling their yogurt "NOT GOOB". Suspicious.',
    ] },
    {
      name: 'Stan', x: 5.5, y: y2, z: 6.6, mode: 'route',
      route: [{ x: 5.5, z: 6.6 }, { x: 16.6, z: 6.6 }, { x: 16.6, z: 11.9 }, { x: 5.8, z: 11.9 }],
      look: look(0x6e7fa0, 'khaki', 0, 'grey'), lines: [
        "Ten thousand steps a day. I'm at nine thousand nine hundred. Laps.",
      ],
    },
    // 1F
    { name: 'Rhonda', x: 19, y: 0, z: 7.2, yaw: Math.PI, mode: 'type', look: look(0x9a4f9e, 'black', 3, 'dark'), lines: [
      "Front doors go out to the parking lot, hon. Deliveries go out the dock.",
      'Locker room is the first door on the left down the hall.',
    ] },
    { name: 'Mo', x: 22.2, y: 0, z: 7.8, yaw: Math.PI, mode: 'stand', look: look(0x7d5a3a, 'khaki', 2, 'black'), lines: [
      'Mail room. Every package here says FRAGILE: GOOB. None of them are goob. I checked.',
      "If Mars sends a reply, I'll let you know.",
    ] },
    {
      name: 'Earl', x: 2, y: 0, z: 11.5, mode: 'route',
      route: [{ x: 2, z: 11.5 }, { x: 22, z: 11.5 }],
      look: look(0x6f6f64, 'charcoal', 5, 'grey'), lines: [
        "Whatever you do, don't make me mop up goob. Again.",
        "Janitor closet's full of stuff you don't want to know about.",
      ],
    },
    { name: 'Gus', x: 8.4, y: 0, z: 22.3, yaw: Math.PI / 2, mode: 'stand', look: look(0x3d6b4f, 'navy', 2, 'brown'), lines: [
      "Vending machine ate my dollar. It's been a hard week.",
    ] },
    { name: 'Nell', x: 9.4, y: 0, z: 22.3, yaw: -Math.PI / 2, mode: 'stand', look: look(0xe0c068, 'khaki', 4, 'red'), lines: [
      "Gus has been telling me about his dollar for twenty minutes.",
    ] },
    { name: 'Pat', x: 3.5, y: 0, z: 17.95, yaw: Math.PI, mode: 'sit', look: look(0x8fb3a0, 'charcoal', 1, 'black'), lines: [
      "Lunch break. Well, it's 9 a.m. Early lunch break.",
    ] },
    { name: 'Hank', x: 30.5, y: 0, z: 8.5, yaw: -Math.PI / 2, mode: 'stand', look: look(0xd88a2d, 'navy', 3, 'dark'), lines: [
      "Shuttle crate's ready. Just needs the goob. Freezer's in the back corner.",
      "Freezer won't open for you without a hazard suit. Rules.",
    ] },
    // 2F copy room
    { name: 'Carla', x: 22.7, y: y2, z: 8.9, yaw: Math.PI, mode: 'stand', look: look(0x4f7ea8, 'black', 0, 'blond'), lines: [
      'The copier makes a noise like a goob. I think it is lonely.',
      'Paper jam in tray three. There is always a paper jam in tray three.',
    ] },
    // 3F executives
    { name: 'Victoria', ...seated(props.ceoDesk, 8), mode: 'type', look: look(0x1f1f28, 'black', 5, 'dark', { tie: 0x6cff4a }), lines: [
      'Goob Co. is going interplanetary, and you are the tip of the spear. Do not drop the spear.',
      'My door is always open. Metaphorically. Please knock.',
    ] },
    { name: 'Martin', ...seated(props.assistantDesk, 8), mode: 'type', look: look(0xdcdcd0, 'navy', 4, 'brown', { tie: 0x2a4a8a }), lines: [
      'Ms. Victoria is in back-to-back meetings until 2031.',
      'Can I get you a water? The fancy water. It has a lemon in it.',
    ] },
    { name: 'Rex', x: 17.75, y: 8, z: 2.65, yaw: 0, mode: 'sit', look: look(0x2a2a3a, 'charcoal', 1, 'grey', { tie: 0x8a1a1a }), lines: [
      'Q3 goob synergy is up forty percent. I do not know what that means either.',
    ] },
    { name: 'Lorraine', x: 20.25, y: 8, z: 5.35, yaw: Math.PI, mode: 'sit', look: look(0x5a2a4a, 'black', 3, 'black'), lines: [
      'If this is about the Mars delivery, I have concerns. Mostly about Mars.',
    ] },
    { name: 'Chip', x: 21.5, y: 8, z: 17.5, yaw: Math.PI / 2, mode: 'stand', look: look(0xf0e0a0, 'khaki', 4, 'blond'), lines: [
      "Executive lounge, my friend. The coffee here costs more than your car. It's free, though.",
    ] },
    // B1
    { name: 'Dr. Pell', x: 21, y: -4, z: 19.5, yaw: Math.PI, mode: 'stand', look: look(0xf4f4f0, 'charcoal', 0, 'grey'), lines: [
      'This is where we make goob. How? Trade secret. Also, we do not fully know.',
      'Goob is completely safe. In the vats. Behind glass. Far away.',
    ] },
    { name: 'Ivo', ...seated(props.labDesk, -4), mode: 'type', look: look(0xf4f4f0, 'navy', 2, 'brown'), lines: [
      'Batch 7 is humming again. Batches should not hum.',
    ] },
    { name: 'Terry', ...seated(props.serverDesk, -4), mode: 'type', look: look(0x3a3a3a, 'black', 4, 'red'), lines: [
      'Have you tried turning the goob off and on again?',
      'The servers run hot down here. The goob likes it. Everything down here is about what the goob likes.',
    ] },
    // Outside
    { name: 'Sal', x: 5, y: 0, z: -1.7, yaw: Math.PI, mode: 'stand', look: look(0x8a6a4a, 'navy', 3, 'dark'), lines: [
      "Just getting some air. Air that isn't goob-adjacent.",
    ] },
    { name: 'Dwayne', x: 45.5, y: 0, z: 6.2, yaw: Math.PI, mode: 'stand', look: look(0xc0582a, 'navy', 5, 'black'), lines: [
      "I drive the truck to the launch site. The rocket does the rest. Mostly the rocket.",
      "Load's late. Take your time. No, don't take your time.",
    ] },
  ];

  const all = defs.map((d) => new NPC(ctx, d));
  addNameplates(ctx, props);
  return {
    all,
    boss: all[0],
    reset() {
      for (const npc of all) npc.reset();
    },
    setEnv(env) {
      for (const npc of all) npc.setEnv(env);
    },
    update(dt, player) {
      for (const npc of all) npc.update(dt, player);
      separate(all);
    },
  };
}

// ---------- Nameplates ----------

const PLATE = { bg: '#262424', fg: '#e8dcb4' };                // brass text on black
const CHAMP_PLATE = { bg: '#d9b03a', fg: '#241a00' };          // gold, for you
const DESK_TOP = 0.76;

// Put a desk nameplate on every desk that belongs to someone, a gold one and a
// small trophy on yours, and plates on Dale's desk and the reception counter.
function addNameplates(ctx, props) {
  const owners = [
    ...DESK_WORKERS.map((w) => [w.seat, w.name]),
    ...Object.entries(AWAY_DESKS).map(([name, seat]) => [seat, name]),
  ];
  for (const [seat, name] of owners) deskPlate(ctx, props.desks[seat], name.toUpperCase(), PLATE);

  const mine = props.desks[PLAYER_SEAT];
  deskPlate(ctx, mine, PLAYER_NAME.toUpperCase(), CHAMP_PLATE, { w: 0.44, h: 0.1 });
  trophy(ctx, mine);

  // Managers' plates face visitors across the desk, not their own chair.
  deskPlate(ctx, props.managerDesk, 'DALE · MANAGER', PLATE, { w: 0.5, lz: -0.34, back: true });
  deskPlate(ctx, props.ceoDesk, 'VICTORIA · CEO', PLATE, { w: 0.5, lz: -0.34, back: true });
  deskPlate(ctx, props.assistantDesk, 'MARTIN · EXECUTIVE ASSISTANT', PLATE, { w: 0.62, lz: -0.34, back: true });
  deskPlate(ctx, props.labDesk, 'DR. IVO', PLATE);
  deskPlate(ctx, props.serverDesk, 'TERRY · IT', PLATE);

  // Rhonda's sits on the reception counter, facing the front door.
  const reception = new THREE.Group();
  reception.position.set(20.0, 0.9, 6.12);
  reception.rotation.y = Math.PI;
  ctx.scene.add(reception);
  plate(ctx, reception, 0, 0, 'RHONDA · RECEPTION', PLATE, { w: 0.52 });
}

// A group at the desk, turned so local +z points at the desk's chair side.
function deskFrame(ctx, seat) {
  const g = new THREE.Group();
  g.position.set(seat.deskX, seat.y + DESK_TOP, seat.deskZ);
  g.rotation.y = (seat.rot & 3) * (Math.PI / 2);
  ctx.scene.add(g);
  return g;
}

function deskPlate(ctx, seat, text, style, { w = 0.38, h = 0.09, lz = 0.34, back = false } = {}) {
  const g = deskFrame(ctx, seat);
  plate(ctx, g, 0.5, lz, text, style, { w, h, back });
}

// A small wedge block with the name on the side facing local +z (or -z).
function plate(ctx, parent, lx, lz, text, style, { w = 0.38, h = 0.09, back = false } = {}) {
  const block = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.04), ctx.materials.get('plastic'));
  block.position.set(lx, (h + 0.02) / 2, lz);
  parent.add(block);
  const label = sign(ctx.scene, text, 0, 0, 0, 'n', { w, h, ...style });
  parent.add(label); // moves it from the scene into the desk's frame
  label.position.set(lx, (h + 0.02) / 2, lz + (back ? -0.021 : 0.021));
  label.rotation.y = back ? Math.PI : 0;
}

// A little gold "World's Okayest Employee" trophy by your monitor.
function trophy(ctx, seat) {
  const g = deskFrame(ctx, seat);
  const gold = ctx.materials.get('trophy');
  const dark = ctx.materials.get('plastic');
  const part = (geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(-0.58, y, -0.05);
    g.add(m);
  };
  part(new THREE.BoxGeometry(0.1, 0.035, 0.1), dark, 0.0175);
  part(new THREE.CylinderGeometry(0.012, 0.018, 0.06, 8), gold, 0.065);
  part(new THREE.CylinderGeometry(0.048, 0.022, 0.07, 10), gold, 0.13);
  part(new THREE.BoxGeometry(0.13, 0.015, 0.015), gold, 0.14);
}

// Nobody walks through anybody: people standing or walking keep a body's
// width apart (0.6 m, shoulder to shoulder). Overlaps are pushed apart
// completely each frame, a few passes so crowds settle; walls still stop
// them (move() collides). Someone seated stays put and only the other one
// moves.
const PERSONAL_SPACE = 0.6;
const SEPARATE_PASSES = 3;
function separate(npcs) {
  const moved = new Set();
  for (let pass = 0; pass < SEPARATE_PASSES; pass++) {
    let any = false;
    for (let i = 0; i < npcs.length; i++) {
      const a = npcs[i];
      for (let j = i + 1; j < npcs.length; j++) {
        const b = npcs[j];
        if (a.seated && b.seated) continue;
        if (Math.abs(a.pos.y - b.pos.y) > 1) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d >= PERSONAL_SPACE) continue;
        const overlap = PERSONAL_SPACE - d;
        // Exactly on top of each other: split in a direction that depends on
        // the pair, so a whole stack fans out instead of lining up.
        const angle = (i * 2.399 + j * 1.3) % (Math.PI * 2);
        const nx = d > 1e-4 ? dx / d : Math.cos(angle);
        const nz = d > 1e-4 ? dz / d : Math.sin(angle);
        const shareA = a.seated ? 0 : b.seated ? 1 : 0.5;
        const shareB = 1 - shareA;
        if (shareA) { a.move(-nx * overlap * shareA, -nz * overlap * shareA); moved.add(a); }
        if (shareB) { b.move(nx * overlap * shareB, nz * overlap * shareB); moved.add(b); }
        any = true;
      }
    }
    if (!any) break;
  }
  for (const npc of moved) npc.syncBody();
}
