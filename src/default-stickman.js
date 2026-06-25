// ============================================================
// default-stickman.js
// A ready-made stickman character: each body part is a small SVG path
// (a rounded capsule shape) you can drag onto the canvas immediately,
// with no drawing required. Pieces are RIGID (not a deformable mesh) —
// this matches how Spine, Unity 2D Animation, and DragonBones rig by
// default: separate art pieces, each pinned to one bone, rather than
// one continuous mesh with skinning weights. Rigid pieces can't warp
// into each other, since there's no shared mesh for that to happen on.
//
// Each piece definition includes:
//   id          - matches a bone id in skeleton.js
//   length      - the piece's length along its bone direction (px)
//   width       - the piece's thickness
//   svgPath     - a capsule/rounded-rect path, drawn pointing "down"
//                 (+y) from (0,0) to (0,length), in the piece's own
//                 local space, with (0,0) as the pivot (attaches to
//                 the bone's fromJoint)
//   color       - fill color
// ============================================================

const DEFAULT_STICKMAN_PARTS = {
  torso: { length: 56, width: 14, color: '#2b2b2b' },
  head: { length: 0, width: 36, color: '#2b2b2b', isHead: true }, // head is a circle, not a capsule
  L_upperArm: { length: 30, width: 10, color: '#2b2b2b' },
  L_forearm: { length: 26, width: 9, color: '#2b2b2b' },
  R_upperArm: { length: 30, width: 10, color: '#2b2b2b' },
  R_forearm: { length: 26, width: 9, color: '#2b2b2b' },
  L_thigh: { length: 38, width: 12, color: '#2b2b2b' },
  L_shin: { length: 36, width: 10, color: '#2b2b2b' },
  R_thigh: { length: 38, width: 12, color: '#2b2b2b' },
  R_shin: { length: 36, width: 10, color: '#2b2b2b' },
};

// Builds a rounded-capsule SVG path string for a piece of the given
// length/width, running from (0,0) to (0,length) in local space.
function capsulePathString(length, width) {
  const r = width / 2;
  if (length <= 0) return ''; // head uses a circle instead, handled separately
  return [
    `M ${-r} ${r}`,
    `A ${r} ${r} 0 0 1 ${r} ${r}`,
    `L ${r} ${length - r}`,
    `A ${r} ${r} 0 0 1 ${-r} ${length - r}`,
    `Z`,
  ].join(' ');
}

// Returns a ready-to-use sprite definition object matching the same
// shape `serializeSprite()` would produce, so it can be loaded exactly
// like a saved/uploaded sprite, no special-casing needed elsewhere.
function buildDefaultStickmanSprite() {
  const parts = {};
  Object.keys(DEFAULT_STICKMAN_PARTS).forEach((boneId) => {
    const def = DEFAULT_STICKMAN_PARTS[boneId];
    parts[boneId] = {
      length: def.length,
      width: def.width,
      color: def.color,
      isHead: !!def.isHead,
      svgPath: def.isHead ? null : capsulePathString(def.length, def.width),
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
// the part lengths plus the skeleton's built-in rest angles, skipping
// the "click 13 joints" step entirely for this character.
function buildDefaultStickmanBindInfo() {
  const boneLength = {};
  Object.keys(DEFAULT_STICKMAN_PARTS).forEach((boneId) => {
    const def = DEFAULT_STICKMAN_PARTS[boneId];
    // The head "bone" still needs a nonzero length for FK purposes (the
    // neck-to-head distance), even though the head PIECE itself is a
    // circle drawn at that point, not a capsule along the bone.
    boneLength[boneId] = def.isHead ? 14 : def.length;
  });

  const restAnglesRelative = {
    torso: 0,
    head: 0,
    // Clean symmetric standing T-pose-ish stance: arms angled slightly
    // down and out from the shoulder, legs straight down. These are
    // INTENTIONALLY different from skeleton.js's generic restAngleDeg
    // defaults (100/-100/170/-170), which were tuned as a fallback for
    // arbitrary user-drawn rigs, not for what a clean default stance
    // should look like -- using those directly here swung the arms to
    // the wrong side and crossed them over the body.
    // Arms hang down at the sides, splayed slightly outward -- same
    // "180deg = opposite of torso's up direction" logic as the legs.
    L_upperArm: -165, L_forearm: -10,
    R_upperArm: 165, R_forearm: 10,
    // Leg angles are relative to the TORSO's direction (which itself
    // points "up", 0deg). To make legs hang DOWN from the hip, the
    // relative angle needs to be close to 180 degrees (the opposite of
    // up), not a small offset near 0 -- a small offset just continues
    // pointing up, the same direction as the spine/head.
    L_thigh: -172, L_shin: 0,
    R_thigh: 172, R_shin: 0,
  };

  return {
    boneLength,
    shoulderOffset: {
      L_shoulder: { along: 1.0, perp: -DEFAULT_STICKMAN_PARTS.torso.width / 2 - 2 },
      R_shoulder: { along: 1.0, perp: DEFAULT_STICKMAN_PARTS.torso.width / 2 + 2 },
    },
    restAnglesRelative,
    hipBindPos: { x: 0, y: 0 }, // caller positions this; see app.js loadBuiltInStickman()
  };
}
