// Goob Co. HQ, described as data. Units are meters.
// x runs west→east, z runs south→north, y is up.
// Main building: x 0–36, z 0–24. Floors: B1 (y −4), 1F (0), 2F (4), 3F (8).
// Walls are 0.2 m thick, centered on their line. Openings are positioned by
// their center ("at") along the wall.

const win = (at, w = 2.4, sill = 0.9, top = 2.5) => ({ at, w, kind: 'window', sill, top });
const door = (at, label, extra = {}) => ({ at, w: 1, kind: 'door', label, ...extra });
const gap = (at, w) => ({ at, w, kind: 'gap' });
const lift = (at) => ({ at, w: 1.4, kind: 'elevator' });
const shutter = (at) => ({ at, w: 4, kind: 'panel', top: 4.5, mat: 'shutter' });
const wall = (x1, z1, x2, z2, opts = {}) => ({ line: [x1, z1, x2, z2], ...opts });
// Outdoor perimeter wall: concrete, chest-high-plus, with its top drawn (you
// can see it from upstairs windows).
const fence = (x1, z1, x2, z2, opts = {}) => wall(x1, z1, x2, z2, { h: 2.6, mat: 'concrete', showTop: true, ...opts });

// The stairwell (x 12–15, z 13–24) is the same on every floor: a center wall
// splits it into two lanes; flights switch back between landings at the south
// (z 13–15) and north (z 21–24) ends. (First entry: the west wall, which some
// floors replace with a version that has a door.)
const stairwellWalls = [
  wall(12, 13, 12, 24),
  wall(15, 13, 15, 24),
  wall(13.5, 15, 13.5, 21),
];

const BUILDING_STAIRWELL = { x0: 12, z0: 13, x1: 15, z1: 24 };

// Outdoor area settings: sparse goob spots and a few tall sodium lamps.
const OUTDOOR = {
  floor: 'asphalt', ceiling: null, fixture: null, outdoor: true,
  lightY: 6, lightRange: 20, lightIntensity: 34, lightColor: 0xffc68a, lightSpacing: 16, goobSpacing: 2.6,
};

export const DOOR_HEIGHT = 2.2;

export const BUILDING = {
  footprint: { x0: 0, z0: 0, x1: 36, z1: 24 },
  // One-story wing off the west end of the 1F corridor (the storage room).
  annex: { x0: -7, z0: 8, x1: 0, z1: 16, roofY: 4 },
  // Roofs: over the loading dock (double height) and over the 3-story office block.
  roofs: [
    { x0: 24, z0: 0, x1: 36, z1: 24, y: 7.7 },
    { x0: 0, z0: 0, x1: 24, z1: 24, y: 11.7 },
  ],
  // Outdoor ground you can walk on (parking lot and loading yard).
  grounds: [
    { x0: -8, z0: -16, x1: 36, z1: 0 },
    { x0: 36, z0: -16, x1: 50, z1: 28 },
  ],

  floors: [
    // ---------------------------------------------------------------- B1
    {
      id: 'B1',
      y: -4,
      wallHeight: 4,
      slab: { x0: 0, z0: 10, x1: 24, z1: 24 },
      voids: [],
      walls: [
        wall(0, 10, 24, 10),
        wall(0, 24, 24, 24),
        wall(0, 10, 0, 24),
        wall(24, 10, 24, 24),
        wall(3, 13, 24, 13, { openings: [lift(16.5), door(21, 'goob lab door')] }),
        wall(3, 13, 3, 21, { openings: [door(17, 'server room door')] }),
        wall(3, 21, 12, 21),
        ...stairwellWalls.slice(1),
        wall(12, 13, 12, 24, { openings: [door(22.5, 'stairwell door')] }),
        wall(12, 21, 13.5, 21), // closes off the space under the stairs
        wall(15, 16, 18, 16),
        wall(18, 13, 18, 24, { openings: [door(20, 'vat room door')] }),
      ],
      rooms: [
        { id: 'hallS', name: 'Basement Hall', rect: { x0: 0, z0: 10, x1: 24, z1: 13 }, floor: 'concrete', ceiling: 3 },
        { id: 'hallW', name: 'Basement Hall', rect: { x0: 0, z0: 13, x1: 3, z1: 21 }, floor: 'concrete', ceiling: 3 },
        { id: 'hallN', name: 'Basement Hall', rect: { x0: 0, z0: 21, x1: 12, z1: 24 }, floor: 'concrete', ceiling: 3 },
        { id: 'server', name: 'Server Room', rect: { x0: 3, z0: 13, x1: 12, z1: 21 }, floor: 'freezerFloor', ceiling: 3, lightColor: 0xc8dcff },
        { id: 'lab', name: 'Goob Lab', rect: { x0: 18, z0: 13, x1: 24, z1: 24 }, floor: 'tile', ceiling: 3, lightColor: 0xdcffd4 },
        { id: 'vats', name: 'Vat Room', rect: { x0: 15, z0: 16, x1: 18, z1: 24 }, floor: 'concrete', ceiling: 3, lightColor: 0xb8ffa8 },
        {
          id: 'stairB1', name: 'Stairwell', rect: { x0: 12, z0: 21, x1: 15, z1: 24 }, floor: 'concrete', ceiling: null,
          lightY: 3.4, fixture: null,
        },
      ],
    },
    // ---------------------------------------------------------------- 1F
    {
      id: '1F',
      y: 0,
      wallHeight: 4,
      slab: { x0: 0, z0: 0, x1: 36, z1: 24 },
      voids: [
        { x0: 13.5, z0: 15, x1: 15, z1: 21 }, // stairs down to B1
        { x0: 15, z0: 13, x1: 18, z1: 16 },   // elevator shaft
      ],
      walls: [
        // Exterior
        wall(0, 0, 24, 0, {
          openings: [win(16, 2, 1, 2.6), door(19, 'front entrance', { w: 2.2, mat: 'glass' }), win(22.5, 2, 1, 2.6)],
        }),
        wall(24, 0, 36, 0, { h: 7.7 }),
        wall(0, 24, 24, 24),
        wall(24, 24, 36, 24, { h: 7.7 }),
        wall(0, 0, 0, 24, { openings: [door(11.3, 'storage door', { w: 1.2 }), win(17, 2), win(21, 2)] }),
        wall(36, 0, 36, 24, { h: 7.7, openings: [shutter(6), shutter(12), door(15.5, 'yard door', { w: 1.2, mat: 'steel' })] }),
        // Storage annex
        wall(-7, 8, 0, 8),
        wall(-7, 16, 0, 16),
        wall(-7, 8, -7, 16),
        // Interior
        wall(0, 10, 24, 10, { openings: [door(4, 'locker room door'), door(11, 'restroom door'), gap(19, 3.2)] }),
        wall(8, 0, 8, 10),
        wall(14, 0, 14, 10),
        wall(21, 6, 21, 10, { openings: [door(8, 'mail room door')] }),
        wall(21, 6, 24, 6),
        wall(24, 0, 24, 24, { openings: [door(11.5, 'loading dock door', { w: 2 })] }),
        wall(0, 13, 24, 13, {
          openings: [door(6, 'break room door'), door(13.5, 'stairwell door'), lift(16.5), door(21, 'infirmary door')],
        }),
        ...stairwellWalls,
        wall(18, 13, 18, 24, { openings: [door(20, 'janitor closet door')] }),
        wall(15, 16, 18, 16),
        // Walk-in freezer inside the loading dock
        wall(31, 17, 31, 24, { h: 3.2, mat: 'freezer', openings: [door(20.5, 'freezer door', { w: 1.2, mat: 'freezer' })] }),
        wall(31, 17, 36, 17, { h: 3.2, mat: 'freezer' }),
        // Outdoor perimeter
        fence(-8, -16, 50, -16, {
          openings: [door(14, 'front gate', { w: 3, mat: 'metal', locked: "The gate's chained shut. Nobody leaves until the goob is sorted." })],
        }),
        fence(50, -16, 50, 28),
        fence(36, 28, 50, 28),
        fence(-8, -16, -8, 0),
        fence(-8, 0, 0, 0),
        fence(36, 24, 36, 28),
      ],
      rooms: [
        { id: 'lockers', name: 'Locker Room', rect: { x0: 0, z0: 0, x1: 8, z1: 10 }, floor: 'tile', ceiling: 3 },
        { id: 'restroom1', name: 'Restroom', rect: { x0: 8, z0: 0, x1: 14, z1: 10 }, floor: 'tile', ceiling: 3 },
        { id: 'lobby', name: 'Lobby', rect: { x0: 14, z0: 0, x1: 24, z1: 10 }, floor: 'linoleum', ceiling: 3, minus: [{ x0: 21, z0: 6, x1: 24, z1: 10 }] },
        { id: 'mail', name: 'Mail Room', rect: { x0: 21, z0: 6, x1: 24, z1: 10 }, floor: 'linoleum', ceiling: 3 },
        { id: 'corridor1', name: 'Corridor', rect: { x0: 0, z0: 10, x1: 24, z1: 13 }, floor: 'linoleum', ceiling: 3 },
        { id: 'breakroom', name: 'Break Room', rect: { x0: 0, z0: 13, x1: 12, z1: 24 }, floor: 'linoleum', ceiling: 3 },
        // No ceiling (it's open to the floors above), so no light panels.
        // Goob can only reach the landing; the rest is stairs.
        {
          id: 'stair1', name: 'Stairwell', rect: { x0: 12, z0: 13, x1: 15, z1: 24 }, floor: 'concrete', ceiling: null,
          lightY: 3.4, fixture: null, goobRect: { x0: 12, z0: 13, x1: 15, z1: 15 },
        },
        { id: 'closet', name: 'Janitor Closet', rect: { x0: 15, z0: 16, x1: 18, z1: 24 }, floor: 'concrete', ceiling: 3 },
        { id: 'infirmary', name: 'Infirmary', rect: { x0: 18, z0: 13, x1: 24, z1: 24 }, floor: 'tile', ceiling: 3 },
        { id: 'storage', name: 'Storage', rect: { x0: -7, z0: 8, x1: 0, z1: 16 }, floor: 'concrete', ceiling: 3 },
        {
          id: 'dock', name: 'Loading Dock', rect: { x0: 24, z0: 0, x1: 36, z1: 24 }, floor: 'concrete',
          ceiling: null, lightY: 7, lightRange: 18, lightIntensity: 30, minus: [{ x0: 31, z0: 17, x1: 36, z1: 24 }],
        },
        {
          id: 'freezer', name: 'Secure Freezer', rect: { x0: 31, z0: 17, x1: 36, z1: 24 }, floor: 'freezerFloor',
          ceiling: null, lightY: 3.18, lightColor: 0xbfe0ff, fixture: 'lightBlue',
        },
        { id: 'lot', name: 'Parking Lot', rect: { x0: -8, z0: -16, x1: 36, z1: 0 }, ...OUTDOOR },
        { id: 'yard', name: 'Loading Yard', rect: { x0: 36, z0: -16, x1: 50, z1: 28 }, ...OUTDOOR },
      ],
    },
    // ---------------------------------------------------------------- 2F
    {
      id: '2F',
      y: 4,
      wallHeight: 4,
      slab: { x0: 0, z0: 0, x1: 24, z1: 24 },
      voids: [
        { x0: 12, z0: 13, x1: 13.5, z1: 21 }, // stairs down to 1F
        { x0: 15, z0: 13, x1: 18, z1: 16 },   // elevator shaft
      ],
      walls: [
        // Exterior
        wall(0, 0, 24, 0, { openings: [win(3), win(9), win(15), win(21)] }),
        wall(0, 24, 24, 24, { openings: [win(3), win(7.5), win(21)] }),
        wall(0, 0, 0, 24, { openings: [win(3), win(9.5), win(17), win(21)] }),
        // Interior windows overlooking the loading dock
        wall(24, 0, 24, 24, { openings: [win(3.5), win(10), win(20.5)] }),
        // Manager's office
        wall(6, 0, 6, 6, { openings: [door(4.5, "manager's door")] }),
        wall(0, 6, 6, 6, { openings: [win(2.5, 3, 1, 2.4)] }),
        // Meeting room
        wall(18, 0, 18, 7, { openings: [door(5.5, 'meeting room door')] }),
        wall(18, 7, 24, 7, { openings: [win(21, 3, 1, 2.4)] }),
        // Copy room and IT closet (east side, with a short hall to the kitchenette)
        wall(18, 7, 18, 11, { openings: [door(9, 'copy room door')] }),
        wall(18, 11, 24, 11),
        wall(20, 11, 20, 16, { openings: [door(13.5, 'IT closet door')] }),
        // Conference room, across from the stairwell door
        wall(10, 19, 10, 24, { openings: [door(22.5, 'conference room door')] }),
        wall(0, 19, 10, 19, { openings: [win(5, 3, 1, 2.4)] }),
        // Core: stairwell, elevator, restroom, kitchenette
        ...stairwellWalls.slice(1),
        wall(12, 13, 12, 24, { openings: [door(22.5, 'stairwell door')] }),
        wall(12, 13, 18, 13, { openings: [lift(16.5)] }),
        wall(15, 16, 18, 16),
        wall(18, 13, 18, 24, { openings: [door(20, 'restroom door')] }),
        wall(18, 16, 24, 16, { openings: [gap(19, 1.2)] }),
      ],
      rooms: [
        {
          id: 'office', name: 'Open Office', rect: { x0: 0, z0: 0, x1: 24, z1: 24 }, floor: 'carpet', ceiling: 3,
          excludeOthers: true, minus: [BUILDING_STAIRWELL],
        },
        { id: 'manager', name: "Manager's Office", rect: { x0: 0, z0: 0, x1: 6, z1: 6 }, floor: 'carpetRed', ceiling: 3 },
        { id: 'meeting', name: 'Meeting Room', rect: { x0: 18, z0: 0, x1: 24, z1: 7 }, floor: 'carpet', ceiling: 3 },
        { id: 'copy', name: 'Copy Room', rect: { x0: 18, z0: 7, x1: 24, z1: 11 }, floor: 'linoleum', ceiling: 3 },
        { id: 'it', name: 'IT Closet', rect: { x0: 20, z0: 11, x1: 24, z1: 16 }, floor: 'concrete', ceiling: 3, lightColor: 0xc8dcff },
        { id: 'conference', name: 'Conference Room', rect: { x0: 0, z0: 19, x1: 10, z1: 24 }, floor: 'carpetRed', ceiling: 3 },
        { id: 'kitchen', name: 'Kitchenette', rect: { x0: 18, z0: 16, x1: 24, z1: 24 }, floor: 'linoleum', ceiling: 3 },
        { id: 'restroom2', name: 'Restroom', rect: { x0: 15, z0: 16, x1: 18, z1: 24 }, floor: 'tile', ceiling: 3 },
        { id: 'stair2', name: 'Stairwell', rect: { x0: 12, z0: 21, x1: 15, z1: 24 }, floor: 'concrete', ceiling: null, lightY: 3.3, fixture: null },
      ],
    },
    // ---------------------------------------------------------------- 3F
    {
      id: '3F',
      y: 8,
      wallHeight: 3.7,
      slab: { x0: 0, z0: 0, x1: 24, z1: 24 },
      voids: [
        { x0: 13.5, z0: 15, x1: 15, z1: 21 }, // stairs down to 2F
        { x0: 15, z0: 13, x1: 18, z1: 16 },   // elevator shaft
      ],
      walls: [
        // Exterior
        wall(0, 0, 24, 0, { openings: [win(3), win(7), win(12), win(17), win(21)] }),
        wall(0, 24, 24, 24, { openings: [win(3), win(9), win(18), win(21.5)] }),
        wall(0, 0, 0, 24, { openings: [win(4), win(10.5), win(20)] }),
        wall(24, 0, 24, 24, { openings: [win(4), win(10.5), win(18), win(22)] }),
        // CEO's office and boardroom (south corners)
        wall(10, 0, 10, 8, { openings: [door(4.5, "CEO's door")] }),
        wall(0, 8, 10, 8, { openings: [win(5, 3, 1, 2.4)] }),
        wall(14, 0, 14, 8, { openings: [door(5, 'boardroom door')] }),
        wall(14, 8, 24, 8, { openings: [win(19, 3, 1, 2.4)] }),
        // Records room (northwest)
        wall(0, 16, 12, 16, { openings: [door(6, 'records room door')] }),
        // Core
        ...stairwellWalls,
        wall(12, 15, 13.5, 15), // closes off the space beside the landing
        wall(12, 13, 24, 13, { openings: [door(13.5, 'stairwell door'), lift(16.5), door(21, 'lounge door')] }),
        wall(15, 16, 18, 16),
        wall(18, 13, 18, 16),
      ],
      rooms: [
        {
          id: 'exec', name: 'Executive Floor', rect: { x0: 0, z0: 0, x1: 24, z1: 24 }, floor: 'carpet', ceiling: 3,
          excludeOthers: true, minus: [BUILDING_STAIRWELL],
        },
        { id: 'ceo', name: "CEO's Office", rect: { x0: 0, z0: 0, x1: 10, z1: 8 }, floor: 'carpetRed', ceiling: 3 },
        { id: 'boardroom', name: 'Boardroom', rect: { x0: 14, z0: 0, x1: 24, z1: 8 }, floor: 'carpetRed', ceiling: 3 },
        { id: 'records', name: 'Records Room', rect: { x0: 0, z0: 16, x1: 12, z1: 24 }, floor: 'carpet', ceiling: 3 },
        { id: 'lounge', name: 'Executive Lounge', rect: { x0: 15, z0: 13, x1: 24, z1: 24 }, floor: 'linoleum', ceiling: 3 },
        { id: 'stair3', name: 'Stairwell', rect: { x0: 12, z0: 13, x1: 15, z1: 15 }, floor: 'concrete', ceiling: null, lightY: 3.3, fixture: null },
      ],
    },
  ],

  // Switchback flights in the stairwell. rises: which way is up.
  flights: [
    { x0: 13.6, x1: 14.9, z0: 15, z1: 21, yLow: -4, yHigh: 0, rises: 's', steps: 16 }, // B1 -> 1F
    { x0: 12.1, x1: 13.4, z0: 15, z1: 21, yLow: 0, yHigh: 4, rises: 'n', steps: 16 },  // 1F -> 2F
    { x0: 13.6, x1: 14.9, z0: 15, z1: 21, yLow: 4, yHigh: 8, rises: 's', steps: 16 },  // 2F -> 3F
  ],
  stairwell: BUILDING_STAIRWELL,

  elevator: {
    x0: 15.1, x1: 17.9, z0: 13.1, z1: 15.9,
    doorAt: 16.5, doorW: 1.4, doorZ: 13,
    floors: [-4, 0, 4, 8],
    floorNames: ['B1', '1F', '2F', '3F'],
    startFloor: 1,
  },

  // Standing behind your chair at your desk on 2F, facing the monitor.
  spawn: { x: 8.15, y: 4, z: 10.7, yaw: 0 },

  // Floor-level air vents, where goob hides after it gets into the ventilation.
  // Position is on the wall face; facing is the direction the vent points
  // (n = +z, s = -z, e = +x, w = -x).
  vents: [
    // B1
    { x: 0.1, y: -3.65, z: 11.5, facing: 'e' },   // basement hall
    { x: 3.1, y: -3.65, z: 14.5, facing: 'e' },   // server room
    { x: 23.9, y: -3.65, z: 18, facing: 'w' },    // goob lab
    { x: 15.1, y: -3.65, z: 22.5, facing: 'e' },  // vat room
    // 1F
    { x: 7.3, y: 0.35, z: 9.9, facing: 's' },     // locker room
    { x: 13.9, y: 0.35, z: 8, facing: 'w' },      // 1F restroom
    { x: 23.9, y: 0.35, z: 3, facing: 'w' },      // lobby
    { x: 23.9, y: 0.35, z: 8.8, facing: 'w' },    // mail room
    { x: 0.1, y: 0.35, z: 12.45, facing: 'e' },   // 1F corridor (beside the water cooler)
    { x: 0.1, y: 0.35, z: 14.5, facing: 'e' },    // break room
    { x: 23.9, y: 0.35, z: 14.5, facing: 'w' },   // infirmary
    { x: -5.7, y: 0.35, z: 8.1, facing: 'n' },    // storage annex
    { x: 17.9, y: 0.35, z: 23, facing: 'w' },     // janitor closet
    { x: 35.9, y: 0.35, z: 9, facing: 'w' },      // loading dock (between the shutters)
    // 2F
    { x: 0.1, y: 4.35, z: 7.5, facing: 'e' },     // open office, west
    { x: 21.2, y: 4.35, z: 10.9, facing: 's' },   // copy room
    { x: 23.9, y: 4.35, z: 14.5, facing: 'w' },   // IT closet
    { x: 5.9, y: 4.35, z: 1, facing: 'w' },       // manager's office
    { x: 23.9, y: 4.35, z: 6.2, facing: 'w' },    // meeting room
    { x: 18.1, y: 4.35, z: 23, facing: 'e' },     // kitchenette
    { x: 15.1, y: 4.35, z: 21, facing: 'e' },     // 2F restroom
    { x: 0.1, y: 4.35, z: 23.2, facing: 'e' },    // conference room
    // 3F
    { x: 0.1, y: 8.35, z: 11, facing: 'e' },      // executive floor
    { x: 0.1, y: 8.35, z: 6.3, facing: 'e' },     // CEO's office
    { x: 23.9, y: 8.35, z: 6.5, facing: 'w' },    // boardroom
    { x: 0.1, y: 8.35, z: 22.5, facing: 'e' },    // records room
    { x: 23.9, y: 8.35, z: 21.5, facing: 'w' },   // executive lounge
  ],

  // Yellow drums where you empty the vacuum tank.
  bins: [
    { x: 11.8, y: 0, z: 12.45 },  // 1F corridor
    { x: 33.0, y: 0, z: 2.2 },    // loading dock
    { x: 0.55, y: 4, z: 16.1 },   // open office
    { x: 23.35, y: 4, z: 18.3 },  // kitchenette
    { x: 22.9, y: -4, z: 11.4 },  // basement hall
    { x: 1.0, y: 8, z: 12.6 },    // executive floor
  ],

  // Rolls of duct tape that patch your hazard suit, sitting on tables, desks
  // and crates.
  ductTape: [
    { x: 4.0, y: 0.47, z: 5.0 },     // locker room bench
    { x: 18.3, y: 0.9, z: 6.3 },     // lobby reception counter
    { x: 8.0, y: 0.76, z: 19.0 },    // break room table
    { x: 21.5, y: 0, z: 14.4 },      // infirmary floor
    { x: -2.2, y: 0, z: 14.4 },      // storage floor
    { x: 28.1, y: 1.7, z: 7.05 },    // loading dock crate stack
    { x: 16.8, y: 0, z: 22.0 },      // janitor closet
    { x: 22.2, y: 0.9, z: 6.5 },     // mail room counter
    { x: 21.0, y: 4.76, z: 3.5 },    // meeting room table
    { x: 20.5, y: 4.76, z: 19.5 },   // kitchenette table
    { x: 2.8, y: 4.76, z: 3.3 },     // manager's desk
    { x: 11.5, y: 5.0, z: 12.3 },    // printer
    { x: 7.2, y: 4.76, z: 21.1 },    // conference table
    { x: 22.7, y: 5.1, z: 7.7 },     // copier
    { x: 21.0, y: -3.1, z: 17.5 },   // goob lab bench
    { x: 5.0, y: -4, z: 20.3 },      // server room floor
    { x: 19.0, y: 8.76, z: 4.0 },    // boardroom table
    { x: 23.4, y: 8.9, z: 17.0 },    // lounge bar
    { x: 5.0, y: 8.0, z: 17.2 },     // records room floor
    { x: 5.5, y: 0.47, z: -0.6 },    // parking lot bench
    { x: 45.3, y: 0, z: 20.0 },      // loading yard, by the pallets
  ],

  // The antidote sprayer waits on the infirmary counter.
  antidote: { x: 20.4, y: 0.9, z: 23.6 },

  // The containment vacuum hangs on the dock wall beside the freezer door.
  vacuumRack: { x: 30.9, y: 0, z: 18.4 },

  // Where Hank waits to watch you bring the goob out of the freezer.
  hankWatch: [{ x: 30.8, z: 16.5 }, { x: 30.6, z: 19.2 }, { x: 29.3, z: 20.8 }],
};
