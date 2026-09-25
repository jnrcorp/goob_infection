import * as THREE from 'three';
import { PS1Renderer, ps1Settings } from './render/ps1.js';
import { createMaterials } from './render/materials.js';
import { CollisionWorld } from './world/collision.js';
import { Interactions } from './world/interaction.js';
import { buildBuilding } from './world/buildBuilding.js';
import { createCast } from './npc/cast.js';
import { Player } from './player/player.js';
import { Viewmodel } from './player/viewmodel.js';
import { Vacuum } from './player/vacuum.js';
import { GoobGraph } from './goob/goobGraph.js';
import { GoobSystem } from './goob/goobSystem.js';
import { Navigation } from './npc/navigation.js';
import { Spill } from './story/spill.js';
import { Chapter1 } from './story/chapter1.js';
import { Input } from './core/input.js';
import { DIFFICULTIES, settings, saveSettings, difficulty } from './core/settings.js';
import { Hud } from './ui/hud.js';
import { Dialogue } from './ui/dialogue.js';
import { ScreenFx } from './ui/screenFx.js';

const canvas = document.getElementById('game');
const screens = {
  title: document.getElementById('title'),
  pause: document.getElementById('pause'),
  ready: document.getElementById('ready'),
  breached: document.getElementById('breached'),
  tbc: document.getElementById('tbc'),
  quit: document.getElementById('quit'),
};

// ---------- Setup ----------
const ps1 = new PS1Renderer(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#3a4150');
scene.fog = new THREE.Fog('#16181b', 10, 42);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 90);

const input = new Input(canvas);
const hud = new Hud();
const dialogue = new Dialogue();
const fx = new ScreenFx();
const collision = new CollisionWorld();
const materials = createMaterials(ps1.renderer.capabilities.getMaxAnisotropy());
const interactions = new Interactions(camera, collision, hud);
const ctx = { scene, collision, materials, interactions, hud };
const world = buildBuilding(ctx);
const cast = createCast(ctx, world.props);
const player = new Player(camera, collision);
const viewmodel = new Viewmodel(materials);

// Spots link through doorways whether the door is open or not (a shut door
// then blocks spreading or walking along that link), and people never block.
const goobPassable = new Set([
  ...world.doors.flatMap((d) => [d.collider, d.openCollider]),
  ...world.elevator.doors.map((d) => d.collider),
  ...cast.all.map((n) => n.collider),
]);
const peopleColliders = cast.all.map((n) => n.collider);
const goobGraph = new GoobGraph(collision, goobPassable, {
  // Shut doors (including the elevator's) stop goob spreading between rooms.
  doors: [...world.doors.map((d) => d.collider), ...world.elevator.doors.map((d) => d.collider)],
  people: new Set(peopleColliders),
}).build(world);
const goob = new GoobSystem(scene, goobGraph, collision);

// Infected walk through each other but not through doors (they can't open
// them), and see through each other and past open door panels.
const sightIgnore = new Set([...peopleColliders, ...world.doors.map((d) => d.openCollider)]);
const vacuum = new Vacuum({ viewmodel, hud, scene, collision, sightIgnore });
const spill = new Spill({ scene, materials, player, camera, viewmodel, goob, fx, hud, world, cast });
const chapter = new Chapter1({
  ctx, world, player, cast, hud, dialogue, interactions, fx, goob, graph: goobGraph, vacuum, spill,
  onEnd: endChapter, onBreach: suitBreached,
});
cast.setEnv({
  player,
  nav: new Navigation(goobGraph),
  collision,
  moveIgnore: new Set(peopleColliders),
  sightIgnore,
  isHostile: () => chapter.hostile,
  isNoisy: () => vacuum.noisy > 0,
  attackers: () => cast.all.filter((n) => n.brain && (n.brain.state === 'windup' || n.brain.state === 'recover')).length,
  onHit: (npc) => { if (!params.has('peaceful')) chapter.hurtPlayer(npc); },
  canOpenDoors: () => difficulty().infectedOpenDoors,
  openDoorsNear: (npc) => world.openDoorsNear(npc),
});
let gameTime = 0;

// ---------- Menus ----------
// 'title' | 'playing' | 'paused' | 'ended' | 'quit'. Gameplay runs while the pointer is locked.
let state = 'title';

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  screens[name]?.querySelector('button')?.focus();
}

function goToTitle() {
  state = 'title';
  showScreen('title');
}

function endChapter({ title, text, hint } = {}) {
  state = 'ended';
  if (document.pointerLockElement) document.exitPointerLock();
  document.getElementById('tbc-title').textContent = title ?? 'To be continued';
  document.getElementById('tbc-text').textContent = text ?? '';
  document.getElementById('tbc-hint').textContent = hint ?? '';
  showScreen('tbc');
}

function suitBreached() {
  state = 'ended';
  if (document.pointerLockElement) document.exitPointerLock();
  document.getElementById('breach-retry').hidden = !chapter.hasCheckpoint;
  showScreen('breached');
}

input.onLockChange = (locked) => {
  if (locked) {
    state = 'playing';
    showScreen(null);
  } else if (state === 'playing') {
    state = 'paused';
    showScreen('pause');
  }
};

document.getElementById('menu-play').addEventListener('click', () => {
  chapter.start();
  input.lock();
});
document.getElementById('pause-resume').addEventListener('click', () => input.lock());

// Difficulty button on the title screen: switches between the options and
// remembers the choice.
const difficultyButton = document.getElementById('menu-difficulty');
function showDifficulty() {
  difficultyButton.textContent = `Difficulty: ${difficulty().label}`;
  document.getElementById('difficulty-note').textContent = difficulty().description;
}
difficultyButton.addEventListener('click', () => {
  const keys = Object.keys(DIFFICULTIES);
  settings.difficulty = keys[(keys.indexOf(settings.difficulty) + 1) % keys.length];
  saveSettings();
  showDifficulty();
});
showDifficulty();
document.getElementById('ready-play').addEventListener('click', () => input.lock());
document.getElementById('breach-retry').addEventListener('click', () => {
  chapter.restoreCheckpoint();
  if (noLock) {
    state = 'playing';
    showScreen(null);
    return;
  }
  state = 'paused'; // the next successful mouse capture resumes play
  input.lock();
});
document.getElementById('breach-title').addEventListener('click', goToTitle);
// Right mouse is the vacuum blast, so no context menu over the game.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => { if (input.locked) e.preventDefault(); });
// If the browser refuses to capture the mouse (it does for about a second
// after Esc), ask for one more click instead of silently doing nothing.
input.onLockError = () => {
  if (state === 'title' || state === 'paused') showScreen('ready');
};
document.getElementById('pause-title').addEventListener('click', goToTitle);
document.getElementById('tbc-title').addEventListener('click', goToTitle);
document.getElementById('quit-back').addEventListener('click', goToTitle);
document.getElementById('menu-quit').addEventListener('click', () => {
  // Browsers only let scripts close tabs they opened, so fall back to a goodbye screen.
  window.close();
  state = 'quit';
  showScreen('quit');
});

// Arrow keys move between menu options; Enter/Space activate the focused one.
window.addEventListener('keydown', (e) => {
  if (state === 'playing' || !['ArrowUp', 'ArrowDown'].includes(e.code)) return;
  const menu = Object.values(screens).find((el) => !el.hidden)?.querySelector('.menu');
  if (!menu) return;
  const buttons = [...menu.querySelectorAll('button')];
  const i = buttons.indexOf(document.activeElement);
  const next = e.code === 'ArrowDown' ? i + 1 : i - 1;
  buttons[(next + buttons.length) % buttons.length].focus();
  e.preventDefault();
});

// ---------- Debug ----------
// Backquote (`) toggles the readout. While it's on: N toggles noclip,
// 1 toggles vertex wobble, 2 toggles dithering, G removes all goob.
// URL options:
//   ?debug          start with the readout on
//   ?shot           skip the title screen (for screenshots)
//   ?stage=NAME     skip ahead: TO_LOCKERS, TO_FREEZER, GET_VACUUM or CLEANUP
//   ?goobspots      show every spot goob can spread to
//   ?peaceful       infected still chase but their hits do nothing (for testing)
//   ?report=Name    after the simulation, log open doors and where Name is
//   ?difficulty=hard   play on a difficulty without changing the saved setting
//   ?at=x,y,z,yaw,pitch   start at a position (angles in degrees)
//   ?sim=seconds    fast-forward the game at load
//   ?nolock         act as if the mouse is captured (for automated testing)
//   ?keys=KeyE:0,KeyW:2   after ?sim, tap E then hold W for 2 s (?after=N runs N s more)
const params = new URLSearchParams(location.search);
let debug = params.has('debug');
const noLock = params.has('nolock');
if (DIFFICULTIES[params.get('difficulty')]) {
  settings.difficulty = params.get('difficulty'); // for this visit only, not saved
  showDifficulty();
}

chapter.start();
if (params.has('stage')) chapter.skipTo(params.get('stage'));
const at = params.get('at')?.split(',').map(Number);
if (at?.length >= 3 && at.every(Number.isFinite)) {
  player.spawn({ x: at[0], y: at[1], z: at[2], yaw: THREE.MathUtils.degToRad(at[3] ?? 0) });
  player.pitch = THREE.MathUtils.degToRad(at[4] ?? 0);
  player.updateCamera();
}
if (params.has('shot')) {
  state = 'playing';
  showScreen(null);
} else {
  showScreen('title');
}
if (params.has('goobspots')) {
  const positions = goobGraph.nodes.flatMap((n) => [n.pos.x, n.pos.y + 0.1, n.pos.z]);
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xff40ff, size: 0.15 })));
  // Count connected groups: goob can only spread within a group.
  const seen = new Set();
  const groups = [];
  for (const start of goobGraph.nodes) {
    if (seen.has(start)) continue;
    const group = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const n = queue.pop();
      group.push(n);
      for (const m of n.links) if (!seen.has(m)) { seen.add(m); queue.push(m); }
    }
    groups.push(group);
  }
  groups.sort((a, b) => b.length - a.length);
  console.log(`[goobspots] ${goobGraph.nodes.length} spots in ${groups.length} connected groups: ${groups.map((g) => g.length).join(', ')}`);
  const doorLinks = goobGraph.nodes.reduce((sum, n) => sum + n.doorsTo.size, 0) / 2;
  const clearances = goobGraph.nodes.map((n) => n.clearance).sort((a, b) => a - b);
  console.log(`[goobspots] ${doorLinks} links pass through doors; spot clearance min ${clearances[0].toFixed(2)} m, median ${clearances[clearances.length >> 1].toFixed(2)} m`);
  const nav = new Navigation(goobGraph);
  const route = nav.path(nav.nearest(new THREE.Vector3(8.15, 4, 10.7)), nav.nearest(new THREE.Vector3(30, 0, 20.5)));
  console.log(`[goobspots] walking route from your desk to the freezer door: ${route ? `${route.length} steps via ${route.filter((p) => p.y > 0.3 && p.y < 3.7).length} on the stairs` : 'NONE'}`);
  for (const g of groups.slice(1)) console.log(`[goobspots] separate group at ${g.slice(0, 3).map((n) => `${n.kind}(${n.pos.x.toFixed(1)},${n.pos.y.toFixed(1)},${n.pos.z.toFixed(1)})`).join(' ')}`);
}

// ---------- Loop ----------
function resize() {
  ps1.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  viewmodel.setAspect(camera.aspect);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let fps = 0;

// ?sim=seconds fast-forwards the game at load (for testing story flow).
// ?press=KeyE&after=2 then presses a key and fast-forwards some more.
async function simulate(seconds) {
  for (let t = 0; t < seconds; t += 1 / 30) {
    scene.updateMatrixWorld(); // normally done by render; raycasts need it
    step(1 / 30);
    input.endFrame();
    await null; // let story sequences (async/await) advance
  }
}

// ?keys=KeyE:0,KeyW:2 taps E, then holds W for 2 seconds (after ?sim).
async function runStartupSimulation() {
  await simulate(Number(params.get('sim')) || 0);
  for (const step of (params.get('keys') ?? '').split(',').filter(Boolean)) {
    const [code, seconds] = step.split(':');
    // Mouse buttons (Mouse0) are pressed directly; keys go through real events.
    const mouse = code.startsWith('Mouse');
    if (mouse) {
      input.keys.add(code);
      input.pressed.add(code);
    } else {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    }
    await simulate(Math.max(1 / 30, Number(seconds) || 0));
    if (mouse) input.keys.delete(code);
    else window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    await simulate(1 / 30);
  }
  await simulate(Number(params.get('after')) || 0);
  if (params.has('report')) {
    const npc = cast.all.find((n) => n.name === params.get('report'));
    const open = world.doors.filter((d) => d.isOpen).map((d) => d.label);
    console.log(`[report] open doors: ${open.join(', ') || 'none'}`);
    if (npc) console.log(`[report] ${npc.name} at ${npc.pos.x.toFixed(1)}, ${npc.pos.y.toFixed(1)}, ${npc.pos.z.toFixed(1)} (${npc.brain?.state ?? npc.mode})`);
  }
  // ?click=id1,id2 clicks buttons by id (for testing menus).
  for (const id of (params.get('click') ?? '').split(',').filter(Boolean)) {
    document.getElementById(id)?.click();
    console.log(`[click] ${id} -> state ${state}, visible screen: ${Object.keys(screens).find((k) => !screens[k].hidden) ?? 'none'}`);
    await simulate(0.2);
  }
}

runStartupSimulation().then(() => {
  clock.getDelta();
  ps1.renderer.setAnimationLoop(() => {
    step(Math.min(clock.getDelta(), 0.05));
    ps1.render(scene, camera, viewmodel);
    input.endFrame();
  });
});

function step(dt) {
  const active = input.locked || noLock;
  // Decided once per frame so the key that closes a dialogue can't also jump or interact.
  const controlling = active && !chapter.inputLocked;

  if (active && input.wasPressed('Backquote')) debug = !debug;
  if (active && debug && input.wasPressed('KeyN')) {
    player.noclip = !player.noclip;
    hud.toast(player.noclip ? 'Noclip on' : 'Noclip off', 1.5);
  }
  if (active && debug && input.wasPressed('Digit1')) {
    ps1Settings.vertexSnap = !ps1Settings.vertexSnap;
    hud.toast(`Vertex wobble ${ps1Settings.vertexSnap ? 'on' : 'off'}`, 1.5);
  }
  if (active && debug && input.wasPressed('Digit2')) {
    ps1.dither = !ps1.dither;
    hud.toast(`Dithering ${ps1.dither ? 'on' : 'off'}`, 1.5);
  }
  if (active && debug && input.wasPressed('KeyG')) {
    goob.collected += goob.remaining;
    goob.blobs.clear();
    hud.toast('Debug: all goob removed', 1.5);
  }

  // The world only runs while playing; menus and the pause screen freeze it.
  // The world runs at the chapter's time scale (slow motion in the spill);
  // the story, camera and screen effects run in real time.
  if (state === 'playing') {
    const worldDt = dt * chapter.timeScale;
    gameTime += worldDt;
    dialogue.update(dt, input);
    player.update(dt, input, controlling);
    world.update(worldDt, player);
    cast.update(worldDt, player);
    goob.update(worldDt, gameTime);
    camera.updateMatrixWorld();
    vacuum.update(dt, input, controlling, camera, player, goob, cast.all);
    chapter.update(dt);
    fx.update(dt);
  }
  interactions.update(input, player, controlling);

  hud.setLocation(world.locationAt(player.pos));
  if (debug) {
    fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
    const p = player.pos;
    hud.setDebug(`${fps.toFixed(0)} fps · x ${p.x.toFixed(2)} y ${p.y.toFixed(2)} z ${p.z.toFixed(2)} · ${chapter.state}${player.noclip ? ' · noclip' : ''}`);
  } else {
    hud.setDebug(null);
  }
  hud.update(dt);
}
