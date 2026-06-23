// ============================================================
// fk.js
// Forward-kinematics solver: converts a pose (relative bone angles)
// into world-space joint positions. Depends on: skeleton.js.
// ============================================================

// ---- fk.js ----
const FK = (function () {
  function degToRad(d) { return (d * Math.PI) / 180; }
  function angleToVector(angleDeg, length) {
    const rad = degToRad(angleDeg);
    return { x: Math.sin(rad) * length, y: -Math.cos(rad) * length };
  }

  function solvePose(bindInfo, pose) {
    const joints = {};
    const boneWorldAngles = {};
    joints[SKELETON.root] = { x: pose.rootPos.x, y: pose.rootPos.y };

    SKELETON.bones.forEach((bone) => {
      const relAngle = (pose.boneAngles && pose.boneAngles[bone.id] != null)
        ? pose.boneAngles[bone.id]
        : bone.restAngleDeg;

      const parentWorldAngle = bone.parent ? boneWorldAngles[bone.parent] : 0;
      const worldAngle = parentWorldAngle + relAngle;
      boneWorldAngles[bone.id] = worldAngle;

      let fromPos;
      if ((bone.fromJoint === 'L_shoulder' || bone.fromJoint === 'R_shoulder') && !joints[bone.fromJoint]) {
        fromPos = resolveShoulder(bone.fromJoint, bindInfo, joints, boneWorldAngles);
        joints[bone.fromJoint] = fromPos;
      } else {
        fromPos = joints[bone.fromJoint];
      }

      if (!fromPos) {
        throw new Error(`FK solve error: fromJoint "${bone.fromJoint}" for bone "${bone.id}" was not resolved before use.`);
      }

      const length = bindInfo.boneLength[bone.id];
      if (length == null) {
        throw new Error(`FK solve error: missing bindInfo.boneLength for bone "${bone.id}"`);
      }

      const delta = angleToVector(worldAngle, length);
      joints[bone.toJoint] = { x: fromPos.x + delta.x, y: fromPos.y + delta.y };
    });

    return { joints, boneWorldAngles };
  }

  function resolveShoulder(shoulderJointName, bindInfo, joints, boneWorldAngles) {
    const torsoWorldAngle = boneWorldAngles['torso'] || 0;
    const hip = joints['hip'];
    const torsoLength = bindInfo.boneLength['torso'];
    const offset = bindInfo.shoulderOffset[shoulderJointName];
    if (!offset) {
      throw new Error(`FK solve error: missing bindInfo.shoulderOffset for "${shoulderJointName}"`);
    }
    const along = angleToVector(torsoWorldAngle, torsoLength * offset.along);
    const alongPoint = { x: hip.x + along.x, y: hip.y + along.y };
    const perp = angleToVector(torsoWorldAngle + 90, offset.perp);
    return { x: alongPoint.x + perp.x, y: alongPoint.y + perp.y };
  }

  return { solvePose, angleToVector, degToRad };
})();
