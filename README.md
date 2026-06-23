# Sprite Rig Studio

A browser-based tool for drawing a 2D character, rigging it with a skeleton, posing it frame by frame, and saving reusable movements that can be applied to any character you rig.

## Setup

No build step, no dependencies. Just open `index.html` in a browser, or host the whole folder (keep `src/` intact) on something like GitHub Pages.

```
sprite-rig-studio/
├── index.html
├── style.css
└── src/
    ├── storage.js
    ├── skeleton.js
    ├── fk.js
    ├── rig.js
    ├── app.js
    ├── draw.js
    ├── rigging.js
    ├── pose.js
    ├── render.js
    ├── ui.js
    └── bootstrap.js
```

If you're uploading to GitHub: upload the whole folder structure as-is. The script files load in a specific order and depend on each other, and `style.css` must stay a sibling of `index.html` (not inside `src/`) or the page will load unstyled.

## The four tabs

Work through these in order the first time. Once a sprite is rigged, the **Rig** and **Pose** tabs unlock.

### 1. Draw

Create your character.

- **Pen tool**: click and drag on the canvas to draw freehand. Pick a brush color and size from the sidebar.
- **Upload image**: click "Upload image" to bring in a reference image instead of (or underneath) your drawing.
- **Clear canvas**: wipes the drawing and resets rigging, in case you want to start over.
- Give your sprite a name in the sidebar — this is what you'll find it under later in the Library.

When you're happy with the drawing, click **Next: Place joints →**.

### 2. Rig

This has two steps: placing joints, then cutting out body parts.

**Step A — Place joints**
Click directly on your drawing to place each joint, in the order the sidebar lists them (hip first, then neck, head, shoulders, elbows, hands, knees, feet — 13 in total). The sidebar always tells you which joint comes next. Click roughly where that part of the body is in your drawing.

- **Undo last**: removes the most recently placed joint so you can reposition it.
- **Restart rig**: clears every joint and starts over.

**Step B — Cut out body parts**
Once all 13 joints are placed, the sidebar walks you through each body part (torso, head, upper arm, forearm, thigh, shin, etc. — 10 in total). For each one:

1. Click points around the canvas to trace a rough outline (a lasso) around that part of your drawing.
2. Click **Close shape & cut out** to confirm it.
3. Move on to the next part.

This is what turns your flat drawing into something that can actually bend and rotate — each cutout becomes its own movable piece, pinned at its joint.

- **Undo**: clears your in-progress lasso, or removes the last completed cutout if you haven't started a new one.

Once every part has a cutout, click **Next: Pose →**.

### 3. Pose

This is where you build a movement out of keyframes.

- **Drag any joint** on the canvas to bend the limb around it. Dragging the hip moves the entire character.
- Each "frame" in the timeline strip (bottom of the screen) is one pose. Click **+** to add a new frame — it starts as a copy of the current one, so you only need to adjust what's changing.
- Click any thumbnail in the timeline to jump back to that frame and edit it. Click the **×** on a thumbnail to delete that frame (you always need at least one frame left).
- **Duration (ms)** controls how long that frame holds before moving to the next one.
- **Root position** lets you type exact hip coordinates instead of dragging.
- **Show angle table** reveals a raw numeric table of every bone's angle for that frame, if you'd rather type exact numbers than drag.
- Name your movement (e.g. "walk," "wave," "punch") in the sidebar.

When it feels right, save your work:

- **Save sprite** — stores this drawing + rig in your browser so you can reuse it later.
- **Save movement** — stores the sequence of frames you just built. Movements are saved independently of any one sprite, since they only store joint angles, not positions tied to a specific drawing.

### 4. Library

Browse everything you've saved.

- Click a saved **sprite** card and a saved **movement** card (you can mix and match — a movement made on one character works on any other character rigged with the same joint structure).
- Click **Load into Pose editor** to bring both into the Pose tab together.
- **Refresh** re-reads your saved library in case something seems out of date.

## Good to know

- Your saves live in this browser's local storage — they won't show up on a different browser, computer, or in private/incognito mode, and clearing your browser data will erase them.
- There's no "undo" once you save — saving overwrites a previous sprite/movement only if you reuse the same name and it was already saved in that session. Otherwise each save creates a new entry.
- A movement is portable across sprites because it stores bone *angles*, not positions — so as long a sprite has all 10 cutouts done, any saved movement will animate it correctly, even if the original drawing was a totally different shape.
