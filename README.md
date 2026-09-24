# The Goob Infection

A first-person 3D browser game built with [Three.js](https://threejs.org/) (r170).

## Run

ES modules can't load from `file://`, so serve the folder locally:

```powershell
./serve.ps1
```

Then open http://localhost:8000. The server (`serve.py`) turns off browser caching, so a normal reload always runs the latest code.

## Layout

- `index.html`: page shell. The import map loads Three.js from the jsDelivr CDN, so there's no build step.
- `src/main.js`: bootstrap and game loop.
- `src/core/`: input, seeded random numbers.
- `src/render/`: PS1 renderer (low-res target, vertex snapping, dithering), procedural textures, materials.
- `src/world/`: building data (`building.js`), the builder that turns it into geometry, collision, doors, elevator, furniture, interactions.
- `src/player/`: first-person controller.
- `src/npc/`: blocky coworker model and animation, NPC behavior, and the cast (who's where and what they say).
- `src/goob/`: the goob spot network (`goobGraph.js`), blobs and spreading (`goobSystem.js`, tuning in `GOOB`), bins and the vacuum rack.
- `src/story/`: chapter state machines. `chapter1.js` runs the objectives, briefing, suit-up and goob pickup.
- `src/ui/`: HUD, dialogue box, fades and the suit visor.
- `GAME_DESIGN.md`, `PLAN.md`: design and implementation plan.

## Controls

WASD move, mouse look, E interact, Shift run, Space jump, Esc pause. With the vacuum: hold the left mouse button to suck up goob.

## Debugging

- `` ` `` (backquote) toggles a readout with FPS and position. While it's on:
  - `N` toggles noclip (Space/C to fly up/down).
  - `1` toggles PS1 vertex wobble (off by default, because it makes nearly-touching surfaces flicker).
  - `2` toggles dithering.
  - `G` removes all goob (to test the ending).
- URL options:
  - `?debug` starts with the readout on.
  - `?at=x,y,z,yaw,pitch` starts at a position (degrees; yaw 0 = facing south / -z).
  - `?stage=TO_LOCKERS`, `TO_FREEZER`, `GET_VACUUM` or `CLEANUP` skips ahead in the story (suit, spill aftermath and vacuum are set up for you).
  - `?goobspots` shows every spot goob can spread to, and logs how they connect.
  - `?sim=seconds` fast-forwards the game at load.
  - `?shot` skips the title screen.
  - `?nolock` acts as if the mouse is captured, and `?keys=KeyE:0,KeyW:2` taps E then holds W for 2 seconds after `?sim` (`?after=N` runs N more seconds). These are for automated testing in a headless browser.
  - `?checkfaces` logs static surfaces that overlap closely enough to flicker (`?checkfaces=desk` limits it to one material).

## Tuning the look

In `src/render/ps1.js`:
- `PS1_HEIGHT` sets the render resolution (240 is authentic PS1; currently 480).
- `VERTEX_SNAP_DEFAULT` turns the PS1 vertex wobble on at startup, and `VERTEX_JITTER` sets how strong it is.
- `COLOR_LEVELS` sets the color steps per channel (31 is authentic PS1; currently 63).

  Example: `http://localhost:8000/?debug&stage=TO_FREEZER&at=26,0,11.5,-90` starts suited up in the loading dock.
