# Stickman Sprite Maker

A free, browser-based tool for posing a stickman, building simple animations frame by frame, and exporting a sprite sheet you can drop straight into a game engine (Unity, Godot, GameMaker, Phaser, or anything else that reads a standard sprite strip).

## Why this version is different

Earlier versions of this tool tried to let you draw your own character and have the artwork bend smoothly at each joint (like Spine or DragonBones do internally). That technique — called mesh deformation — turned out to have a real, hard-to-fully-eliminate problem: body parts that were merely drawn *close together* could warp into each other, because everything shared one connected mesh.

This version uses the same approach the actual industry-standard tools (Spine, Unity's 2D Animation package, DragonBones) use **by default**: every body part is its own separate, rigid piece — a head, an upper arm, a forearm, and so on — each pinned to exactly one bone. There's no shared mesh, so there's nothing for one body part to warp into. Moving the right hand can **never** move the head or the left foot, structurally, not just "usually."

The trade-off: the stickman's body parts are simple solid shapes (rounded capsules), not your own hand-drawn artwork. A built-in stickman is included so you can start animating immediately with no drawing step at all.

## Setup

No build step, no dependencies. Open `index.html` in a browser, or host the folder (keep `src/` intact) on something like GitHub Pages.

```
stickman-sprite-maker/
├── index.html
├── style.css
└── src/
    ├── storage.js
    ├── skeleton.js
    ├── fk.js
    ├── default-stickman.js
    ├── app.js
    ├── input.js
    ├── pose.js
    ├── render.js
    ├── export.js
    ├── ui.js
    └── bootstrap.js
```

If uploading to GitHub: upload the whole folder as-is, keeping `style.css` next to `index.html` and the `src/` folder intact.

## How to use it

The stickman is already loaded and ready when the page opens — no setup needed.

### Pose tab

- **Drag any joint** on the canvas to bend that part of the body. Dragging the hip moves the whole figure.
- The timeline strip at the bottom holds your frames. Click **+** to add a new frame (it starts as a copy of the current one — only change what's different).
- Click a thumbnail to jump back and edit that frame. Click its **×** to delete it.
- **Duration (ms)** controls how long that frame holds in the animation.
- **Show angle table** lets you type exact bone angles instead of dragging, if you want precision.
- **Save sprite** / **Save movement** store your work in this browser for later. A saved movement can be replayed on any sprite that shares the same skeleton.
- **Reset to default stickman** discards changes and brings back the built-in character.

### Library tab

Browse sprites and movements you've saved. Pick one of each and click **Load into Pose editor** to bring them in together.

### Export tab

- **Frame size (px)** sets how big each frame is in the exported sheet.
- **Download sprite sheet (PNG)** exports your current movement as a single strip image — one square cell per frame, left to right, transparent background. This is the standard layout most game engines expect; you'll tell your engine the frame size and frame count when importing it.
- **Download animated GIF preview** gives you a quick way to see the animation outside the tool (e.g. to drop into a chat or doc) — it's a preview format, not what you'd import into a game engine.

## Good to know

- Saves live in this browser's local storage — they won't follow you to a different browser, computer, or private/incognito mode.
- The built-in stickman's proportions are fixed. If you want a visually different character later, the file `src/default-stickman.js` is where each body part's size/shape is defined — straightforward to tweak by hand if you're comfortable editing the SVG path values.
