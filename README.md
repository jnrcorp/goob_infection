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
- `src/render/`: the renderer (tone mapping and post effects: bloom, FXAA), quality presets (`quality.js`), procedural textures and materials.
- `src/world/`: building data (`building.js`), the builder that turns it into geometry, collision, doors, elevator, furniture, interactions.
- `src/player/`: first-person controller, the held vacuum and antidote sprayer.
- `src/npc/`: blocky coworker model and animation, NPC behavior, the cast (who's where and what they say), infected AI (`infectedBrain.js`, tuning in `INFECTED`) and pathfinding.
- `src/goob/`: the goob spot network (`goobGraph.js`), blobs and spreading (`goobSystem.js`, tuning in `GOOB`), bins and the vacuum rack.
- `src/story/`: chapter 1's story flow (`chapter1.js`), the spill cinematic, wheeling bins to the freezer, and the dark lore (`lore.js`: missing-person flyers, the collectible files, Victoria's confrontation and the two endings).
- `src/ui/`: HUD, dialogue box (with numbered choices), the file reader, fades and the suit visor.
- `GAME_DESIGN.md`, `PLAN.md`: design and implementation plan.

## Controls

The day starts at home: turn off your alarm, get ready (brush your teeth and shower, get dressed, make coffee and toast, then grab your keys, in that order), then drive to Goob Co. (W/S gas and brake, A/D steer, Space handbrake, E get in/out) and park in any space in the lot.

WASD move, mouse look, E interact, Shift run, Space jump, Esc pause. With the vacuum: hold the left mouse button to suck up goob; right-click to blast infected coworkers back. Pushing a bin: Q lets go. With the antidote: hold F to spray. J opens the files you've found (also on the pause screen); 1 and 2 pick an answer when a conversation offers a choice.

The title screen has Continue (the autosave), Difficulty and Volume. Goob spreads at a quarter speed on Easy, 60% on Normal and full speed on Hard (`goobSpread` in `src/core/settings.js`). On Easy and Normal the HUD shows, for B1, 1F, 2F, 3F and outside, how many liters of goob are left (during the cleanup) and how many coworkers are still infected (during the cure). Settings and the autosave are kept in the browser (`localStorage`).

## Debugging

- `` ` `` (backquote) toggles a readout with FPS and position. While it's on:
  - `N` toggles noclip (Space/C to fly up/down).
  - `V` cycles the graphics preset (Low / Medium / High), for comparing. It doesn't change your saved setting.
  - `G` removes all goob (to skip the cleanup).
  - `K` cures everyone (during the cure objective, to test the ending).
  - `R` (while pushing a biohazard bin) sends it straight to the secure freezer.
  - `I` toggles an infinite vacuum tank (it never fills, so you never have to empty it).
  - `M` skips the morning at home and the drive, straight to your desk.
  - `P` saves a checkpoint (and the autosave) right now, once the outbreak has started.
  - `L` marks every file as found (during the investigation, it sends Victoria to the boardroom).
- URL options:
  - `?debug` starts with the readout on.
  - `?at=x,y,z,yaw,pitch` starts at a position (degrees; yaw 0 = facing south / -z).
  - `?stage=` skips ahead in the story: `TO_LOCKERS`, `TO_FREEZER`, `GET_VACUUM`, `CLEANUP`, `SECURE`, `LOCK_FREEZER`, `GET_ANTIDOTE`, `CURE`, `INVESTIGATE`, `ESCAPE` (the lockdown after you expose Victoria) or `EPILOGUE` (the ending: arrest, coworkers, news and credits), or `INTRO` (at your desk, skipping the morning). Everything before that point is set up for you. Skipping ahead doesn't overwrite your autosave.
  - `?grab=N` starts you pushing biohazard bin N (with `?stage=SECURE`); `?binat=N,x,y,z` places bin N.
  - `?morning=chores` starts with the alarm off and the chores to do (stays where `?at=` puts you). `?morning=drive` skips the chores (you're standing by your car), `?morning=arrive` starts parked at work, and `?morning=office` starts just arrived on 2F. `?carat=x,z,heading` (with `?morning=drive`) puts you in your car there. `?look=yaw,pitch` turns the view (also in bed).
  - `?car=2` starts with the working elevator car on 2F (0 = B1, 1 = 1F, 3 = 3F).
  - `?callto=N` sends the elevator to floor N right away (0 = B1, 1 = 1F, 2 = 2F, 3 = 3F).
  - `?filecheck` logs whether each collectible file rests on something or is buried in furniture.
  - `?goobspots` shows every spot goob can spread to, and logs how they connect.
  - `?peaceful` makes infected coworkers' hits do nothing (they still chase you).
  - `?difficulty=hard` (or `easy`, `normal`) plays on that difficulty without changing your saved choice.
  - `?report=Hank` logs which doors are open, your suit integrity, goob volume by area, and where that coworker is after the simulation, plus who lands each hit.
  - `?finale=news` plays just the ending's news bulletin and credits.
  - `?npcat=Hank,x,y,z[,yaw]` places a coworker, facing yaw degrees (testing). Repeat it to place several; `?npcfreeze` keeps them still, and `?crowd=N,x,y,z` stacks N coworkers on one spot.
  - `?sim=seconds` fast-forwards the game at load.
  - `?shot` skips the title screen.
  - `?nolock` acts as if the mouse is captured, and `?keys=KeyE:0,KeyW:2` taps E then holds W for 2 seconds after `?sim` (`?after=N` runs N more seconds). These are for automated testing in a headless browser.
  - `?click=id1,id2` clicks menu buttons by id after the simulation (testing menus).
  - `?checkfaces` logs static surfaces that overlap closely enough to flicker (`?checkfaces=desk` limits it to one material).

  Combine options with `&`. Example: `http://localhost:8000/?debug&stage=TO_FREEZER&at=26,0,11.5,-90` starts suited up in the loading dock, facing the shutters.

## Tuning the look

Graphics presets (Low / Medium / High) are in `src/render/quality.js`: render scale, texture size, light count, shadows, bloom and anti-aliasing. The Graphics button on the title and pause screens picks one (Auto guesses from your GPU, and drops a level if play runs under 40 fps). `?quality=low` (or `medium`, `high`) forces one for this visit, and `?shadows=none` (or `sun`, `all`) overrides its sun shadows; headless tests should use `?quality=low`.

In `src/render/renderer.js`: `EXPOSURE` (overall brightness) and `BLOOM` (glow strength, and how bright something has to be to glow). All surfaces are matte (diffuse-only `MeshLambertMaterial`, no reflections); textures and bump maps are generated in `src/render/surfaces.js`.

Elsewhere:
- `SIZE` in `src/render/textures.js` sets texture resolution (currently 128; 64 is chunkier).
- `STRENGTH` and `FADE` in `src/render/shadows.js` set how dark and how wide the soft contact shadows under furniture are.
