# The Goob Infection

A first-person 3D browser game built with [Three.js](https://threejs.org/) (r170).

## Run

ES modules can't load from `file://`, so serve the folder locally:

```powershell
./serve.ps1
# or: python -m http.server 8000
```

Then open http://localhost:8000.

## Layout

- `index.html`: page shell. The import map loads Three.js from the jsDelivr CDN, so there's no build step.
- `src/main.js`: bootstrap and game loop.
- `src/core/`: input, seeded random numbers.
- `src/render/`: PS1 renderer (low-res target, vertex snapping, dithering), procedural textures, materials.
- `src/world/`: building data (`building.js`), the builder that turns it into geometry, collision, doors, elevator, furniture, interactions.
- `src/player/`: first-person controller.
- `src/ui/`: HUD.
- `GAME_DESIGN.md`, `PLAN.md`: design and implementation plan.

## Controls

WASD move, mouse look, E interact, Shift run, Space jump, Esc pause.

## Debugging

- `` ` `` (backquote) toggles a readout with FPS and position. While it's on, `N` toggles noclip (Space/C to fly up/down).
- URL options: `?debug` starts with the readout on, `?at=x,y,z,yaw` starts at a position (yaw in degrees, 0 = facing south / -z), `?shot` hides the title screen.
  Example: `http://localhost:8000/?debug&at=26,0,11.5,-90` starts in the loading dock facing the shutters.
