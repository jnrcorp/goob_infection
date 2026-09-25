# The Goob Infection: Chapter 1 Implementation Plan

Based on `GAME_DESIGN.md` and the design Q&A. Chapter 2 is out of scope.

## Decisions so far

| Topic | Decision |
|---|---|
| Look | Retro PS1 style: low-res render, wobbly vertices, dithering, heavy fog |
| Assets | Built in code from primitives and procedural textures (glTF can replace them later) |
| Objectives | Boss NPC walks over and briefs you, then an on-screen objective line |
| Building | 2F open-plan office, stairs + elevator, 1F locker room, loading dock + freezer, break room, bathrooms |
| Spill cinematic | Stays in first person: slow motion, camera shake, you watch coworkers turn |
| Spread area | Whole building. Goob starts on 1F and creeps up the stairs and elevator shaft |
| Spread rule | Each uncleaned puddle keeps growing and budding. Anything you vacuum is gone for good |
| Spread failure | None. More spread just means more to clean and a harder level |
| Hiding spots | Vents, under desks, ceilings, bathroom stalls, elevator shaft, and so on |
| Vacuum | Suck mode collects goob into a limited tank. Blow mode knocks back and stuns infected coworkers |
| Tank | Empty it at biohazard containment bins on each floor. The freezer is for the final step |
| HUD | Objective, suit integrity %, tank fill, % of goob cleaned |
| Infected | Hostile and chase you. Hits lower suit integrity; at 0% you're infected (game over) |
| Chapter end | All goob collected and secured in the freezer. Coworkers stay infected (hook for chapter 2) |
| Saving | Autosave to browser storage |

## Chapter 1 flow

The game runs as a state machine. Each state sets the objective text and turns triggers on or off.

1. **AT_DESK**: start seated at your desk on 2F. Free to look around and walk.
2. **BOSS_BRIEFING**: the boss walks up and gives a dialogue box speech about delivering the goob to Mars.
3. **GO_TO_LOCKERS**: objective "Suit up in the 1F locker room". Use the stairs or elevator.
4. **SUIT_UP**: interact with your locker. A short fade plays and the suit overlay appears (visor frame and breathing sound).
5. **GET_GOOB**: go to the loading dock and open the secure freezer (keycard or keypad interaction).
6. **SPILL**: picking up the goob starts the first-person cinematic. Input locks, time slows, the canister slips and splatters, the camera turns toward coworkers as they get infected, then time returns to normal. It's skippable after the first viewing.
7. **CLEANUP**: goob spreads, infected coworkers hunt you, you vacuum and dump the tank at bins. The HUD shows % cleaned.
8. **SECURE**: when the building has no goob left, objective "Secure the goob in the freezer". Walk to the freezer and deposit.
9. **CHAPTER_END**: the freezer locks, infected coworkers moan in the distance, and a "Chapter 1 complete" card appears.

The game autosaves on each state change and every time you empty the tank.

## Systems

### Rendering (PS1 look)
- Render at about 320×240 to a render target, then upscale with nearest-neighbor filtering.
- Snap vertices to a low-precision screen grid (shader patch via `onBeforeCompile`).
- Nearest-filtered 64×64 procedural textures (carpet, ceiling tiles, concrete, linoleum), plus a dither and color-depth reduction pass.
- Short fog distance to hide draw distance and add dread.

### World
- The building is defined as **data**: floors, rooms (rectangles), doors, stairs and elevator. A builder turns that data into walls, floors, ceilings and furniture.
- Collision uses axis-aligned boxes (the same approach as the current `main.js`, extended). Stairs are ramps.
- Elevator: a call button, a moving car and doors. After the spill it jams halfway and becomes a goob hiding spot, so the stairs are the only way up.
- Interactables share one system: look at an object, a prompt appears, press `E`. This covers doors, locker, freezer, bins, vent grates and elevator buttons.

### Goob
- Each goob **blob** has a position, a surface (floor, wall, ceiling or vent) and a volume.
- Each tick, uncleaned blobs grow. Above a size threshold they **bud** a child onto a nearby valid surface point. Pre-placed **hiding-spot anchors** (vents, under desks, ceiling, stalls, shaft) let goob spread into places you have to search.
- Vacuuming shrinks the blob in the cone in front of you and moves its volume into the tank. Removed blobs never come back.
- A hard cap on total blobs (about 300) keeps performance steady. Blobs render as one instanced mesh of glossy green shapes that wobble.
- Progress = collected ÷ (collected + remaining). This can drop while goob spreads, which is intentional.

### Vacuum
- Left mouse button sucks in a short cone. It pulls blobs in and fills the tank.
- Right mouse button blows. It knocks back and stuns infected coworkers for about 3 seconds, and costs a little tank goob or has a cooldown.
- When the tank is full, suction stops. The HUD pulses and you head to a biohazard bin (at least 2 per floor).

### Coworkers and infected
- Before the spill, coworkers idle at their desks, in the break room and in bathrooms, with simple wander animations.
- After the spill, most turn infected: green tint, lurching walk and moans.
- Infected AI states are wander → notice (sight cone or noise) → chase → attack → stunned.
- Pathfinding uses A* over a walkable grid per floor, with stair links between floors.
- Each hit reduces suit integrity by about 15%. Duct-tape pickups repair it. At 0% the suit is breached and the game reloads the last autosave.

### UI
- Objective line, dialogue box, interaction prompt, suit %, tank bar, % cleaned, visor frame when suited.
- Menus: title screen, pause, game over, chapter complete.
  - Title screen (from `GAME_DESIGN_2.MD`): solid green, with **Play Chapter 1: The Infection** and **Quit** in the middle. Built in milestone 1, along with the pause screen.

### Audio
- WebAudio sound synthesized in code for now: office hum, vacuum whine, goob squelch, moans, breathing in the suit, and bin clunk.

### Saving
- `localStorage` stores the story state, player position, suit %, tank, surviving goob blobs, and infected positions.
- Title screen offers "Continue" and "New game".

## File layout

```
src/
  main.js              bootstrap and game loop
  core/                input, audio, save, event bus
  render/              PS1 post-process, vertex snapping, procedural textures
  world/               building data, builder, collision, doors, elevator, interactables
  player/              controller, suit, vacuum
  goob/                blob system, spreading, hiding spots, bins, freezer
  npc/                 coworker, infected AI, boss, pathfinding
  story/               chapter 1 state machine, dialogue, spill cinematic
  ui/                  HUD, dialogue box, menus
```

## Milestones

Each milestone ends in something you can play.

1. ✅ **Building greybox**: PS1 renderer, both floors built from data, collision, stairs, working elevator, doors. You can walk the whole building.
2. ✅ **Pre-spill story**: interaction system, coworkers idling, boss briefing, objectives, locker suit-up, freezer. Playable from the desk to picking up the goob.
   - Manager: **Dale**, cheerfully oblivious. 17 coworkers across both floors, each with a couple of lines.
   - The freezer door stays locked until you're wearing the hazard suit.
   - Picking up the goob currently ends on a "To be continued" card.
3. ✅ **Spill + goob**: slow-motion cinematic, goob blobs, spreading and hiding spots, vacuum suck, tank, bins, HUD progress.
   - Hank waits outside the freezer and is the first to be infected; everyone else turns right after.
   - The goob gets into 14 floor vents; 6 random ones start with goob. It also hides on ceilings and under desks.
   - Goob never spreads through walls, and a shut door stops it spreading between rooms (closing doors is a way to contain it). Blobs are drawn no bigger than the space around them.
   - The elevator jams on 1F with goob inside, so the stairs are the only way up.
   - The vacuum hangs beside the freezer door. Tank: 30 L. Four biohazard bins, two per floor.
   - Coworkers turn green and shamble around (not hostile yet: that's milestone 4).
   - Cleaning up everything ends on a "Goob contained" card for now.
4. ✅ **Infected**: infection transformation, chase AI and pathfinding, suit damage, blow mode, duct tape, game over.
   - Infected notice you by sight (14 m, in front of them), by hearing you run or use the vacuum nearby, or when you're right next to them.
   - They chase at 2.3 m/s (you walk 3.4, run 5.6) and path around walls and up/down the stairs.
   - Difficulty (title screen, remembered): on **Normal** infected can't open doors, so a shut door stops them; on **Hard** they shove doors open.
   - At most two lunge at once. Each hit costs 10% suit integrity. They're dazed for a few seconds after the spill.
   - Right mouse blasts them back and stuns them for 3 seconds.
   - 10 rolls of duct tape around the building each patch 35%.
   - Suit breached at 0%: retry from the last checkpoint (after the spill, when you take the vacuum, each time you empty the tank). Checkpoints are in memory until milestone 5 saves them.
5. ✅ **Finish chapter 1**: secure-in-freezer ending, cure the infected, autosave and continue, audio. (Tuning still waits on a playtest.)
   0. **Conference room** (2F, northwest corner, across a short hallway from the stairwell door) with a window onto the office: another room to shut infected coworkers in. Replaces two cubicle pods.
   1. **Bigger building**: a one-story annex off the west end of the 1F corridor holds the new **Storage** room. The old storage room (1F, beside the elevator) becomes the **Infirmary**: beds, a medicine cabinet, and the antidote rack.
   2. **Secure the goob**: when the building is clean, the elevator is repaired. Wheel all four biohazard bins into the secure freezer (grab with E, push them along, slower while pushing; the 2F bins come down in the elevator). Then lock the freezer.
   3. **Dale calls**: over the intercom, infected but still managerial. Everyone is still goob. There's antidote in the new infirmary.
   4. **Cure everyone**: the antidote sprayer clips onto the vacuum. Hold **F** to spray; about 1.5 s of spray cures a coworker. The blast (right mouse) still stuns, so stun, then spray. Cured coworkers turn back to normal, are dazed for a moment, then are friendly again (with new lines).
   5. **Chapter end**: when all 18 (Dale included) are cured, Dale thanks you (sort of) and the "Chapter 1 complete" card appears.
   6. **Saving**: autosave to the browser at each story step, each tank emptied, each bin loaded and each cure. The title screen shows **Continue** when there's a save.
   7. **Sound**: all synthesized: office hum, vacuum suck and blast, antidote spray, goob squelch, moans, suit breathing, footsteps, doors, bins, elevator, UI blips; volume setting on the title screen.
   8. **Tuning** from playtesting.

## Still open (answer any time; defaults in brackets)

- ~~Player name and company name~~: you're **Champ** (what Dale calls you), at Goob Co. Every desk has a nameplate; yours is gold, with a trophy.
- **Boss personality and lines**: stern, clueless, or overly cheerful? [cheerfully oblivious middle manager]
- **How many coworkers**? [about 12 across both floors]
- **Target chapter length**? [15–25 minutes]
- **Is the Mars delivery shown**, for example a rocket at the loading dock? [only mentioned in dialogue for now]
- **What does goob do besides infect**: sound, glow, does it move toward you? [squelches and wobbles; it doesn't move except by spreading]
- **Difficulty**: fixed, or settings for spread speed and infected speed? [fixed, tuned during milestone 5]
