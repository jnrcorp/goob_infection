import * as THREE from 'three';
import { PS1Renderer, ps1Settings } from './render/ps1.js';
import { createMaterials } from './render/materials.js';
import { CollisionWorld } from './world/collision.js';
import { Interactions } from './world/interaction.js';
import { buildBuilding } from './world/buildBuilding.js';
import { createCast } from './npc/cast.js';
import { Player } from './player/player.js';
import { Chapter1 } from './story/chapter1.js';
import { Input } from './core/input.js';
import { Hud } from './ui/hud.js';
import { Dialogue } from './ui/dialogue.js';
import { ScreenFx } from './ui/screenFx.js';

const canvas = document.getElementById('game');
const screens = {
  title: document.getElementById('title'),
  pause: document.getElementById('pause'),
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
const chapter = new Chapter1({ world, player, cast, hud, dialogue, interactions, fx, onEnd: endChapter });

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

function endChapter() {
  state = 'ended';
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen('tbc');
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
// 1 toggles vertex wobble, 2 toggles dithering.
// URL options:
//   ?debug          start with the readout on
//   ?shot           skip the title screen (for screenshots)
//   ?stage=NAME     skip ahead: TO_LOCKERS or TO_FREEZER
//   ?at=x,y,z,yaw,pitch   start at a position (angles in degrees)
//   ?sim=seconds    fast-forward the game at load
//   ?nolock         act as if the mouse is captured (for automated testing)
//   ?keys=KeyE:0,KeyW:2   after ?sim, tap E then hold W for 2 s (?after=N runs N s more)
const params = new URLSearchParams(location.search);
let debug = params.has('debug');
const noLock = params.has('nolock');

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

// ---------- Loop ----------
function resize() {
  ps1.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
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
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    await simulate(Math.max(1 / 30, Number(seconds) || 0));
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    await simulate(1 / 30);
  }
  await simulate(Number(params.get('after')) || 0);
}

runStartupSimulation().then(() => {
  clock.getDelta();
  ps1.renderer.setAnimationLoop(() => {
    step(Math.min(clock.getDelta(), 0.05));
    ps1.render(scene, camera);
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

  // The world only runs while playing; menus and the pause screen freeze it.
  if (state === 'playing') {
    dialogue.update(dt, input);
    player.update(dt, input, controlling);
    world.update(dt, player);
    cast.update(dt, player);
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
