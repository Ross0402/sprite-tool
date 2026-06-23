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

  // ---------------------------------------------------------
  // BONE TRANSFORMS (for mesh skinning)
  // Packages each bone's world position (its fromJoint) + world
  // rotation into a 2D rigid transform with helpers to convert a point
  // into that bone's local space, or back out to world space. Used by
  // mesh.js to skin vertices: a vertex's bind-pose world position is
  // converted to LOCAL space via the bone's BIND transform, then back
  // to world space via the bone's CURRENT transform — this is what
  // makes the vertex "ride along" with the bone as if rigidly attached,
  // without ever needing to cut the drawing into separate pieces.
  // ---------------------------------------------------------
  function makeTransform(position, rotationDeg) {
    const rad = degToRad(rotationDeg);
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return {
      position, rotationDeg,
      // World point -> this transform's local space (inverse rotate+translate)
      toLocal(worldPoint) {
        const dx = worldPoint.x - position.x;
        const dy = worldPoint.y - position.y;
        return {
          x: cos * dx + sin * dy,
          y: -sin * dx + cos * dy,
        };
      },
      // Local point -> world space (rotate+translate)
      fromLocal(localPoint) {
        return {
          x: position.x + cos * localPoint.x - sin * localPoint.y,
          y: position.y + sin * localPoint.x + cos * localPoint.y,
        };
      },
    };
  }

  function boneTransforms(bindInfo, pose) {
    const solved = solvePose(bindInfo, pose);
    const transforms = {};
    SKELETON.bones.forEach((bone) => {
      const pos = solved.joints[bone.fromJoint];
      const angle = solved.boneWorldAngles[bone.id];
      transforms[bone.id] = makeTransform(pos, angle);
    });
    return { transforms, solved };
  }

  return { solvePose, angleToVector, degToRad, makeTransform, boneTransforms };
})();
