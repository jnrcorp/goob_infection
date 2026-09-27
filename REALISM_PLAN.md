# Realism plan: from PS1 to 1080p

The game started as a PS1-style throwback. It's more fun with a clean, modern look, so this plan moves it to realistic rendering designed for 1080p. The tone stays bright and a little comic; the horror stays in the writing.

## Decisions

| Question | Decision |
|---|---|
| Where textures come from | Still procedural (drawn in code, no downloaded assets), at much higher resolution, with normal and roughness maps. |
| Coworkers | Refined stylized people: rounded bodies, simple faces, hair, varied clothes and smoother animation. Not photoreal. |
| Hardware | 1080p at 60 fps on a mid-range desktop, and playable on integrated laptop GPUs using quality presets. |
| Mood | Bright and clean throughout: a believable, well-lit corporate office. |

## Where it is today

- **Renderer**: a custom `PS1Renderer` draws the scene to a fixed 960-line target, then upscales it. Vertex wobble and dithering exist but are off.
- **Materials**: flat `MeshLambertMaterial` with no normal or roughness maps. Lighting is one ambient light plus the 24 nearest point lights (`LightPool`). There are no real shadows, only baked contact shadows and blob shadows.
- **Textures**: about 30 procedural canvas textures at 128 px, mapped in world space.
- **Geometry**: box-built walls and furniture, merged per material. Everything has sharp edges and little trim.
- **People**: box heads, box limbs and flat colors.

## Rendering

- **Drop the PS1 pipeline.** Render at native resolution with a render-scale setting (50–100%). Output in sRGB with ACES filmic tone mapping. Delete `ps1ify`, the vertex snapping, dithering and color quantizing.
- **PBR materials.** Move to `MeshStandardMaterial` with albedo, normal and roughness maps (plus metalness for steel). Keep the world-space UVs, which already avoid stretching.
- **Environment reflections.** Build a `RoomEnvironment` PMREM map once, so steel, glass, screens and the goob pick up soft reflections.
- **Anti-aliasing.** Use MSAA on the main target at Medium and High, and FXAA at Low.
- **Post effects** (High, and some at Medium):
  - Ambient occlusion (GTAO or N8AO) grounds furniture and corners. It replaces most of the baked contact shadows.
  - Subtle bloom on light panels, screens, exit signs and the goob.
  - No film grain or chromatic aberration; the look stays clean.

### Quality presets

| | Low (integrated GPU) | Medium | High |
|---|---|---|---|
| Render scale | 67% | 85% | 100% |
| Texture size | 512 | 1024 | 1024 (2048 for floors and walls) |
| Normal maps | off | on | on |
| Dynamic lights | 8 nearest | 16 nearest | 24 nearest |
| Real-time shadows | none (contact and blob shadows) | sun (2048 map) | sun (4096 map) |
| Bloom | off | on | on |

The preset is picked automatically the first time from a short frame-time probe. It can be changed on the title screen and pause menu, and is saved in settings. Headless tests run with `?quality=low`.

## Textures (procedural v2)

- **Generator rewrite.** Each material is generated as a height field plus color. The normal map comes from the height via a Sobel filter, and roughness from the same noise. Use layered value/Perlin noise, cellular noise and domain warping instead of today's simple patterns.
- **Resolution** follows the quality preset (512/1024/2048). Generation runs in a Web Worker on `OffscreenCanvas`, so the page stays responsive. Results are cached in IndexedDB, keyed by a generator version, so only the first launch pays the cost.
- **Surfaces to redo**, in order of screen area:
  - Carpet: tile seams, fiber noise and slight color drift.
  - Ceiling: acoustic tiles with fissures and a T-bar grid.
  - Painted drywall: orange-peel normal and faint scuffs near the floor.
  - Linoleum and terrazzo.
  - Concrete: pores and stains.
  - Asphalt: aggregate and painted lines.
  - Wood grain for desks and doors.
  - Brushed steel, laminate, plastic, cardboard, fabric for chairs and cubicles, and rubber.
- **Anti-tiling.** Break up visible repeats on big surfaces with a second, larger-scale variation layer blended in the shader.
- **Signs, flyers, screens and nameplates** re-render at 4× their current canvas size, with a proper font.

## Geometry and architecture

- **Rounded edges.** Use `RoundedBoxGeometry` for furniture, counters, doors and props so edges catch light. Walls stay square but get trim.
- **Trim everywhere.** Baseboards, door frames and casings, window frames with mullions and sills, a T-bar ceiling grid with recessed 2×2 troffer lights, wall outlets, light switches, thermostats, fire alarms, sprinkler heads and exit signs.
- **Furniture pass:**
  - Office chairs: five-star base, casters and a padded seat.
  - Monitors: thin bezel and stand.
  - Desk gear: keyboards, mice, desk phones, mugs, papers, binders and potted plants with leaves.
  - Cubicle panels with fabric and aluminium edges.
- **Rooms with character.** The lobby gets a reception desk, logo wall and seating. The break room gets appliances and a vending-machine glow. The server room gets rack LEDs. The lab and vat room get equipment, pipes and tanks.
- **Outdoors.** A sky gradient or `Sky` shader with a fixed afternoon sun, grass and curbs, parking lines, and a building facade with windows and a roofline.
- Keep merging static geometry per material, so the draw-call count stays low as detail grows.

## Lighting

- **Ceiling lights** become recessed troffers: an emissive panel, plus the `LightPool` of the nearest real lights. Wall-washing comes from light placement rather than a flat ambient.
- **Ambient fill.** Replace the flat ambient with a `HemisphereLight` (cool ceiling, warm floor bounce), tuned per floor. B1 is dimmer and cooler; 3F is warmer and executive.
- **Daylight** through windows from a directional sun (shadowed at Medium and High). Where daylight hits, it lights the floor and furniture.
- **After the spill**, a few lights near the freezer flicker and the goob adds a green glow. It stays bright overall, so the tone doesn't shift to horror.
- Remove the fog, or keep it only very faint outdoors for distance.

## Coworkers (refined stylized)

- **Bodies.** Capsule and lathe-built torsos, arms and legs with a slight taper, rounded shoulders and hips, and mitten hands with a thumb. About 1.5–3k triangles per person; it's still one draw call per person, as now.
- **Heads.** A rounded head with a nose and ears. The face is a canvas texture with eyes, brows and a mouth that can blink and change expression (neutral, talking, dazed, infected).
- **Hair meshes** in a few styles (short, bob, ponytail, bald, curly), plus beards and glasses as options.
- **Clothes.** Shirt, blouse, sweater, blazer, tie, skirt or trousers and lanyard. Colors are driven by each coworker's existing `look` data, so the cast keeps their identities.
- **Animation.** Keep the procedural animation, but with easing, arm swing, head turns toward the player, a breathing idle, sitting and typing poses, a lurching shamble for the infected and a proper lunge.
- **Infected look.** Green-tinted skin with a subtle glow and wet goob patches on the clothes.

## Goob, tools and effects

- **Goob shader.** Glossy and wet, with a fresnel rim, a fake subsurface glow, animated normals so it slowly churns, and bloom. The blobs get smoother, higher-resolution shapes.
- **Viewmodels.** Rebuild the vacuum and antidote sprayer with PBR materials, beveled parts, a tank window showing the goob level, and a proper hazard-suit glove.
- **Effects.** Suction particles become soft sprites with a streak, and the antidote gets a fine mist. The visor overlay gets realistic scratches, an edge vignette and condensation.

## UI

- **Fonts.** Keep the goob-green accent, but move HUD and menu text from the retro pixel font (VT323) to a clean sans (Inter) for crisp 1080p text.
- **Screens.** The title screen keeps its green identity with sharper typography. Dialogue, reader and Files screens get finer borders and spacing.
- **Menus.** Add the quality preset and render-scale options to the title and pause menus.

## Milestones

Each milestone ends with the game fully playable.

1. **Renderer and presets.**
   - Native-resolution renderer, tone mapping, sRGB, PBR materials using the current textures, environment reflections.
   - Quality presets with auto-detect, and `?quality=`.
   - Delete the PS1 code.
2. **Texture generator v2.** Height, normal and roughness generation in a worker, IndexedDB cache, and the surface list above.
3. **Lighting pass.**
   - Troffers and T-bar ceilings, hemisphere fill per floor, sun and daylight through windows.
   - Shadows per preset, ambient occlusion, bloom.
   - Retire most baked contact shadows at Medium and High.
4. **Architecture and furniture detail.** Trim, rounded furniture, desk clutter, room-specific dressing and the outdoor facade.
5. **Coworkers v2.** New bodies, faces, hair, clothes and animation, with the infected look.
6. **Goob, tools, effects and UI polish.** Goob shader, viewmodels, particles, visor, fonts and menus.

After each milestone: a performance check at Low on an integrated-GPU-class setting (target 60 fps at Low, 1080p), plus a full-chapter headless run.

## Status (first pass of every milestone)

1. **Renderer and presets: done.** PS1 code removed. There's a Graphics button (Auto/Low/Medium/High) on the title and pause screens; Auto steps down under 40 fps. `?quality=` forces a preset.
2. **Textures: done**, generated on the GPU at load (instant, so no worker or cache needed). Roughness is packed into the color texture's alpha. Everything is capped at 1024 (no 2048).
3. **Lighting: mostly done.**
   - Done: troffers on the ceiling grid, per-area hemisphere fill, afternoon sun with shadows (Medium/High), a sky dome, flickering dock/freezer lights after the spill, and lights that fade at the edge of the pool.
   - Dropped: ceiling-light shadows (they jumped as lights were reassigned).
4. **Detail: partly done.**
   - Done: rounded furniture, new office chairs, monitors, keyboards, desk clutter, plants, sofas, door and window frames, facade panels, grass, curbs and cars.
   - Still to do: exit signs, sprinklers and outlets, room-specific dressing, and the roof parapet.
5. **Coworkers: done.** Rounded bodies, faces that blink and talk, hair styles, glasses, beards and infected goob patches.
6. **Polish: mostly done.**
   - Done: the goob shader (wet clear coat, rim glow, churning highlights), the vacuum and sprayer, the visor and the Inter font.
   - Still to do: the particle upgrade and the FOV setting.

- **Reflections: removed.** Glossy PBR highlights and environment reflections made rooms look washed out and flickered as lights changed over; every surface is matte (Lambert, with normal maps) instead.
- **Ambient occlusion: removed.** GTAO made blocky, shimmering dark patches under desks and tables. The soft contact shadows handle that at every preset.

## Risks

- **First-load time.** Generating 1024–2048 px maps for about 30 materials could take several seconds. The worker and cache handle repeat launches; the first launch shows a progress bar.
- **Integrated GPUs.** Point-light count and ambient occlusion are the main costs. The Low preset must stay well under budget.
- **Headless tests.** SwiftShader is slow with post effects on, so tests run at Low, with a few High screenshots for review.
- **Mixed styles mid-way.** Between milestones 1 and 5, some things (people especially) will look older than the rooms around them. The order above fixes the biggest surfaces first.

## Still open (defaults in brackets)

- **Field of view slider** in settings? [yes, 60–90°, default 75°]
- **Motion blur / depth of field?** [no; they hurt clarity and cost performance]
- **Keep an optional "Retro mode"** that re-enables the PS1 look? [no; dropping it keeps the code simpler]
- **Fixed afternoon sun, or time passes during the chapter?** [fixed afternoon]
