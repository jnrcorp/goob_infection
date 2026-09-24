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
        { id: 'stair1', name: 'Stairwell', rect: { x0: 12, z0: 13, x1: 15, z1: 24 }, floor: 'concrete', ceiling: null, lightY: 3.4, fixture: null },
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
};
