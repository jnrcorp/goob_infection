import { NPC } from './npc.js';

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
  { seat: 11, name: 'Marcy', look: look(0xc2b280, 'navy', 0, 'red'), lines: [
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
  { seat: 33, name: 'Walt', look: look(0x8c5a3c, 'khaki', 4, 'grey'), lines: [
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
      name: 'Stan', x: 5.5, y: y2, z: 6.3, mode: 'route',
      route: [{ x: 5.5, z: 6.3 }, { x: 16.6, z: 6.3 }, { x: 16.6, z: 11.9 }, { x: 5.8, z: 11.9 }],
      look: look(0x6e7fa0, 'khaki', 0, 'grey'), lines: [
        "Ten thousand steps a day. I'm at nine thousand nine hundred. Laps.",
      ],
    },
    // 1F
    { name: 'Rhonda', x: 19, y: 0, z: 7.2, yaw: Math.PI, mode: 'type', look: look(0x9a4f9e, 'black', 3, 'dark'), lines: [
      'Front doors lock after hours, hon. Deliveries go out the dock.',
      'Locker room is the first door on the left down the hall.',
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
  ];

  const all = defs.map((d) => new NPC(ctx, d));
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
      separate(all, dt);
    },
  };
}

// Infected crowding the same spot get nudged apart.
const PERSONAL_SPACE = 0.55;
function separate(npcs, dt) {
  for (let i = 0; i < npcs.length; i++) {
    const a = npcs[i];
    if (!a.infected) continue;
    for (let j = i + 1; j < npcs.length; j++) {
      const b = npcs[j];
      if (!b.infected || Math.abs(a.pos.y - b.pos.y) > 1) continue;
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d >= PERSONAL_SPACE || d < 1e-4) continue;
      const push = Math.min((PERSONAL_SPACE - d) * 0.5, 1.5 * dt);
      a.move((-dx / d) * push, (-dz / d) * push);
      b.move((dx / d) * push, (dz / d) * push);
    }
  }
}
