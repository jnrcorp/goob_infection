import * as THREE from 'three';
import { GameRenderer } from './render/renderer.js';
import { setContactShadowStrength } from './render/shadows.js';
import { QUALITY_PRESETS, QUALITY_CHOICES, detectQuality, lowerQuality } from './render/quality.js';
import { createMaterials } from './render/materials.js';
import { CollisionWorld } from './world/collision.js';
import { Interactions } from './world/interaction.js';
import { buildBuilding } from './world/buildBuilding.js';
import { createCast } from './npc/cast.js';
import { Player } from './player/player.js';
import { Viewmodel } from './player/viewmodel.js';
import { Vacuum } from './player/vacuum.js';
import { Antidote } from './player/antidote.js';
import { GoobGraph } from './goob/goobGraph.js';
import { GoobSystem } from './goob/goobSystem.js';
import { Navigation } from './npc/navigation.js';
import { Spill } from './story/spill.js';
import { Chapter1 } from './story/chapter1.js';
import { Input } from './core/input.js';
import { DIFFICULTIES, VOLUMES, settings, saveSettings, difficulty } from './core/settings.js';
import { startAudio, setVolume, setMuted, setListener, setLoops, sfx } from './core/sound.js';
import { saveGame, loadGame, clearSave } from './core/save.js';
import { Hud } from './ui/hud.js';
import { Dialogue } from './ui/dialogue.js';
import { Reader } from './ui/reader.js';
import { ScreenFx } from './ui/screenFx.js';

const canvas = document.getElementById('game');
const screens = {
  title: document.getElementById('title'),
  pause: document.getElementById('pause'),
  files: document.getElementById('files'),
  ready: document.getElementById('ready'),
  breached: document.getElementById('breached'),
  tbc: document.getElementById('tbc'),
  quit: document.getElementById('quit'),
};

// ---------- Loading ----------
// Building the game takes a moment. Between the big steps, move the title
// screen's progress bar on and let the page draw it (this module can await
// at the top level) before carrying on.
async function loadStep(fraction, text) {
  const percent = Math.round(fraction * 100);
  document.getElementById('loading-fill').style.width = `${Math.max(4, percent)}%`;
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading').setAttribute('aria-valuenow', String(percent));
  // (A frame, or 100 ms if the tab is in the background and not drawing.)
  await new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
    setTimeout(resolve, 100);
  });
}

// ---------- Setup ----------
await loadStep(0.08, 'Starting the renderer…');
const gfx = new GameRenderer(canvas);
// The quality preset to start with (see Graphics quality below).
function initialQuality() {
  const param = new URLSearchParams(location.search).get('quality');
  if (QUALITY_PRESETS[param]) return param;
  return settings.quality === 'auto' ? detectQuality(gfx.renderer) : settings.quality;
}
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fb4c8');
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 120);

const input = new Input(canvas);
const hud = new Hud();
const dialogue = new Dialogue();
const reader = new Reader();
const fx = new ScreenFx();
const collision = new CollisionWorld();
await loadStep(0.18, 'Painting the walls…');
const materials = createMaterials(gfx.renderer, QUALITY_PRESETS[initialQuality()]);
const interactions = new Interactions(camera, collision, hud);
const ctx = { scene, collision, materials, interactions, hud };
await loadStep(0.35, 'Building Goob Co.…');
const world = buildBuilding(ctx);
await loadStep(0.6, 'Hiring your coworkers…');
const cast = createCast(ctx, world.props);
const player = new Player(camera, collision);
const viewmodel = new Viewmodel(materials);

// ---------- Graphics quality ----------
// 'auto' starts from a guess based on the GPU and steps down if the frame
// rate can't keep up. ?quality=low|medium|high overrides it for this visit.
const qualityParam = new URLSearchParams(location.search).get('quality');
const qualityOverride = QUALITY_PRESETS[qualityParam] ? qualityParam : null;
let autoQuality = detectQuality(gfx.renderer);
function qualityName() {
  const choice = qualityOverride ?? settings.quality;
  return choice === 'auto' ? autoQuality : choice;
}
// ?shadows=none|sun|all, ?contactShadows=0..1, ?normalMaps=0|1 and ?msaa=0|4
// override those parts of the preset (for tracking down rendering problems).
const presetTweaks = {};
for (const key of ['shadows', 'contactShadows', 'normalMaps', 'msaa']) {
  const value = new URLSearchParams(location.search).get(key);
  if (value === null) continue;
  presetTweaks[key] = key === 'shadows' ? value : key === 'normalMaps' ? value === '1' : Number(value);
}
const tweakedPresets = new Map();
function presetFor(name) {
  if (!tweakedPresets.has(name)) tweakedPresets.set(name, { ...QUALITY_PRESETS[name], ...presetTweaks });
  return tweakedPresets.get(name);
}
function applyQuality() {
  const preset = presetFor(qualityName());
  if (gfx.preset !== preset) gfx.applyPreset(preset);
  world.lights.setCount(preset.lights);
  world.setShadows(preset.shadows, gfx.renderer);
  setContactShadowStrength(preset.contactShadows);
  materials.regenerate(preset);
}
gfx.setup(scene, camera, viewmodel, presetFor(qualityName()));
world.lights.setCount(presetFor(qualityName()).lights);
world.setShadows(presetFor(qualityName()).shadows, gfx.renderer);
setContactShadowStrength(presetFor(qualityName()).contactShadows);
materials.regenerate(presetFor(qualityName()));

// On Auto: if play runs under 40 fps for 5 seconds, drop a preset.
const frameWatch = { time: 0, frames: 0 };
function watchFrameRate(dt) {
  if (state !== 'playing' || qualityOverride || settings.quality !== 'auto') {
    frameWatch.time = frameWatch.frames = 0;
    return;
  }
  frameWatch.time += dt;
  frameWatch.frames += 1;
  if (frameWatch.time < 5) return;
  const fps = frameWatch.frames / frameWatch.time;
  frameWatch.time = frameWatch.frames = 0;
  const lower = lowerQuality(autoQuality);
  if (fps >= 40 || !lower) return;
  autoQuality = lower;
  applyQuality();
  showQuality();
  hud.toast(`Graphics set to ${QUALITY_PRESETS[lower].label} to keep things smooth.`, 3);
}

// Spots link through doorways whether the door is open or not (a shut door
// then blocks spreading or walking along that link), and people never block.
const goobPassable = new Set([
  ...world.doors.flatMap((d) => [d.collider, d.openCollider]),
  ...world.elevator.doors.map((d) => d.collider),
  ...cast.all.map((n) => n.collider),
]);
const peopleColliders = cast.all.map((n) => n.collider);
for (const c of peopleColliders) c.person = true; // the player never gets shoved out of these
await loadStep(0.72, 'Mapping where goob can go…');
const goobGraph = new GoobGraph(collision, goobPassable, {
  // Shut doors (including the elevator's) stop goob spreading between rooms.
  doors: [...world.doors.map((d) => d.collider), ...world.elevator.doors.map((d) => d.collider)],
  people: new Set(peopleColliders),
}).build(world);
const goob = new GoobSystem(scene, goobGraph, collision);
// (Twice as fast during the lockdown at the end.)
goob.spreadSpeed = () => difficulty().goobSpread * (chapter?.state === 'ESCAPE' ? 2 : 1);

// Infected walk through each other but not through doors (they can't open
// them), and see through each other and past open door panels.
const sightIgnore = new Set([...peopleColliders, ...world.doors.map((d) => d.openCollider)]);
const vacuum = new Vacuum({ viewmodel, hud, scene, collision, sightIgnore });
const antidote = new Antidote({ viewmodel, hud, scene, collision, sightIgnore });
const spill = new Spill({ scene, materials, player, camera, viewmodel, goob, fx, hud, world, cast });
await loadStep(0.84, 'Writing chapter 1…');
const chapter = new Chapter1({
  ctx, world, player, cast, hud, dialogue, reader, interactions, fx, goob, graph: goobGraph, vacuum, antidote, spill,
  sightIgnore, onEnd: endChapter, onBreach: suitBreached,
});

// Everything solid casts and catches real shadows (when the preset has them):
// people, doors, the elevator, props and goob. (The building's static
// geometry sets this itself.)
scene.traverse((o) => {
  if (!o.isMesh || o.castShadow) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m?.isMeshLambertMaterial || m.transparent) return;
  o.castShadow = true;
  o.receiveShadow = true;
});
// Every checkpoint is also the autosave.
chapter.onCheckpoint = (checkpoint) => saveGame(checkpoint);
cast.setEnv({
  player,
  nav: new Navigation(goobGraph),
  collision,
  moveIgnore: new Set(peopleColliders),
  sightIgnore,
  isHostile: () => chapter.hostile,
  isNoisy: () => vacuum.noisy > 0 || antidote.spraying,
  attackers: () => cast.all.filter((n) => n.brain && (n.brain.state === 'windup' || n.brain.state === 'recover')).length,
  onHit: (npc) => {
    if (params.has('report')) console.log(`[report] hit by ${npc.name} at ${npc.pos.x.toFixed(2)}, ${npc.pos.z.toFixed(2)}`);
    if (!params.has('peaceful')) chapter.hurtPlayer(npc);
  },
  // Everyone stands still while Dale's on the intercom (after the freezer
  // is locked), and while you're spraying the antidote.
  hold: () => chapter.state === 'DALE_CALL' || antidote.spraying,
  // Everyone, so people walking somewhere can wait for whoever's in front.
  people: () => cast.all,
  canOpenDoors: () => difficulty().infectedOpenDoors,
  canAttack: () => difficulty().infectedAttack,
  openDoorsNear: (npc) => world.openDoorsNear(npc),
});
let closestEver = null; // see step()
let autoChaseIn = 0; // see step()
let gameTime = 0;
let lastStep = 0; // footstep counter for sounds

// ---------- Menus ----------
// 'title' | 'playing' | 'paused' | 'ended' | 'quit'. Gameplay runs while the pointer is locked.
let state = 'title';

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  screens[name]?.querySelector('button')?.focus();
}

function goToTitle() {
  state = 'title';
  // Continue picks up from the autosave, if there is one.
  document.getElementById('menu-continue').hidden = !loadGame();
  showScreen('title');
}

function endChapter({ title, text, hint } = {}) {
  state = 'ended';
  clearSave(); // the chapter is finished; nothing to continue
  if (document.pointerLockElement) document.exitPointerLock();
  document.getElementById('tbc-heading').textContent = title ?? 'To be continued';
  document.getElementById('tbc-text').textContent = text ?? '';
  document.getElementById('tbc-hint').textContent = hint ?? '';
  showScreen('tbc');
}

// Game over: the suit breached, or (with title/text) something else, like
// being sealed in by the lockdown at the end.
function suitBreached({ title, text } = {}) {
  state = 'ended';
  if (document.pointerLockElement) document.exitPointerLock();
  document.getElementById('breached-heading').textContent = title ?? 'Suit breached';
  document.getElementById('breached-text').textContent = text ?? 'The goob got in. You feel... surprisingly happy.';
  document.getElementById('breach-retry').hidden = !chapter.hasCheckpoint;
  showScreen('breached');
}

input.onLockChange = (locked) => {
  if (locked) {
    state = 'playing';
    showScreen(null);
  } else if (state === 'playing') {
    state = 'paused';
    updateFilesButton();
    showScreen('pause');
  }
};

// Capture the mouse to start playing (or, when testing with ?nolock, just go).
function beginPlay() {
  if (noLock) {
    state = 'playing';
    showScreen(null);
  } else {
    input.lock();
  }
}

document.getElementById('menu-play').addEventListener('click', () => {
  clearSave();
  chapter.start();
  beginPlay();
});
document.getElementById('menu-play2').addEventListener('click', () => {
  clearSave();
  chapter.start(2);
  beginPlay();
});
document.getElementById('menu-continue').addEventListener('click', () => {
  const saved = loadGame();
  chapter.start(saved?.chapter ?? 1);
  if (saved) chapter.restoreCheckpoint(saved);
  beginPlay();
});
document.getElementById('pause-resume').addEventListener('click', () => beginPlay());

// ---------- Files screen (J in game, or from the pause menu) ----------
function showFiles() {
  const list = document.getElementById('files-list');
  const found = chapter.files.filter((f) => f.found);
  document.getElementById('files-count').textContent = `${found.length} of ${chapter.files.length} found`;
  list.innerHTML = '';
  const titleEl = document.getElementById('files-reader-title');
  const bodyEl = document.getElementById('files-reader-body');
  const show = (file) => {
    titleEl.textContent = file.title;
    bodyEl.textContent = file.body;
  };
  if (!found.length) {
    titleEl.textContent = 'Nothing yet';
    bodyEl.textContent = 'Files you find lying around the building (folders, printouts, sticky notes) are kept here.';
  }
  for (const item of found) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.file.title;
    button.addEventListener('click', () => show(item.file));
    button.addEventListener('focus', () => show(item.file));
    list.appendChild(button);
  }
  if (found.length) show(found[found.length - 1].file);
  state = 'files';
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen('files');
}

function updateFilesButton() {
  const found = chapter.files.filter((f) => f.found).length;
  document.getElementById('pause-files').textContent = `Files (${found}/${chapter.files.length})`;
}
chapter.onFileFound = updateFilesButton;
chapter.hauler.canSend = () => debug; // R sends a bin to the freezer (debug only)
document.getElementById('pause-files').addEventListener('click', showFiles);
document.getElementById('files-back').addEventListener('click', () => beginPlay());

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

// Graphics button (title and pause screens): Auto, Low, Medium, High.
const qualityButtons = [document.getElementById('menu-quality'), document.getElementById('pause-quality')];
function showQuality() {
  const label = settings.quality === 'auto'
    ? `Auto (${QUALITY_PRESETS[autoQuality].label})`
    : QUALITY_PRESETS[settings.quality].label;
  for (const button of qualityButtons) button.textContent = `Graphics: ${label}`;
}
for (const button of qualityButtons) {
  button.addEventListener('click', () => {
    settings.quality = QUALITY_CHOICES[(QUALITY_CHOICES.indexOf(settings.quality) + 1) % QUALITY_CHOICES.length];
    saveSettings();
    applyQuality();
    showQuality();
  });
}
showQuality();

// Volume button: steps through 0–100%.
const volumeButton = document.getElementById('menu-volume');
function showVolume() {
  volumeButton.textContent = `Volume: ${Math.round(settings.volume * 100)}%`;
  setVolume(settings.volume);
}
volumeButton.addEventListener('click', () => {
  const i = VOLUMES.findIndex((v) => Math.abs(v - settings.volume) < 0.01);
  settings.volume = VOLUMES[(i + 1) % VOLUMES.length];
  saveSettings();
  showVolume();
});
showVolume();

// Any menu button starts the audio (browsers need a click first) and blips.
for (const button of document.querySelectorAll('.menu button')) {
  button.addEventListener('click', () => {
    startAudio();
    setVolume(settings.volume);
    sfx.ui();
  });
}
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
// V cycles the graphics preset (for comparing), G removes all goob,
// K cures everyone (during the cure objective), L marks every file as found,
// M skips the morning (at home and the drive), H lands a hit on the chapter 2 boss, P saves a checkpoint now (autosave), I toggles an infinite vacuum tank, R (while pushing a bin) sends it to the freezer.
// URL options:
//   ?debug          start with the readout on
//   ?shot           skip the title screen (for screenshots)
//   ?stage=NAME     skip ahead: TO_LOCKERS, TO_FREEZER, GET_VACUUM, CLEANUP, SECURE,
//                   LOCK_FREEZER, GET_ANTIDOTE or CURE
//   ?goobspots      show every spot goob can spread to
//   ?peaceful       infected still chase but their hits do nothing (for testing)
//   ?report=Name    after the simulation, log open doors and where Name is
//   ?npcat=Name,x,y,z   place a coworker (testing)
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

// ?chapter=2 starts chapter 2 (testing).
chapter.start(params.get('chapter') === '2' ? 2 : 1);
if (params.has('stage')) chapter.skipTo(params.get('stage'));
const at = params.get('at')?.split(',').map(Number);
if (at?.length >= 3 && at.every(Number.isFinite)) {
  player.rig = null; // (not still lying in bed)
  player.spawn({ x: at[0], y: at[1], z: at[2], yaw: THREE.MathUtils.degToRad(at[3] ?? 0) });
  player.pitch = THREE.MathUtils.degToRad(at[4] ?? 0);
  player.updateCamera();
}
// ?morning=chores: up and about, alarm off, chores to do (testing; stays
// wherever ?at= put you).
if (params.get('morning') === 'chores' && chapter.morning.active) {
  player.rig = null;
  chapter.morning.stage = 'CHORES';
  hud.setObjective(chapter.morning.choresObjective());
}
// ?morning=drive: skip the chores, standing by your car (testing).
if (params.get('morning') === 'drive' && chapter.morning.active) chapter.morning.readyToDrive();
// ?morning=arrive: parked at work, about to head inside (testing).
if (params.get('morning') === 'arrive' && chapter.morning.active) {
  chapter.morning.readyToDrive();
  chapter.morning.car.place(13.6, -5.5, Math.PI);
  chapter.morning.useCar();
  chapter.morning.arrive();
}
// ?morning=office: arrived and just walked up to 2F (testing the hand-off to
// the workday).
if (params.get('morning') === 'office' && chapter.morning.active) {
  chapter.morning.finish();
  chapter.morning.stage = 'ARRIVE';
  player.spawn(world.spawn);
}
// ?carat=x,z,headingDegrees: put your car there, with you in it (testing
// the drive; use with ?morning=drive, or ?stage=C2_DRIVE).
const carAt = params.get('carat')?.split(',').map(Number);
if (carAt && (chapter.morning.stage === 'DRIVE' || chapter.state === 'C2_DRIVE')) {
  chapter.morning.car.place(carAt[0], carAt[1], THREE.MathUtils.degToRad(carAt[2] ?? 0));
  chapter.morning.car.onUse();
}
// ?look=yawDegrees,pitchDegrees: turn the view (testing; works in bed too).
const look = params.get('look')?.split(',').map(Number);
if (look) {
  player.yaw = THREE.MathUtils.degToRad(look[0]);
  player.pitch = THREE.MathUtils.degToRad(look[1] ?? 0);
  player.updateCamera();
}
// ?routes: walking distances along part 2's whole route (testing its
// length), and whether its pickups are clear of furniture.
if (params.has('routes')) {
  const nav = new Navigation(goobGraph);
  const flat = (a, b) => {
    const route = nav.path(nav.nearest(new THREE.Vector3(...a)), nav.nearest(new THREE.Vector3(...b)), true) ?? [];
    let d = 0;
    for (let i = 1; i < route.length; i++) d += route[i].distanceTo(route[i - 1]);
    return d || Math.hypot(a[0] - b[0], a[2] - b[2]);
  };
  // Between floors: to the stairwell, up/down (about 11 m of stairs and
  // landings per floor), then on from the stairwell.
  const walk = (a, b) => {
    if (Math.abs(a[1] - b[1]) < 1) return flat(a, b);
    return flat(a, [13.5, a[1], 14]) + Math.abs(a[1] - b[1]) / 4 * 11 + flat([13.5, b[1], 14], b);
  };
  const stops = [
    ['B3 control room', [31.6, -12, 21.4]], ['B3 hidden elevator', [9, -12, 22.6]], ['B1 north wall', [9, -4, 22.6]],
    ["3F Victoria's office", [5, 8, 5]],
    ['transmitter B1', [11.4, -4, 14.2]], ['transmitter 1F', [22.5, 0, 9.2]], ['transmitter 2F', [20.55, 4, 14.8]], ['transmitter 3F', [11.4, 8, 22.6]],
    ['cleanup 3F', [12, 8, 11]], ['cleanup 2F', [12, 4, 12]], ['bin 2F', [0.55, 4, 16.1]], ['cleanup 1F', [12, 0, 11.5]], ['bin 1F', [11.8, 0, 12.45]], ['cleanup B1', [12, -4, 11.5]], ['bin B1', [22.9, -4, 11.4]],
    ['scrap B1', [8, -4, 11.6]], ['scrap 1F a', [6, 0, 15]], ['scrap 1F b', [17, 0, 8.2]], ['scrap 2F a', [1.2, 4, 5.2]], ['scrap 2F b', [19.5, 4, 17.2]], ['scrap 2F c', [9.2, 4, 20]], ['scrap 3F a', [17, 8, 7]], ['scrap 3F b', [20, 8, 16]],
    ['Deb 3F', [19.5, 8, 18.5]], ['Brad 2F', [5.5, 4, 13.2]], ['Olu 2F', [20.5, 4, 3]], ['Hank 1F', [18, 0, 5]], ['Rhonda 1F', [6, 0, 18.5]], ['Stan B1', [2, -4, 22.4]], ['elevator', [16.5, -4, 12.2]],
    ['roof -> chase start 3F', [16.5, 8, 11.6]], ['chase: catch her (loading dock)', [32, 0, 16]],
    ['escort: break room', [6.5, 0, 18.6]], ['escort: front doors', [19, 0, 1]], ['escort: police line', [17, 0, -6]],
  ];
  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    const [from, a] = stops[i - 1];
    const [to, b] = stops[i];
    // (The hidden elevator ride itself isn't walking.)
    const d = from === 'B3 hidden elevator' ? 0 : walk(a, b);
    total += d;
    console.log(`[report] route ${from} -> ${to}: ${d.toFixed(0)} m`);
  }
  console.log(`[report] routes total ${total.toFixed(0)} m`);
  for (const [name, p] of stops.filter(([n]) => n.startsWith('scrap') || n.startsWith('transmitter'))) {
    const inside = collision.pointInside(new THREE.Vector3(p[0], p[1] + 0.1, p[2]));
    if (inside) console.log(`[report] ${name} at ${p.join(',')} is INSIDE something`);
  }
}
// ?finale=news: just the ending's news bulletin and credits (testing).
if (params.get('finale') === 'news') chapter.ending.newsAndCredits();
// ?npcat=Name,x,y,z[,yawDegrees]: put a coworker somewhere, facing that way
// (0 = +z) (testing).
// (Repeat it to place several people.)
for (const npcAt of params.getAll('npcat').map((v) => v.split(','))) {
  const npc = cast.all.find((n) => n.name === npcAt[0]);
  if (npc) {
    npc.pos.set(Number(npcAt[1]), Number(npcAt[2]), Number(npcAt[3]));
    npc.home.copy(npc.pos);
    npc.path = null;
    if (npcAt[4] !== undefined) npc.yaw = THREE.MathUtils.degToRad(Number(npcAt[4]));
    // ?npcfreeze: they stay put (to look at a pose).
    if (params.has('npcfreeze')) npc.frozen = true;
  }
}
// ?crowd=N,x,y,z: put N coworkers on exactly the same spot (testing that
// they push apart).
const crowd = params.get('crowd')?.split(',').map(Number);
if (crowd) {
  for (const npc of cast.all.filter((n) => !n.seated).slice(0, crowd[0])) {
    npc.pos.set(crowd[1], crowd[2], crowd[3]);
    npc.home.copy(npc.pos);
    npc.path = null;
  }
}
// ?car=1: start with the (working) elevator car on that floor (testing).
if (params.has('car') && !world.elevator.jammed) {
  const e = world.elevator;
  e.current = e.target = Number(params.get('car'));
  e.carY = e.floors[e.current];
  e.syncCar();
}
// ?binat=N,x,y,z: put biohazard bin N somewhere (testing).
const binAt = params.get('binat')?.split(',').map(Number);
if (binAt) chapter.hauler.place(chapter.hauler.bins[binAt[0]], binAt[1], binAt[2], binAt[3]);
// ?secretto=N: send the hidden elevator to floor N (0 = B3, 1 = B1) after
// ?sim (testing).
// ?callto=N: send the (working) elevator to floor N at load (0 = B1).
if (params.has('callto')) world.elevator.request(Number(params.get('callto')));
// ?grab=N: start pushing biohazard bin N (with ?stage=SECURE).
if (params.has('grab') && chapter.state === 'SECURE') chapter.hauler.grab(chapter.hauler.bins[Number(params.get('grab'))]);
if (params.has('shot')) {
  state = 'playing';
  showScreen(null);
} else {
  goToTitle();
}
// ?filecheck: is every file resting on something, and not buried in furniture?
if (params.has('filecheck')) {
  for (const { file } of chapter.files) {
    const { x, y, z } = file.at;
    const ground = collision.groundAt(x, z, y + 0.3, 0.02, 0.6);
    const buried = collision.pointInside(new THREE.Vector3(x, y + 0.02, z));
    console.log(`[report] file ${file.id}: rests on ${ground.toFixed(2)} (placed at ${y}), ${buried ? 'BURIED' : 'clear'}`);
  }
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
  const route = nav.path(nav.nearest(new THREE.Vector3(8.15, 4, 10.7)), nav.nearest(new THREE.Vector3(30, 0, 20.5)), true);
  console.log(`[goobspots] walking route (doors open) from your desk to the freezer door: ${route ? `${route.length} steps via ${route.filter((p) => p.y > 0.3 && p.y < 3.7).length} on the stairs` : 'NONE'}`);
  const probe = params.get('goobspots').split(',').map(Number);
  if (probe.length === 3) {
    for (const n of goobGraph.nodes.filter((m) => m.pos.distanceTo(new THREE.Vector3(...probe)) < 2.5)) {
      console.log(`[goobspots] spot ${n.kind} (${n.pos.x.toFixed(2)}, ${n.pos.y.toFixed(1)}, ${n.pos.z.toFixed(2)}) links: ${n.links.map((m) => `(${m.pos.x.toFixed(1)},${m.pos.z.toFixed(1)})`).join(' ')}`);
    }
  }
  for (const g of groups.slice(1)) console.log(`[goobspots] separate group at ${g.slice(0, 3).map((n) => `${n.kind}(${n.pos.x.toFixed(1)},${n.pos.y.toFixed(1)},${n.pos.z.toFixed(1)})`).join(' ')}`);
}

// ---------- Loop ----------
function resize() {
  gfx.setSize(window.innerWidth, window.innerHeight);
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
  // ?escortdone: finish the escort right away (testing what comes after it).
  if (params.has('escortdone') && chapter.state === 'C2_ESCORT') chapter.ch2.part2.finalRun.finish();
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
  if (params.has('secretto')) world.secretElevator.request(Number(params.get('secretto')));
  if (params.has('gantryto')) world.gantryElevator.request(Number(params.get('gantryto')));
  await simulate(Number(params.get('after')) || 0);
  if (params.has('report')) {
    const npc = cast.all.find((n) => n.name === params.get('report'));
    const open = world.doors.filter((d) => d.isOpen).map((d) => d.label);
    console.log(`[report] open doors: ${open.join(', ') || 'none'}; suit ${Math.ceil(player.suit)}%; you at ${player.pos.x.toFixed(2)}, ${player.pos.y.toFixed(2)}, ${player.pos.z.toFixed(2)} (${world.locationAt(player.pos)})`);
    const bins = chapter.hauler.bins.map((b, i) => `${i}: y ${b.group.position.y.toFixed(2)}`).join(', ');
    console.log(`[report] bins ${bins}; elevator car at y ${world.elevator.carY.toFixed(2)}`);
    const byFloor = {};
    for (const blob of goob.blobs.values()) {
      const id = chapter.areaOf(blob.node);
      byFloor[id] = Math.round(((byFloor[id] ?? 0) + blob.volume) * 10) / 10;
    }
    console.log(`[report] goob volume by area: ${JSON.stringify(byFloor)}`);
    const walking = cast.all.filter((n) => n.mode === 'returning');
    console.log(`[report] cured: ${cast.all.filter((n) => n.cured).length}, still walking home: ${walking.map((n) => `${n.name} (${n.pos.x.toFixed(1)}, ${n.pos.y.toFixed(1)}, ${n.pos.z.toFixed(1)})`).join(', ') || 'none'}`);
    // The closest two people standing on the same floor (should never overlap).
    let closest = null;
    for (const a of cast.all) for (const b of cast.all) {
      if (a === b || Math.abs(a.pos.y - b.pos.y) > 1 || (a.seated && b.seated)) continue;
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      if (!closest || d < closest.d) closest = { d, a: a.name, b: b.name };
    }
    console.log(`[report] everyone: ${cast.all.map((n) => `${n.name}@${n.pos.x.toFixed(2)},${n.pos.z.toFixed(2)}`).join(' ')}`);
    if (closestEver) console.log(`[report] closest anyone walking ever got to someone: ${closestEver.a} and ${closestEver.b}, ${closestEver.d.toFixed(2)} m at t ${closestEver.t.toFixed(1)}s (${closestEver.at}; waiting for ${closestEver.wait})`);
    if (closest) console.log(`[report] closest two people: ${closest.a} and ${closest.b}, ${closest.d.toFixed(2)} m apart`);
    if (chapter.ch2.part2.boss.root.visible) console.log(`[report] boss armor ${chapter.ch2.part2.boss.armor}, distance ${Math.hypot(chapter.ch2.part2.boss.pos.x - player.pos.x, chapter.ch2.part2.boss.pos.z - player.pos.z).toFixed(1)} m, game time ${gameTime.toFixed(0)}s`);
    const fr = chapter.ch2.part2.finalRun;
    if (fr.followers && chapter.state === 'C2_ESCORT') console.log(`[report] escort: ${fr.followers.map((n) => `${n.name}${n.safe ? ' SAFE' : n.infected ? ' INFECTED' : ''}@${n.pos.x.toFixed(1)},${n.pos.z.toFixed(1)}`).join(' ')}`);
    if (chapter.ch2.part2.active) console.log(`[report] part 2: ${JSON.stringify(chapter.ch2.part2.snapshot())}; roof locked ${!!world.elevator.floorLocks}`);
    const ld = chapter.ch2.lockdown;
    if (ld.active || ld.done) console.log(`[report] lockdown: done ${ld.done}; breakers ${ld.switches.map((s) => (s.on ? 1 : 0)).join('')}; elevator ${world.elevator.lockedMessage ? 'dead' : 'on'} at ${world.elevator.current} ${world.elevator.phase}; kim ${ld.kim.root.visible ? `${ld.kim.root.position.x.toFixed(1)},${ld.kim.root.position.y.toFixed(1)},${ld.kim.root.position.z.toFixed(1)}` : 'hidden'}; defend ${ld.progress?.toFixed(1)}/${ld.needed}; threats ${(ld.threats ?? []).map((n) => `${n.name}${n.infected ? '' : ' cured'}`).join(' ')}`);
    const wing = chapter.ch2.wing;
    if (wing.active) console.log(`[report] wing: ${JSON.stringify(wing.snapshot())}; cameras ${wing.cameras.map((c) => `${c.on ? 'on' : 'off'}:${c.suspicion.toFixed(2)}`).join(' ')}; ${wing.prisoners.map((q) => `${q.name}${q.npc.infected ? ' INFECTED' : q.freed ? ' freed' : ''}@${q.npc.pos.x.toFixed(1)},${q.npc.pos.z.toFixed(1)}`).join(' ')}; in lobby ${chapter.ch2.inLobby}/${chapter.ch2.everyone.length}`);
    const launch = chapter.ch2.part2.launch;
    if (launch.active) console.log(`[report] launch: pods ${launch.pods.map((q) => `${q.name}:${q.state}@${chapter.ch2.cast.all.find((n) => n.name === q.name)?.pos.x.toFixed(1)},${chapter.ch2.cast.all.find((n) => n.name === q.name)?.pos.z.toFixed(1)}`).join(' ')}; code ${launch.digitsText}; final ${launch.final.active ? `armor ${launch.final.armor}, T-${launch.liftoff?.toFixed(0)}` : 'off'}; car ${chapter.morning.car.pos.x.toFixed(1)},${chapter.morning.car.pos.z.toFixed(1)}`);
    console.log(`[report] stage ${chapter.state}; files ${chapter.filesFound}/${chapter.files.length}; reading ${reader.active}; dialogue ${dialogue.active}; screen ${state}`);
    if (npc?.path) console.log(`[report] ${npc.name} path ${npc.pathIndex}/${npc.path.length} next ${JSON.stringify(npc.path[npc.pathIndex])} frozen ${npc.frozen} waitingFor ${npc.yieldingTo?.name ?? '-'} stuck ${npc.stuckFor?.toFixed(1)}`);
    if (npc) console.log(`[report] ${npc.name} at ${npc.pos.x.toFixed(1)}, ${npc.pos.y.toFixed(1)}, ${npc.pos.z.toFixed(1)} (${npc.brain?.state ?? npc.mode})`);
  }
  // ?click=id1,id2 clicks buttons by id (for testing menus).
  for (const id of (params.get('click') ?? '').split(',').filter(Boolean)) {
    // Click the button itself, like a player would.
    document.querySelector(`button#${id}`)?.click();
    console.log(`[click] ${id} -> state ${state}, visible screen: ${Object.keys(screens).find((k) => !screens[k].hidden) ?? 'none'}`);
    await simulate(0.2);
  }
  if (params.has('click') && params.has('report')) {
    console.log(`[report] after clicks, you at ${player.pos.x.toFixed(2)}, ${player.pos.y.toFixed(2)}, ${player.pos.z.toFixed(2)}; hidden elevator at y ${world.secretElevator.carY}, ${world.secretElevator.phase}, doors ${world.secretElevator.open.map((o) => o.toFixed(1))}`);
    console.log(`[report] after clicks, open doors: ${world.doors.filter((d) => d.isOpen).map((d) => d.label).join(', ') || 'none'}`);
  }
}

// Compile the shaders up front, so the first frames of play don't stutter.
await loadStep(0.94, 'Warming up…');
gfx.renderer.compile(scene, camera);
await loadStep(1, 'Ready');

runStartupSimulation().then(() => {
  // Everything's built and the first frame is about to draw: the title
  // menu can be used now (see [data-loading] in style.css).
  screens.title.removeAttribute('data-loading');
  document.getElementById('loading').hidden = true;
  for (const b of screens.title.querySelectorAll('.menu button')) b.disabled = false;
  clock.getDelta();
  gfx.renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    step(Math.min(dt, 0.05));
    watchFrameRate(dt);
    gfx.render();
    input.endFrame();
  });
});

// Loops follow what's happening; footsteps follow the walk bob; infected moan
// every so often (more often while chasing).
function updateAudio(dt) {
  setListener(camera.position.x, camera.position.y, camera.position.z, player.yaw);
  setLoops({
    // (No office hum at home or on the road.)
    hum: chapter.morning.active && chapter.morning.stage !== 'ARRIVE' ? 0 : chapter.outbreak ? 0.6 : 1,
    engine: chapter.morning.car.driver ? 1 : 0,
    vacuum: vacuum.sucking ? 1 : 0,
    spray: antidote.spraying ? 1 : 0,
    breath: player.suited ? 1 : 0,
  });
  const stepIndex = Math.floor(player.bob / Math.PI);
  if (stepIndex !== lastStep && player.grounded) sfx.step(player.pos);
  lastStep = stepIndex;
  for (const npc of cast.all) {
    if (!npc.infected) continue;
    npc.moanIn = (npc.moanIn ?? Math.random() * 6) - dt;
    if (npc.moanIn > 0) continue;
    const chasing = npc.brain?.state === 'chase';
    npc.moanIn = chasing ? 2.5 + Math.random() * 2.5 : 6 + Math.random() * 7;
    sfx.moan(npc.pos, 0.8 + (npc.name.charCodeAt(0) % 5) * 0.1);
  }
}

function step(dt) {
  // ?aimboss: keep the camera on the chapter 2 boss (testing the fight).
  const boss = chapter.ch2.part2.boss;
  if (params.has('aimboss') && boss.active) player.lookTarget = { x: boss.pos.x, y: boss.pos.y + 1.4, z: boss.pos.z };
  const finalBoss = chapter.ch2.part2.launch.final;
  if (params.has('aimboss') && finalBoss.active) player.lookTarget = { x: finalBoss.pos.x, y: finalBoss.pos.y + 2, z: finalBoss.pos.z };
  // ?aimvictoria: keep the camera on Victoria (testing the chase); ?holdshift: run.
  // ?autochase: steer along the nav graph toward Victoria (testing the chase;
  // hold W with ?keys).
  if (params.has('autochase') && chapter.state === 'C2_CHASE') {
    autoChaseIn -= dt;
    if (autoChaseIn <= 0) {
      autoChaseIn = 0.25;
      const nav = new Navigation(goobGraph);
      const route = nav.path(nav.nearest(player.pos), nav.nearest(chapter.victoria.pos), true) ?? [];
      const next = route.find((p) => Math.hypot(p.x - player.pos.x, p.z - player.pos.z) > 1.2) ?? chapter.victoria.pos;
      player.lookTarget = { x: next.x, y: next.y + 1.5, z: next.z };
    }
  }
  if (params.has('holdshift')) input.keys.add('ShiftLeft');
  // ?report: the closest any two people walking about ever got (testing).
  if (params.has('report')) {
    for (const a of cast.all) for (const b of cast.all) {
      if (a === b || !a.path || !a.person.root.visible || !b.person.root.visible || Math.abs(a.pos.y - b.pos.y) > 1 || (a.seated && b.seated)) continue;
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      if (d < (closestEver?.d ?? Infinity)) closestEver = { d, a: a.name, b: b.name, t: gameTime, at: `${a.pos.x.toFixed(1)},${a.pos.z.toFixed(1)} / ${b.pos.x.toFixed(1)},${b.pos.z.toFixed(1)}`, wait: `${a.yieldingTo?.name ?? '-'} / ${b.yieldingTo?.name ?? '-'}` };
    }
  }
  const active = input.locked || noLock;
  // Decided once per frame so the key that closes a dialogue can't also jump or interact.
  const controlling = active && !chapter.inputLocked;

  if (active && input.wasPressed('Backquote')) debug = !debug;
  if (active && debug && input.wasPressed('KeyN')) {
    player.noclip = !player.noclip;
    hud.toast(player.noclip ? 'Noclip on' : 'Noclip off', 1.5);
  }
  if (active && debug && input.wasPressed('KeyV')) {
    const names = Object.keys(QUALITY_PRESETS);
    const next = names[(names.indexOf(qualityName()) + 1) % names.length];
    gfx.applyPreset(QUALITY_PRESETS[next]);
    world.lights.setCount(QUALITY_PRESETS[next].lights);
    world.setShadows(QUALITY_PRESETS[next].shadows, gfx.renderer);
    setContactShadowStrength(QUALITY_PRESETS[next].contactShadows);
    materials.regenerate(QUALITY_PRESETS[next]);
    hud.toast(`Debug: ${QUALITY_PRESETS[next].label} graphics (until the next settings change)`, 1.5);
  }
  if (active && debug && input.wasPressed('KeyG')) {
    goob.collected += goob.remaining;
    goob.blobs.clear();
    hud.toast('Debug: all goob removed', 1.5);
  }
  if (active && debug && input.wasPressed('KeyK') && ['CURE', 'C2_CURE'].includes(chapter.state)) {
    for (const npc of cast.all) if (npc.infected) chapter.cureNpc(npc);
  }
  if (active && debug && input.wasPressed('KeyI')) {
    vacuum.infinite = !vacuum.infinite;
    if (vacuum.infinite) vacuum.empty();
    hud.toast(vacuum.infinite ? 'Debug: infinite vacuum tank' : 'Debug: normal vacuum tank', 1.5);
  }
  if (active && debug && input.wasPressed('KeyM') && chapter.state === 'MORNING') {
    chapter.skipTo('INTRO');
    hud.toast('Debug: skipped the morning', 1.5);
  }
  if (active && debug && input.wasPressed('KeyH') && chapter.ch2.part2.boss.active) {
    chapter.ch2.part2.boss.stun();
    chapter.ch2.part2.cured(chapter.ch2.part2.boss);
  }
  if (active && debug && input.wasPressed('KeyP') && chapter.outbreak) {
    chapter.saveCheckpoint();
    hud.toast('Debug: checkpoint saved', 1.5);
  }
  if (active && debug && input.wasPressed('KeyL')) {
    for (const f of chapter.files) f.found = true;
    updateFilesButton();
    chapter.checkInvestigation();
    hud.toast('Debug: all files found', 1.5);
  }
  // J: your files (not while reading one, or mid-conversation).
  if (state === 'playing' && active && input.wasPressed('KeyJ') && !dialogue.active) {
    if (reader.active) reader.close();
    showFiles();
  }

  // Reading a file pauses the world (the coworkers wait politely).
  if (state === 'playing' && reader.active) reader.update(input);

  // The world only runs while playing; menus and the pause screen freeze it.
  // The world runs at the chapter's time scale (slow motion in the spill);
  // the story, camera and screen effects run in real time.
  if (state === 'playing' && !reader.active) {
    const worldDt = dt * chapter.timeScale;
    gameTime += worldDt;
    dialogue.update(dt, input);
    player.update(dt, input, controlling);
    world.update(worldDt, player);
    cast.update(worldDt, player);
    goob.update(worldDt, gameTime);
    camera.updateMatrixWorld();
    // No vacuuming or spraying with your hands full of bin.
    // (Or on the steering wheel: the vacuum's put away while you drive.)
    const driving = !!chapter.morning.car.driver;
    const handsFree = controlling && !chapter.hauler.carrying && !driving;
    viewmodel.scene.visible = !driving;
    // (The blast also knocks out chapter 2's guards.)
    vacuum.update(dt, input, handsFree, camera, player, goob, [...cast.all, ...chapter.ch2.targets]);
    antidote.update(dt, input, handsFree, camera, [...cast.all, ...chapter.ch2.targets], vacuum.nozzleWorld);
    chapter.update(dt, input, controlling);
    fx.update(dt);
    updateAudio(dt);
  }
  setMuted(state !== 'playing');
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
