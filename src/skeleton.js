// ============================================================
// skeleton.js
// Defines the fixed joint/bone graph shared by every sprite, plus
// joint labels and lookup helpers. No dependencies — load this first.
// ============================================================

// ---- skeleton.js ----
const SKELETON = {
  root: 'hip',
  bones: [
    { id: 'torso', parent: null, fromJoint: 'hip', toJoint: 'neck', restAngleDeg: 0 },
    { id: 'head', parent: 'torso', fromJoint: 'neck', toJoint: 'head', restAngleDeg: 0 },

    { id: 'L_upperArm', parent: 'torso', fromJoint: 'L_shoulder', toJoint: 'L_elbow', restAngleDeg: 100 },
    { id: 'L_forearm', parent: 'L_upperArm', fromJoint: 'L_elbow', toJoint: 'L_hand', restAngleDeg: 0 },

    { id: 'R_upperArm', parent: 'torso', fromJoint: 'R_shoulder', toJoint: 'R_elbow', restAngleDeg: -100 },
    { id: 'R_forearm', parent: 'R_upperArm', fromJoint: 'R_elbow', toJoint: 'R_hand', restAngleDeg: 0 },

    { id: 'L_thigh', parent: 'torso', fromJoint: 'hip', toJoint: 'L_knee', restAngleDeg: 170 },
    { id: 'L_shin', parent: 'L_thigh', fromJoint: 'L_knee', toJoint: 'L_foot', restAngleDeg: 0 },

    { id: 'R_thigh', parent: 'torso', fromJoint: 'hip', toJoint: 'R_knee', restAngleDeg: -170 },
    { id: 'R_shin', parent: 'R_thigh', fromJoint: 'R_knee', toJoint: 'R_foot', restAngleDeg: 0 },
  ],
  shoulderAttachment: ['L_shoulder', 'R_shoulder'],
};

const ALL_JOINTS = ['hip', 'neck', 'head', 'L_shoulder', 'L_elbow', 'L_hand', 'R_shoulder', 'R_elbow', 'R_hand', 'L_knee', 'L_foot', 'R_knee', 'R_foot'];
// Joints the user explicitly clicks during rigging. L_shoulder/R_shoulder
// ARE included here even though they're "derived" at pose time, because
// at RIG time we need their bind-pose position to compute the attachment
// offset (see rig.deriveBindInfo).
const RIGGABLE_JOINTS = ALL_JOINTS;

const JOINT_LABELS = {
  hip: 'Hip (root)', neck: 'Neck', head: 'Head',
  L_shoulder: 'Left shoulder', L_elbow: 'Left elbow', L_hand: 'Left hand',
  R_shoulder: 'Right shoulder', R_elbow: 'Right elbow', R_hand: 'Right hand',
  L_knee: 'Left knee', L_foot: 'Left foot',
  R_knee: 'Right knee', R_foot: 'Right foot',
};

function bonesById() {
  const map = {};
  SKELETON.bones.forEach((b) => { map[b.id] = b; });
  return map;
}
