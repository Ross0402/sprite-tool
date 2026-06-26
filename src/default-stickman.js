// ============================================================
// default-stickman.js
// A ready-made stickman character: thick black line segments for
// limbs/torso and a bold round head, matching Pivot Animator's actual
// visual style. Sized to fill a good portion of the 480px stage,
// like Pivot's figures do, instead of a small thin sketch.
//
// Pieces are RIGID (not a deformable mesh) — matching how Spine,
// Unity 2D Animation, DragonBones, and Pivot all rig by default:
// separate pieces, each pinned to one bone, so nothing can warp into
// a part it isn't attached to.
//
// Each piece definition includes:
//   length     - the bone's length (px) — used for FK, not drawing
//                directly (segments are drawn joint-to-joint)
//   lineWidth  - stroke thickness for limb segments
//   color      - stroke/fill color
// ============================================================

const DEFAULT_STICKMAN_PARTS = {
  torso: { length: 110, lineWidth: 14, color: '#1a1a1a' },
  head: { radius: 38, color: '#1a1a1a', isHead: true },
  L_upperArm: { length: 60, lineWidth: 11, color: '#1a1a1a' },
  L_forearm: { length: 54, lineWidth: 10, color: '#1a1a1a' },
  R_upperArm: { length: 60, lineWidth: 11, color: '#1a1a1a' },
  R_forearm: { length: 54, lineWidth: 10, color: '#1a1a1a' },
  L_thigh: { length: 70, lineWidth: 13, color: '#1a1a1a' },
  L_shin: { length: 66, lineWidth: 11, color: '#1a1a1a' },
  R_thigh: { length: 70, lineWidth: 13, color: '#1a1a1a' },
  R_shin: { length: 66, lineWidth: 11, color: '#1a1a1a' },
};

// Returns a ready-to-use sprite definition object matching the same
// shape `serializeSprite()` would produce, so it can be loaded exactly
// like a saved/uploaded sprite, no special-casing needed elsewhere.
function buildDefaultStickmanSprite() {
  const parts = {};
  Object.keys(DEFAULT_STICKMAN_PARTS).forEach((boneId) => {
    const def = DEFAULT_STICKMAN_PARTS[boneId];
    parts[boneId] = {
      length: def.length || 0,
      lineWidth: def.lineWidth || 0,
      radius: def.radius || 0,
      color: def.color,
      isHead: !!def.isHead,
    };
  });
  return {
    id: null,
    name: 'Stickman',
    isBuiltIn: true,
    parts,
  };
}

// Since the default stickman's proportions are fixed and known (not
// derived from user clicks), its bindInfo can be built directly from
// the part lengths plus a clean standing-pose set of rest angles,
// skipping any manual rigging step entirely for this character.
function buildDefaultStickmanBindInfo() {
  const boneLength = {};
  Object.keys(DEFAULT_STICKMAN_PARTS).forEach((boneId) => {
    const def = DEFAULT_STICKMAN_PARTS[boneId];
    // The head "bone" still needs a nonzero length for FK purposes (the
    // neck-to-head distance), even though the head PIECE itself is
    // drawn as a circle at that point, not a line segment.
    boneLength[boneId] = def.isHead ? def.radius * 0.6 : def.length;
  });

  const restAnglesRelative = {
    torso: 0,
    head: 0,
    // Arms hang down at the sides, splayed slightly outward. Angles
    // are relative to the TORSO's own direction (0deg = up), so 180deg
    // = straight down, the opposite of the torso/head direction.
    L_upperArm: -170, L_forearm: -8,
    R_upperArm: 170, R_forearm: 8,
    // Legs hang straight down from the hip, slightly apart.
    L_thigh: -174, L_shin: 0,
    R_thigh: 174, R_shin: 0,
  };

  return {
    boneLength,
    // Arms attach close to the top of the torso line, with only a
    // small sideways offset -- Pivot's stick figures attach arms
    // almost directly on the torso line, not far out at true
    // shoulder-width.
    shoulderOffset: {
      L_shoulder: { along: 0.92, perp: -6 },
      R_shoulder: { along: 0.92, perp: 6 },
    },
    restAnglesRelative,
    hipBindPos: { x: 0, y: 0 }, // caller positions this; see app.js loadBuiltInStickman()
  };
}
