// ============================================================
// rig.js
// Derives bindInfo (bone lengths, shoulder offsets, rest angles) from
// raw joint click positions captured during rigging. This logic is
// UNCHANGED from the v1 rigid-cutout tool (it was already correct and
// tested there) -- only the cutout-polygon helpers were dropped, since
// mesh.js now owns mesh/silhouette geometry instead.
// Depends on: skeleton.js.
// ============================================================

const RIG = (function () {
  function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  function deriveBindInfo(jointPositions) {
    const boneLength = {};
    const worldRestAngles = {};

    SKELETON.bones.forEach((bone) => {
      const from = jointPositions[bone.fromJoint];
      const to = jointPositions[bone.toJoint];
      if (!from || !to) {
        throw new Error(`rig.deriveBindInfo: missing joint position for bone "${bone.id}"`);
      }
      boneLength[bone.id] = dist(from, to);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      worldRestAngles[bone.id] = (Math.atan2(dx, -dy) * 180) / Math.PI;
    });

    const relRestAngles = {};
    SKELETON.bones.forEach((bone) => {
      const parentWorld = bone.parent ? worldRestAngles[bone.parent] : 0;
      relRestAngles[bone.id] = worldRestAngles[bone.id] - parentWorld;
    });

    const hip = jointPositions.hip;
    const torsoLen = boneLength.torso;
    const torsoWorldAngle = worldRestAngles.torso;

    function projectShoulder(jointName) {
      const p = jointPositions[jointName];
      if (!p) throw new Error(`rig.deriveBindInfo: missing joint position for "${jointName}"`);
      const vx = p.x - hip.x;
      const vy = p.y - hip.y;
      const rad = (torsoWorldAngle * Math.PI) / 180;
      const alongUnit = { x: Math.sin(rad), y: -Math.cos(rad) };
      const perpUnit = { x: Math.sin(rad + Math.PI / 2), y: -Math.cos(rad + Math.PI / 2) };
      const alongDist = vx * alongUnit.x + vy * alongUnit.y;
      const perpDist = vx * perpUnit.x + vy * perpUnit.y;
      return { along: torsoLen !== 0 ? alongDist / torsoLen : 0, perp: perpDist };
    }

    return {
      boneLength,
      shoulderOffset: {
        L_shoulder: projectShoulder('L_shoulder'),
        R_shoulder: projectShoulder('R_shoulder'),
      },
      restAnglesRelative: relRestAngles,
      hipBindPos: { x: hip.x, y: hip.y },
    };
  }

  return { deriveBindInfo };
})();
