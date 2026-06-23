# Sprite Mesh Studio

A browser-based tool for drawing a 2D character, rigging it with a skeleton, and posing it frame by frame — where the artwork itself bends smoothly with the skeleton, instead of splitting into rigid cardboard-cutout pieces.

## What changed from the cutout version

The first version of this tool cut each body part into its own rigid piece (a "paper doll" rig): pivoting an elbow just rotated a stiff forearm-shaped piece, and anything not captured inside a cutout shape disappeared entirely.

This version uses **mesh deformation** instead — the same underlying technique behind tools like Spine or DragonBones, simplified for this tool:

1. After placing joints, you trace **one continuous outline** around your whole character (not one shape per limb).
2. That outline gets filled with an invisible mesh of small triangles.
3. Every triangle is "weighted" toward the one or two nearest bones.
4. When you pose the skeleton, the whole mesh bends smoothly, and the original drawing is stretched along with it — nothing is cut apart, so nothing disappears.

## Setup

No build step, no dependencies. Open `index.html` in a browser, or host the whole folder (keep `src/` intact) somewhere like GitHub Pages.

```
sprite-mesh-studio/
├── index.html
├── style.css
└── src/
    ├── storage.js
    ├── skeleton.js
    ├── fk.js
    ├── rig.js
    ├── mesh.js
    ├── app.js
    ├── draw.js
    ├── rigging.js
    ├── pose.js
    ├── render.js
    ├── ui.js
    └── bootstrap.js
```

If uploading to GitHub: upload the whole folder structure as-is, keeping `style.css` next to `index.html` (not inside `src/`), and keeping every file in `src/` together.

## The four tabs

### 1. Draw

Same as before — pen tool or image upload, name your sprite, then move to Rig.

### 2. Rig

**Step A — Place joints.** Click on your drawing in the order the sidebar lists (hip, neck, head, shoulders, elbows, hands, knees, feet — 13 total).

**Step B — Trace one outline.** Once all joints are placed, click points all the way around your *entire* character — one continuous shape, like tracing its silhouette. This is different from the old per-limb lassos: you're outlining the whole body in one go.

- **Close outline & build mesh**: finalizes the outline and builds the triangle mesh.
- **Undo point** / **Clear**: adjust your outline before closing it.
- If a joint ends up outside your traced outline, you'll get a warning after building — the mesh still builds, but that area may not deform well. Retrace a slightly larger outline if that happens.

Once the mesh is built, click **Next: Pose →**.

### 3. Pose

Same as before: drag any joint to bend the skeleton there, and the drawing itself bends with it. Build keyframes on the timeline, adjust frame duration, type exact bone angles in the angle table if you prefer.

New: a **Show mesh wireframe** checkbox lets you see the triangle mesh overlaid on your character, which is useful for understanding why a particular area is or isn't deforming the way you expect.

Save your sprite and your movement the same way as before.

### 4. Library

Unchanged — browse saved sprites and movements, mix and match them (a movement made on one character works on any other character that shares the same skeleton), and load a combination into the Pose editor.

## Good to know

- Your saves live in this browser's local storage — they won't follow you to a different browser, computer, or private/incognito mode.
- A tighter-fitting outline around your character generally deforms better than a loose one with lots of empty space inside it.
- Thin parts (like fingers or a narrow tail) may need a smaller, more careful outline trace to deform well, since the mesh is built from your traced shape, not from the drawing's actual ink.
