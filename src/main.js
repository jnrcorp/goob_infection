import * as THREE from 'three';
import { PS1Renderer } from './render/ps1.js';
import { createMaterials } from './render/materials.js';
import { CollisionWorld } from './world/collision.js';
import { Interactions } from './world/interaction.js';
import { buildBuilding } from './world/buildBuilding.js';
import { Player } from './player/player.js';
import { Input } from './core/input.js';
import { Hud } from './ui/hud.js';

const canvas = document.getElementById('game');
const screens = {
  title: document.getElementById('title'),
  pause: document.getElementById('pause'),
  quit: document.getElementById('quit'),
};

const ps1 = new PS1Renderer(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#3a4150');
scene.fog = new THREE.Fog('#16181b', 10, 42);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 90);

const input = new Input(canvas);
const hud = new Hud();
const collision = new CollisionWorld();
const materials = createMaterials();
const interactions = new Interactions(camera, collision, hud);
const world = buildBuilding({ scene, collision, materials, interactions, hud });
const player = new Player(camera, collision);

// Debug tools: backquote (`) toggles the readout; N toggles noclip while it's on.
// URL options: ?debug shows the readout, ?at=x,y,z,yawDegrees starts somewhere else,
// ?shot hides the title screen (for screenshots).
const params = new URLSearchParams(location.search);
let debug = params.has('debug');
const at = params.get('at')?.split(',').map(Number);
if (at?.length >= 3 && at.every(Number.isFinite)) {
  player.spawn({ x: at[0], y: at[1], z: at[2], yaw: THREE.MathUtils.degToRad(at[3] ?? 0) });
} else {
  player.spawn(world.spawn);
}
// ---------- Menus ----------
// 'title' | 'playing' | 'paused' | 'quit'. Gameplay runs while the pointer is locked.
let state = 'title';

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  screens[name]?.querySelector('button')?.focus();
}

function startPlaying() {
  input.lock();
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

document.getElementById('menu-play').addEventListener('click', startPlaying);
document.getElementById('pause-resume').addEventListener('click', startPlaying);
document.getElementById('pause-title').addEventListener('click', () => {
  state = 'title';
  showScreen('title');
});
document.getElementById('menu-quit').addEventListener('click', () => {
  // Browsers only let scripts close tabs they opened, so fall back to a goodbye screen.
  window.close();
  state = 'quit';
  showScreen('quit');
});
document.getElementById('quit-back').addEventListener('click', () => {
  state = 'title';
  showScreen('title');
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

if (params.has('shot')) {
  state = 'playing';
  showScreen(null);
} else {
  showScreen('title');
}

function resize() {
  ps1.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let fps = 0;

ps1.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const active = input.locked;

  if (active && input.wasPressed('Backquote')) debug = !debug;
  if (active && debug && input.wasPressed('KeyN')) {
    player.noclip = !player.noclip;
    hud.toast(player.noclip ? 'Noclip on' : 'Noclip off', 1.5);
  }

  player.update(dt, input, active);
  world.update(dt, player);
  interactions.update(input, player, active);

  hud.setLocation(world.locationAt(player.pos));
  if (debug) {
    fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
    const p = player.pos;
    hud.setDebug(`${fps.toFixed(0)} fps · x ${p.x.toFixed(2)} y ${p.y.toFixed(2)} z ${p.z.toFixed(2)}${player.noclip ? ' · noclip' : ''}`);
  } else {
    hud.setDebug(null);
  }
  hud.update(dt);

  ps1.render(scene, camera);
  input.endFrame();
});
