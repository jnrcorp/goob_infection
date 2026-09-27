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
- `src/core/`: input, seeded random numbers, settings, autosave, and synthesized sound (`sound.js`).
- `src/render/`: PS1 renderer (low-res target, vertex snapping, dithering), procedural textures, materials.
- `src/world/`: building data (`building.js`), the builder that turns it into geometry, collision, doors, elevator, furniture, interactions.
- `src/player/`: first-person controller, the held vacuum and antidote sprayer.
- `src/npc/`: blocky coworker model and animation, NPC behavior, the cast (who's where and what they say), infected AI (`infectedBrain.js`, tuning in `INFECTED`) and pathfinding.
- `src/goob/`: the goob spot network (`goobGraph.js`), blobs and spreading (`goobSystem.js`, tuning in `GOOB`), bins and the vacuum rack.
- `src/story/`: chapter 1's story flow (`chapter1.js`), the spill cinematic, wheeling bins to the freezer, and the dark lore (`lore.js`: missing-person flyers, the collectible files, Victoria's confrontation and the two endings).
- `src/ui/`: HUD, dialogue box (with numbered choices), the file reader, fades and the suit visor.
- `GAME_DESIGN.md`, `PLAN.md`: design and implementation plan.

## Controls

WASD move, mouse look, E interact, Shift run, Space jump, Esc pause. With the vacuum: hold the left mouse button to suck up goob; right-click to blast infected coworkers back. Pushing a bin: R sends it straight to the secure freezer, Q lets go. With the antidote: hold F to spray. J opens the files you've found (also on the pause screen); 1 and 2 pick an answer when a conversation offers a choice.

The title screen has Continue (the autosave), Difficulty and Volume. On Easy and Normal the HUD shows how the remaining goob (during the cleanup) and the infected coworkers (during the cure) are split across B1, 1F, 2F, 3F and outside. Settings and the autosave are kept in the browser (`localStorage`).

## Debugging

- `` ` `` (backquote) toggles a readout with FPS and position. While it's on:
  - `N` toggles noclip (Space/C to fly up/down).
  - `1` toggles PS1 vertex wobble (off by default, because it makes nearly-touching surfaces flicker).
  - `2` toggles dithering.
  - `G` removes all goob (to skip the cleanup).
  - `K` cures everyone (during the cure objective, to test the ending).
  - `L` marks every file as found (during the investigation, it sends Victoria to the boardroom).
- URL options:
  - `?debug` starts with the readout on.
  - `?at=x,y,z,yaw,pitch` starts at a position (degrees; yaw 0 = facing south / -z).
  - `?stage=` skips ahead in the story: `TO_LOCKERS`, `TO_FREEZER`, `GET_VACUUM`, `CLEANUP`, `SECURE`, `LOCK_FREEZER`, `GET_ANTIDOTE`, `CURE` or `INVESTIGATE`. Everything before that point is set up for you. Skipping ahead doesn't overwrite your autosave.
  - `?grab=N` starts you pushing biohazard bin N (with `?stage=SECURE`); `?binat=N,x,y,z` places bin N.
  - `?car=1` starts with the working elevator car on 2F (0 = 1F).
  - `?filecheck` logs whether each collectible file rests on something or is buried in furniture.
  - `?goobspots` shows every spot goob can spread to, and logs how they connect.
  - `?peaceful` makes infected coworkers' hits do nothing (they still chase you).
  - `?difficulty=hard` (or `easy`, `normal`) plays on that difficulty without changing your saved choice.
  - `?report=Hank` logs which doors are open, your suit integrity, goob volume by area, and where that coworker is after the simulation, plus who lands each hit.
  - `?npcat=Hank,x,y,z` places a coworker (testing).
  - `?sim=seconds` fast-forwards the game at load.
  - `?shot` skips the title screen.
  - `?nolock` acts as if the mouse is captured, and `?keys=KeyE:0,KeyW:2` taps E then holds W for 2 seconds after `?sim` (`?after=N` runs N more seconds). These are for automated testing in a headless browser.
  - `?click=id1,id2` clicks menu buttons by id after the simulation (testing menus).
  - `?checkfaces` logs static surfaces that overlap closely enough to flicker (`?checkfaces=desk` limits it to one material).

  Combine options with `&`. Example: `http://localhost:8000/?debug&stage=TO_FREEZER&at=26,0,11.5,-90` starts suited up in the loading dock, facing the shutters.

## Tuning the look

In `src/render/ps1.js`:
- `PS1_HEIGHT` sets the render resolution (240 is authentic PS1; currently 960).
- `MSAA_SAMPLES` sets anti-aliasing (0 = off, 4 = on).
- `COLOR_LEVELS` sets the color steps per channel (31 is authentic PS1; 255 = full color). `DITHER_DEFAULT` turns the PS1 dither pattern on at startup.
- `VERTEX_SNAP_DEFAULT` turns the PS1 vertex wobble on at startup, and `VERTEX_JITTER` sets how strong it is.

Elsewhere:
- `SIZE` in `src/render/textures.js` sets texture resolution (currently 128; 64 is chunkier).
- `STRENGTH` and `FADE` in `src/render/shadows.js` set how dark and how wide the soft contact shadows under furniture are.
