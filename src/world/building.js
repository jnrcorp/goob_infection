// Goob Co. HQ, described as data. Units are meters.
// x runs west→east (0–36), z runs south→north (0–24), y is up.
// Walls are 0.2 m thick, centered on their line. Openings are positioned by
// their center ("at") along the wall.

const win = (at, w = 2.4, sill = 0.9, top = 2.5) => ({ at, w, kind: 'window', sill, top });
const door = (at, label, extra = {}) => ({ at, w: 1, kind: 'door', label, ...extra });
const gap = (at, w) => ({ at, w, kind: 'gap' });
const shutter = (at) => ({ at, w: 4, kind: 'panel', top: 4.5, mat: 'shutter' });
const wall = (x1, z1, x2, z2, opts = {}) => ({ line: [x1, z1, x2, z2], ...opts });

export const DOOR_HEIGHT = 2.2;

export const BUILDING = {
  footprint: { x0: 0, z0: 0, x1: 36, z1: 24 },
  roofY: 7.7,

  floors: [
    {
      id: '1F',
      y: 0,
      wallHeight: 4,
      voids: [],
      walls: [
        // Exterior
        wall(0, 0, 24, 0, {
          openings: [
            win(16, 2, 1, 2.6),
            door(19, 'front entrance', { w: 2.2, mat: 'glass', locked: 'Locked. Deliveries go out through the loading dock.' }),
            win(22.5, 2, 1, 2.6),
          ],
        }),
        wall(24, 0, 36, 0, { h: 7.7 }),
        wall(0, 24, 24, 24),
        wall(24, 24, 36, 24, { h: 7.7 }),
        wall(0, 0, 0, 24, { openings: [win(17, 2), win(21, 2)] }),
        wall(36, 0, 36, 24, { h: 7.7, openings: [shutter(6), shutter(12)] }),
        // Interior
        wall(0, 10, 24, 10, { openings: [door(4, 'locker room door'), door(11, 'restroom door'), gap(19, 3.2)] }),
        wall(8, 0, 8, 10),
        wall(14, 0, 14, 10),
        wall(24, 0, 24, 24, { openings: [door(11.5, 'loading dock door', { w: 2 })] }),
        wall(0, 13, 24, 13, {
          openings: [
            door(6, 'break room door'),
            door(13.5, 'stairwell door'),
            { at: 16.5, w: 1.4, kind: 'elevator' },
            door(21, 'storage door'),
          ],
        }),
        wall(12, 13, 12, 24),
        wall(15, 13, 15, 24),
        wall(18, 13, 18, 24, { openings: [door(20, 'janitor closet door')] }),
        wall(15, 16, 18, 16),
        // Walk-in freezer inside the loading dock
        wall(31, 17, 31, 24, { h: 3.2, mat: 'freezer', openings: [door(20.5, 'freezer door', { w: 1.2, mat: 'freezer' })] }),
        wall(31, 17, 36, 17, { h: 3.2, mat: 'freezer' }),
      ],
      rooms: [
        { id: 'lockers', name: 'Locker Room', rect: { x0: 0, z0: 0, x1: 8, z1: 10 }, floor: 'tile', ceiling: 3 },
        { id: 'restroom1', name: 'Restroom', rect: { x0: 8, z0: 0, x1: 14, z1: 10 }, floor: 'tile', ceiling: 3 },
        { id: 'lobby', name: 'Lobby', rect: { x0: 14, z0: 0, x1: 24, z1: 10 }, floor: 'linoleum', ceiling: 3 },
        { id: 'corridor1', name: 'Corridor', rect: { x0: 0, z0: 10, x1: 24, z1: 13 }, floor: 'linoleum', ceiling: 3 },
        { id: 'breakroom', name: 'Break Room', rect: { x0: 0, z0: 13, x1: 12, z1: 24 }, floor: 'linoleum', ceiling: 3 },
        // No ceiling (it's open to 2F), so no light panels: they'd float over the stairs.
        // Goob can only reach the landing; the rest is under the stairs.
        {
          id: 'stair1', name: 'Stairwell', rect: { x0: 12, z0: 13, x1: 15, z1: 24 }, floor: 'concrete', ceiling: null,
          lightY: 3.4, fixture: null, goobRect: { x0: 12, z0: 13, x1: 15, z1: 15 },
        },
        { id: 'closet', name: 'Janitor Closet', rect: { x0: 15, z0: 16, x1: 18, z1: 24 }, floor: 'concrete', ceiling: 3 },
        { id: 'storage', name: 'Storage', rect: { x0: 18, z0: 13, x1: 24, z1: 24 }, floor: 'concrete', ceiling: 3 },
        {
          id: 'dock', name: 'Loading Dock', rect: { x0: 24, z0: 0, x1: 36, z1: 24 }, floor: 'concrete',
          ceiling: null, lightY: 7, lightRange: 18, lightIntensity: 30, excludeOthers: true,
        },
        {
          id: 'freezer', name: 'Secure Freezer', rect: { x0: 31, z0: 17, x1: 36, z1: 24 }, floor: 'freezerFloor',
          ceiling: null, lightY: 3.18, lightColor: 0xbfe0ff, fixture: 'lightBlue',
        },
      ],
    },
    {
      id: '2F',
      y: 4,
      wallHeight: 3.7,
      slab: { x0: 0, z0: 0, x1: 24, z1: 24 },
      voids: [
        { x0: 12, z0: 13, x1: 15, z1: 21 }, // stair opening
        { x0: 15, z0: 13, x1: 18, z1: 16 }, // elevator shaft
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
        // Core: stairwell, elevator, restroom, kitchenette
        wall(12, 13, 12, 24, { openings: [door(22.5, 'stairwell door')] }),
        wall(15, 13, 15, 24),
        wall(12, 13, 18, 13, { openings: [{ at: 16.5, w: 1.4, kind: 'elevator' }] }),
        wall(15, 16, 18, 16),
        wall(18, 13, 18, 24, { openings: [door(20, 'restroom door')] }),
        wall(18, 16, 24, 16, { openings: [gap(21, 1.2)] }),
      ],
      rooms: [
        { id: 'office', name: 'Open Office', rect: { x0: 0, z0: 0, x1: 24, z1: 24 }, floor: 'carpet', ceiling: 3, excludeOthers: true },
        { id: 'manager', name: "Manager's Office", rect: { x0: 0, z0: 0, x1: 6, z1: 6 }, floor: 'carpetRed', ceiling: 3 },
        { id: 'meeting', name: 'Meeting Room', rect: { x0: 18, z0: 0, x1: 24, z1: 7 }, floor: 'carpet', ceiling: 3 },
        { id: 'kitchen', name: 'Kitchenette', rect: { x0: 18, z0: 16, x1: 24, z1: 24 }, floor: 'linoleum', ceiling: 3 },
        { id: 'restroom2', name: 'Restroom', rect: { x0: 15, z0: 16, x1: 18, z1: 24 }, floor: 'tile', ceiling: 3 },
        { id: 'stair2', name: 'Stairwell', rect: { x0: 12, z0: 21, x1: 15, z1: 24 }, floor: 'concrete', ceiling: null, lightY: 3.3 },
      ],
    },
  ],

  // Straight flight rising north, between the stairwell walls.
  stairs: { x0: 12.1, x1: 14.9, z0: 15, z1: 21, y0: 0, y1: 4, steps: 16 },
  stairwell: { x0: 12, z0: 13, x1: 15, z1: 24 },

  elevator: {
    x0: 15.1, x1: 17.9, z0: 13.1, z1: 15.9,
    doorAt: 16.5, doorW: 1.4, doorZ: 13,
    floors: [0, 4],
    startFloor: 0,
  },

  // Standing behind your chair at your desk on 2F, facing the monitor.
  spawn: { x: 8.15, y: 4, z: 10.7, yaw: 0 },

  // Floor-level air vents, where goob hides after it gets into the ventilation.
  // Position is on the wall face; facing is the direction the vent points
  // (n = +z, s = -z, e = +x, w = -x).
  vents: [
    { x: 7.3, y: 0.35, z: 9.9, facing: 's' },     // locker room
    { x: 13.9, y: 0.35, z: 8, facing: 'w' },      // 1F restroom
    { x: 23.9, y: 0.35, z: 5, facing: 'w' },      // lobby
    { x: 0.1, y: 0.35, z: 12.45, facing: 'e' },   // 1F corridor (beside the water cooler)
    { x: 0.1, y: 0.35, z: 14.5, facing: 'e' },    // break room
    { x: 23.9, y: 0.35, z: 14.5, facing: 'w' },   // storage
    { x: 17.9, y: 0.35, z: 23, facing: 'w' },     // janitor closet
    { x: 35.9, y: 0.35, z: 16, facing: 'w' },     // loading dock
    { x: 0.1, y: 4.35, z: 7.5, facing: 'e' },     // open office, west
    { x: 23.9, y: 4.35, z: 13.5, facing: 'w' },   // open office, east
    { x: 5.9, y: 4.35, z: 1, facing: 'w' },       // manager's office
    { x: 23.9, y: 4.35, z: 6.2, facing: 'w' },    // meeting room
    { x: 18.1, y: 4.35, z: 23, facing: 'e' },     // kitchenette
    { x: 15.1, y: 4.35, z: 21, facing: 'e' },     // 2F restroom
  ],

  // Yellow drums where you empty the vacuum tank. Two per floor.
  bins: [
    { x: 11.8, y: 0, z: 12.45 },  // 1F corridor
    { x: 33.0, y: 0, z: 2.2 },    // loading dock
    { x: 0.55, y: 4, z: 16.1 },   // open office
    { x: 23.35, y: 4, z: 18.3 },  // kitchenette
  ],

  // Rolls of duct tape that patch your hazard suit, sitting on tables, desks
  // and crates.
  ductTape: [
    { x: 4.0, y: 0.47, z: 5.0 },     // locker room bench
    { x: 18.3, y: 0.9, z: 6.3 },     // lobby reception counter
    { x: 8.0, y: 0.76, z: 19.0 },    // break room table
    { x: 21.5, y: 0, z: 14.4 },      // storage floor
    { x: 28.1, y: 1.7, z: 7.05 },    // loading dock crate stack
    { x: 16.8, y: 0, z: 22.0 },      // janitor closet
    { x: 21.0, y: 4.76, z: 3.5 },    // meeting room table
    { x: 20.5, y: 4.76, z: 19.5 },   // kitchenette table
    { x: 2.8, y: 4.76, z: 3.3 },     // manager's desk
    { x: 11.5, y: 5.0, z: 12.3 },    // printer
  ],

  // The containment vacuum hangs on the dock wall beside the freezer door.
  vacuumRack: { x: 30.9, y: 0, z: 18.4 },

  // Where Hank waits to watch you bring the goob out of the freezer.
  hankWatch: [{ x: 30.8, z: 16.5 }, { x: 30.6, z: 19.2 }, { x: 29.3, z: 20.8 }],
};
